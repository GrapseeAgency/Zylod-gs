import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'

/**
 * POST /api/rewards/redeem
 * Exchange loyalty points for discount vouchers or wallet funds.
 * Body: { pointsToRedeem: number, rewardType: 'voucher' | 'wallet_credit' }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { pointsToRedeem, rewardType = 'voucher' } = body

    if (!pointsToRedeem || typeof pointsToRedeem !== 'number' || pointsToRedeem < 100) {
      return NextResponse.json({ error: 'Minimum redemption is 100 points' }, { status: 400 })
    }

    const reward = await db.buyerRewards.findUnique({
      where: { buyerId: auth.user.id },
    })

    if (!reward || reward.pointsBalance < pointsToRedeem) {
      return NextResponse.json({ error: 'Insufficient point balance' }, { status: 400 })
    }

    // Value calculation: 10 points = ৳1 BDT
    const cashValueBDT = Math.floor(pointsToRedeem / 10)

    // Deduct points
    await db.buyerRewards.update({
      where: { buyerId: auth.user.id },
      data: {
        pointsBalance: { decrement: pointsToRedeem },
        totalRedeemed: { increment: pointsToRedeem },
      },
    })

    // Log transaction
    await db.rewardTransactions.create({
      data: {
        buyerId: auth.user.id,
        type: 'redeem',
        points: -pointsToRedeem,
        description: `Redeemed ${pointsToRedeem} points for ৳${cashValueBDT} ${rewardType === 'wallet_credit' ? 'Wallet Credit' : 'Voucher'}`,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let createdCoupon: any = null

    if (rewardType === 'voucher') {
      const code = `POINTS-${cashValueBDT}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      createdCoupon = await db.userCoupons.create({
        data: {
          userId: auth.user.id,
          couponId: 'points-redemption',
          code,
          title: `Points Redemption: ৳${cashValueBDT} Voucher`,
          discountStyle: 'fixed',
          discountLabel: `৳${cashValueBDT} FLAT OFF`,
          status: 'active',
          validUntil: new Date(Date.now() + 30 * 86400000),
          savingsBDT: cashValueBDT,
          minOrderBDT: cashValueBDT * 3,
          categoryLabel: 'Loyalty Reward',
          categoryColor: '#D97706',
        },
      })
    } else if (rewardType === 'wallet_credit') {
      // Find existing wallet first, then update or create
      const existingWallet = await db.wallets.findFirst({
        where: { userId: auth.user.id },
      })

      if (existingWallet) {
        await db.wallets.update({
          where: { id: existingWallet.id },
          data: { balance: { increment: cashValueBDT } },
        })
      } else {
        await db.wallets.create({
          data: { userId: auth.user.id, balance: cashValueBDT },
        })
      }
    }

    // Real in-app notification
    await sendNotification({
      userId: auth.user.id,
      type: 'promotion',
      title: `Points Redeemed: ৳${cashValueBDT}`,
      body: `You exchanged ${pointsToRedeem} loyalty points for ৳${cashValueBDT} wholesale purchasing credit.`,
    })

    return NextResponse.json({
      success: true,
      message: `Redeemed ${pointsToRedeem} points successfully!`,
      data: {
        pointsRedeemed: pointsToRedeem,
        cashValueBDT,
        coupon: createdCoupon,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Points redemption error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
