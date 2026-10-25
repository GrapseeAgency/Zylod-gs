import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/events
 * Public listing of upcoming trade fairs & buyer events (tradeEvents table).
 * Returns { success, data: [{ id, title, description, location, startsAt, endsAt?, websiteUrl? }] }
 */
export async function GET() {
  try {
    const events = await db.tradeEvents.findMany({
      where: { isActive: true },
      orderBy: { startsAt: 'asc' },
      take: 30,
    })

    return NextResponse.json({ success: true, data: events })
  } catch (error) {
    console.error('Events GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
