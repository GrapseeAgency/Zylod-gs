import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/referrals
 * Retrieve user's referral code, invite statistics, and earned referral points.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Upsert user referral code
    let referral = await db.referralCodes.findFirst({
      where: { buyerId: auth.user.id },
      include: {
        uses: {
          include: {
            referredUser: {
              select: { id: true, email: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!referral) {
      const uniqueCode = 'ZY-' + auth.user.id.slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
      referral = await db.referralCodes.create({
        data: {
          buyerId: auth.user.id,
          code: uniqueCode,
          rewardPoints: 500, // 500 points per verified business referred
        },
        include: {
          uses: {
            include: {
              referredUser: {
                select: { id: true, email: true, createdAt: true },
              },
            },
          },
        },
      })
    }

    const totalEarnedPoints = (referral.uses?.filter(u => u.rewardGiven).length || 0) * 500

    return NextResponse.json({
      success: true,
      data: {
        code: referral.code,
        shareUrl: `https://zylod.com/register?ref=${referral.code}`,
        rewardPerReferral: referral.rewardPoints,
        totalInvited: referral.uses?.length || 0,
        successfulReferrals: referral.uses?.filter(u => u.rewardGiven).length || 0,
        totalPointsEarned: totalEarnedPoints,
        referralHistory: referral.uses || [],
      },
    })
  } catch (error) {
    console.error('Referrals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
