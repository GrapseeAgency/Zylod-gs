import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/* Ownership scoping (Task 50-b): every method resolves the session's
 * supplierProfile and only touches tickets where supplierId matches. A
 * foreign or unknown id gets the same 404 — no existence leak. */

const messageSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty').max(4000),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const { id } = await params
    const ticket = await db.sellerSupportTickets.findFirst({
      where: { id, supplierId: profile.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        supplier: { select: { companyName: true } },
      },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: ticket })
  } catch (error) {
    console.error('Support ticket GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rl = checkRateLimit(request, 'supplier-support-message', 30, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const parsed = messageSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid message' },
        { status: 400 }
      )
    }

    const { id } = await params
    const ticket = await db.sellerSupportTickets.findFirst({
      where: { id, supplierId: profile.id },
      select: { id: true },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const newMsg = await db.sellerSupportMessages.create({
      data: {
        ticketId: id,
        senderId: auth.user.id,
        senderRole: 'supplier',
        message: parsed.data.message,
      },
    })

    return NextResponse.json({ success: true, data: newMsg, message: 'Message sent' }, { status: 201 })
  } catch (error) {
    console.error('Support message POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
