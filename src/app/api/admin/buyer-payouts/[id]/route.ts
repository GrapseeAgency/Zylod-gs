import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { payoutDecisionSchema, shapeAdminBuyerPayout } from '@/lib/payouts'

/**
 * PATCH /api/admin/buyer-payouts/[id] — the payout decision on the BUYER
 * withdrawal rail (Task 119). The buyer-side twin of PATCH
 * /api/admin/payouts/[id] (the seller rail, Task 107) with the same
 * iron rules:
 *
 *   COMPLETE → money leaves the ledger NOW, inside ONE transaction:
 *     wallet balance check (409 insufficient) → decrement →
 *     walletTransactions {type:'withdrawal', amount:-amount,
 *     balanceAfter} → buyerPayouts {completed, reference, processedAt}.
 *     A completed payout with NO transfer reference is an untraceable
 *     money claim — the schema refuses one (reference required).
 *   REJECT → frees the request-time hold without ever touching the wallet
 *     (nothing was debited at request time). buyerPayouts {failed,
 *     processedAt}.
 *   Both decisions are terminal: completed/failed can never be re-decided
 *   (409). Every decision is audit-logged (before/after balance on
 *   complete) and broadcast to every admin room; the buyer gets a REAL
 *   notifications row either way.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-buyer-payout-verify', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const parsed = payoutDecisionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const { action, reference, note } = parsed.data

    const result = await db.$transaction(async (tx) => {
      const payout = await tx.buyerPayouts.findUnique({ where: { id } })
      if (!payout) return { notFound: true as const }
      if (payout.status === 'completed' || payout.status === 'failed') {
        return { decided: true as const, payout }
      }

      // Snapshot the wallet (if any) for the honest audit before/after.
      const walletNow = await tx.wallets.findFirst({ where: { userId: payout.userId } })
      const balanceBefore = walletNow?.balance ?? 0

      if (action === 'reject') {
        const updated = await tx.buyerPayouts.update({
          where: { id },
          data: { status: 'failed', processedAt: new Date() },
        })
        return { payout: updated, balanceBefore, newBalance: null }
      }

      // action === 'complete' — money leaves the ledger NOW, inside this tx.
      if (!walletNow) return { noWallet: true as const, payout }
      if (walletNow.balance < payout.amount) {
        return { insufficient: true as const, payout }
      }
      const newBalance = walletNow.balance - payout.amount
      await tx.wallets.update({ where: { id: walletNow.id }, data: { balance: newBalance } })
      await tx.walletTransactions.create({
        data: {
          walletId: walletNow.id,
          type: 'withdrawal',
          amount: -payout.amount,
          balanceAfter: newBalance,
          description: `Withdrawal settled (${payout.method}) · ref ${reference}${note ? ` · ${note}` : ''}`,
        },
      })
      const updated = await tx.buyerPayouts.update({
        where: { id },
        data: { status: 'completed', reference: reference ?? null, processedAt: new Date() },
      })
      return { payout: updated, newBalance, balanceBefore }
    })

    if ('notFound' in result && result.notFound) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }
    if ('decided' in result && result.decided) {
      return NextResponse.json(
        { error: `This payout was already decided (${result.payout.status}) — decisions are terminal` },
        { status: 409 }
      )
    }
    if ('noWallet' in result && result.noWallet) {
      return NextResponse.json({ error: 'The buyer has no wallet to debit' }, { status: 409 })
    }
    if ('insufficient' in result && result.insufficient) {
      return NextResponse.json(
        { error: `Wallet balance is below the payout amount — cannot settle ৳${result.payout.amount.toLocaleString()}` },
        { status: 409 }
      )
    }

    const payout = result.payout
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: action === 'complete' ? 'buyer_payout_completed' : 'buyer_payout_rejected',
        entityType: 'buyerPayouts',
        entityId: payout.id,
        metadata: JSON.stringify({
          actorType: 'admin',
          amount: payout.amount,
          method: payout.method,
          reference: payout.reference,
          note: note ?? null,
          before: { walletBalance: result.balanceBefore },
          after: { walletBalance: result.newBalance ?? result.balanceBefore },
        }),
      },
    })

    // REAL notification row for the buyer either way.
    await db.notifications.create({
      data: {
        userId: payout.userId,
        type: 'payment',
        title: action === 'complete' ? 'Withdrawal settled' : 'Withdrawal request rejected',
        body:
          action === 'complete'
            ? `Your ৳${payout.amount.toLocaleString()} withdrawal (${payout.method}) was settled. Transfer ref: ${payout.reference}. New balance: ৳${(result.newBalance ?? 0).toLocaleString()}.`
            : `Your ৳${payout.amount.toLocaleString()} withdrawal request was rejected. ${note ?? 'No reason recorded.'} The hold was freed and your balance was not changed.`,
        relatedEntityId: payout.id,
      },
    })

    // Live tap on every admin's own room (fire-and-forget).
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    void Promise.allSettled(
      admins.map((admin) =>
        broadcastToRoom(`admin:${admin.id}`, 'payout:changed', {
          rail: 'buyer',
          action,
          id: payout.id,
          status: payout.status,
          amount: payout.amount,
        })
      )
    )

    return NextResponse.json({
      success: true,
      data: shapeAdminBuyerPayout(payout),
      message:
        action === 'complete'
          ? 'Withdrawal settled — wallet debited with the reference on record'
          : 'Withdrawal rejected — the hold is freed, no money moved',
    })
  } catch (error) {
    console.error('Admin buyer payout decision error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
