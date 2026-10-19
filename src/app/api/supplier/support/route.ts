import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET  /api/supplier/support — REAL sellerSupportTickets for the signed-in
 *                          supplier with real message counts (honest empty).
 * POST /api/supplier/support — create a real support ticket row
 *                          (status 'open'), audit-logged. Replaces the old
 *                          fake body-echo POST.
 */

const TICKET_CATEGORIES = ['account', 'orders', 'payments', 'products', 'technical', 'other'] as const
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

const createTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(150),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(4000),
  priority: z.enum(TICKET_PRIORITIES).default('medium'),
})

export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-support-get', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    // Task 76: the responder half — admins see EVERY seller thread (with the
    // filer's identity); a seller keeps their own. Admins have no supplier
    // profile, so the old unconditional profile resolution 403'd them.
    const isAdmin = auth.user.userType === 'admin'
    let supplierId: string | null = null
    if (!isAdmin) {
      const profile = await resolveSupplierProfile(auth.user)
      if (!profile) {
        return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
      }
      supplierId = profile.id
    }

    const status = request.nextUrl.searchParams.get('status')

    const tickets = await db.sellerSupportTickets.findMany({
      where: {
        ...(isAdmin ? {} : { supplierId: supplierId! }),
        ...(status ? { status } : {}),
      },
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { message: true, createdAt: true, senderRole: true },
        },
        supplier: { select: { id: true, companyName: true, user: { select: { email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      success: true,
      data: tickets.map((t) => ({
        id: t.id,
        category: t.category,
        subject: t.subject,
        description: t.description,
        priority: t.priority,
        status: t.status,
        resolvedAt: t.resolvedAt,
        createdAt: t.createdAt,
        messageCount: t._count.messages,
        lastMessage: t.messages[0] || null,
        ...(isAdmin
          ? { supplier: { id: t.supplier?.id, companyName: t.supplier?.companyName, email: t.supplier?.user?.email } }
          : {}),
      })),
    })
  } catch (error) {
    console.error('Supplier support GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-support-post', 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const parsed = createTicketSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid ticket payload' },
        { status: 400 }
      )
    }
    const body = parsed.data

    const ticket = await db.sellerSupportTickets.create({
      data: {
        supplierId: profile.id,
        category: body.category,
        subject: body.subject,
        description: body.description,
        priority: body.priority,
        status: 'open',
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_support_ticket_created',
        entityType: 'sellerSupportTickets',
        entityId: ticket.id,
        metadata: JSON.stringify({ supplierId: profile.id, category: ticket.category, priority: ticket.priority }),
      },
    })

    return NextResponse.json({ success: true, data: ticket }, { status: 201 })
  } catch (error) {
    console.error('Supplier support POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
