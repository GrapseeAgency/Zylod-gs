import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateTransaction } from '@/lib/payments/sslcommerz'
import { creditVerifiedTopup } from '@/lib/payments/credit'

/**
 * POST /api/wallet/ipn/sslcommerz
 *
 * Server-to-server Instant Payment Notification. Same verification path as the
 * redirect callback; creditVerifiedTopup is idempotent so double-fires are safe.
 * Respond 200 so SSLCommerz stops retrying.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let valId = ''
    let tranId = ''

    if (contentType.includes('application/json')) {
      const body = await request.json()
      valId = body.val_id || ''
      tranId = body.tran_id || ''
    } else {
      const formData = await request.formData()
      valId = String(formData.get('val_id') || '')
      tranId = String(formData.get('tran_id') || '')
    }

    if (!valId || !tranId) {
      return NextResponse.json({ error: 'missing params' }, { status: 400 })
    }

    const validation = await validateTransaction(valId)
    if (!validation || !['VALID', 'VALIDATED'].includes(validation.status)) {
      return NextResponse.json({ error: 'validation failed' }, { status: 400 })
    }

    const topup = await db.walletTopups.findUnique({ where: { reference: tranId } })
    if (!topup) {
      return NextResponse.json({ error: 'unknown topup' }, { status: 404 })
    }

    if (validation.tran_id === tranId && Math.abs(parseFloat(validation.amount) - topup.amount) <= 0.01) {
      await creditVerifiedTopup({
        reference: tranId,
        gatewayTrxId: validation.bank_tran_id,
        providerDescription: `Wallet top-up via SSLCommerz ${validation.card_type} IPN (TrxID ${validation.bank_tran_id})`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('SSLCommerz IPN error:', error)
    return NextResponse.json({ error: 'IPN processing failed' }, { status: 500 })
  }
}
