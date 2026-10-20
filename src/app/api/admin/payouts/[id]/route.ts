import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { payoutDecisionSchema, shapeAdminPayout } from '@/lib/payouts'

/**
 * Task 107: the payout decision — the only place wallet money leaves for
 * settlements. COMPLETE debits the wallet inside the same transaction that
 * stamps the payout completed (with the admin's transfer reference — a
 * completed payout with no reference is an untraceable money claim, so the
 * drill refuses to allow one). REJECT frees the request-time hold without
 * ever touching the wallet (nothing was debited at request time — that was
 * the old flow's fake-money bug). Both decisions are terminal: a completed
 * or failed payout can never be re-decided (409).
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-payout-verify', 20, 60_000)
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
      const payout = await tx.sellerPayouts.findUnique({ where: { id } })
      if (!payout) return { notFound: true as const }
      if (payout.status === 'completed' || payout.status === 'failed') {
        return { decided: true as const, payout }
      }

      if (action === 'reject') {
        const updated = await tx.sellerPayouts.update({
          where: { id },
          data: { status: 'failed', processedAt: new Date() },
        })
        return { payout: updated }
      }

      // action === 'complete' — money leaves the ledger NOW, inside this tx.
      const profile = await tx.supplierProfiles.findUnique({
        where: { id: payout.supplierId },
        select: { userId: true },
      })
      if (!profile) return { notFound: true as const }
      const wallet = await tx.wallets.findFirst({ where: { userId: profile.userId } })
      if (!wallet) return { noWallet: true as const, payout }
      if (wallet.balance < payout.amount) {
        return { insufficient: true as const, payout }
      }
      const newBalance = wallet.balance - payout.amount
      await tx.wallets.update({ where: { id: wallet.id }, data: { balance: newBalance } })
      await tx.walletTransactions.create({
        data: {
          walletId: wallet.id,
          type: 'withdrawal',
          amount: -payout.amount,
          balanceAfter: newBalance,
          description: `Payout settled (${payout.method}) · ref ${reference}${note ? ` · ${note}` : ''}`,
        },
      })
      const updated = await tx.sellerPayouts.update({
        where: { id },
        data: { status: 'completed', reference: reference ?? null, processedAt: new Date() },
      })
      return { payout: updated }
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
      return NextResponse.json({ error: 'The supplier has no wallet to debit' }, { status: 409 })
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
        action: action === 'complete' ? 'payout_completed' : 'payout_rejected',
        entityType: 'sellerPayouts',
        entityId: payout.id,
        metadata: JSON.stringify({
          amount: payout.amount,
          method: payout.method,
          reference: payout.reference,
          note: note ?? null,
        }),
      },
    })
    await tapAllAdmins('payout:changed', {
      action,
      id: payout.id,
      status: payout.status,
      amount: payout.amount,
    })
    return NextResponse.json({ success: true, data: shapeAdminPayout(payout, undefined), message: action === 'complete' ? 'Payout settled — wallet debited with the reference on record' : 'Payout rejected — the hold is freed, no money moved' })
  } catch (error) {
    console.error('Admin payout decision error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
