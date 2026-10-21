import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * POST /api/admin/topups/[id]/verify — the admin decision on a manual wallet
 * top-up claim (Task 118). The ONLY route in the platform that can flip a
 * manual claim from 'pending' to 'credited' — and with it, the only place a
 * manual claim moves money. This is the wallet half of the Task 56 doctrine:
 * the buyer's claim creates a PENDING row and nothing else; an admin who has
 * confirmed the money actually arrived flips it, inside ONE transaction:
 *
 *   verify →
 *     - walletTopups {status:'credited', creditedAt, gatewayTrxId=reference,
 *       claimDetails gains the verification annex}
 *     - wallets row found-or-created, balance += amount (inside the tx)
 *     - walletTransactions deposit row with the REAL balanceAfter
 *   reject →
 *     - walletTopups {status:'rejected', claimDetails gains the annex}
 *     - NO wallet mutation, NO ledger row — honestly nothing moved.
 *
 * Mandate order (house contract):
 *   1) requireUserType(['admin']) → 401 FIRST.
 *   2) rate limit 20/min 'admin-topup-verify'.
 *   3) topup findUnique (with user) → 404 'Top-up not found' when absent.
 *   4) Zod STRICT: { action: 'verify' | 'reject', note?: ≤300 }.
 *   5) Guard: topup.status must be 'pending' else 409
 *      `Top-up already <status>` (verbatim real status).
 *   6) ONE transaction (as above) + auditLogs 'wallet_topup_verified' |
 *      'wallet_topup_rejected' with the real before/after (topup status AND
 *      wallet balance) and actorType 'admin'.
 *   7) AFTER commit, fire-and-forget 'wallet:topup-verified' /
 *      'wallet:topup-rejected' to every admin's own admin:<adminUserId>
 *      room, and a REAL notifications row for the claimant either way.
 *
 * Response 200 { topupId, status, newBalance? } — newBalance present on
 * verify so the UI can state the credited balance without a second read.
 */

const RATE_LIMIT = { limit: 20, windowMs: 60_000 }

const verifySchema = z
  .object({
    action: z.enum(['verify', 'reject']),
    note: z.string().trim().max(300).optional(),
  })
  .strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) Admin auth first — 401 before anything else.
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  // 2) Rate limit second (mandated order).
  const rl = checkRateLimit(request, 'admin-topup-verify', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const topup = await db.walletTopups.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            buyerProfile: { select: { fullName: true, businessName: true } },
            supplierProfile: { select: { companyName: true } },
          },
        },
      },
    })
    if (!topup) {
      return NextResponse.json({ error: 'Top-up not found' }, { status: 404 })
    }

    // 4) Zod strict — verbatim issue on failure.
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = verifySchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body' },
        { status: 400 }
      )
    }
    const { action, note } = parsed.data
    const verifying = action === 'verify'

    // 5) Only a pending claim can be decided. Gateway sessions that are
    // already credited/failed/cancelled by their callbacks stay immutable —
    // no admin can double-credit a wallet.
    if (topup.status !== 'pending') {
      return NextResponse.json({ error: `Top-up already ${topup.status}` }, { status: 409 })
    }

    // Merge the verification annex into claimDetails WITHOUT breaking JSON
    // parseability (same policy as payments.gatewayResponse).
    const previous =
      topup.claimDetails && typeof topup.claimDetails === 'object' && !Array.isArray(topup.claimDetails)
        ? (topup.claimDetails as Record<string, unknown>)
        : {}
    const mergedClaimDetails = {
      ...previous,
      verification: {
        action,
        actorType: 'admin',
        actorId: auth.user.id,
        note: note ?? null,
        at: new Date().toISOString(),
      },
    }

    // Balance BEFORE the decision (for the honest audit before/after).
    const walletBefore = await db.wallets.findFirst({ where: { userId: topup.userId } })
    const balanceBefore = walletBefore?.balance ?? 0

    // 6) ONE transaction: topup flip (+ wallet credit + ledger row on verify) + audit.
    let newBalance: number | null = null
    await db.$transaction(async (tx) => {
      if (verifying) {
        // Find-or-create the wallet INSIDE the tx so the credited balance
        // can never race a missing wallet row.
        let wallet = await tx.wallets.findFirst({ where: { userId: topup.userId } })
        if (!wallet) {
          wallet = await tx.wallets.create({ data: { userId: topup.userId, balance: 0, currency: 'BDT' } })
        }
        const updated = await tx.wallets.update({
          where: { id: wallet.id },
          data: { balance: { increment: topup.amount } },
        })
        newBalance = updated.balance
        await tx.walletTransactions.create({
          data: {
            walletId: wallet.id,
            type: 'deposit',
            amount: topup.amount,
            balanceAfter: updated.balance,
            description: `Wallet top-up verified (${topup.provider} · ${topup.reference})`,
            relatedEntityId: topup.id,
          },
        })
      }
      await tx.walletTopups.update({
        where: { id: topup.id },
        data: {
          status: verifying ? 'credited' : 'rejected',
          creditedAt: verifying ? new Date() : null,
          gatewayTrxId: verifying ? topup.reference : topup.gatewayTrxId,
          claimDetails: mergedClaimDetails,
        },
      })
      await tx.auditLogs.create({
        data: {
          actorId: auth.user!.id,
          action: verifying ? 'wallet_topup_verified' : 'wallet_topup_rejected',
          entityType: 'walletTopups',
          entityId: topup.id,
          metadata: JSON.stringify({
            actorType: 'admin',
            amount: topup.amount,
            provider: topup.provider,
            reference: topup.reference,
            before: { topupStatus: topup.status, walletBalance: balanceBefore },
            after: {
              topupStatus: verifying ? 'credited' : 'rejected',
              walletBalance: verifying ? newBalance : balanceBefore,
            },
          }),
        },
      })
    })

    // 7) Fire-and-forget broadcasts of REAL persisted state + a REAL
    // notification row for the claimant either way.
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    const payload = {
      topupId: topup.id,
      userId: topup.userId,
      amount: topup.amount,
      provider: topup.provider,
      reference: topup.reference,
      status: verifying ? 'credited' : 'rejected',
      newBalance,
    }
    void Promise.allSettled(
      admins.map((admin) =>
        broadcastToRoom(`admin:${admin.id}`, verifying ? 'wallet:topup-verified' : 'wallet:topup-rejected', payload)
      )
    )

    const displayName =
      topup.user.buyerProfile?.fullName ?? topup.user.buyerProfile?.businessName ?? topup.user.supplierProfile?.companyName ?? 'Zylod user'
    await db.notifications.create({
      data: {
        userId: topup.userId,
        type: 'payment',
        title: verifying ? 'Wallet top-up verified' : 'Wallet top-up claim rejected',
        body: verifying
          ? `Your ৳${topup.amount.toLocaleString()} top-up (ref ${topup.reference}) was verified. New balance: ৳${(newBalance ?? 0).toLocaleString()}.`
          : `Your ৳${topup.amount.toLocaleString()} top-up claim (ref ${topup.reference}) was rejected. ${note ?? 'No reason recorded.'} Your balance was not changed.`,
        relatedEntityId: topup.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        topupId: topup.id,
        status: verifying ? 'credited' : 'rejected',
        amount: topup.amount,
        newBalance,
      },
    })
  } catch (error) {
    console.error('Admin topup verify POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
