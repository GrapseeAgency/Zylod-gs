import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/support/tickets/[id]/messages — get message thread
 * POST /api/support/tickets/[id]/messages — post a reply
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

    const ticket = await db.supportTickets.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const messages = await db.supportTicketMessages.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ success: true, data: messages })
  } catch (error) {
    console.error('Ticket messages GET error:', error)
    return NextResponse.json({ error: 'Failed to load ticket messages' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const ticket = await db.supportTickets.findFirst({
      where: { id, userId: auth.user.id },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const body = await request.json()
    const { message, attachments } = body

    if (!message || String(message).trim().length < 1) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    const newMsg = await db.supportTicketMessages.create({
      data: {
        ticketId: id,
        senderId: auth.user.id,
        senderType: 'user',
        message: String(message).trim(),
        attachments: attachments ? JSON.stringify(attachments) : null,
      },
    })

    // Update ticket status to in_progress if currently waiting
    await db.supportTickets.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        status: ticket.status === 'resolved' || ticket.status === 'closed' ? 'open' : ticket.status,
      },
    })

    return NextResponse.json({ success: true, data: newMsg }, { status: 201 })
  } catch (error) {
    console.error('Ticket message POST error:', error)
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 })
  }
}
