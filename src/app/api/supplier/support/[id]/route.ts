import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { sendNotification } from '@/lib/notifications'

/** Task 76: admin status transitions on seller threads. */
const patchSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserType(request, ['admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'supplier-support-patch', 30, 60000)

    if (!rl.ok) return rateLimitResponse(rl)


    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid status' }, { status: 400 })
    }

    const { id } = await params
    const ticket = await db.sellerSupportTickets.findUnique({
      where: { id },
      include: { supplier: { select: { userId: true } } },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const updated = await db.sellerSupportTickets.update({
      where: { id },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === 'resolved' ? { resolvedAt: new Date() } : {}),
      },
    })

    // The seller learns the thread state changed (real row, deep-linkable).
    void sendNotification({
      userId: ticket.supplier.userId,
      type: 'system',
      title: `Ticket ${parsed.data.status === 'resolved' ? 'Resolved' : 'Updated'}: ${ticket.subject}`,
      body: `Your support ticket "${ticket.subject}" is now ${parsed.data.status.replace('_', ' ')}.`,
      relatedEntityId: id,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Support ticket PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    // Task 76: admins open ANY seller thread; sellers only their own.
    const isAdmin = auth.user.userType === 'admin'
    let supplierId: string | null = null
    if (!isAdmin) {
      const profile = await resolveSupplierProfile(auth.user)
      if (!profile) {
        return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
      }
      supplierId = profile.id
    }

    const { id } = await params
    const ticket = await db.sellerSupportTickets.findFirst({
      where: isAdmin ? { id } : { id, supplierId: supplierId! },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        supplier: { select: { companyName: true, user: { select: { email: true } } } },
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

    const parsed = messageSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid message' },
        { status: 400 }
      )
    }

    // Task 76: admins reply on ANY seller thread (senderRole 'admin' + the
    // seller gets a real notification); sellers only on their own.
    const isAdmin = auth.user.userType === 'admin'
    let supplierId: string | null = null
    if (!isAdmin) {
      const profile = await resolveSupplierProfile(auth.user)
      if (!profile) {
        return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
      }
      supplierId = profile.id
    }

    const { id } = await params
    const ticket = await db.sellerSupportTickets.findFirst({
      where: isAdmin ? { id } : { id, supplierId: supplierId! },
      include: { supplier: { select: { userId: true } } },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const newMsg = await db.sellerSupportMessages.create({
      data: {
        ticketId: id,
        senderId: auth.user.id,
        senderRole: isAdmin ? 'admin' : 'supplier',
        message: parsed.data.message,
      },
    })

    if (isAdmin) {
      // Task 76: the reply notifies the SELLER (real row — bell + list) and
      // the thread moves to in_progress.
      await db.sellerSupportTickets.update({
        where: { id },
        data: { status: ticket.status === 'resolved' || ticket.status === 'closed' ? 'open' : 'in_progress' },
      })
      void sendNotification({
        userId: ticket.supplier.userId,
        type: 'system',
        title: `Support replied: ${ticket.subject}`,
        body: parsed.data.message.slice(0, 300),
        relatedEntityId: id,
      })
    }

    return NextResponse.json({ success: true, data: newMsg, message: 'Message sent' }, { status: 201 })
  } catch (error) {
    console.error('Support message POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
