import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { notifyBackInStock, notifyVariantBackInStock } from '@/lib/stock-alerts'

/**
 * POST /api/admin/orders/[id]/cancel — the admin force-cancel override
 * (Task 59-b, queued by Task 58). The buyer's self-service cancel
 * (POST /api/orders/[id]/cancel) is deliberately narrow: unpaid money only,
 * pre-pack shipments only. This endpoint is the counterweight: an admin can
 * cancel ANY active order in ANY fulfillment state — pending, confirmed,
 * packed, shipped, even delivered — because platform-level intervention
 * (fraud, disputes, impossible orders) must not be blocked by the same
 * guards that protect buyers from themselves.
 *
 * Honest money doctrine (the whole point — no fake refunds here):
 * - payments pending          → failed (unverified references die with the
 *                               order; same as buyer cancel).
 * - order unpaid              → paymentStatus stays 'unpaid'; totalAmount
 *                               decremented to 0 (nothing was ever owed once
 *                               nothing ships — mirrors Task 57 full cancel).
 * - order paid | partial      → payments success rows → refunded, and
 *                               orders.paymentStatus → 'refunded'. The
 *                               totalAmount stays INTACT — it is the charged
 *                               historical value; the refund ledger records
 *                               that the money came back. Real money moves
 *                               OUTSIDE this system (bank/mobile banking),
 *                               exactly like the returns refund flow.
 *
 * Mechanics (mirroring the proven Task 57/58 cancel):
 * - RACE GUARD: subOrders.updateMany (id in active, status != cancelled) —
 *   count mismatch ⇒ a concurrent request won ⇒ whole tx rolls back, stock
 *   can never be restored twice.
 * - stock restore is the exact inverse of the orders POST decrement:
 *   variant stockQuantity increment + product stockQuantity increment +
 *   soldCount decrement, per item of every cancelled shipment.
 * - auditLogs 'order_force_cancelled' with REAL before/after (per-shipment
 *   statuses, paymentStatus, totalAmount, refunded amounts, reason).
 * - AFTER commit (fire-and-forget): 'order:cancelled' (force: true) to the
 *   order room + every affected seller room + every admin's own room;
 *   'product:stock' per touched product.
 *
 * Contract: 401-first (requireUserType admin) → rate limit 20/min
 * 'admin-order-cancel' → 404 unknown id (no-leak) → 409 already cancelled →
 * optional strict body { reason?: string ≤ 500 } (audit-logged).
 */

const RATE_LIMIT = { limit: 20, windowMs: 60_000 }

const bodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict()

/** Internal control-flow signal: lost the concurrent-cancel race. */
class ConcurrentCancelError extends Error {}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) Admin-only — 401 before anything else.
  const authResult = await requireUserType(request, ['admin'])
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json({ error: authResult.error || 'Admin access required' }, { status: 401 })
  }

  // 2) Rate limit second.
  const rl = checkRateLimit(request, 'admin-order-cancel', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    // Optional reason — strict body, absent/empty JSON means no reason.
    let reason: string | undefined
    const raw = await request.text().catch(() => '')
    if (raw.trim().length > 0) {
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(raw)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      const parsed = bodySchema.safeParse(parsedJson)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        return NextResponse.json(
          { error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body' },
          { status: 400 }
        )
      }
      reason = parsed.data.reason
    }

    // 3) Load the order with everything the cancel touches.
    const order = await db.orders.findUnique({
      where: { id },
      include: {
        subOrders: {
          select: {
            id: true,
            status: true,
            supplierId: true,
            subtotal: true,
            shippingCost: true,
            items: { select: { id: true, productId: true, variantId: true, quantity: true } },
          },
        },
        payments: { select: { id: true, status: true, amount: true } },
      },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const active = order.subOrders.filter((so) => so.status !== 'cancelled')
    if (active.length === 0) {
      return NextResponse.json({ error: 'This order is already cancelled' }, { status: 409 })
    }

    const wasVerifiedMoney = order.paymentStatus === 'paid' || order.paymentStatus === 'partial'

    // 4) ONE transaction: cancel everything still active, resolve money,
    //    restore stock, audit.
    const result = await db.$transaction(async (tx) => {
      // RACE GUARD: only rows not already cancelled flip; fewer rows than
      // active.length means a concurrent request won — roll back so stock
      // is never restored twice.
      const cancelled = await tx.subOrders.updateMany({
        where: { id: { in: active.map((so) => so.id) }, status: { not: 'cancelled' } },
        data: { status: 'cancelled' },
      })
      if (cancelled.count !== active.length) {
        throw new ConcurrentCancelError()
      }

      // Money: pending references always die.
      const paymentsFailed = await tx.payments.updateMany({
        where: { orderId: order.id, status: 'pending' },
        data: { status: 'failed' },
      })

      // Verified money is refunded — and the order says so honestly.
      let paymentsRefunded = 0
      let refundedAmount = 0
      if (wasVerifiedMoney) {
        const successPayments = order.payments.filter((p) => p.status === 'success')
        if (successPayments.length > 0) {
          const refunded = await tx.payments.updateMany({
            where: { orderId: order.id, status: 'success' },
            data: { status: 'refunded' },
          })
          paymentsRefunded = refunded.count
          refundedAmount = successPayments.reduce((sum, p) => sum + p.amount, 0)
        }
        await tx.orders.update({
          where: { id: order.id },
          data: { paymentStatus: 'refunded' },
        })
      } else {
        // Nothing verified: the order owes nothing once nothing ships.
        await tx.orders.update({
          where: { id: order.id },
          data: { totalAmount: 0 },
        })
      }

      // Restore stock exactly inversely to the orders POST decrement.
      const items = active.flatMap((so) => so.items)
      const stockFeed = new Map<
        string,
        { stockQuantity: number; unit: string; bundleSize: number | null; soldCount: number }
      >()
      // Task 65: variant goods this force-cancel puts back — each completes
      // only the watches pinned to THAT variant.
      const variantFeed = new Map<string, string>() // variantId → productId
      for (const item of items) {
        if (item.variantId) {
          await tx.productVariants.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: item.quantity } },
          })
          variantFeed.set(item.variantId, item.productId)
        }
        const restoredProduct = await tx.products.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: item.quantity },
            soldCount: { decrement: item.quantity },
          },
          select: { stockQuantity: true, soldCount: true, unit: true, bundleSize: true },
        })
        stockFeed.set(item.productId, {
          stockQuantity: restoredProduct.stockQuantity,
          unit: restoredProduct.unit,
          bundleSize: restoredProduct.bundleSize,
          soldCount: restoredProduct.soldCount,
        })
      }

      await tx.auditLogs.create({
        data: {
          actorId: authResult.user!.id,
          action: 'order_force_cancelled',
          entityType: 'orders',
          entityId: order.id,
          metadata: JSON.stringify({
            actorType: 'admin',
            orderNumber: order.orderNumber,
            force: true,
            reason: reason ?? null,
            before: {
              subOrderStatuses: order.subOrders.map((so) => so.status),
              paymentStatus: order.paymentStatus,
              totalAmount: order.totalAmount,
            },
            after: {
              subOrdersCancelled: cancelled.count,
              paymentsFailed: paymentsFailed.count,
              paymentsRefunded,
              refundedAmount: Math.round(refundedAmount * 100) / 100,
              itemsRestored: items.length,
              paymentStatus: wasVerifiedMoney ? 'refunded' : order.paymentStatus,
              totalAmount: wasVerifiedMoney ? order.totalAmount : 0,
            },
          }),
        },
      })

      return {
        subOrdersCancelled: cancelled.count,
        paymentsFailed: paymentsFailed.count,
        paymentsRefunded,
        refundedAmount,
        itemsRestored: items.length,
        paymentStatus: wasVerifiedMoney ? 'refunded' : order.paymentStatus,
        totalAmount: wasVerifiedMoney ? order.totalAmount : 0,
        stockFeed,
        variantFeed,
      }
    })

    // 5) Fire-and-forget broadcasts of REAL persisted state.
    const affectedSupplierIds = [...new Set(active.map((so) => so.supplierId))]
    const admins = await db.users.findMany({
      where: { userType: 'admin' },
      select: { id: true },
    })
    const cancelPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      force: true,
      paymentStatus: result.paymentStatus,
      refundedAmount: Math.round(result.refundedAmount * 100) / 100,
      subOrdersCancelled: result.subOrdersCancelled,
      totalAmount: result.totalAmount,
    }
    void Promise.allSettled([
      broadcastToRoom(`order:${order.id}`, 'order:cancelled', cancelPayload),
      ...affectedSupplierIds.map((supplierId) =>
        broadcastToRoom(`seller:${supplierId}`, 'order:cancelled', cancelPayload)
      ),
      ...admins.map((admin) =>
        broadcastToRoom(`admin:${admin.id}`, 'order:cancelled', cancelPayload)
      ),
      ...[...result.stockFeed.entries()].map(([productId, s]) =>
        broadcastToRoom(`product:${productId}`, 'product:stock', {
          productId,
          stockQuantity: s.stockQuantity,
          unit: s.unit,
          bundleSize: s.bundleSize,
          soldCount: s.soldCount,
          inStock: s.stockQuantity > 0,
        })
      ),
    ])
    // Task 61: force-cancel restores stock too — event-driven back-in-stock
    // evaluation (no cron), after commit, fire-and-forget.
    for (const productId of result.stockFeed.keys()) {
      notifyBackInStock(productId)
    }
    // Task 65: variant goods restored by this force-cancel complete the
    // watches pinned to THAT variant only.
    for (const [variantId, productId] of result.variantFeed) {
      notifyVariantBackInStock(productId, variantId)
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        subOrdersCancelled: result.subOrdersCancelled,
        paymentsFailed: result.paymentsFailed,
        paymentsRefunded: result.paymentsRefunded,
        refundedAmount: Math.round(result.refundedAmount * 100) / 100,
        itemsRestored: result.itemsRestored,
        paymentStatus: result.paymentStatus,
        totalAmount: result.totalAmount,
      },
    })
  } catch (error) {
    if (error instanceof ConcurrentCancelError) {
      return NextResponse.json(
        { error: 'This order was just updated by another request — reload and try again' },
        { status: 409 }
      )
    }
    console.error('Admin order force-cancel error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
