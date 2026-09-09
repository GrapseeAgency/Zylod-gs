import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/rewards/spin-history
 * Retrieve user's previous wheel spin results.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const spins = await db.spinWinResults.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const todayStr = new Date().toISOString().split('T')[0]
    const spinsToday = await db.spinWinResults.count({
      where: { userId: auth.user.id, spinDate: todayStr },
    })

    return NextResponse.json({
      success: true,
      data: spins,
      spinsToday,
      spinsRemaining: Math.max(0, 3 - spinsToday),
    })
  } catch (error) {
    console.error('Spin history GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
