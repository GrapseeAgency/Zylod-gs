import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

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

  // Task 147: a money-adjacent redemption rail gets the full doctrine —
  // rate limit, Zod strict, ONE transaction with the conditional decrement
  // re-checked AT the write (the t143/t70/t74 race guard), a wallet ledger
  // row in EVERY branch (the old create-branch credited balance with NO
  // walletTransactions row — untraceable money), and an audit row.
  const rl = checkRateLimit(request, 'rewards-catalog-redeem', 5, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const parsed = z
      .object({ redeemId: z.string().trim().min(1).max(64) })
      .strict()
      .safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid redemption request' }, { status: 400 })
    }

    const CATALOG: Record<string, { label: string; points: number; type: string; value: number }> = {
      'credit-50': { label: '৳50 Wallet Credit', points: 500, type: 'wallet_credit', value: 50 },
      'credit-100': { label: '৳100 Wallet Credit', points: 1000, type: 'wallet_credit', value: 100 },
      'credit-250': { label: '৳250 Wallet Credit', points: 2500, type: 'wallet_credit', value: 250 },
      'credit-500': { label: '৳500 Wallet Credit', points: 5000, type: 'wallet_credit', value: 500 },
    }
    const option = CATALOG[parsed.data.redeemId]
    if (!option) {
      return NextResponse.json({ error: 'Invalid redemption option' }, { status: 400 })
    }

    const buyerId = auth.user.id
    const rewards = await db.buyerRewards.findUnique({ where: { buyerId } })
    if (!rewards || rewards.pointsBalance < option.points) {
      return NextResponse.json(
        { error: `Not enough points — you have ${rewards?.pointsBalance ?? 0}, this needs ${option.points}` },
        { status: 400 }
      )
    }

    const { result } = await db.$transaction(async (tx) => {
      const spent = await tx.buyerRewards.updateMany({
        where: { buyerId, pointsBalance: { gte: option.points } },
        data: {
          pointsBalance: { decrement: option.points },
          totalRedeemed: { increment: option.points },
        },
      })
      if (spent.count === 0) {
        const current = await tx.buyerRewards.findUnique({ where: { buyerId } })
        return { result: { insufficient: true as const, balance: current?.pointsBalance ?? 0 } }
      }

      await tx.rewardTransactions.create({
        data: {
          buyerId,
          type: 'redeem',
          points: -option.points,
          description: `Redeemed ${option.label}`,
          relatedEntityId: parsed.data.redeemId,
        },
      })

      if (option.type === 'wallet_credit') {
        let wallet = await tx.wallets.findFirst({ where: { userId: buyerId } })
        if (!wallet) {
          wallet = await tx.wallets.create({ data: { userId: buyerId, balance: 0, currency: 'BDT' } })
        }
        const balanceAfter = wallet.balance + option.value
        await tx.wallets.update({ where: { id: wallet.id }, data: { balance: balanceAfter } })
        const ledger = await tx.walletTransactions.create({
          data: {
            walletId: wallet.id,
            type: 'credit',
            amount: option.value,
            balanceAfter,
            description: `Loyalty points redemption — ${option.label}`,
          },
        })
        return { result: { insufficient: false as const, ledgerId: ledger.id, walletId: wallet.id, balanceAfter } }
      }

      return { result: { insufficient: false as const, ledgerId: null, walletId: null, balanceAfter: null } }
    })

    if (result.insufficient) {
      return NextResponse.json(
        { error: `Not enough points — a concurrent redemption spent them first. You have ${result.balance} left.` },
        { status: 409 }
      )
    }

    // Evidence: the credit leaves an audit row the admin console can read.
    await db.auditLogs
      .create({
        data: {
          actorId: auth.user.id,
          action: 'reward_wallet_credit',
          entityType: 'wallets',
          entityId: result.walletId ?? auth.user.id,
          metadata: JSON.stringify({ userId: buyerId, points: option.points, valueBDT: option.value, balanceAfter: result.balanceAfter }),
        },
      })
      .catch(() => { /* evidence, not a gate */ })

    return NextResponse.json({
      success: true,
      message: `Redeemed ${option.label} successfully`,
      data: { redeemed: option.label, pointsSpent: option.points, walletBalanceAfter: result.balanceAfter },
    })
  } catch (error) {
    console.error('Rewards POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
