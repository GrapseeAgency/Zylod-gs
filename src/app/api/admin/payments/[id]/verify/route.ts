import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { notifyPaymentVerified, notifyPaymentRejected } from '@/lib/notifications'
import { holdEscrowInTx } from '@/lib/escrow'

/**
 * POST /api/admin/payments/[id]/verify — the ADMIN's override half of the
 * manual payment leg (Task 56-b). Same semantics as the seller verify
 * (POST /api/seller/payments/[id]/verify) — admins can decide ANY payment on
 * ANY order (an override path for when the seller is unresponsive or the
 * buyer disputes) — but the actor is the platform: auditLogs carry
 * actorType 'admin' and the admin's userId.
 *
 * Mandate order (house contract):
 *   1) requireUserType(['admin']) → 401 FIRST.
 *   2) rate limit 20/min 'admin-payment-verify'.
 *   3) payment findUnique (with order) → 404 'Payment not found' when absent.
 *   4) Zod STRICT: { action: 'verify' | 'reject', note?: ≤500 }.
 *   5) Guard: payment.status must be 'pending' else 409
 *      `Payment already <status>` (verbatim real status).
 *   6) ONE transaction:
 *      - payment → 'success' (verify, paidAt=now) or 'failed' (reject);
 *        gatewayResponse gains the verification annex JSON.
 *      - verify ONLY → honest math: amount ≥ order.totalAmount − 0.01 →
 *        orders.paymentStatus 'paid' ELSE 'partial' (a genuinely smaller
 *        payment leaves the order honestly PARTIAL). reject → order
 *        untouched.
 *      - auditLogs 'payment_verified' | 'payment_rejected' with real
 *        before/after and actorType 'admin'.
 *   7) AFTER commit, fire-and-forget: 'payment:verified'/'payment:rejected'
 *      to order:<orderId>, seller:<supplierId> for every supplier on the
 *      order, and each admin's own admin:<adminUserId> room.
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
 * breaking its JSON-parseability (same policy as the seller verify route):
 * a JSON-object previous value gains a `verification` key on the SAME
 * object; non-JSON values (e.g. the webhook's plain note) get the annex
 * appended as a separate JSON block.
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
  // 1) Admin auth first — 401 before anything else.
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  // 2) Rate limit second (mandated order).
  const rl = checkRateLimit(request, 'admin-payment-verify', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const payment = await db.payments.findUnique({
      where: { id },
      include: { order: { include: { subOrders: { select: { supplierId: true } } } } },
    })
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
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

    // 5) Only a pending submission can be decided.
    if (payment.status !== 'pending') {
      return NextResponse.json(
        { error: `Payment already ${payment.status}` },
        { status: 409 }
      )
    }

    // 6) ONE transaction: payment flip (+ honest order math on verify) + audit.
    const newPaymentStatus = verifying ? 'success' : 'failed'
    const verificationAnnex = {
      verification: {
        action,
        actorType: 'admin',
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
        // Task 71: verified money is HELD in escrow per supplier (idempotent).
        await holdEscrowInTx(tx, payment.order.id, payment.order.buyerId)
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
            actorType: 'admin',
            amount: payment.amount,
            orderTotal: payment.order.totalAmount,
            before: { paymentStatus: payment.status, orderPaymentStatus: payment.order.paymentStatus },
            after: { paymentStatus: newPaymentStatus, orderPaymentStatus: newOrderPaymentStatus },
          }),
        },
      })
    })

    // 7) Fire-and-forget broadcasts of REAL persisted state.
    const supplierIds = [...new Set(payment.order.subOrders.map((so) => so.supplierId))]
    const admins = await db.users.findMany({
      where: { userType: 'admin' },
      select: { id: true },
    })
    const payload = {
      orderId: payment.order.id,
      orderNumber: payment.order.orderNumber,
      paymentId: payment.id,
      paymentStatus: newPaymentStatus,
      orderPaymentStatus: newOrderPaymentStatus,
      amountPaid: payment.amount,
      orderTotal: payment.order.totalAmount,
    }
    void Promise.allSettled([
      broadcastToRoom(`order:${payment.order.id}`, verifying ? 'payment:verified' : 'payment:rejected', payload),
      ...supplierIds.map((supplierId) =>
        broadcastToRoom(`seller:${supplierId}`, verifying ? 'payment:verified' : 'payment:rejected', payload)
      ),
      ...admins.map((admin) =>
        broadcastToRoom(`admin:${admin.id}`, verifying ? 'payment:verified' : 'payment:rejected', payload)
      ),
    ])

    // Task 68-c: admin override decisions reach the buyer as REAL rows too.
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
    console.error('Admin payment verify POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
