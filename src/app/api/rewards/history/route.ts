import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/rewards/history
 * Retrieve full point transactions ledger (earning, redemptions, expirations).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const type = searchParams.get('type') // earn | redeem
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { buyerId: auth.user.id }
    if (type) where.type = type

    const [transactions, total] = await Promise.all([
      db.rewardTransactions.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.rewardTransactions.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Points history GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
