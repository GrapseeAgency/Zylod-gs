import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { notifyOrderMilestone } from '@/lib/notifications'
import { resolveUnitPrice, PricingError } from '@/lib/wholesale-pricing'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * POST /api/orders/create-direct — Buy Now (single product, no cart).
 *
 * SECURITY CONTRACT (de-fake campaign Task 37/38, pricing rule Task 50-b):
 * - The server is the ONLY source of price: the recorded unitPrice is always
 *   resolved by the canonical wholesale pricing rule in
 *   src/lib/wholesale-pricing.ts (variant priceOverride → matching price
 *   tier → basePrice). Any client-sent unitPrice/supplierId/total is ignored,
 *   not validated — a client cannot choose what it pays.
 * - MOQ and maxOrderQty are enforced on the server (422 with the real limit).
 * - Variant stock is decremented atomically with a guarded update — a
 *   variant oversell returns 409 with the REAL remaining stock.
 * - Orders are ALWAYS created paymentStatus='unpaid'. No payment method in
 *   this request (or any client request) can mark an order paid. The only
 *   paths to 'paid' are the HMAC-verified payment webhook
 *   (/api/payments/webhook) or audited admin verification
 *   (/api/admin/orders/[id]/verify-payment).
 * - supplierId is taken from the product row, never from the client.
 */

/* ─── Body schema: the client never sends prices — only what it wants to buy ─── */
const createDirectSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(10000, 'Quantity exceeds the per-line limit of 10000'),
  variantId: z.string().min(1).optional().nullable(),
  shippingAddressId: z.string().min(1).optional().nullable(),
})

/** Thrown inside the transaction when stock is insufficient —
 *  carries the REAL remaining stock so the 409 states the truth. */
class StockError extends Error {
  available: number
  constructor(message: string, available: number) {
    super(message)
    this.name = 'StockError'
    this.available = available
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth-first (Task 51-a mandate), then the purchase abuse guard.
    const authResult = await requireUserType(request, ['buyer'])
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'orders-create-direct', 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const buyerId = authResult.user.id

    // NOTE: unitPrice / supplierId / totalAmount are deliberately NOT read
    // from the body — the server derives all of them from the database.
    const parsed = createDirectSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Missing required fields: productId, quantity' },
        { status: 400 }
      )
    }
    const { productId, quantity: qty, variantId, shippingAddressId } = parsed.data

    // Validate shipping address belongs to this buyer
    if (shippingAddressId) {
      const address = await db.addresses.findFirst({
        where: { id: shippingAddressId, userId: buyerId },
      })
      if (!address) {
        return NextResponse.json({ error: 'Invalid shipping address' }, { status: 400 })
      }
    }

    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()

    try {
      // Atomic creation — order + sub-order + item + tracking + pricing +
      // stock decrement all resolve inside ONE transaction.
      const order = await db.$transaction(async (tx) => {
        // Load the real product — the only source of truth for price & supplier
        const product = await tx.products.findUnique({ where: { id: productId } })
        if (!product || !product.isActive || !product.isApproved) {
          throw new PricingError('PRODUCT_NOT_FOUND', 'Product not available')
        }

        // Variant must exist and belong to this product
        let variantRef: { id: string; productId: string; priceOverride: number | null } | null = null
        if (variantId) {
          const variant = await tx.productVariants.findUnique({ where: { id: variantId } })
          if (!variant || variant.productId !== productId) {
            throw new PricingError('VARIANT_MISMATCH', 'Invalid variant for this product')
          }
          variantRef = { id: variant.id, productId: variant.productId, priceOverride: variant.priceOverride }
        }

        // Fail fast on product-level stock before pricing (variant-level
        // stock is guarded atomically at decrement time below).
        if (qty > product.stockQuantity) {
          throw new StockError(`Insufficient stock for ${product.name}`, product.stockQuantity)
        }

        // SERVER TRUTH: the recorded unitPrice always comes from the pricing
        // rule. MOQ and maxOrderQty are enforced here (PricingError → 422
        // with the real limit in `details`).
        const resolved = await resolveUnitPrice(tx, productId, qty, variantRef)

        // SECURITY: supplier always comes from the product row (anti-manipulation)
        const supplierId = product.supplierId
        if (!supplierId) {
          throw new PricingError('PRODUCT_NOT_FOUND', 'Product has no supplier assigned')
        }

        const totalPrice = resolved.unitPrice * qty

        const newOrder = await tx.orders.create({
          data: {
            buyerId,
            orderNumber,
            totalAmount: totalPrice,
            paymentStatus: 'unpaid',
            shippingAddressId: shippingAddressId || null,
          },
        })

        const subOrder = await tx.subOrders.create({
          data: {
            orderId: newOrder.id,
            supplierId,
            subtotal: totalPrice,
            status: 'pending',
            // estimatedDelivery intentionally left null — set by the supplier
            // when they actually confirm the order, never fabricated here.
          },
        })

        await tx.orderItems.create({
          data: {
            subOrderId: subOrder.id,
            productId,
            variantId: variantId || null,
            quantity: qty,
            unitPrice: resolved.unitPrice,
            totalPrice,
          },
        })

        await tx.orderTracking.create({
          data: {
            subOrderId: subOrder.id,
            status: 'pending',
            location: 'Order placed',
            note: 'Order has been created and is awaiting payment and supplier confirmation.',
          },
        })

        // VARIANT STOCK: guarded decrement — never lets a variant go negative.
        // A failed guard throws, rolling back the whole order.
        if (variantId) {
          const decremented = await tx.productVariants.updateMany({
            where: { id: variantId, stockQuantity: { gte: qty } },
            data: { stockQuantity: { decrement: qty } },
          })
          if (decremented.count === 0) {
            const current = await tx.productVariants.findUnique({
              where: { id: variantId },
              select: { variantName: true, variantValue: true, stockQuantity: true },
            })
            throw new StockError(
              `Insufficient stock for ${current?.variantName ?? 'variant'} ${current?.variantValue ?? ''}`.trim(),
              current?.stockQuantity ?? 0
            )
          }
        }

        // Product-level stock decrement + soldCount (existing behaviour kept)
        await tx.products.update({
          where: { id: productId },
          data: {
            stockQuantity: { decrement: qty },
            soldCount: { increment: qty },
          },
        })

        return { order: newOrder, subOrder, supplierId }
      })

      await notifyOrderMilestone(buyerId, order.order.orderNumber, 'confirmed', order.order.id)

      // Real-time (Task 51-a): the seller gets a live order:new push on their
      // seller:<supplierId> room — real persisted values, no buyer PII.
      void broadcastToRoom(`seller:${order.supplierId}`, 'order:new', {
        orderId: order.order.id,
        subOrderIds: [order.subOrder.id],
        itemCount: qty,
        totalAmount: order.order.totalAmount,
        createdAt: order.order.createdAt.toISOString(),
      })

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.order.id,
          orderNumber: order.order.orderNumber,
          totalAmount: order.order.totalAmount,
          paymentStatus: order.order.paymentStatus,
        },
      }, { status: 201 })
    } catch (txError) {
      if (txError instanceof StockError) {
        return NextResponse.json(
          { error: txError.message, available: txError.available },
          { status: 409 }
        )
      }
      if (txError instanceof PricingError) {
        return NextResponse.json(
          { error: txError.message, code: txError.code, ...txError.details },
          { status: txError.status }
        )
      }
      throw txError
    }
  } catch (error) {
    console.error('Direct order creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
