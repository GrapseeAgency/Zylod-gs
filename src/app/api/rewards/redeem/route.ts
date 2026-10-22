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

    const userId = auth.user.id
    const body = await request.json()
    const { pointsToRedeem, rewardType = 'voucher' } = body

    if (!pointsToRedeem || typeof pointsToRedeem !== 'number' || pointsToRedeem < 100) {
      return NextResponse.json({ error: 'Minimum redemption is 100 points' }, { status: 400 })
    }

    const reward = await db.buyerRewards.findUnique({
      where: { buyerId: userId },
    })

    if (!reward || reward.pointsBalance < pointsToRedeem) {
      return NextResponse.json({ error: 'Insufficient point balance' }, { status: 400 })
    }

    // Value calculation: 10 points = ৳1 BDT
    const cashValueBDT = Math.floor(pointsToRedeem / 10)

    // Deduct points
    await db.buyerRewards.update({
      where: { buyerId: userId },
      data: {
        pointsBalance: { decrement: pointsToRedeem },
        totalRedeemed: { increment: pointsToRedeem },
      },
    })

    // Log transaction
    await db.rewardTransactions.create({
      data: {
        buyerId: userId,
        type: 'redeem',
        points: -pointsToRedeem,
        description: `Redeemed ${pointsToRedeem} points for ৳${cashValueBDT} ${rewardType === 'wallet_credit' ? 'Wallet Credit' : 'Voucher'}`,
      },
    })

    let createdCoupon: { id: string; code?: string; discountValue?: number } | null = null

    if (rewardType === 'voucher') {
      // Task 143: the voucher is a REAL bound coupon with checkout teeth —
      // the old write landed in userCoupons, a table NOTHING reads (no
      // checkout validation, no UI): a promise that could never be honored.
      // Now: coupons row bound to this buyer, single-use, the validated
      // preview + order write both honor it, and the notification carries
      // the REAL code.
      const code = `POINTS-${cashValueBDT}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      createdCoupon = await db.coupons.create({
        data: {
          code,
          userId,
          discountType: 'fixed',
          discountPercent: cashValueBDT,
          minOrderAmount: cashValueBDT * 3,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 30 * 86400000),
          usageLimit: 1,
          isActive: true,
        },
      })
      await db.auditLogs
        .create({
          data: {
            actorId: auth.user.id,
            action: 'reward_voucher_issued',
            entityType: 'coupons',
            entityId: createdCoupon.id,
            metadata: JSON.stringify({ userId, points: pointsToRedeem, valueBDT: cashValueBDT, code }),
          },
        })
        .catch(() => { /* evidence, not a gate */ })
    } else if (rewardType === 'wallet_credit') {
      // Task 143: a wallet movement WITHOUT a ledger row is untraceable
      // money — every other balance change writes walletTransactions with
      // the real balanceAfter. The credit now leaves the same evidence.
      const result = await db.$transaction(async (tx) => {
        let wallet = await tx.wallets.findFirst({ where: { userId } })
        if (!wallet) {
          wallet = await tx.wallets.create({ data: { userId, balance: 0, currency: 'BDT' } })
        }
        const balanceAfter = wallet.balance + cashValueBDT
        await tx.wallets.update({ where: { id: wallet.id }, data: { balance: balanceAfter } })
        const ledger = await tx.walletTransactions.create({
          data: {
            walletId: wallet.id,
            type: 'cashback',
            amount: cashValueBDT,
            balanceAfter,
            description: `Loyalty points redemption: ${pointsToRedeem} points → ৳${cashValueBDT}`,
          },
        })
        return { ledger, balanceAfter }
      })
      await db.auditLogs
        .create({
          data: {
            actorId: auth.user.id,
            action: 'reward_wallet_credit',
            entityType: 'wallets',
            entityId: result.ledger.walletId,
            metadata: JSON.stringify({ userId, points: pointsToRedeem, valueBDT: cashValueBDT, balanceAfter: result.balanceAfter }),
          },
        })
        .catch(() => { /* evidence, not a gate */ })
    }

    // Real in-app notification — for vouchers it carries the REAL code so
    // the buyer can actually spend what they earned.
    await sendNotification({
      userId,
      type: 'promotion',
      title: `Points Redeemed: ৳${cashValueBDT}`,
      body: createdCoupon?.code
        ? `You exchanged ${pointsToRedeem} loyalty points for a ৳${cashValueBDT} voucher. Code: ${createdCoupon.code} — enter it at checkout (single use, 30 days, min order ৳${(cashValueBDT * 3).toLocaleString()}).`
        : `You exchanged ${pointsToRedeem} loyalty points for ৳${cashValueBDT} wallet credit — it is in your wallet with a full ledger entry.`,
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
