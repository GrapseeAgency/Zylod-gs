import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/support/tickets/[id] — get a ticket and its messages
 * PATCH /api/support/tickets/[id] — update status or close ticket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Task 75: admins can open ANY thread (the responder half); buyers only
    // their own. Not-yours stays a no-leak 404.
    const isAdmin = auth.user.userType === 'admin'
    const ticket = await db.supportTickets.findFirst({
      where: isAdmin ? { id } : { id, userId: auth.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        ...(isAdmin
          ? { user: { select: { id: true, email: true, userType: true, buyerProfile: { select: { fullName: true } } } } }
          : {}),
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: ticket })
  } catch (error) {
    console.error('Ticket GET error:', error)
    return NextResponse.json({ error: 'Failed to load ticket' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'support-tickets-write', 30, 60000)

    if (!rl.ok) return rateLimitResponse(rl)


    const body = await request.json()
    const { status } = body

    // Task 75: the RESPONDER half of the status lifecycle. Admins drive the
    // thread (in_progress / waiting_buyer / resolved / closed, assignedTo =
    // the responding admin); the buyer keeps reopen/close on their own.
    const ADMIN_STATUSES = ['open', 'in_progress', 'waiting_buyer', 'resolved', 'closed']
    if (auth.user.userType === 'admin') {
      const ticket = await db.supportTickets.findUnique({ where: { id } })
      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
      }
      if (!ADMIN_STATUSES.includes(String(status || ''))) {
        return NextResponse.json({ error: `status must be one of: ${ADMIN_STATUSES.join(' | ')}` }, { status: 400 })
      }
      const updated = await db.supportTickets.update({
        where: { id },
        data: {
          status: String(status),
          assignedTo: ticket.assignedTo ?? auth.user.id,
        },
      })
      return NextResponse.json({ success: true, data: updated })
    }

    const existing = await db.supportTickets.findFirst({
      where: { id, userId: auth.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const updated = await db.supportTickets.update({
      where: { id },
      data: {
        status: status || existing.status,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Ticket PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
