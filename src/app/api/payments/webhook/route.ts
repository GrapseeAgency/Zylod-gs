import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { clientIp } from '@/lib/rate-limit'

/**
 * POST /api/payments/webhook — THE ONLY AUTOMATED PATH THAT CAN MARK AN ORDER PAID.
 *
 * Security model (no trust in the client):
 * 1. Raw body is verified with HMAC-SHA256 against PAYMENT_WEBHOOK_SECRET
 *    (timing-safe compare). Header: `x-zylod-signature: sha256=<hex>`.
 * 2. amount in the payload must match order.totalAmount from the DB
 *    (±0.01 tolerance for gateway rounding) — a signed payload paying the
 *    wrong amount is still rejected.
 * 3. Idempotent by transactionId — replays return 200 without side effects.
 * 4. Missing secret env → 503 (honest: channel not configured), never 200.
 * 5. Invalid signatures are logged with the caller IP for audit.
 *
 * Expected JSON body:
 * { "orderId": "...", "transactionId": "...", "amount": 1234.56,
 *   "status": "success" | "failed", "gateway": "bank|bKash|Nagad|..." }
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Payment webhook is not configured (missing PAYMENT_WEBHOOK_SECRET).' },
      { status: 503 }
    )
  }

  const raw = await request.text()
  const sigHeader = request.headers.get('x-zylod-signature') || ''
  const expected = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex')

  const a = Buffer.from(sigHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    console.warn(
      `[SECURITY] Invalid payment webhook signature from ${clientIp(request)} at ${new Date().toISOString()}`
    )
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: {
    orderId?: string
    transactionId?: string
    amount?: number
    status?: string
    gateway?: string
  }
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orderId, transactionId, amount, status } = payload
  if (!orderId || !transactionId || typeof amount !== 'number' || !status) {
    return NextResponse.json(
      { error: 'orderId, transactionId, amount and status are required' },
      { status: 400 }
    )
  }
  if (!['success', 'failed'].includes(status)) {
    return NextResponse.json({ error: 'status must be success or failed' }, { status: 400 })
  }

  const order = await db.orders.findUnique({ where: { id: orderId } })
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Signed but wrong amount → refuse + audit trail
  if (Math.abs(amount - order.totalAmount) > 0.01) {
    console.warn(
      `[SECURITY] Webhook amount mismatch: paid ${amount}, order ${order.orderNumber} total ${order.totalAmount} (tx ${transactionId})`
    )
    return NextResponse.json({ error: 'Payment amount does not match the order total' }, { status: 400 })
  }

  // Idempotency: same transactionId already recorded → no double processing
  const existingTx = await db.payments.findFirst({ where: { transactionId } })
  if (existingTx) {
    return NextResponse.json({ success: true, data: { alreadyProcessed: true, paymentId: existingTx.id } })
  }

  const gatewayNote = `${payload.gateway || 'unknown-gateway'} ${new Date().toISOString()}`.slice(0, 500)

  await db.$transaction(async (tx) => {
    await tx.payments.create({
      data: {
        orderId: order.id,
        method: 'bank_transfer',
        amount,
        status: status === 'success' ? 'success' : 'failed',
        transactionId,
        gatewayResponse: gatewayNote,
        paidAt: status === 'success' ? new Date() : null,
      },
    })
    // paymentStatus transitions ONLY here (verified webhook) or via admin verify
    if (status === 'success') {
      await tx.orders.update({
        where: { id: order.id },
        data: { paymentStatus: 'paid' },
      })
    }
  })

  return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber, paymentStatus: status === 'success' ? 'paid' : order.paymentStatus } })
}
