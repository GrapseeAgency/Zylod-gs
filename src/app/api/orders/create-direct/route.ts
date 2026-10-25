import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { notifyOrderMilestone } from '@/lib/notifications'
import { resolveUnitPrice, PricingError } from '@/lib/wholesale-pricing'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { roundQty } from '@/lib/product-contract'
import { buildAddressSnapshot } from '@/lib/addresses'
import { computeQuote, shipmentWeightKg } from '@/lib/shipping'
import { activePromotionFilter, resolveBestPromotionApplication, claimPromotionUsage } from '@/lib/promotions'
import { PromotionUsageError } from '@/lib/promotions-errors'

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
    .positive('Quantity must be greater than 0')
    .max(10000, 'Quantity exceeds the per-line limit of 10000'),
  variantId: z.string().min(1).optional().nullable(),
  // t190 SECURITY HARDENING: a wholesale order ships physical goods — an
  // order without a real shipping address can never be fulfilled, so the
  // address is REQUIRED (the address must also belong to the buyer —
  // validated below). The buy-now page always sends it; direct API callers
  // no longer get address-less orders through.
  shippingAddressId: z.string().min(1, 'shippingAddressId is required'),
  // Task 95: the shipping method the buyer picked for this shipment. The
  // client NEVER sends a price — the server re-quotes the shipment against
  // the live zones/methods/rates book.
  shippingMethodId: z.string().min(1).optional(),
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

/** Task 95: thrown when the shipping choice cannot be honored — 400 for
 *  structurally wrong requests, 409 when the quoted book no longer covers
 *  the picked method. */
class ShippingChoiceError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ShippingChoiceError'
    this.status = status
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
    const { productId, quantity: rawQty, variantId, shippingAddressId, shippingMethodId } = parsed.data
    // Unit-bearing decimal (kg: 2.5 valid) — normalize to 2 dp.
    const qty = roundQty(rawQty)

    // Validate shipping address belongs to this buyer
    // Task 87: capture the address for the immutable order-time snapshot
    // (addresses are user-deletable; the FK alone would lose the history).
    // t190: schema now REQUIRES shippingAddressId — the address must exist
    // AND belong to this buyer, or the order is refused outright.
    const address = await db.addresses.findFirst({
      where: { id: shippingAddressId, userId: buyerId },
    })
    if (!address) {
      return NextResponse.json(
        { error: 'A valid shipping address belonging to you is required to place an order' },
        { status: 400 },
      )
    }
    const shippingAddressSnapshot = buildAddressSnapshot(address)
    // Task 95: the quote rail's district input — where the shipment goes.
    const shippingDistrict = address.district

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

        // Task 100: PLATFORM PROMOTION — the same engine the cart path uses,
        // applied BEFORE the order total (goods → promotion → + shipping).
        // Automatic: no code, no opt-in. The usage claim is atomic; a
        // campaign exhausted between read and write refuses the order (409).
        // Task 115: TWO OWNERS — a seller campaign (supplierId set) may only
        // score lines from its own supplier; this path is single-product, so
        // the guard drops foreign campaigns before the resolver sees them.
        let appliedPromotion: { id: string; name: string; discount: number; supplierId: string | null } | null = null
        {
          const now = new Date()
          const rows = await tx.promotionProducts.findMany({
            where: { productId, promotion: activePromotionFilter(now) },
            include: {
              promotion: {
                select: {
                  id: true, name: true, type: true, value: true, minOrderAmount: true,
                  maxDiscount: true, usageLimit: true, usedCount: true, isActive: true, validFrom: true, validUntil: true,
                  supplierId: true,
                },
              },
            },
          })
          const ownRows = rows.filter((row) => row.promotion.supplierId === null || row.promotion.supplierId === supplierId)
          if (ownRows.length > 0) {
            const best = resolveBestPromotionApplication(
              ownRows.map((row) => ({ promotion: row.promotion, pinnedProductIds: new Set([productId]) })),
              [{ productId, totalPrice }],
              now
            )
            if (best) {
              await claimPromotionUsage(tx, best.promotion)
              appliedPromotion = { id: best.promotion.id, name: best.promotion.name, discount: best.discount, supplierId: best.promotion.supplierId }
              await tx.auditLogs.create({
                data: {
                  actorId: buyerId,
                  action: 'promotion_applied',
                  entityType: 'orders',
                  entityId: orderNumber,
                  metadata: JSON.stringify({
                    promotionId: best.promotion.id,
                    promotionName: best.promotion.name,
                    type: best.promotion.type,
                    value: best.promotion.value,
                    promotedSubtotal: best.promotedSubtotal,
                    discount: best.discount,
                    funding: best.promotion.supplierId ? 'seller' : 'platform',
                  }),
                },
              })
            }
          }
        }

        // Task 95: SHIPPING — re-quote the shipment server-side when the
        // buyer picked a method. Weight = qty × product.weightKg (null
        // weight = honestly unquotable, never priced as 0 kg), district
        // from the buyer's own address, subtotal = the server-priced goods.
        let shippingFee = 0
        let shippingLeg: {
          methodId: string
          methodName: string
          price: number
          weightKg: number
        } | null = null
        if (shippingMethodId) {
          if (!shippingDistrict) {
            throw new ShippingChoiceError(
              'A shipping address with a district is required when a shipping method is selected',
              400
            )
          }
          if (product.weightKg === null || product.weightKg === undefined) {
            throw new ShippingChoiceError(
              `Shipping cannot be quoted: "${product.name}" has no weight on file — place the order without a shipping choice and settle shipping with the supplier`,
              400
            )
          }
          const weightKg = shipmentWeightKg([{ quantity: qty, weightKg: product.weightKg }])
          if (weightKg === null) {
            throw new ShippingChoiceError(
              `Shipping cannot be quoted: "${product.name}" has no weight on file`,
              400
            )
          }
          const [zones, methods, rates] = await Promise.all([
            tx.shippingZones.findMany(),
            tx.shippingMethods.findMany(),
            tx.shippingRates.findMany(),
          ])
          const options = computeQuote(zones, methods, rates, shippingDistrict, weightKg, totalPrice)
          const picked = options.find((o) => o.methodId === shippingMethodId)
          if (!picked) {
            throw new ShippingChoiceError(
              `The selected shipping method no longer covers this shipment (${weightKg}kg to ${shippingDistrict}) — refresh the shipping options and pick again`,
              409
            )
          }
          shippingFee = picked.price
          shippingLeg = {
            methodId: picked.methodId,
            methodName: picked.methodName,
            price: picked.price,
            weightKg,
          }
        }
        // ORDER total = goods after promotion + quoted shipping — payment math reads this.
        const orderTotal = totalPrice - (appliedPromotion?.discount ?? 0) + shippingFee

        const newOrder = await tx.orders.create({
          data: {
            buyerId,
            orderNumber,
            totalAmount: orderTotal,
            shippingFee,
            promotionId: appliedPromotion?.id ?? null,
            promotionName: appliedPromotion?.name ?? null,
            promotionDiscount: appliedPromotion?.discount ?? 0,
            paymentStatus: 'unpaid',
            shippingAddressId,
            shippingAddressSnapshot,
          },
        })

        // SELLER-FUNDED (Task 115): a seller campaign's discount comes off
        // THIS supplier's subOrder subtotal too (the seller gives it from
        // their own pocket) — subtotal is written POST-discount so escrow,
        // payouts and every revenue reader stay consistent; campaignDiscount
        // keeps the delta visible against the full orderItems line truth.
        const sellerFundedDiscount = appliedPromotion?.supplierId ? (appliedPromotion?.discount ?? 0) : 0
        const subOrder = await tx.subOrders.create({
          data: {
            orderId: newOrder.id,
            supplierId,
            subtotal: totalPrice - sellerFundedDiscount,
            campaignDiscount: sellerFundedDiscount,
            shippingCost: shippingLeg ? shippingLeg.price : null,
            shippingMethodId: shippingLeg?.methodId ?? null,
            shippingMethodName: shippingLeg?.methodName ?? null,
            status: 'pending',
            // estimatedDelivery intentionally left null — set by the supplier
            // when they actually confirm the order, never fabricated here.
          },
        })
        if (shippingLeg) {
          await tx.auditLogs.create({
            data: {
              actorId: buyerId,
              action: 'shipping_selected',
              entityType: 'subOrders',
              entityId: subOrder.id,
              metadata: JSON.stringify({
                orderId: newOrder.id,
                orderNumber,
                supplierId,
                methodId: shippingLeg.methodId,
                methodName: shippingLeg.methodName,
                price: shippingLeg.price,
                weightKg: shippingLeg.weightKg,
                district: shippingDistrict,
              }),
            },
          })
        }

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

        return { order: newOrder, subOrder, supplierId, appliedPromotion }
      })

      await notifyOrderMilestone(buyerId, order.order.orderNumber, 'confirmed', order.order.id)

      // Real-time (Task 51-a): the seller gets a live order:new push on their
      // seller:<supplierId> room — real persisted values, no buyer PII.
      void broadcastToRoom(`seller:${order.supplierId}`, 'order:new', {
        orderId: order.order.id,
        subOrderIds: [order.subOrder.id],
        itemCount: qty,
        // Goods subtotal of the seller's slice (consistent with the cart
        // path) — the quoted shipping rides on the subOrder row they see
        // through their authenticated GET.
        totalAmount: order.subOrder.subtotal,
        createdAt: order.order.createdAt.toISOString(),
      })

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.order.id,
          orderNumber: order.order.orderNumber,
          totalAmount: order.order.totalAmount,
          shippingFee: order.order.shippingFee,
          paymentStatus: order.order.paymentStatus,
          // Task 100: the honest buy-now receipt — the campaign that applied.
          promotionApplied: order.appliedPromotion,
        },
      }, { status: 201 })
    } catch (txError) {
      if (txError instanceof StockError) {
        return NextResponse.json(
          { error: txError.message, available: txError.available },
          { status: 409 }
        )
      }
      if (txError instanceof PromotionUsageError) {
        return NextResponse.json({ error: txError.message }, { status: 409 })
      }
      if (txError instanceof ShippingChoiceError) {
        return NextResponse.json({ error: txError.message }, { status: txError.status })
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
