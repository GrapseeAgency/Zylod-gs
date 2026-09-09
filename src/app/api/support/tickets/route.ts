import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/support/tickets — list the user's support/dispute tickets.
 * POST /api/support/tickets — open a new ticket.
 * Body: { category: order_issue|payment_issue|account_issue|product_issue|seller_issue|general,
 *         subject, description, priority?, relatedOrderId? }
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const tickets = await db.supportTickets.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    })
    return NextResponse.json({ success: true, data: tickets })
  } catch (error) {
    console.error('Support tickets GET error:', error)
    return NextResponse.json({ error: 'Failed to load tickets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { category, subject, description, priority, relatedOrderId } = body

    const VALID_CATEGORIES = ['order_issue', 'payment_issue', 'account_issue', 'product_issue', 'seller_issue', 'general']
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent']

    if (!VALID_CATEGORIES.includes(String(category || ''))) {
      return NextResponse.json({ error: 'Please choose a valid category' }, { status: 400 })
    }
    if (!subject || String(subject).trim().length < 5) {
      return NextResponse.json({ error: 'Subject must be at least 5 characters' }, { status: 400 })
    }
    if (!description || String(description).trim().length < 20) {
      return NextResponse.json({ error: 'Please describe the issue in at least 20 characters' }, { status: 400 })
    }

    // If an order is referenced, verify ownership
    if (relatedOrderId) {
      const order = await db.orders.findFirst({
        where: { id: relatedOrderId, buyerId: auth.user.id },
        select: { id: true },
      })
      if (!order) {
        return NextResponse.json({ error: 'Order not found or not yours' }, { status: 403 })
      }
    }

    const ticket = await db.supportTickets.create({
      data: {
        userId: auth.user.id,
        category: String(category),
        subject: String(subject).trim(),
        description: String(description).trim(),
        priority: VALID_PRIORITIES.includes(String(priority)) ? String(priority) : 'medium',
        relatedOrderId: relatedOrderId || null,
      },
    })

    return NextResponse.json({ success: true, data: ticket }, { status: 201 })
  } catch (error) {
    console.error('Support ticket POST error:', error)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}