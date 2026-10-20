import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { normalizePayoutMethod, withdrawSchema } from '@/lib/payouts'

/**
 * Task 107: THE PAYOUT RAIL (seller side) — withdrawal requests under the
 * payment-doctrine rule the platform already runs for buyer payments: money
 * only leaves the ledger through VERIFICATION.
 *
 * The old flow debited the wallet the instant a request arrived and marked
 * the transaction 'processing' with nothing anywhere to complete or reject
 * it — money vanished from the balance with no settlement and no refund
 * path. Now a request creates a PENDING sellerPayouts row (the queue the
 * admin works from) and the wallet is untouched until an admin completes
 * the payout. The requested amount is HELD honestly: available balance =
 * wallet balance − the seller's own pending/processing requests, so the
 * same ৳ can never be double-requested while a payout awaits verification.
 */

/** Holds = this supplier's payouts awaiting a decision. */
function holdsOn(pendingRows: { amount: number }[]): number {
  return pendingRows.reduce((s, r) => s + r.amount, 0)
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'wallet-withdraw', 10, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }
    const parsed = withdrawSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const d = parsed.data

    const wallet = await db.wallets.findFirst({ where: { userId: auth.user.id } })
    if (!wallet) {
      return NextResponse.json({ error: 'No wallet found for this account' }, { status: 404 })
    }
    const openRows = await db.sellerPayouts.findMany({
      where: { supplierId: profile.id, status: { in: ['pending', 'processing'] } },
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

    const destination = `${d.method}${d.bankName ? ` · ${d.bankName}` : ''} · ${d.accountNumber} · ${d.holderName}`
    const payout = await db.sellerPayouts.create({
      data: {
        supplierId: profile.id,
        amount: d.amount,
        method: normalizePayoutMethod(d.method),
        status: 'pending',
        destination,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'payout_requested',
        entityType: 'sellerPayouts',
        entityId: payout.id,
        metadata: JSON.stringify({ amount: d.amount, method: payout.method, destination }),
      },
    })

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
    console.error('Withdrawal request error:', error)
    return NextResponse.json({ error: 'Failed to submit withdrawal request' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'wallet-withdraw-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }
    const [wallet, rows] = await Promise.all([
      db.wallets.findFirst({ where: { userId: auth.user.id }, select: { balance: true } }),
      db.sellerPayouts.findMany({
        where: { supplierId: profile.id },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
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
    console.error('Withdrawal list error:', error)
    return NextResponse.json({ error: 'Failed to load withdrawal requests' }, { status: 500 })
  }
}
