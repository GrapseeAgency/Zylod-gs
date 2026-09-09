import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/support/tickets/[id]/rate
 * Rate resolution quality on a resolved ticket
 */
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

    const body = await request.json()
    const { rating, ratingComment } = body

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be a number between 1 and 5' }, { status: 400 })
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
        rating,
        ratingComment: ratingComment ? String(ratingComment).trim() : null,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Rate ticket error:', error)
    return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 })
  }
}
