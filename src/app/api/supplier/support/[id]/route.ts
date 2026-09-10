import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ticket = await db.sellerSupportTickets.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        supplier: { select: { companyName: true } }
      }
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
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await request.json()
    const { message } = body
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    const newMsg = await db.sellerSupportMessages.create({
      data: {
        ticketId: id,
        senderId: auth.user.id,
        senderRole: 'supplier',
        message: message.trim()
      }
    })

    return NextResponse.json({ success: true, data: newMsg, message: 'Message sent' })
  } catch (error) {
    console.error('Support message POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}