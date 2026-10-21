import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { buyerWithdrawSchema, normalizePayoutMethod } from '@/lib/payouts'

/**
 * Task 119: THE BUYER WITHDRAWAL RAIL — the OUT half of the buyer wallet.
 * Task 118 made buyer top-ups verified real money; Task 119 closes the
 * one-way door: a buyer can now request money OUT under the exact same
 * doctrine the seller rail has run since Task 107 (and the buyer rail is
 * intentionally a SEPARATE queue — sellers settle from earnings, buyers
 * from sourcing funds; the admin console keeps them on separate rails):
 *
 *   POST → a PENDING buyerPayouts row that HOLDS the amount (available =
 *   wallet balance − the buyer's own pending/processing requests). The
 *   wallet is NOT touched here. Only POST /api/admin/buyer-payouts/[id]
 *   (complete | reject) moves or frees money.
 *
 * POST mandate order (house contract):
 *   1) requireUserType(['buyer']) → 401 FIRST (suppliers have their own
 *      rail: POST /api/wallet/withdraw — this route is buyer-only).
 *   2) rate limit 10/min 'buyer-withdraw'.
 *   3) Zod strict via buyerWithdrawSchema (amount ≥ ৳50, method enum,
 *      accountNumber ≥ 6, holderName required).
 *   4) Wallet must exist (404 — a buyer with no wallet has nothing to
 *      withdraw; we never auto-create a wallet on a money-OUT path).
 *   5) Holds math against the buyer's OWN pending/processing rows — the
 *      same ৳ can never be double-requested while a payout awaits
 *      verification. Over-request → 400 with the real numbers spelled out.
 *   6) ONE create: buyerPayouts {status:'pending', destination verbatim}
 *      + auditLogs 'buyer_payout_requested'.
 *   7) AFTER commit, fire-and-forget 'wallet:withdrawal-requested' to
 *      every admin room (tapAllAdmins semantics via direct enumeration).
 *
 * GET — the caller's OWN rail view: balance, onHold, available, and their
 * withdrawal history (pending-first, newest first, take 100). Suppliers
 * hitting this route get 401 (requireUserType) — their rail is
 * GET /api/wallet/withdraw.
 */

function holdsOn(pendingRows: { amount: number }[]): number {
  return pendingRows.reduce((s, r) => s + r.amount, 0)
}

export async function POST(request: NextRequest) {
  // 1) Buyer auth first — 401 before anything else.
  const auth = await requireUserType(request, ['buyer'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  // 2) Rate limit second (mandated order).
  const rl = checkRateLimit(request, 'buyer-withdraw', 10, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    // 3) Zod strict — verbatim issue on failure.
    const parsed = buyerWithdrawSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const d = parsed.data

    // 4) A buyer with no wallet has nothing to withdraw — no auto-create
    // on a money-OUT path.
    const wallet = await db.wallets.findFirst({ where: { userId: auth.user.id } })
    if (!wallet) {
      return NextResponse.json({ error: 'No wallet found for this account' }, { status: 404 })
    }

    // 5) Holds math — the request-time hold, honestly computed.
    const openRows = await db.buyerPayouts.findMany({
      where: { userId: auth.user.id, status: { in: ['pending', 'processing'] } },
      select: { amount: true },
    })
    const onHold = holdsOn(openRows)
    const available = wallet.balance - onHold
    if (d.amount > available) {
      return NextResponse.json(
        { error: `Requested ৳${d.amount.toLocaleString()} exceeds the ৳${available.toLocaleString()} available (balance ৳${wallet.balance.toLocaleString()} minus ৳${onHold.toLocaleString()} already pending verification)` },
        { status: 400 }
      )
    }

    // 6) The pending request itself — wallet untouched.
    const destination = `${d.method}${d.bankName ? ` · ${d.bankName}` : ''} · ${d.accountNumber} · ${d.holderName}`
    const payout = await db.buyerPayouts.create({
      data: {
        userId: auth.user.id,
        amount: d.amount,
        method: normalizePayoutMethod(d.method),
        status: 'pending',
        destination,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'buyer_payout_requested',
        entityType: 'buyerPayouts',
        entityId: payout.id,
        metadata: JSON.stringify({ amount: d.amount, method: payout.method, destination }),
      },
    })

    // 7) Live tap on every admin's own room (fire-and-forget).
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    void Promise.allSettled(
      admins.map((admin) =>
        broadcastToRoom(`admin:${admin.id}`, 'wallet:withdrawal-requested', {
          payoutId: payout.id,
          amount: payout.amount,
          method: payout.method,
        })
      )
    )

    return NextResponse.json(
      {
        success: true,
        message: `Withdrawal request for ৳${d.amount.toLocaleString()} submitted — an admin verifies it before any money leaves.`,
        data: {
          payoutId: payout.id,
          amount: payout.amount,
          status: payout.status,
          onHoldAfter: onHold + payout.amount,
          availableAfter: available - payout.amount,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Buyer withdrawal request error:', error)
    return NextResponse.json({ error: 'Failed to submit withdrawal request' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['buyer'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'buyer-withdraw-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const [wallet, rows] = await Promise.all([
      db.wallets.findFirst({ where: { userId: auth.user.id }, select: { balance: true } }),
      db.buyerPayouts.findMany({
        where: { userId: auth.user.id },
        orderBy: [{ createdAt: 'desc' }],
        take: 100,
      }),
    ])
    const onHold = holdsOn(rows.filter((r) => r.status === 'pending' || r.status === 'processing'))
    const balance = wallet?.balance ?? 0
    return NextResponse.json({
      success: true,
      data: {
        balance,
        onHold,
        available: balance - onHold,
        payouts: rows.map((r) => ({
          id: r.id,
          amount: r.amount,
          method: r.method,
          status: r.status,
          destination: r.destination,
          reference: r.reference,
          processedAt: r.processedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    })
  } catch (error) {
    console.error('Buyer withdrawal list error:', error)
    return NextResponse.json({ error: 'Failed to load withdrawal requests' }, { status: 500 })
  }
}
