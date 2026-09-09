import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/rewards/loyalty
 * Retrieve buyer loyalty point balance, current tier, and tier progress.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const reward = await db.buyerRewards.upsert({
      where: { buyerId: auth.user.id },
      create: {
        buyerId: auth.user.id,
        pointsBalance: 150,
        totalEarned: 150,
        tier: 'bronze',
      },
      update: {},
    })

    // Compute tier criteria
    // Bronze: 0 - 999
    // Silver: 1,000 - 4,999
    // Gold: 5,000 - 14,999
    // Platinum: 15,000+
    let currentTier = reward.tier
    let nextTier = 'silver'
    let pointsNeeded = 1000 - reward.totalEarned
    let tierProgress = Math.min(100, Math.round((reward.totalEarned / 1000) * 100))

    if (reward.totalEarned >= 15000) {
      currentTier = 'platinum'
      nextTier = 'max'
      pointsNeeded = 0
      tierProgress = 100
    } else if (reward.totalEarned >= 5000) {
      currentTier = 'gold'
      nextTier = 'platinum'
      pointsNeeded = 15000 - reward.totalEarned
      tierProgress = Math.min(100, Math.round(((reward.totalEarned - 5000) / 10000) * 100))
    } else if (reward.totalEarned >= 1000) {
      currentTier = 'silver'
      nextTier = 'gold'
      pointsNeeded = 5000 - reward.totalEarned
      tierProgress = Math.min(100, Math.round(((reward.totalEarned - 1000) / 4000) * 100))
    }

    return NextResponse.json({
      success: true,
      data: {
        pointsBalance: reward.pointsBalance,
        totalEarned: reward.totalEarned,
        totalRedeemed: reward.totalRedeemed,
        tier: currentTier,
        nextTier,
        pointsNeededForNextTier: Math.max(0, pointsNeeded),
        tierProgressPercent: tierProgress,
        cashValueBDT: Math.floor(reward.pointsBalance / 10), // 10 points = ৳1 BDT
      },
    })
  } catch (error) {
    console.error('Loyalty rewards GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
