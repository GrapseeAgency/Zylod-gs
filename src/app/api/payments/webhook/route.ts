import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { clientIp } from '@/lib/rate-limit'
import { notifyPaymentVerified, notifyPaymentRejected } from '@/lib/notifications'
import { holdEscrowInTx } from '@/lib/escrow'

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
  const rl = checkRateLimit(request, 'payments-webhook', 120, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

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
    method?: string
  }
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orderId, transactionId, amount, status } = payload
  // t229: the gateway declares the method; we validate it against the schema
  // enum instead of silently recording every gateway event as 'bank_transfer'.
  const VALID_METHODS = ['cod', 'bank_transfer', 'card', 'mobile_banking', 'wallet'] as const
  const method = VALID_METHODS.includes(payload.method as (typeof VALID_METHODS)[number])
    ? (payload.method as (typeof VALID_METHODS)[number])
    : 'bank_transfer'
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

  let payment
  await db.$transaction(async (tx) => {
    payment = await tx.payments.create({
      data: {
        orderId: order.id,
        method,
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
      // Task 71: verified webhook money is HELD in escrow per supplier.
      await holdEscrowInTx(tx, order.id, order.buyerId)
    }
    // Task 140: gateway money events leave the same evidence trail as the
    // manual verify paths — an auditLogs row INSIDE the transaction, with the
    // before/after paymentStatus and the real gateway transaction id. The
    // HMAC already proved the caller; this proves what the caller changed.
    await tx.auditLogs.create({
      data: {
        actorId: null,
        action: 'gateway_payment_recorded',
        entityType: 'payments',
        entityId: payment.id,
        metadata: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          transactionId,
          amount,
          status,
          before: { paymentStatus: order.paymentStatus },
          after: { paymentStatus: status === 'success' ? 'paid' : order.paymentStatus },
          escrowHold: status === 'success',
        }),
      },
    })
  })

  // Task 68-c: the webhook is the THIRD money path — its decision reaches the
  // buyer as a REAL notification row too (bell + list + deep-link), exactly
  // like the seller/admin manual verify paths.
  if (status === 'success') {
    void notifyPaymentVerified(order.buyerId, order.orderNumber, order.id, payment.id, amount, order.totalAmount, 'paid')
  } else {
    void notifyPaymentRejected(order.buyerId, order.orderNumber, order.id, payment.id, null)
  }

  return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber, paymentStatus: status === 'success' ? 'paid' : order.paymentStatus } })
}
