import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/support/faqs/[id]/vote
 * Body: { helpful: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { helpful } = body

    const existing = await db.faqItems.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'FAQ item not found' }, { status: 404 })
    }

    const updated = await db.faqItems.update({
      where: { id },
      data: {
        helpfulYes: helpful ? { increment: 1 } : existing.helpfulYes,
        helpfulNo: !helpful ? { increment: 1 } : existing.helpfulNo,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('FAQ vote error:', error)
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
  }
}
