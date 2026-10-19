import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/seller/returns — the seller's returns queue (Task 59-a: the leg
 * that was missing). Every return request that touches THIS supplier's
 * goods: a returnRequestItem points at an orderItem, that orderItem lives
 * on a subOrder, and the subOrder carries the supplierId. A multi-supplier
 * return is ONE request on the order, so a seller sees only their own
 * items of it — never another supplier's lines, never the buyer's other
 * orders.
 *
 * Contract:
 * - 401-first (authenticateRequest), then the supplier-profile resolution —
 *   a session without a real supplierProfile gets the honest 403
 *   SUPPLIER_PROFILE_REQUIRED (never a fabricated or borrowed profile).
 * - Rate limit 30/min 'seller-returns-list'.
 * - ?status=pending|approved|rejected|refunded|all (default all), 400 on
 *   anything else. Newest-first inside the result.
 * - Resolution is the Zylod team's job (admin PATCH /api/admin/returns/[id]
 *   + refund ledger). Receipt of the returned GOODS is the seller's own
 *   action (Task 60-a): POST .../[id]/confirm-receipt restores stock for
 *   their items once the goods physically arrive — each row carries the
 *   caller's myReceipt state so the UI can offer/reflect exactly that.
 * - sellerShare = the seller's own prorated value of the returned goods:
 *   Σ(orderItem.totalPrice × returnedQty ÷ orderedQty) over their items.
 *   The return's estimatedRefund covers the whole request (all suppliers);
 *   the seller's honest slice is computed here from real order rows.
 * - Scope cap (stated, not hidden): the newest 1000 order lines of this
 *   supplier are considered when mapping return items to their goods.
 */

const TAKE_RETURNS = 50
const SCOPE_CAP_ORDER_LINES = 1000

const RETURN_STATUSES = ['pending', 'approved', 'rejected', 'refunded'] as const
type ReturnStatus = (typeof RETURN_STATUSES)[number]

export async function GET(request: NextRequest) {
  // 1) Auth first — 401 before anything else.
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2) Seller scope — no supplier profile, no seller data (honest 403).
  const profile = await resolveSupplierProfile(auth.user)
  if (!profile) {
    return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
  }

  // 3) Rate limit third.
  const rl = checkRateLimit(request, 'seller-returns-list', 30, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    // 4) Optional status filter — validated, never passed through raw.
    const statusParam = request.nextUrl.searchParams.get('status')
    if (statusParam && statusParam !== 'all' && !RETURN_STATUSES.includes(statusParam as ReturnStatus)) {
      return NextResponse.json(
        { error: `Invalid status — use one of ${RETURN_STATUSES.join(', ')} or all` },
        { status: 400 }
      )
    }

    // 5) Map this supplier's goods → the return items that reference them.
    //    orderItems → (string FK) returnRequestItems.orderItemId, so two
    //    scoped queries with a stated cap; nothing outside the supplier's
    //    own lines can ever enter the result.
    const myOrderItems = await db.orderItems.findMany({
      where: { subOrder: { supplierId: profile.id } },
      orderBy: { id: 'desc' },
      take: SCOPE_CAP_ORDER_LINES,
      select: { id: true },
    })
    const myItemIds = myOrderItems.map((i) => i.id)

    if (myItemIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const myReturnItemRows = await db.returnRequestItems.findMany({
      where: { orderItemId: { in: myItemIds } },
      select: { returnRequestId: true },
    })
    const myReturnIds = [...new Set(myReturnItemRows.map((r) => r.returnRequestId))]

    if (myReturnIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // 6) The real return requests (newest first, optional status filter).
    const returns = await db.returnRequests.findMany({
      where: {
        id: { in: myReturnIds },
        ...(statusParam && statusParam !== 'all' ? { status: statusParam } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: TAKE_RETURNS,
      select: {
        id: true,
        returnNumber: true,
        orderId: true,
        status: true,
        shippingMethod: true,
        estimatedRefund: true,
        resolutionNote: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (returns.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // 7) THIS supplier's items inside those returns, joined to the real
    //    order/product rows for names and the honest per-seller share.
    const myItems = await db.returnRequestItems.findMany({
      where: {
        returnRequestId: { in: returns.map((r) => r.id) },
        orderItemId: { in: myItemIds },
      },
    })

    const joinedOrderItems = await db.orderItems.findMany({
      where: { id: { in: myItems.map((i) => i.orderItemId) } },
      select: {
        id: true,
        quantity: true,
        totalPrice: true,
        product: { select: { name: true, unit: true } },
        variant: { select: { variantName: true, variantValue: true } },
      },
    })
    const orderItemById = new Map(joinedOrderItems.map((i) => [i.id, i]))

    // 8) Order context (orderNumber only — the seller already sees their
    //    orders; no other buyer data rides along).
    const orders = await db.orders.findMany({
      where: { id: { in: [...new Set(returns.map((r) => r.orderId))] } },
      select: { id: true, orderNumber: true, paymentStatus: true },
    })
    const orderById = new Map(orders.map((o) => [o.id, o]))

    // 8b) THIS supplier's receipt rows for these returns (Task 60-a) — one
    //     per (return, supplier) by the unique constraint, so the map is flat.
    const myReceipts = await db.returnReceipts.findMany({
      where: { returnRequestId: { in: returns.map((r) => r.id) }, supplierId: profile.id },
    })
    const receiptByReturnId = new Map(myReceipts.map((rc) => [rc.returnRequestId, rc]))

    let sellerShareTotal = 0
    const data = returns.map((r) => {
      const items = myItems
        .filter((i) => i.returnRequestId === r.id)
        .map((i) => {
          const oi = orderItemById.get(i.orderItemId)
          const prorated = oi ? Math.round(((oi.totalPrice * i.quantity) / oi.quantity) * 100) / 100 : 0
          sellerShareTotal += prorated
          return {
            id: i.id,
            orderItemId: i.orderItemId,
            productName: oi?.product.name ?? null,
            unit: oi?.product.unit ?? null,
            variant: oi?.variant
              ? `${oi.variant.variantName}: ${oi.variant.variantValue}`
              : null,
            quantity: i.quantity,
            orderedQuantity: oi?.quantity ?? null,
            reason: i.reason,
            comments: i.comments,
            estimatedItemValue: prorated,
          }
        })

      const order = orderById.get(r.orderId)
      return {
        id: r.id,
        returnNumber: r.returnNumber,
        orderId: r.orderId,
        orderNumber: order?.orderNumber ?? null,
        orderPaymentStatus: order?.paymentStatus ?? null,
        status: r.status,
        shippingMethod: r.shippingMethod,
        estimatedRefund: r.estimatedRefund,
        sellerShare: Math.round(items.reduce((s, i) => s + i.estimatedItemValue, 0) * 100) / 100,
        resolutionNote: r.resolutionNote,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        myReceipt: receiptByReturnId.has(r.id)
          ? {
              itemsRestored: receiptByReturnId.get(r.id)!.itemsRestored,
              restoredValue: receiptByReturnId.get(r.id)!.restoredValue,
              note: receiptByReturnId.get(r.id)!.note,
              createdAt: receiptByReturnId.get(r.id)!.createdAt.toISOString(),
            }
          : null,
        items,
      }
    })

    return NextResponse.json({
      success: true,
      data,
      meta: {
        count: data.length,
        sellerShareTotal: Math.round(sellerShareTotal * 100) / 100,
        note: 'Returns are reviewed and resolved by the Zylod team. Once a return is approved, confirm receipt here when the goods physically arrive — that is what restores your stock.'
      },
    })
  } catch (error) {
    console.error('Seller returns list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
