import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * POST /api/seller/returns/[id]/confirm-receipt — the seller confirms the
 * RETURNED GOODS physically arrived back at their warehouse (Task 60-a).
 *
 * Why this exists (cohesion): an admin approval only AUTHORIZES the goods to
 * travel back. Nothing in the platform knows when they actually arrive —
 * except the seller. This endpoint is the physical half of the returns flow:
 * confirming receipt is what restores stock/soldCount for the seller's own
 * items, exactly mirroring the cancellation restock math (Task 57/58).
 *
 * Real behavior (no fake truth):
 * - 401-first, then the supplier-profile 403, then rate limit (20/min).
 * - A return that touches NONE of this supplier's order lines returns the
 *   same 404 as a nonexistent return (no existence leak).
 * - Guards: status must be 'approved' or 'refunded' (goods only travel back
 *   after approval; the refund ledger state is about MONEY, not goods) →
 *   409 verbatim otherwise. A second receipt for the same (return, supplier)
 *   → 409 (unique (returnRequestId, supplierId) + explicit pre-check).
 * - ONE transaction: receipt row + per-item stock/soldCount restore
 *   (product.stockQuantity += qty, soldCount −= qty; variant stock += qty
 *   when the line had a variant) + auditLogs 'return_received' with REAL
 *   before/after per item.
 * - subOrders status: a subOrder of THIS supplier is marked 'returned' ONLY
 *   when EVERY item in it is fully covered by this return's quantities.
 *   Partial receipts leave the shipment status honest ('delivered') — the
 *   order still stands for the remainder.
 * - Money is NEVER touched here: refunds are the admin refunds ledger's job
 *   (POST /api/admin/returns/[id]/refund). Receipt restores GOODS, not cash.
 * - Broadcasts AFTER the tx commits: return:received to the seller's own
 *   room + every admin room + the order room; product:stock per touched
 *   product (public availability payload).
 */

const BodySchema = z
  .object({
    note: z.string().max(500).optional(),
  })
  .strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) Auth first — 401 before anything else.
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  // 2) Seller scope — a session without a real supplierProfile is honest 403.
  const profile = await resolveSupplierProfile(auth.user)
  if (!profile) {
    return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
  }

  // 3) Rate limit third.
  const rl = checkRateLimit(request, 'seller-return-receipt', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    let body: unknown = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const parsed = BodySchema.safeParse(body ?? {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const note = (parsed.data.note ?? '').trim() || null

    // 4) The return row — same 404 as nonexistent when missing.
    const existing = await db.returnRequests.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 })
    }

    // 5) THIS supplier's order lines (scoped like GET /api/seller/returns,
    //    stated cap 1000 newest lines), intersected with the return's items.
    const myOrderItems = await db.orderItems.findMany({
      where: { subOrder: { supplierId: profile.id } },
      orderBy: { id: 'desc' },
      take: 1000,
      select: { id: true },
    })
    const myItemIds = new Set(myOrderItems.map((i) => i.id))

    const returnItems = await db.returnRequestItems.findMany({
      where: { returnRequestId: id },
    })
    const myReturnItems = returnItems.filter((i) => myItemIds.has(i.orderItemId))

    // No ownership leak: a return with zero of my lines = a return I cannot
    // see (same 404 as a nonexistent one).
    if (myReturnItems.length === 0) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 })
    }

    // 6) Status guard — goods only come back after an approval; the refund
    //    ledger ('refunded') is about money and does not block the goods.
    if (existing.status !== 'approved' && existing.status !== 'refunded') {
      return NextResponse.json(
        {
          error: `This return (${existing.returnNumber}) is '${existing.status}' — goods can only be received back after the return is approved.`,
        },
        { status: 409 }
      )
    }

    // 7) Idempotency — one receipt per (return, supplier), explicit 409.
    const alreadyReceived = await db.returnReceipts.findUnique({
      where: { returnRequestId_supplierId: { returnRequestId: id, supplierId: profile.id } },
    })
    if (alreadyReceived) {
      return NextResponse.json(
        {
          error: `Receipt already confirmed for ${existing.returnNumber} on ${alreadyReceived.createdAt.toISOString()} — stock was already restored for your items.`,
        },
        { status: 409 }
      )
    }

    // 8) Real rows to restore: product/variant + before values.
    const orderItemRows = await db.orderItems.findMany({
      where: { id: { in: myReturnItems.map((i) => i.orderItemId) } },
      select: {
        id: true,
        quantity: true,
        totalPrice: true,
        productId: true,
        variantId: true,
      },
    })
    const orderItemById = new Map(orderItemRows.map((i) => [i.id, i]))

    const productIds = [...new Set(orderItemRows.map((i) => i.productId))]
    const productRows = await db.products.findMany({
      where: { id: { in: productIds } },
      select: { id: true, stockQuantity: true, soldCount: true, unit: true, bundleSize: true },
    })
    // Running stock counters (updated inside the tx) + the immutable unit/bundle
    // metadata (units never change during a restore) are kept separately so the
    // types stay honest — no fabricated defaults.
    const productBefore = new Map<string, { stockQuantity: number; soldCount: number }>(
      productRows.map((p) => [p.id, { stockQuantity: p.stockQuantity, soldCount: p.soldCount }])
    )
    const productMeta = new Map<string, { unit: string; bundleSize: number | null }>(
      productRows.map((p) => [p.id, { unit: p.unit, bundleSize: p.bundleSize }])
    )

    const variantIds = orderItemRows
      .map((i) => i.variantId)
      .filter((v): v is string => typeof v === 'string')
    const variantRows = variantIds.length
      ? await db.productVariants.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, stockQuantity: true },
        })
      : []
    const variantBefore = new Map(variantRows.map((v) => [v.id, v]))

    // Restored value = the same prorated math the seller queue displays:
    // Σ(orderItem.totalPrice × returnedQty ÷ orderedQty) over MY items.
    let restoredValue = 0
    for (const ri of myReturnItems) {
      const oi = orderItemById.get(ri.orderItemId)
      if (!oi) continue
      restoredValue += (oi.totalPrice * ri.quantity) / oi.quantity
    }
    restoredValue = Math.round(restoredValue * 100) / 100

    // 9) Which of MY subOrders are FULLY covered by this return (every item
    //    in the subOrder appears in the return with qty ≥ ordered qty)?
    //    Only those become 'returned'; partial receipts stay 'delivered'.
    const mySubOrderRows = await db.subOrders.findMany({
      where: { orderId: existing.orderId, supplierId: profile.id },
      select: { id: true, status: true, items: { select: { id: true, quantity: true } } },
    })
    const returnedQtyByOrderItem = new Map<string, number>()
    for (const ri of myReturnItems) {
      returnedQtyByOrderItem.set(ri.orderItemId, (returnedQtyByOrderItem.get(ri.orderItemId) ?? 0) + ri.quantity)
    }
    const fullyReturnedSubOrderIds = mySubOrderRows
      .filter(
        (so) =>
          so.status !== 'cancelled' &&
          so.items.length > 0 &&
          so.items.every((it) => (returnedQtyByOrderItem.get(it.id) ?? 0) >= it.quantity)
      )
      .map((so) => so.id)

    // 10) ONE transaction: receipt + stock restore + subOrder flips + audit.
    const now = new Date()
    const receipt = await db.$transaction(async (tx) => {
      const created = await tx.returnReceipts.create({
        data: {
          returnRequestId: id,
          supplierId: profile.id,
          receivedById: auth.user!.id,
          note,
          itemsRestored: myReturnItems.length,
          restoredValue,
        },
      })

      for (const ri of myReturnItems) {
        const oi = orderItemById.get(ri.orderItemId)
        if (!oi) continue
        const before = productBefore.get(oi.productId)
        const afterStock = Math.round(((before?.stockQuantity ?? 0) + ri.quantity) * 1000) / 1000
        const afterSold = Math.max(0, (before?.soldCount ?? 0) - ri.quantity)
        await tx.products.update({
          where: { id: oi.productId },
          data: { stockQuantity: afterStock, soldCount: afterSold },
        })
        productBefore.set(oi.productId, {
          stockQuantity: afterStock,
          soldCount: afterSold,
        })
        if (oi.variantId) {
          const vb = variantBefore.get(oi.variantId)
          const afterVariantStock = Math.round(((vb?.stockQuantity ?? 0) + ri.quantity) * 1000) / 1000
          await tx.productVariants.update({
            where: { id: oi.variantId },
            data: { stockQuantity: afterVariantStock },
          })
          variantBefore.set(oi.variantId, { id: oi.variantId, stockQuantity: afterVariantStock })
        }
      }

      if (fullyReturnedSubOrderIds.length > 0) {
        await tx.subOrders.updateMany({
          where: { id: { in: fullyReturnedSubOrderIds } },
          data: { status: 'returned', updatedAt: now },
        })
      }

      await tx.auditLogs.create({
        data: {
          actorId: auth.user!.id,
          action: 'return_received',
          entityType: 'returnRequests',
          entityId: id,
          metadata: JSON.stringify({
            returnNumber: existing.returnNumber,
            orderId: existing.orderId,
            supplierId: profile.id,
            itemsRestored: myReturnItems.length,
            restoredValue,
            note,
            subOrdersMarkedReturned: fullyReturnedSubOrderIds,
            perItem: myReturnItems.map((ri) => {
              const oi = orderItemById.get(ri.orderItemId)
              const pb = oi ? productBefore.get(oi.productId) : undefined
              return {
                orderItemId: ri.orderItemId,
                productId: oi?.productId ?? null,
                quantity: ri.quantity,
                stockAfter: pb?.stockQuantity ?? null,
                soldCountAfter: pb?.soldCount ?? null,
              }
            }),
          }),
        },
      })

      return created
    })

    // 11) Broadcasts AFTER commit — fire-and-forget, DB is the truth.
    const allReturnItemRows = await db.orderItems.findMany({
      where: { id: { in: returnItems.map((i) => i.orderItemId) } },
      select: { id: true, subOrder: { select: { supplierId: true } } },
    })
    const returnItemSupplierById = new Map(allReturnItemRows.map((i) => [i.id, i.subOrder.supplierId]))
    const distinctSuppliers = [...new Set(returnItems.map((ri) => returnItemSupplierById.get(ri.orderItemId)).filter((s): s is string => Boolean(s)))]

    const receipts = await db.returnReceipts.findMany({
      where: { returnRequestId: id },
      select: { supplierId: true },
    })
    const fullyReceived =
      distinctSuppliers.length > 0 && distinctSuppliers.every((sid) => receipts.some((r) => r.supplierId === sid))

    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    const receiptPayload = {
      returnId: id,
      returnNumber: existing.returnNumber,
      orderId: existing.orderId,
      supplierId: profile.id,
      itemsRestored: myReturnItems.length,
      restoredValue,
      fullyReceived,
      createdAt: receipt.createdAt.toISOString(),
    }
    void Promise.allSettled([
      broadcastToRoom(`seller:${profile.id}`, 'return:received', receiptPayload),
      ...distinctSuppliers
        .filter((sid) => sid !== profile.id)
        .map((sid) => broadcastToRoom(`seller:${sid}`, 'return:received', receiptPayload)),
      ...admins.map((a) => broadcastToRoom(`admin:${a.id}`, 'return:received', receiptPayload)),
      broadcastToRoom(`order:${existing.orderId}`, 'return:received', receiptPayload),
      ...productIds.map((pid) => {
        const p = productBefore.get(pid)
        const meta = productMeta.get(pid)
        return broadcastToRoom(`product:${pid}`, 'product:stock', {
          productId: pid,
          stockQuantity: p?.stockQuantity ?? null,
          unit: meta?.unit ?? null,
          bundleSize: meta?.bundleSize ?? null,
          inStock: (p?.stockQuantity ?? 0) > 0,
          soldCount: p?.soldCount ?? null,
        })
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        receiptId: receipt.id,
        returnNumber: existing.returnNumber,
        itemsRestored: myReturnItems.length,
        restoredValue,
        subOrdersMarkedReturned: fullyReturnedSubOrderIds,
        fullyReceived,
        createdAt: receipt.createdAt.toISOString(),
      },
      message: `Receipt confirmed for ${existing.returnNumber} — ${myReturnItems.length} item line(s) restored to your stock.`,
    })
  } catch (error) {
    console.error('Seller return receipt error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
