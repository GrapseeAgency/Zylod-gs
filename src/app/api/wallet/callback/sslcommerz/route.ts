import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateTransaction } from '@/lib/payments/sslcommerz'
import { creditVerifiedTopup, failTopup } from '@/lib/payments/credit'

/**
 * GET /api/wallet/callback/sslcommerz
 *
 * EasyCheckout redirects the buyer back here with POST-style params on the
 * query (val_id, tran_id, status, ...). As with bKash, the redirect itself is
 * never trusted — we call the validationserverAPI server-side and only a
 * VALID/VALIDATED response with matching amount credits the wallet.
 */
export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const valId = searchParams.get('val_id') || ''
  const tranId = searchParams.get('tran_id') || ''
  const gatewayStatus = (searchParams.get('status') || '').toUpperCase()
  const origin = process.env.APP_URL || new URL(request.url).origin
  const walletUrl = `${origin}/?page=my-wallet`

  if (gatewayStatus === 'CANCELLED' || gatewayStatus === 'UNATTEMPTED') {
    if (tranId) await failTopup(tranId, 'cancelled')
    return NextResponse.redirect(`${walletUrl}&topup=cancelled`)
  }

  if (!valId || !tranId) {
    return NextResponse.redirect(`${walletUrl}&topup=failed&reason=missing_params`)
  }

  try {
    // Server-side validation — the source of truth
    const validation = await validateTransaction(valId)
    if (!validation || !['VALID', 'VALIDATED'].includes(validation.status)) {
      await failTopup(tranId, 'failed')
      return NextResponse.redirect(`${walletUrl}&topup=failed`)
    }

    const topup = await db.walletTopups.findUnique({ where: { reference: tranId } })
    if (!topup) {
      return NextResponse.redirect(`${walletUrl}&topup=failed&reason=unknown_topup`)
    }
    if (validation.tran_id !== tranId || Math.abs(parseFloat(validation.amount) - topup.amount) > 0.01) {
      await failTopup(tranId, 'failed')
      return NextResponse.redirect(`${walletUrl}&topup=failed&reason=amount_mismatch`)
    }

    await creditVerifiedTopup({
      reference: tranId,
      gatewayTrxId: validation.bank_tran_id,
      providerDescription: `Wallet top-up via SSLCommerz ${validation.card_type} (TrxID ${validation.bank_tran_id})`,
    })

    return NextResponse.redirect(`${walletUrl}&topup=success`)
  } catch (error) {
    console.error('SSLCommerz callback error:', error)
    return NextResponse.redirect(`${walletUrl}&topup=failed`)
  }
}
