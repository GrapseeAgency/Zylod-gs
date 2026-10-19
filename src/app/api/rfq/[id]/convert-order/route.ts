import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { roundQty } from '@/lib/product-contract'

/**
 * POST /api/rfq/[id]/convert-order — the buyer converts an ACCEPTED quote on
 * THEIR awarded RFQ into a REAL order (Task 55-b: RFQ chain → orders chain).
 *
 * Mandate order (mirrors GET /api/rfq/[id] and the 52-b award rail):
 *   1) authenticateRequest → 401 FIRST (nothing parses before auth).
 *   2) rate limit 20/min 'rfq-buyer-convert'.
 *   3) Ownership: rfq.buyerId === session user else 404 (no-leak — existence
 *      never crosses accounts, same pattern as GET /api/rfq/[id]). Conversion
 *      is a buyer act — admin bypass is deliberately NOT implemented.
 *   4) Zod strict body { shippingAddressId? } — unknown/extra keys rejected;
 *      a provided address must belong to this buyer exactly like orders POST
 *      (db.addresses.findFirst { id, userId }) else 400 'Invalid shipping
 *      address'.
 *   5) Guards (409s with verbatim truthful messages):
 *        - rfq.status must be 'awarded'
 *        - exactly one accepted quote on the rfq
 *        - rfq.convertedOrderId must be null (one order per accepted quote)
 *        - rfq.productId must resolve to an ACTIVE + APPROVED product —
 *          honest limitation: freeform (product-less) RFQs are NOT
 *          convertible because there is no product to order, decrement
 *          stock for, or attach to a supplier sub-order.
 *   6) quantity = roundQty(rfq.quantity ?? Σ rfqItems.quantity ?? 1) — the
 *      exact same basis the supplier quote's totalPrice was computed with.
 *      Stock guard: quantity > product.stockQuantity → 409 with the REAL
 *      remaining { available }.
 *   7) ONE transaction: order (paymentStatus 'unpaid') + ONE subOrder
 *      (supplierId = quote.supplierId — SERVER TRUTH, never client-sent) +
 *      ONE orderItem whose unitPrice is THE NEGOTIATED quote.pricePerUnit
 *      (overrides the pricing rule entirely — NO resolveUnitPrice, NO MOQ
 *      check: this deal was negotiated between buyer and supplier) + product
 *      stockQuantity decrement / soldCount increment + rfq.convertedOrderId /
 *      convertedOrderNumber stamped in the SAME transaction (atomic — nothing
 *      half-written) + auditLogs 'rfq_converted_to_order'.
 *   8) AFTER commit: fire-and-forget broadcasts of REAL persisted state —
 *      'rfq:converted' to rfq:<id> (buyer/multi-tab watchers) AND 'order:new'
 *      to seller:<supplierId> with the EXACT payload shape orders POST uses,
 *      so the seller's live feed treats a converted RFQ order identically.
 *      The socket service being down NEVER fails the request (DB is truth).
 */

const RATE_LIMIT = { limit: 20, windowMs: 60_000 }

const convertSchema = z
  .object({
    shippingAddressId: z.string().min(1).optional().nullable(),
  })
  .strict()

/** Thrown inside the transaction when stock vanished between the pre-check
 *  and the write — carries the REAL remaining stock so the 409 tells truth. */
class InsufficientStockError extends Error {
  available: number
  constructor(message: string, available: number) {
    super(message)
    this.name = 'InsufficientStockError'
    this.available = available
  }
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

  // 2) Rate limit second (mandated order).
  const rl = checkRateLimit(request, 'rfq-buyer-convert', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const buyerId = auth.user.id

    // 3) Ownership — buyer-owner only, no-leak 404 otherwise (no admin bypass:
    //    conversion is a buyer act; admins have oversight, not purchase power).
    const rfq = await db.rfqRequests.findUnique({
      where: { id },
      include: { items: { select: { quantity: true } } },
    })
    if (!rfq || rfq.buyerId !== buyerId) {
      return NextResponse.json({ error: 'RFQ request not found' }, { status: 404 })
    }

    // 4) Zod strict — verbatim parse error on unknown/invalid bodies.
    let rawBody: unknown = undefined
    try {
      const text = await request.text()
      if (text.trim().length > 0) rawBody = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = convertSchema.safeParse(rawBody ?? {})
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body' },
        { status: 400 }
      )
    }
    const { shippingAddressId } = parsed.data

    // Address validation identical to orders POST: must belong to THIS buyer.
    if (shippingAddressId) {
      const address = await db.addresses.findFirst({
        where: { id: shippingAddressId, userId: buyerId },
      })
      if (!address) {
        return NextResponse.json({ error: 'Invalid shipping address' }, { status: 400 })
      }
    }

    // 5a) Status guard — only an awarded RFQ (accepted quote decided) converts.
    if (rfq.status !== 'awarded') {
      return NextResponse.json(
        { error: `Cannot convert an RFQ with status "${rfq.status}"` },
        { status: 409 }
      )
    }

    // 5b) Exactly one accepted quote — that negotiation is what becomes an order.
    const quote = await db.rfqQuotes.findFirst({
      where: { rfqId: id, status: 'accepted' },
    })
    if (!quote) {
      return NextResponse.json({ error: 'No accepted quote on this RFQ' }, { status: 409 })
    }

    // 5c) One order per accepted quote — idempotency guard.
    if (rfq.convertedOrderId) {
      return NextResponse.json(
        { error: `This RFQ has already been converted to order ${rfq.convertedOrderNumber ?? ''}`.trim() },
        { status: 409 }
      )
    }

    // 5d) The RFQ must be linked to a LIVE marketplace product. Honest
    //     limitation: freeform RFQs describe a need, not an orderable SKU.
    const product = rfq.productId
      ? await db.products.findUnique({ where: { id: rfq.productId } })
      : null
    if (!product || !product.isActive || !product.isApproved) {
      return NextResponse.json(
        { error: 'This RFQ is not linked to a live marketplace product and cannot be converted to an order' },
        { status: 409 }
      )
    }

    // 6) Same quantity basis the supplier's totalPrice was computed with.
    const quantity = roundQty(rfq.quantity ?? rfq.items.reduce((s, it) => s + it.quantity, 0) ?? 1)
    if (!(quantity > 0)) {
      return NextResponse.json({ error: 'This RFQ has no convertible quantity' }, { status: 409 })
    }
    if (quantity > product.stockQuantity) {
      return NextResponse.json(
        { error: `Insufficient stock for ${product.name}`, available: product.stockQuantity },
        { status: 409 }
      )
    }

    // 7) ONE transaction — order + subOrder + item + stock + rfq stamp + audit.
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
    const totalAmount = roundQty(quote.pricePerUnit * quantity)

    const { order, subOrder, stockAfter } = await db.$transaction(async (tx) => {
      const newOrder = await tx.orders.create({
        data: {
          buyerId,
          orderNumber,
          totalAmount,
          paymentStatus: 'unpaid',
          shippingAddressId: shippingAddressId ?? null,
        },
      })

      // SERVER TRUTH: the sub-order's supplier is the quote's supplier
      // (rfqQuotes.supplierId → supplierProfiles.id) — never client-sent.
      const newSubOrder = await tx.subOrders.create({
        data: {
          orderId: newOrder.id,
          supplierId: quote.supplierId,
          subtotal: totalAmount,
          status: 'pending',
        },
      })

      // THE NEGOTIATED PRICE OVERRIDES the pricing rule: unitPrice is the
      // accepted quote's pricePerUnit. NO resolveUnitPrice, NO MOQ check —
      // the deal was negotiated; re-applying list-price rules would betray it.
      await tx.orderItems.create({
        data: {
          subOrderId: newSubOrder.id,
          productId: product.id,
          quantity,
          unitPrice: quote.pricePerUnit,
          totalPrice: totalAmount,
        },
      })

      // Guarded decrement inside the tx: if stock vanished since the
      // pre-check the whole transaction rolls back (never oversell).
      const decremented = await tx.products.updateMany({
        where: { id: product.id, stockQuantity: { gte: quantity } },
        data: {
          stockQuantity: { decrement: quantity },
          soldCount: { increment: quantity },
        },
      })
      if (decremented.count === 0) {
        const current = await tx.products.findUnique({
          where: { id: product.id },
          select: { name: true, stockQuantity: true },
        })
        throw new InsufficientStockError(
          `Insufficient stock for ${current?.name ?? product.name}`,
          current?.stockQuantity ?? 0
        )
      }

      // Read back the REAL persisted after-values (Task 56-c) so the
      // product:stock PDP broadcast after commit carries server truth.
      const stockAfter = await tx.products.findUnique({
        where: { id: product.id },
        select: { stockQuantity: true, soldCount: true, unit: true, bundleSize: true },
      })

      // The conversion stamp lands in the SAME transaction as the order —
      // re-conversion is impossible even under concurrent double-clicks.
      await tx.rfqRequests.update({
        where: { id },
        data: { convertedOrderId: newOrder.id, convertedOrderNumber: orderNumber },
      })

      // Audit mirror of the accept route's before/after shape.
      await tx.auditLogs.create({
        data: {
          actorId: buyerId,
          action: 'rfq_converted_to_order',
          entityType: 'rfqRequests',
          entityId: id,
          metadata: JSON.stringify({
            before: { convertedOrderId: null, status: rfq.status },
            after: { convertedOrderId: newOrder.id, convertedOrderNumber: orderNumber },
          }),
        },
      })

      return { order: newOrder, subOrder: newSubOrder, stockAfter }
    })

    // 8) Fire-and-forget broadcasts of REAL persisted state — the socket
    //    service being down NEVER fails the request (designed degradation).
    //    The seller payload is byte-compatible with orders POST's 'order:new'
    //    so the seller live feed treats this exactly like any other order.
    //    Task 56-c: the product's PUBLIC PDP room also gets the canonical
    //    product:stock availability event from the post-decrement row.
    void Promise.allSettled([
      broadcastToRoom(`rfq:${id}`, 'rfq:converted', {
        rfqId: id,
        orderId: order.id,
        orderNumber,
        totalAmount,
      }),
      broadcastToRoom(`seller:${quote.supplierId}`, 'order:new', {
        orderId: order.id,
        subOrderIds: [subOrder.id],
        itemCount: quantity,
        totalAmount,
        createdAt: order.createdAt.toISOString(),
      }),
      ...(stockAfter
        ? [
            broadcastToRoom(`product:${product.id}`, 'product:stock', {
              productId: product.id,
              stockQuantity: stockAfter.stockQuantity,
              unit: stockAfter.unit,
              bundleSize: stockAfter.bundleSize,
              soldCount: stockAfter.soldCount,
              inStock: stockAfter.stockQuantity > 0,
            }),
          ]
        : []),
    ])

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: order.id,
          orderNumber,
          totalAmount,
          quantity,
          unitPrice: quote.pricePerUnit,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: error.message, available: error.available },
        { status: 409 }
      )
    }
    console.error('RFQ convert-order POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
