import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { executePayment, queryPayment } from '@/lib/payments/bkash'
import { creditVerifiedTopup, failTopup } from '@/lib/payments/credit'

/**
 * GET /api/wallet/callback/bkash?paymentID=...&status=success|cancel|failure
 *
 * bKash redirects the user here after they approve (or cancel) on the bKash
 * page. We NEVER trust the redirect query — we execute the payment server-side
 * and independently query the status before crediting.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const paymentID = searchParams.get('paymentID') || ''
  const status = (searchParams.get('status') || '').toLowerCase()
  const origin = process.env.APP_URL || new URL(request.url).origin
  const walletUrl = `${origin}/?page=my-wallet`

  if (!paymentID) {
    return NextResponse.redirect(`${walletUrl}&topup=failed&reason=missing_payment_id`)
  }

  // User cancelled on the bKash page
  if (status === 'cancel' || status === 'failure') {
    const topup = await db.walletTopups.findFirst({ where: { sessionId: paymentID } })
    if (topup) await failTopup(topup.reference, status === 'cancel' ? 'cancelled' : 'failed')
    return NextResponse.redirect(`${walletUrl}&topup=cancelled`)
  }

  try {
    // 1. Capture the payment (idempotent-safe: Completed status is checked inside)
    let trxId = ''
    let paidAmount = ''
    try {
      const executed = await executePayment(paymentID)
      trxId = executed.trxID
      paidAmount = executed.amount
    } catch {
      // Execute can fail if already captured — fall through to the status query
    }

    // 2. Independent server-side verification — the source of truth
    const verified = await queryPayment(paymentID)
    if (!verified || verified.transactionStatus !== 'Completed') {
      const topup = await db.walletTopups.findFirst({ where: { sessionId: paymentID } })
      if (topup) await failTopup(topup.reference, 'failed')
      return NextResponse.redirect(`${walletUrl}&topup=failed`)
    }
    if (!trxId) trxId = verified.trxID
    if (!paidAmount) paidAmount = verified.amount

    // 3. Find our topup by paymentID (sessionId) and check the amount matches
    const topup = await db.walletTopups.findFirst({ where: { sessionId: paymentID } })
    if (!topup) {
      return NextResponse.redirect(`${walletUrl}&topup=failed&reason=unknown_topup`)
    }
    if (Math.abs(parseFloat(paidAmount) - topup.amount) > 0.01) {
      // Paid amount differs from what we initiated — flag, don't credit
      await failTopup(topup.reference, 'failed')
      return NextResponse.redirect(`${walletUrl}&topup=failed&reason=amount_mismatch`)
    }

    // 4. Credit — idempotent via unique reference
    await creditVerifiedTopup({
      reference: topup.reference,
      gatewayTrxId: trxId,
      providerDescription: `Wallet top-up via bKash (TrxID ${trxId})`,
    })

    return NextResponse.redirect(`${walletUrl}&topup=success`)
  } catch (error) {
    console.error('bKash callback error:', error)
    return NextResponse.redirect(`${walletUrl}&topup=failed`)
  }
}
