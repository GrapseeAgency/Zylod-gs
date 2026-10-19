import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * POST /api/orders/[id]/payment-submit — the buyer's MANUAL payment leg
 * (Task 56-b). The verified webhook (POST /api/payments/webhook) is the only
 * AUTOMATED path that flips paymentStatus; this route is the missing manual
 * path it pairs with: a buyer who paid by bKash/bank/COD/etc. submits their
 * payment reference here, a payments row is recorded with status 'pending',
 * and the SELLER (or an admin) verifies it through
 * /api/seller/payments/[id]/verify · /api/admin/payments/[id]/verify —
 * the only routes that may transition orders.paymentStatus besides the
 * webhook (paymentStatus transitions ONLY here via verify, or the webhook).
 *
 * Mandate order (house contract):
 *   1) authenticateRequest → 401 FIRST.
 *   2) rate limit 10/min 'order-payment-submit'.
 *   3) Ownership: order not found OR buyerId !== session user → the SAME
 *      404 { error: 'Order not found' } (no-leak — existence never crosses
 *      accounts).
 *   4) Guard: order.paymentStatus must be 'unpaid' | 'partial' else 409
 *      spelling the current status (paid/refunded orders take no submissions).
 *   5) Zod STRICT body — unknown fields rejected:
 *        method        enum ['bank_transfer','mobile_banking','cod','wallet','card']
 *        brand?        trimmed 1..40        (bKash / Nagad / Rocket / bank name)
 *        transactionId /^[A-Za-z0-9\-_]{6,64}$/  (the human payment reference)
 *        senderNumber? /^\+?[0-9]{6,20}$/     (wallet/sender msisdn)
 *        note?         trimmed ≤500
 *        amount?       positive number ≤ order.totalAmount (server defaults
 *                      it to the FULL order total when omitted)
 *   6) transactionId uniqueness across the payments table: same order →
 *      409 'This transaction ID was already submitted for this order';
 *      a DIFFERENT order → 409 'This transaction ID is already used by
 *      another order' (a reference is globally unique, like the webhook's
 *      idempotency check).
 *   7) ONE transaction: payments row {status:'pending', …,
 *      gatewayResponse: JSON {brand, senderNumber, note, submittedAt}} +
 *      auditLogs 'payment_submitted' with the real before/after.
 *   8) AFTER commit (fire-and-forget doctrine — the socket service being
 *      down never fails the request): 'payment:submitted' to
 *      seller:<supplierId> for EVERY distinct subOrder supplierId, to each
 *      admin's own admin:<adminUserId> room (the house admin-room convention
 *      — room-token authorizes admins to their own id only), and to
 *      order:<orderId>.
 *
 * Response 201 { success: true, data: { paymentId, status: 'pending', orderNumber } }.
 */

const RATE_LIMIT = { limit: 10, windowMs: 60_000 }

const PAYMENT_METHODS = ['bank_transfer', 'mobile_banking', 'cod', 'wallet', 'card'] as const

const submitSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  brand: z.string().trim().min(1).max(40).optional(),
  transactionId: z
    .string()
    .regex(/^[A-Za-z0-9\-_]{6,64}$/, 'transactionId must be 6-64 characters (letters, numbers, dash, underscore)'),
  senderNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{6,20}$/, 'senderNumber must be 6-20 digits, optionally starting with +')
    .optional(),
  note: z.string().trim().max(500).optional(),
  amount: z.number().positive('amount must be greater than 0').optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) Auth first — 401 before anything else.
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2) Rate limit second (mandated order).
  const rl = checkRateLimit(request, 'order-payment-submit', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    // 3) Ownership — the buyer-owner only, no-leak 404 otherwise.
    const order = await db.orders.findUnique({
      where: { id },
      include: { subOrders: { select: { supplierId: true } } },
    })
    if (!order || order.buyerId !== auth.user.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 4) Only orders that can still take money.
    if (order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'partial') {
      return NextResponse.json(
        { error: `This order is already ${order.paymentStatus} — no further payment submissions are accepted` },
        { status: 409 }
      )
    }

    // 5) Zod strict — verbatim issue on failure.
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = submitSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body' },
        { status: 400 }
      )
    }
    const { method, brand, transactionId, senderNumber, note } = parsed.data
    // Server truth: an omitted amount means the FULL order total; a supplied
    // amount can never exceed the order total.
    const amount = parsed.data.amount ?? order.totalAmount
    if (amount > order.totalAmount) {
      return NextResponse.json(
        { error: `amount ${amount} exceeds the order total ${order.totalAmount}` },
        { status: 400 }
      )
    }

    // 6) Transaction-reference uniqueness — global across orders.
    const existingTx = await db.payments.findFirst({ where: { transactionId } })
    if (existingTx) {
      if (existingTx.orderId === order.id) {
        return NextResponse.json(
          { error: 'This transaction ID was already submitted for this order' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'This transaction ID is already used by another order' },
        { status: 409 }
      )
    }

    const gatewayResponse = JSON.stringify({
      brand: brand ?? null,
      senderNumber: senderNumber ?? null,
      note: note ?? null,
      submittedAt: new Date().toISOString(),
    })

    // 7) ONE transaction: the pending payment + its audit row.
    const payment = await db.$transaction(async (tx) => {
      const created = await tx.payments.create({
        data: {
          orderId: order.id,
          method,
          amount,
          status: 'pending',
          transactionId,
          gatewayResponse,
        },
      })
      await tx.auditLogs.create({
        data: {
          actorId: auth.user!.id,
          action: 'payment_submitted',
          entityType: 'payments',
          entityId: created.id,
          metadata: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            before: { paymentStatus: order.paymentStatus },
            after: { submission: created.id, amount, method },
          }),
        },
      })
      return created
    })

    // 8) Fire-and-forget broadcasts of REAL persisted state — seller rooms
    //    (one per distinct supplier), each admin's own room, the order room.
    const supplierIds = [...new Set(order.subOrders.map((so) => so.supplierId))]
    const admins = await db.users.findMany({
      where: { userType: 'admin' },
      select: { id: true },
    })
    const payload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: payment.id,
      amount,
      method,
      transactionId,
    }
    void Promise.allSettled([
      ...supplierIds.map((supplierId) => broadcastToRoom(`seller:${supplierId}`, 'payment:submitted', payload)),
      ...admins.map((admin) => broadcastToRoom(`admin:${admin.id}`, 'payment:submitted', payload)),
      broadcastToRoom(`order:${order.id}`, 'payment:submitted', payload),
    ])

    return NextResponse.json(
      {
        success: true,
        data: {
          paymentId: payment.id,
          status: payment.status,
          orderNumber: order.orderNumber,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Order payment-submit POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
