import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * GET /api/rewards — loyalty points balance, tier, and transaction history.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['buyer'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  try {
    const buyerId = auth.user.id

    let rewards = await db.buyerRewards.findUnique({ where: { buyerId } })
    if (!rewards) {
      rewards = await db.buyerRewards.create({ data: { buyerId } })
    }

    const transactions = await db.rewardTransactions.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Tier thresholds
    const TIERS = [
      { tier: 'bronze', min: 0 },
      { tier: 'silver', min: 1000 },
      { tier: 'gold', min: 5000 },
      { tier: 'platinum', min: 15000 },
    ]
    const tierIndex = TIERS.reduce((acc, t, i) => (rewards!.totalEarned >= t.min ? i : acc), 0)
    const nextTier = TIERS[tierIndex + 1] || null
    const progressToNext = nextTier
      ? Math.round(((rewards.totalEarned - TIERS[tierIndex].min) / (nextTier.min - TIERS[tierIndex].min)) * 100)
      : 100

    // Redemption catalog — fixed point values mapped to wallet credit / coupons
    const redeemOptions = [
      { id: 'credit-50', label: '৳50 Wallet Credit', points: 500, type: 'wallet_credit', value: 50 },
      { id: 'credit-100', label: '৳100 Wallet Credit', points: 1000, type: 'wallet_credit', value: 100 },
      { id: 'credit-250', label: '৳250 Wallet Credit', points: 2500, type: 'wallet_credit', value: 250 },
      { id: 'credit-500', label: '৳500 Wallet Credit', points: 5000, type: 'wallet_credit', value: 500 },
    ]

    return NextResponse.json({
      success: true,
      data: {
        balance: rewards.pointsBalance,
        totalEarned: rewards.totalEarned,
        totalRedeemed: rewards.totalRedeemed,
        tier: TIERS[tierIndex].tier,
        nextTier: nextTier ? { tier: nextTier.tier, pointsNeeded: nextTier.min - rewards.totalEarned, progressPct: progressToNext } : null,
        redeemOptions,
        history: transactions.map(t => ({
          id: t.id,
          type: t.type,
          points: t.points,
          description: t.description,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error('Rewards GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/rewards — redeem points for a reward option.
 * Body: { redeemId: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['buyer'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  try {
    const { redeemId } = await request.json()
    const CATALOG: Record<string, { label: string; points: number; type: string; value: number }> = {
      'credit-50': { label: '৳50 Wallet Credit', points: 500, type: 'wallet_credit', value: 50 },
      'credit-100': { label: '৳100 Wallet Credit', points: 1000, type: 'wallet_credit', value: 100 },
      'credit-250': { label: '৳250 Wallet Credit', points: 2500, type: 'wallet_credit', value: 250 },
      'credit-500': { label: '৳500 Wallet Credit', points: 5000, type: 'wallet_credit', value: 500 },
    }
    const option = CATALOG[redeemId]
    if (!option) {
      return NextResponse.json({ error: 'Invalid redemption option' }, { status: 400 })
    }

    const buyerId = auth.user.id
    const rewards = await db.buyerRewards.findUnique({ where: { buyerId } })
    if (!rewards || rewards.pointsBalance < option.points) {
      return NextResponse.json({ error: 'Not enough points' }, { status: 400 })
    }

    // Debit points
    await db.buyerRewards.update({
      where: { buyerId },
      data: {
        pointsBalance: { decrement: option.points },
        totalRedeemed: { increment: option.points },
      },
    })

    // Record transaction
    await db.rewardTransactions.create({
      data: {
        buyerId,
        type: 'redeem',
        points: -option.points,
        description: `Redeemed ${option.label}`,
        relatedEntityId: redeemId,
      },
    })

    // Credit wallet for wallet_credit redemptions
    if (option.type === 'wallet_credit') {
      const wallet = await db.wallets.findFirst({ where: { userId: buyerId } })
      if (wallet) {
        await db.wallets.update({
          where: { id: wallet.id },
          data: { balance: { increment: option.value } },
        })
        await db.walletTransactions.create({
          data: {
            walletId: wallet.id,
            type: 'credit',
            amount: option.value,
            balanceAfter: wallet.balance + option.value,
            description: `Loyalty points redemption — ${option.label}`,
          },
        })
      } else {
        await db.wallets.create({
          data: { userId: buyerId, balance: option.value },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Redeemed ${option.label} successfully`,
      data: { redeemed: option.label, pointsSpent: option.points },
    })
  } catch (error) {
    console.error('Rewards POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
