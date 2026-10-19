import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * POST /api/orders/[id]/cancel — the buyer's self-service cancellation (Task
 * 57-a, extended per-shipment in Task 58). House payment/fulfillment
 * doctrine: an order is the buyer's to retract ONLY before real work
 * happened — no money verified and no shipment movement. Everything else
 * must go through the seller/admin (returns → refunds is the paid-order
 * path, /api/returns + /api/admin/returns/[id]/refund).
 *
 * Body (both fields optional):
 *   { subOrderIds?: string[] } — cancel ONLY these shipments (Task 58).
 *     Omitted / empty = the whole order (every cancellable shipment).
 *     Multi-supplier orders are the NORM here (Zylod splits subOrders per
 *     supplier), so a buyer must be able to drop ONE supplier's shipment
 *     while keeping the rest.
 *
 * Mandate order (house contract):
 *   1) authenticateRequest → 401 FIRST.
 *   2) rate limit 10/min 'order-cancel'.
 *   3) Ownership: order not found OR buyerId !== session user → the SAME
 *      404 { error: 'Order not found' } (no-leak).
 *   4) Guards (409, verbatim real state):
 *      - paymentStatus must be 'unpaid' | 'partial' — verified/paid money is
 *        NOT self-cancellable (refund handling is the returns flow).
 *      - ALL subOrders already cancelled → 'This order is already cancelled'.
 *      - every SELECTED subOrder must be 'pending' | 'confirmed' — packed or
 *        shipped goods physically exist; cancellation cannot un-ship.
 *      - unknown subOrderIds → 400 (the caller owns the order; a foreign id
 *        is a client bug, not an existence leak).
 *   5) ONE transaction:
 *      - subOrders.updateMany(id in selected, pending|confirmed → cancelled)
 *        — the update IS the RACE GUARD: count < selected.length ⇒ a
 *        concurrent request changed something ⇒ whole tx rolls back (stock
 *        can never be restored twice).
 *      - FULL cancel only (no active subOrders remain): payments pending →
 *        failed. A PARTIAL cancel keeps pending references — the reference
 *        was submitted for a real remaining order and is verified against
 *        the ADJUSTED total by the same honest math.
 *      - order.totalAmount decremented by the cancelled shipments' subtotal
 *        + shippingCost (the ledger must match what is actually owed);
 *        never below 0.
 *      - per cancelled item: product stockQuantity INCREMENT + soldCount
 *        DECREMENT (exact mirror of the orders POST), variant stock
 *        increment — after-values collected for product:stock broadcasts.
 *      - auditLogs 'order_cancelled' with real before/after (incl. total
 *        adjustment + partial flag).
 *   6) AFTER commit (fire-and-forget): 'order:cancelled' to order:<id> +
 *        seller:<supplierId> for every AFFECTED supplier + each admin's own
 *        room; 'product:stock' per touched product.
 *
 * The order's paymentStatus is left exactly as it was (unpaid/partial) —
 * no verified money moved, so no payment transition happens here.
 */

const RATE_LIMIT = { limit: 10, windowMs: 60_000 }

const CANCELLABLE_SUBORDER_STATUSES = ['pending', 'confirmed'] as const

const cancelBodySchema = z
  .object({
    subOrderIds: z.array(z.string().min(1)).min(1).max(50).optional(),
  })
  .strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) Auth first — 401 before anything else.
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2) Rate limit second.
  const rl = checkRateLimit(request, 'order-cancel', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    // Optional scoped body — absent/invalid JSON means "whole order".
    let scopedIds: string[] | null = null
    const raw = await request.text().catch(() => '')
    if (raw.trim().length > 0) {
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(raw)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      const parsed = cancelBodySchema.safeParse(parsedJson)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        return NextResponse.json(
          { error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body' },
          { status: 400 }
        )
      }
      if (parsed.data.subOrderIds && parsed.data.subOrderIds.length > 0) {
        scopedIds = [...new Set(parsed.data.subOrderIds)]
      }
    }

    // 3) Ownership — buyer-owner only, no-leak 404 otherwise.
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
      },
    })
    if (!order || order.buyerId !== auth.user.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 4a) Money guard — verified payment means the seller already holds the
    // funds; self-service cannot claw that back.
    if (order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'partial') {
      return NextResponse.json(
        {
          error: `This order is ${order.paymentStatus} — paid orders cannot be self-cancelled. Contact the supplier for a refund.`,
        },
        { status: 409 }
      )
    }

    // 4b) Whole-order state guards.
    const allCancelled =
      order.subOrders.length > 0 &&
      order.subOrders.every((so) => so.status === 'cancelled')
    if (allCancelled) {
      return NextResponse.json({ error: 'This order is already cancelled' }, { status: 409 })
    }

    // Resolve the target set: the scoped shipments, or — for a whole-order
    // cancel — every shipment still pending|confirmed (already-cancelled
    // shipments from an earlier partial cancel are simply skipped; the
    // buyer's intent is "cancel everything that can still be cancelled").
    let selected = order.subOrders.filter((so) =>
      CANCELLABLE_SUBORDER_STATUSES.includes(so.status as 'pending' | 'confirmed')
    )
    if (scopedIds) {
      const known = new Set(order.subOrders.map((so) => so.id))
      const foreign = scopedIds.filter((sid) => !known.has(sid))
      if (foreign.length > 0) {
        return NextResponse.json(
          { error: 'One or more shipments do not belong to this order' },
          { status: 400 }
        )
      }
      selected = order.subOrders.filter((so) => scopedIds!.includes(so.id))
    }
    if (selected.length === 0) {
      if (scopedIds) {
        return NextResponse.json({ error: 'This shipment is already cancelled' }, { status: 409 })
      }
      // Whole-order cancel with nothing cancellable: hand the FULL list to
      // the guards below so a shipped/packed order gets its verbatim 409.
      selected = order.subOrders
    }

    // 4c) Fulfillment guard — every SELECTED subOrder must still be pre-pack.
    const allSelectedCancelled =
      selected.length > 0 && selected.every((so) => so.status === 'cancelled')
    if (allSelectedCancelled) {
      return NextResponse.json({ error: 'This shipment is already cancelled' }, { status: 409 })
    }
    const blocking = selected.find(
      (so) => !CANCELLABLE_SUBORDER_STATUSES.includes(so.status as 'pending' | 'confirmed')
    )
    if (blocking) {
      return NextResponse.json(
        {
          error: `This shipment cannot be cancelled — it is already ${blocking.status}. Contact the supplier.`,
        },
        { status: 409 }
      )
    }

    // Items whose stock must come back (only the selected shipments').
    const items = selected.flatMap((so) => so.items)

    // 5) ONE transaction: cancel + (full-cancel only) void pending payments
    //    + honest total adjustment + restore stock + audit.
    const result = await db.$transaction(async (tx) => {
      // RACE GUARD: only rows still pending|confirmed flip; fewer rows than
      // selected means a concurrent request won — roll back so stock is
      // never restored twice.
      const cancelled = await tx.subOrders.updateMany({
        where: { id: { in: selected.map((so) => so.id) }, status: { in: [...CANCELLABLE_SUBORDER_STATUSES] } },
        data: { status: 'cancelled' },
      })
      if (cancelled.count !== selected.length) {
        throw new ConcurrentCancelError()
      }

      // FULL vs PARTIAL: does any active shipment remain on the order?
      const remainingActive = order.subOrders.filter(
        (so) => !selected.some((s) => s.id === so.id) && so.status !== 'cancelled'
      ).length
      const isFullCancel = remainingActive === 0

      // Void unverified payment submissions ONLY when nothing remains — a
      // partial cancel keeps the reference valid against the ADJUSTED total.
      let paymentsVoided = 0
      if (isFullCancel) {
        const voided = await tx.payments.updateMany({
          where: { orderId: order.id, status: 'pending' },
          data: { status: 'failed' },
        })
        paymentsVoided = voided.count
      }

      // Honest ledger: the order now owes exactly what remains active.
      const cancelledValue = selected.reduce(
        (sum, so) => sum + so.subtotal + (so.shippingCost ?? 0),
        0
      )
      const totalBefore = order.totalAmount
      const totalAfter = Math.max(0, totalBefore - cancelledValue)
      if (totalAfter !== totalBefore) {
        await tx.orders.update({
          where: { id: order.id },
          data: { totalAmount: totalAfter },
        })
      }

      // Restore stock exactly inversely to the orders POST decrement.
      const stockFeed = new Map<
        string,
        { stockQuantity: number; unit: string; bundleSize: number | null; soldCount: number }
      >()
      for (const item of items) {
        if (item.variantId) {
          await tx.productVariants.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: item.quantity } },
          })
        }
        const restoredProduct = await tx.products.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: item.quantity },
            soldCount: { decrement: item.quantity },
          },
          select: {
            stockQuantity: true,
            soldCount: true,
            unit: true,
            bundleSize: true,
          },
        })
        // Sequential writes — the last write per product is the final truth.
        stockFeed.set(item.productId, {
          stockQuantity: restoredProduct.stockQuantity,
          unit: restoredProduct.unit,
          bundleSize: restoredProduct.bundleSize,
          soldCount: restoredProduct.soldCount,
        })
      }

      await tx.auditLogs.create({
        data: {
          actorId: auth.user!.id,
          action: 'order_cancelled',
          entityType: 'orders',
          entityId: order.id,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            partial: !isFullCancel,
            cancelledSubOrderIds: selected.map((so) => so.id),
            before: {
              subOrderStatuses: order.subOrders.map((so) => so.status),
              paymentStatus: order.paymentStatus,
              totalAmount: totalBefore,
            },
            after: {
              subOrdersCancelled: cancelled.count,
              remainingActive,
              paymentsVoided,
              itemsRestored: items.length,
              totalAmount: totalAfter,
            },
          }),
        },
      })

      return {
        subOrdersCancelled: cancelled.count,
        remainingActive,
        paymentsVoided,
        itemsRestored: items.length,
        totalBefore,
        totalAfter,
        stockFeed,
      }
    })

    // 6) Fire-and-forget broadcasts of REAL persisted state.
    const affectedSupplierIds = [...new Set(selected.map((so) => so.supplierId))]
    const admins = await db.users.findMany({
      where: { userType: 'admin' },
      select: { id: true },
    })
    const cancelPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      subOrdersCancelled: result.subOrdersCancelled,
      remainingActive: result.remainingActive,
      totalAmount: result.totalAfter,
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

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        subOrdersCancelled: result.subOrdersCancelled,
        remainingActive: result.remainingActive,
        paymentsVoided: result.paymentsVoided,
        itemsRestored: result.itemsRestored,
        totalBefore: result.totalBefore,
        totalAmount: result.totalAfter,
      },
    })
  } catch (error) {
    if (error instanceof ConcurrentCancelError) {
      return NextResponse.json(
        { error: 'This order was just updated by another request — reload and try again' },
        { status: 409 }
      )
    }
    console.error('Order cancel POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Internal control-flow signal: lost the concurrent-cancel race. */
class ConcurrentCancelError extends Error {}
