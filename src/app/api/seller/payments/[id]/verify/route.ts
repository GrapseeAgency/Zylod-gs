import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { notifyPaymentVerified, notifyPaymentRejected } from '@/lib/notifications'

/**
 * POST /api/seller/payments/[id]/verify — the SELLER's half of the manual
 * payment leg (Task 56-b). The buyer submitted a payment reference via
 * POST /api/orders/[id]/payment-submit (status 'pending'); the seller who
 * ships that order confirms — after checking their own bank/wallet — that
 * the money really arrived (verify) or did not (reject). Together with
 * /api/admin/payments/[id]/verify and the verified webhook, this is one of
 * the ONLY places orders.paymentStatus transitions (house payment doctrine).
 *
 * Mandate order (house contract):
 *   1) authenticateRequest → 401 FIRST.
 *   2) supplier-profile resolution → honest 403 SUPPLIER_PROFILE_REQUIRED.
 *   3) rate limit 20/min 'seller-payment-verify'.
 *   4) Scope/no-leak: payment not found OR its order carries no subOrder
 *      under THIS supplier → the SAME 404 { error: 'Payment not found' }
 *      (existence never crosses suppliers).
 *   5) Zod STRICT: { action: 'verify' | 'reject', note?: ≤500 }.
 *   6) Guard: payment.status must be 'pending' else 409
 *      `Payment already <status>` (verbatim real status).
 *   7) ONE transaction:
 *      - payment → 'success' (verify, paidAt=now) or 'failed' (reject,
 *        paidAt=null); gatewayResponse gains a verification annex JSON.
 *      - verify ONLY → honest math against the order total: amount ≥
 *        total − 0.01 (gateway-rounding tolerance, same as the webhook)
 *        → orders.paymentStatus 'paid', ELSE 'partial' (a genuinely smaller
 *        payment leaves the order honestly PARTIAL). reject → order
 *        untouched.
 *      - auditLogs 'payment_verified' | 'payment_rejected' with real
 *        before/after (actor = the seller's userId).
 *   8) AFTER commit, fire-and-forget: 'payment:verified'/'payment:rejected'
 *      to order:<orderId>, seller:<supplierId>, and each admin's own
 *      admin:<adminUserId> room (house admin-room convention).
 *
 * Response 200 { paymentId, paymentStatus, orderPaymentStatus, amountPaid,
 * orderTotal } — both amounts spelled out so the partial math is visible.
 */

const RATE_LIMIT = { limit: 20, windowMs: 60_000 }

const verifySchema = z
  .object({
    action: z.enum(['verify', 'reject']),
    note: z.string().trim().max(500).optional(),
  })
  .strict()

/**
 * Merge the verification annex into the payment's gatewayResponse WITHOUT
 * breaking its JSON-parseability: when the previous value is a JSON object
 * (the payment-submit shape), the annex becomes a `verification` key on the
 * SAME object — consumers (seller/admin lists) keep extracting brand /
 * submittedAt. Non-JSON previous values (e.g. the webhook's plain note) get
 * the annex appended as a separate JSON block.
 */
function mergeGatewayResponse(previous: string | null, annex: Record<string, unknown>): string {
  if (previous) {
    try {
      const parsed: unknown = JSON.parse(previous)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return JSON.stringify({ ...(parsed as Record<string, unknown>), ...annex }).slice(0, 2000)
      }
    } catch {
      /* not JSON — fall through to the append form */
    }
  }
  return `${previous ? `${previous} ` : ''}${JSON.stringify(annex)}`.slice(0, 2000)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) Auth first — 401 before anything else.
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2) Seller scope — no supplier profile, no seller actions (honest 403).
  const profile = await resolveSupplierProfile(auth.user)
  if (!profile) {
    return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
  }

  // 3) Rate limit third (mandated order for this route: profile before limiter).
  const rl = checkRateLimit(request, 'seller-payment-verify', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    // 4) Load the payment WITH its order and sub-orders, then scope to this
    //    supplier — not found and not-yours are the SAME 404.
    const payment = await db.payments.findUnique({
      where: { id },
      include: { order: { include: { subOrders: { select: { supplierId: true } } } } },
    })
    if (!payment || !payment.order.subOrders.some((so) => so.supplierId === profile.id)) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // 5) Zod strict — verbatim issue on failure.
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

    // 6) Only a pending submission can be decided.
    if (payment.status !== 'pending') {
      return NextResponse.json(
        { error: `Payment already ${payment.status}` },
        { status: 409 }
      )
    }

    // 7) ONE transaction: payment flip (+ honest order math on verify) + audit.
    const newPaymentStatus = verifying ? 'success' : 'failed'
    const verificationAnnex = {
      verification: {
        action,
        actorType: 'seller',
        actorId: auth.user.id,
        note: note ?? null,
        at: new Date().toISOString(),
      },
    }
    const mergedGatewayResponse = mergeGatewayResponse(payment.gatewayResponse, verificationAnnex)

    // Honest math (spell both amounts): a verify marks the order paid only
    // when the money actually covers the total (±0.01 gateway tolerance).
    const coversTotal = verifying && payment.amount >= payment.order.totalAmount - 0.01
    const newOrderPaymentStatus = coversTotal ? 'paid' : verifying ? 'partial' : payment.order.paymentStatus

    await db.$transaction(async (tx) => {
      await tx.payments.update({
        where: { id: payment.id },
        data: {
          status: newPaymentStatus,
          paidAt: verifying ? new Date() : null,
          gatewayResponse: mergedGatewayResponse,
        },
      })
      if (verifying) {
        await tx.orders.update({
          where: { id: payment.order.id },
          data: { paymentStatus: newOrderPaymentStatus },
        })
      }
      await tx.auditLogs.create({
        data: {
          actorId: auth.user!.id,
          action: verifying ? 'payment_verified' : 'payment_rejected',
          entityType: 'payments',
          entityId: payment.id,
          metadata: JSON.stringify({
            orderId: payment.order.id,
            orderNumber: payment.order.orderNumber,
            actorType: 'seller',
            supplierId: profile.id,
            amount: payment.amount,
            orderTotal: payment.order.totalAmount,
            before: { paymentStatus: payment.status, orderPaymentStatus: payment.order.paymentStatus },
            after: { paymentStatus: newPaymentStatus, orderPaymentStatus: newOrderPaymentStatus },
          }),
        },
      })
    })

    // 8) Fire-and-forget broadcasts of REAL persisted state.
    const payload = {
      orderId: payment.order.id,
      orderNumber: payment.order.orderNumber,
      paymentId: payment.id,
      paymentStatus: newPaymentStatus,
      orderPaymentStatus: newOrderPaymentStatus,
      amountPaid: payment.amount,
      orderTotal: payment.order.totalAmount,
    }
    const admins = await db.users.findMany({
      where: { userType: 'admin' },
      select: { id: true },
    })
    void Promise.allSettled([
      broadcastToRoom(`order:${payment.order.id}`, verifying ? 'payment:verified' : 'payment:rejected', payload),
      broadcastToRoom(`seller:${profile.id}`, verifying ? 'payment:verified' : 'payment:rejected', payload),
      ...admins.map((admin) =>
        broadcastToRoom(`admin:${admin.id}`, verifying ? 'payment:verified' : 'payment:rejected', payload)
      ),
    ])

    // Task 68-c: the buyer learns the decision from a REAL notification row
    // (bell + list + deep-link to the exact payment), not only from a room
    // broadcast that requires the order page to be open right now.
    if (verifying) {
      void notifyPaymentVerified(
        payment.order.buyerId,
        payment.order.orderNumber,
        payment.order.id,
        payment.id,
        payment.amount,
        payment.order.totalAmount,
        newOrderPaymentStatus
      )
    } else {
      void notifyPaymentRejected(payment.order.buyerId, payment.order.orderNumber, payment.order.id, payment.id, note ?? null)
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.id,
        paymentStatus: newPaymentStatus,
        orderPaymentStatus: newOrderPaymentStatus,
        amountPaid: payment.amount,
        orderTotal: payment.order.totalAmount,
      },
    })
  } catch (error) {
    console.error('Seller payment verify POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
