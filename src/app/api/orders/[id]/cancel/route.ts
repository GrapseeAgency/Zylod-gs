import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * POST /api/orders/[id]/cancel — the buyer's self-service cancellation (Task
 * 57-a). House payment/fulfillment doctrine: an order is the buyer's to
 * retract ONLY before real work happened — no money verified and no shipment
 * movement. Everything else must go through the seller/admin (returns and
 * refunds are separate flows, honestly out of scope here).
 *
 * Mandate order (house contract):
 *   1) authenticateRequest → 401 FIRST.
 *   2) rate limit 10/min 'order-cancel'.
 *   3) Ownership: order not found OR buyerId !== session user → the SAME
 *      404 { error: 'Order not found' } (no-leak).
 *   4) Guards (409, verbatim real state):
 *      - paymentStatus must be 'unpaid' | 'partial' — verified/paid money is
 *        NOT self-cancellable (refund handling is a seller/admin flow).
 *      - EVERY subOrder must still be 'pending' | 'confirmed' — packed or
 *        shipped goods physically exist; cancellation cannot un-ship.
 *   5) ONE transaction:
 *      - subOrders.updateMany(pending|confirmed → cancelled) — the update is
 *        the RACE GUARD: count 0 ⇒ another request already cancelled and the
 *        whole tx rolls back (stock can never be restored twice).
 *      - payments.updateMany(pending → failed) — a cancelled order voids any
 *        unverified payment submission (the reference never becomes paid).
 *      - per orderItem: product stockQuantity INCREMENT + soldCount
 *        DECREMENT (exact mirror of the orders POST decrement), variant
 *        stock increment for variant lines — after-values collected for the
 *        product:stock broadcast (server truth, Task 56-c doctrine).
 *      - auditLogs 'order_cancelled' with real before/after.
 *   6) AFTER commit (fire-and-forget): 'order:cancelled' to order:<id> +
 *        seller:<supplierId> for every supplier + each admin's own room;
 *        'product:stock' per touched product.
 *
 * The order's paymentStatus is left exactly as it was (unpaid/partial) —
 * no money moved, so no payment transition happens here.
 */

const RATE_LIMIT = { limit: 10, windowMs: 60_000 }

const CANCELLABLE_SUBORDER_STATUSES = ['pending', 'confirmed'] as const

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

    // 3) Ownership — buyer-owner only, no-leak 404 otherwise.
    const order = await db.orders.findUnique({
      where: { id },
      include: {
        subOrders: {
          select: {
            id: true,
            status: true,
            supplierId: true,
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

    // 4b) Fulfillment guard — every subOrder must still be pre-pack. An order
    // whose subOrders are ALL already cancelled says so verbatim; anything
    // else that blocks (packed/shipped/delivered/returned) is spelled out.
    const allCancelled =
      order.subOrders.length > 0 &&
      order.subOrders.every((so) => so.status === 'cancelled')
    if (allCancelled) {
      return NextResponse.json({ error: 'This order is already cancelled' }, { status: 409 })
    }
    const blocking = order.subOrders.find(
      (so) => !CANCELLABLE_SUBORDER_STATUSES.includes(so.status as 'pending' | 'confirmed')
    )
    if (blocking) {
      return NextResponse.json(
        {
          error: `This order cannot be cancelled — a shipment is already ${blocking.status}. Contact the supplier.`,
        },
        { status: 409 }
      )
    }

    // Flat item list across every subOrder (orderItems hang off subOrders).
    const items = order.subOrders.flatMap((so) => so.items)

    // 5) ONE transaction: cancel + void pending payments + restore stock + audit.
    const result = await db.$transaction(async (tx) => {
      // RACE GUARD: only rows still pending|confirmed flip; zero rows means a
      // concurrent request won — roll back so stock is never restored twice.
      const cancelled = await tx.subOrders.updateMany({
        where: { orderId: order.id, status: { in: [...CANCELLABLE_SUBORDER_STATUSES] } },
        data: { status: 'cancelled' },
      })
      if (cancelled.count === 0) {
        throw new AlreadyCancelledError()
      }

      // Void any unverified payment submissions — the order no longer exists
      // as purchasable, so a pending reference can never be verified later.
      const paymentsVoided = await tx.payments.updateMany({
        where: { orderId: order.id, status: 'pending' },
        data: { status: 'failed' },
      })

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
            before: {
              subOrderStatuses: order.subOrders.map((so) => so.status),
              paymentStatus: order.paymentStatus,
            },
            after: {
              subOrdersCancelled: cancelled.count,
              paymentsVoided: paymentsVoided.count,
              itemsRestored: items.length,
            },
          }),
        },
      })

      return {
        subOrdersCancelled: cancelled.count,
        paymentsVoided: paymentsVoided.count,
        itemsRestored: items.length,
        stockFeed,
      }
    })

    // 6) Fire-and-forget broadcasts of REAL persisted state.
    const supplierIds = [...new Set(order.subOrders.map((so) => so.supplierId))]
    const admins = await db.users.findMany({
      where: { userType: 'admin' },
      select: { id: true },
    })
    const cancelPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      subOrdersCancelled: result.subOrdersCancelled,
    }
    void Promise.allSettled([
      broadcastToRoom(`order:${order.id}`, 'order:cancelled', cancelPayload),
      ...supplierIds.map((supplierId) =>
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
        paymentsVoided: result.paymentsVoided,
        itemsRestored: result.itemsRestored,
      },
    })
  } catch (error) {
    if (error instanceof AlreadyCancelledError) {
      return NextResponse.json({ error: 'This order is already cancelled' }, { status: 409 })
    }
    console.error('Order cancel POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Internal control-flow signal: lost the concurrent-cancel race. */
class AlreadyCancelledError extends Error {}
