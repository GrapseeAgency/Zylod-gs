import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * POST /api/rewards/redeem
 * Exchange loyalty points for discount vouchers or wallet funds.
 * Body: { pointsToRedeem: number, rewardType: 'voucher' | 'wallet_credit' }
 *
 * Task 143 (audit completion): the whole redemption is ONE transaction with
 * a conditional decrement re-checked AT the write (the same race guard the
 * order engine uses for coupon usage and wallet debits) — two concurrent
 * redemptions can never both spend the same points. rewardType is Zod-strict
 * (the old unvalidated string let an unknown type deduct points and grant
 * NOTHING — a silent 201 theft), and the route is rate-limited like every
 * other money-adjacent rail.
 */

const redeemSchema = z.object({
  pointsToRedeem: z.number().int().min(100),
  rewardType: z.enum(['voucher', 'wallet_credit']).default('voucher'),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const rate = checkRateLimit(request, 'rewards-redeem', 10, 60_000)
    if (!rate.ok) return rateLimitResponse(rate)

    const userId = auth.user.id
    const parsed = redeemSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid redemption request' },
        { status: 400 }
      )
    }
    const { pointsToRedeem, rewardType } = parsed.data

    // Fast friendly pre-check (the AUTHORITATIVE check is the conditional
    // decrement inside the transaction below) — also gives the real balance
    // for the error message.
    const reward = await db.buyerRewards.findUnique({
      where: { buyerId: userId },
    })

    if (!reward || reward.pointsBalance < pointsToRedeem) {
      return NextResponse.json(
        {
          error: `Insufficient point balance — you have ${reward?.pointsBalance ?? 0} points, this redemption needs ${pointsToRedeem}`,
        },
        { status: 400 }
      )
    }

    // Value calculation: 10 points = ৳1 BDT
    const cashValueBDT = Math.floor(pointsToRedeem / 10)

    // ONE transaction: the conditional decrement, the ledger row, and the
    // instrument (voucher / wallet credit) all commit together or not at all.
    const { result } = await db.$transaction(async (tx) => {
      const spent = await tx.buyerRewards.updateMany({
        where: { buyerId: userId, pointsBalance: { gte: pointsToRedeem } },
        data: {
          pointsBalance: { decrement: pointsToRedeem },
          totalRedeemed: { increment: pointsToRedeem },
        },
      })
      if (spent.count === 0) {
        const current = await tx.buyerRewards.findUnique({ where: { buyerId: userId } })
        return { result: { insufficient: true as const, balance: current?.pointsBalance ?? 0 } }
      }

      await tx.rewardTransactions.create({
        data: {
          buyerId: userId,
          type: 'redeem',
          points: -pointsToRedeem,
          description: `Redeemed ${pointsToRedeem} points for ৳${cashValueBDT} ${rewardType === 'wallet_credit' ? 'Wallet Credit' : 'Voucher'}`,
        },
      })

      if (rewardType === 'voucher') {
        // Task 143: the voucher is a REAL bound coupon with checkout teeth —
        // the old write landed in userCoupons, a table no checkout validation
        // reads: a promise that could never be honored. Now: coupons row bound
        // to this buyer, single-use, the validated preview + order write both
        // honor it, and the notification carries the REAL code. The vault
        // (/api/coupons/my) merges bound coupons so it is visible where the
        // buyer manages coupons.
        const code = `POINTS-${cashValueBDT}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        const createdCoupon = await tx.coupons.create({
          data: {
            userId,
            code,
            discountType: 'fixed',
            discountPercent: cashValueBDT,
            minOrderAmount: cashValueBDT * 3,
            validFrom: new Date(),
            validUntil: new Date(Date.now() + 30 * 86400000),
            usageLimit: 1,
            isActive: true,
          },
        })
        return {
          result: {
            insufficient: false as const,
            kind: 'voucher' as const,
            coupon: { id: createdCoupon.id, code: createdCoupon.code, discountValue: cashValueBDT },
          },
        }
      }

      // wallet_credit — a wallet movement WITHOUT a ledger row is
      // untraceable money: every other balance change writes
      // walletTransactions with the real balanceAfter.
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
      return {
        result: {
          insufficient: false as const,
          kind: 'wallet' as const,
          balanceAfter,
          ledgerId: ledger.id,
        },
      }
    })

    if (result.insufficient) {
      return NextResponse.json(
        {
          error: `Insufficient point balance — a concurrent redemption spent your points. You have ${result.balance} left.`,
        },
        { status: 409 }
      )
    }

    // Evidence rows (not gates): every issued instrument leaves an audit row
    // the admin console can read.
    await db.auditLogs
      .create({
        data: {
          actorId: auth.user.id,
          action: result.kind === 'voucher' ? 'reward_voucher_issued' : 'reward_wallet_credit',
          entityType: result.kind === 'voucher' ? 'coupons' : 'wallets',
          entityId: result.kind === 'voucher' ? result.coupon.id : result.ledgerId,
          metadata: JSON.stringify(
            result.kind === 'voucher'
              ? { userId, points: pointsToRedeem, valueBDT: cashValueBDT, code: result.coupon.code }
              : { userId, points: pointsToRedeem, valueBDT: cashValueBDT, balanceAfter: result.balanceAfter }
          ),
        },
      })
      .catch(() => { /* evidence, not a gate */ })

    // Real in-app notification — for vouchers it carries the REAL code so
    // the buyer can actually spend what they earned.
    await sendNotification({
      userId,
      type: 'promotion',
      title: `Points Redeemed: ৳${cashValueBDT}`,
      body:
        result.kind === 'voucher'
          ? `You exchanged ${pointsToRedeem} loyalty points for a ৳${cashValueBDT} voucher. Code: ${result.coupon.code} — enter it at checkout (single use, 30 days, min order ৳${(cashValueBDT * 3).toLocaleString()}). It is in your coupon vault.`
          : `You exchanged ${pointsToRedeem} loyalty points for ৳${cashValueBDT} wallet credit — it is in your wallet with a full ledger entry.`,
    })

    return NextResponse.json(
      {
        success: true,
        message: `Redeemed ${pointsToRedeem} points successfully!`,
        data: {
          pointsRedeemed: pointsToRedeem,
          cashValueBDT,
          coupon: result.kind === 'voucher' ? result.coupon : null,
          walletBalanceAfter: result.kind === 'wallet' ? result.balanceAfter : null,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Points redemption error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
