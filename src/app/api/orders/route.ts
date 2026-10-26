import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveUnitPrice, PricingError } from '@/lib/wholesale-pricing'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { notifyPaymentVerified, notifySellerNewOrder, notifyAdminNewOrder } from '@/lib/notifications'
import { holdEscrowInTx } from '@/lib/escrow'
import { roundQty } from '@/lib/product-contract'
import { buildAddressSnapshot } from '@/lib/addresses'
import { computeQuote, shipmentWeightKg } from '@/lib/shipping'
import { activePromotionFilter, resolveBestPromotionApplication, claimPromotionUsage } from '@/lib/promotions'
import { PromotionUsageError } from '@/lib/promotions-errors'

export async function GET(request: NextRequest) {
  try {
    // Auth-first (Task 51-a mandate): authentication before rate limiting.
    const authResult = await requireUserType(request, ['buyer', 'admin'])
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'orders-get', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const status = searchParams.get('status')

    // Use authenticated user's ID - prevent IDOR
    const buyerId = authResult.user.userType === 'admin'
      ? searchParams.get('buyerId') || authResult.user.id
      : authResult.user.id

    const where: Record<string, unknown> = { buyerId }
    if (status) {
      where.paymentStatus = status
    }

    const total = await db.orders.count({ where })

    const orders = await db.orders.findMany({
      where,
      include: {
        shippingAddress: true,
        subOrders: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, thumbnailUrl: true, unit: true } },
                variant: { select: { id: true, variantName: true, variantValue: true } },
              },
            },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Orders GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ─── Body schema: the client never sends prices — only what it wants to buy ─── */
const orderItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  variantId: z.string().min(1).optional().nullable(),
  quantity: z.coerce
    .number()
    .positive('Quantity must be greater than 0')
    .max(10000, 'Quantity exceeds the per-line limit of 10000'),
})

const createOrderSchema = z.object({
  // t191 SECURITY HARDENING (mirrors create-direct): a wholesale order
  // ships physical goods — an order without a real shipping address can
  // never be fulfilled, so the address is REQUIRED (and must belong to the
  // buyer — validated below). The checkout page always sends it; direct
  // API callers no longer get address-less orders through.
  shippingAddressId: z.string().min(1, 'shippingAddressId is required'),
  couponCode: z.string().min(1).optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required').max(50, 'Too many items per order'),
  // Task 70: pay the (server-priced) total straight from the buyer's real
  // wallet balance — the order lands PAID in the same transaction that
  // decrements stock. Omitted/false keeps the classic UNPAID manual leg.
  payWithWallet: z.boolean().optional(),
  // t194 ZERO-PAYMENT HARDENING: an order can no longer be created with NO
  // payment intent at all. The buyer must explicitly pick HOW they pay:
  //   wallet        → debited now, order lands 'paid' (402 if balance short)
  //   bank_transfer → pending payments row + instructions, verified later
  //   mobile_banking→ pending payments row + instructions, verified later
  //   cod           → explicit pay-on-delivery choice, stays 'unpaid'
  // Legacy callers that only send payWithWallet=true still map to 'wallet'.
  // A request with NEITHER payWithWallet=true NOR paymentMethod is rejected
  // with 400 — the silent zero-payment order path is closed.
  paymentMethod: z
    .enum(['wallet', 'bank_transfer', 'mobile_banking', 'cod'])
    .optional(),
  // Task 95: the shipping method the buyer picked PER SUPPLIER SHIPMENT.
  // The client NEVER sends a price — the server re-quotes every shipment
  // against the live zones/methods/rates book and lands the quoted fee.
  shippingChoices: z
    .array(
      z.object({
        supplierId: z.string().min(1, 'supplierId is required'),
        methodId: z.string().min(1, 'methodId is required'),
      })
    )
    .max(20, 'Too many shipping choices')
    .optional(),
})

/** Thrown inside the transaction when a variant has insufficient stock —
 *  carries the REAL remaining stock so the 409 states the truth. */
class VariantStockError extends Error {
  available: number
  constructor(message: string, available: number) {
    super(message)
    this.name = 'VariantStockError'
    this.available = available
  }
}

/** Task 70: thrown inside the transaction when the wallet cannot cover the
 *  server-priced total — carries the REAL balance so the 402 states truth. */
class WalletInsufficientError extends Error {
  balance: number
  constructor(balance: number) {
    super('Insufficient wallet balance for this order')
    this.name = 'WalletInsufficientError'
    this.balance = balance
  }
}

/** Task 74: thrown when a submitted couponCode cannot be honored — the 409
 *  carries the REAL reason so the checkout states the truth. */
class CouponError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CouponError'
  }
}

/** Task 95: thrown when a shipping choice cannot be honored. 400 for
 *  structurally wrong choices (no address / unknown supplier / unweighed
 *  product), 409 when the quoted book no longer covers the picked method
 *  (the buyer re-fetches the quote and re-picks). */
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
    // Auth-first (Task 51-a mandate), then the checkout abuse guard.
    const authResult = await requireUserType(request, ['buyer'])
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'orders-post', 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const buyerId = authResult.user.id // Use authenticated user's ID, not from body

    const parsed = createOrderSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const { shippingAddressId, couponCode, items, payWithWallet, paymentMethod, shippingChoices } = parsed.data

    // t194: a payment intent is MANDATORY. payWithWallet=true is the legacy
    // spelling of method 'wallet'; anything else must name its method.
    const wantsWallet = payWithWallet === true || paymentMethod === 'wallet'
    const effectiveMethod = wantsWallet ? 'wallet' : paymentMethod
    if (!effectiveMethod) {
      return NextResponse.json(
        { error: 'A payment method is required — choose wallet, bank transfer, mobile banking or cash on delivery.' },
        { status: 400 },
      )
    }
    // t196 ZERO-PAYMENT GATE: cash on delivery ships goods before any money
    // arrives, so an UNVERIFIED account must never be able to place one.
    // The verification flags come from the session row (validateSession
    // select) — editing the request body cannot bypass this.
    if (
      effectiveMethod === 'cod' &&
      !authResult.user.isEmailVerified &&
      !authResult.user.isPhoneVerified
    ) {
      return NextResponse.json(
        {
          error: 'Cash on Delivery requires a verified account — verify your email or phone in your profile first.',
          code: 'COD_VERIFICATION_REQUIRED',
        },
        { status: 403 },
      )
    }
    // Unit-bearing decimals: normalize to 2 dp so float drift never reaches DB rows.
    for (const item of items) {
      item.quantity = roundQty(item.quantity)
    }

    // Validate shipping address belongs to this buyer — and CAPTURE it for
    // the order's immutable snapshot (Task 87): addresses are user-deletable,
    // the FK is SetNull, so without this a deleted address would erase the
    // order's real shipping history.
    // t191: the schema now REQUIRES shippingAddressId — the address must
    // exist AND belong to this buyer, or the order is refused outright
    // (same contract as create-direct).
    const address = await db.addresses.findFirst({
      where: { id: shippingAddressId, userId: buyerId },
    })
    if (!address) {
      return NextResponse.json({ error: 'A valid shipping address belonging to you is required to place an order' }, { status: 400 })
    }
    const shippingAddressSnapshot = buildAddressSnapshot(address)
    // Task 95: the quote rail's district input — where the shipments go.
    const shippingDistrict = address.district

    // Generate order number
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()

    try {
      // Atomic creation — pricing, stock and the order itself all resolve
      // inside ONE transaction, so nothing is ever half-written.
      const order = await db.$transaction(async (tx) => {
        // Group items by the supplier recorded on each PRODUCT row (never a
        // client-sent supplierId — anti-manipulation) and price every line
        // with the canonical wholesale pricing rule.
        const supplierGroups: Record<
          string,
          { items: Array<{ productId: string; variantId: string | null; quantity: number; unitPrice: number; totalPrice: number; unit: string; bundleSize: number | null; weightKg: number | null; productName: string }>; subtotal: number }
        > = {}
        let totalAmount = 0
        // Task 100: the priced lines (server truth) feed the promotion engine.
        const pricedLines: Array<{ productId: string; totalPrice: number }> = []
        // Task 141: the ৳ the completed pools actually took off this order.
        let poolSavingsTotal = 0

        for (const item of items) {
          const product = await tx.products.findUnique({ where: { id: item.productId } })
          if (!product || !product.isActive || !product.isApproved) {
            throw new PricingError('PRODUCT_NOT_FOUND', `Product ${item.productId} not available`)
          }

          // Fail fast on product-level stock before pricing (variant-level
          // stock is guarded atomically at decrement time below).
          if (item.quantity > product.stockQuantity) {
            throw new VariantStockError(
              `Insufficient stock for ${product.name}`,
              product.stockQuantity
            )
          }

          let variantRef: { id: string; productId: string; priceOverride: number | null } | null = null
          if (item.variantId) {
            const variant = await tx.productVariants.findUnique({ where: { id: item.variantId } })
            if (!variant || variant.productId !== item.productId) {
              throw new PricingError('VARIANT_MISMATCH', 'Invalid variant for this product')
            }
            variantRef = { id: variant.id, productId: variant.productId, priceOverride: variant.priceOverride }
          }

          // SERVER TRUTH: the recorded unitPrice always comes from the
          // pricing rule (variant priceOverride → matching tier → basePrice).
          // MOQ and maxOrderQty are enforced here too (PricingError 422).
          const resolved = await resolveUnitPrice(tx, item.productId, item.quantity, variantRef)

          // Task 141: a COMPLETED pool's promise is real money. If this buyer
          // holds unredeemed reservations on a completed pool for THIS
          // product, up to min(lineQty, remaining) units price at the pool
          // rate; the rest price by the canonical rule (a blended unitPrice
          // when the line straddles the reservation). Plain lines only —
          // pools are product-level commitments, variants keep rule pricing.
          // The redemption counter increments in the SAME transaction, so a
          // reservation can never be double-spent or survive a failed order.
          let poolUnits = 0
          let poolSavings = 0
          if (!item.variantId) {
            // Plain-FK world: find the product's completed pool, then this
            // buyer's reservation on it (compound-unique per buyer).
            const completedPool = await tx.groupBuyCampaigns.findFirst({
              where: { productId: item.productId, status: 'completed' },
              orderBy: { updatedAt: 'desc' },
              select: { id: true, discountedPrice: true },
            })
            const participation = completedPool
              ? await tx.groupBuyParticipants.findUnique({
                  where: { campaignId_userId: { campaignId: completedPool.id, userId: buyerId } },
                  select: { id: true, quantity: true, redeemedQty: true },
                })
              : null
            const poolRate = completedPool?.discountedPrice ?? null
            if (participation) {
              const remaining = participation.quantity - participation.redeemedQty
              if (remaining > 0) {
                const units = Math.min(item.quantity, remaining)
                // Only ever a DISCOUNT — if the pool rate somehow sits above
                // the rule price (seller raised basePrice after the pool),
                // the buyer pays the rule price and the pool is left intact.
                if (poolRate != null && poolRate < resolved.unitPrice) {
                  poolUnits = units
                  poolSavings = units * (resolved.unitPrice - poolRate)
                  await tx.groupBuyParticipants.update({
                    where: { id: participation.id },
                    data: { redeemedQty: { increment: poolUnits } },
                  })
                }
              }
            }
          }

          const totalPrice = resolved.unitPrice * item.quantity - poolSavings
          poolSavingsTotal += poolSavings
          // Task 141: the line's unitPrice must keep the LINE IDENTITY
          // (unitPrice × quantity === totalPrice) — a pool-discounted line
          // records the BLENDED per-unit price, never the rule price beside
          // a pool-adjusted total.
          const lineUnitPrice = item.quantity > 0 ? totalPrice / item.quantity : resolved.unitPrice

          const supplierId = product.supplierId
          if (!supplierGroups[supplierId]) {
            supplierGroups[supplierId] = { items: [], subtotal: 0 }
          }
          supplierGroups[supplierId].items.push({
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: item.quantity,
            unitPrice: lineUnitPrice,
            totalPrice,
            // unit/bundleSize ride along for the product:stock broadcast
            unit: product.unit,
            bundleSize: product.bundleSize,
            // Task 95: per-unit weight for the shipment weighing below
            weightKg: product.weightKg,
            productName: product.name,
          })
          supplierGroups[supplierId].subtotal += totalPrice
          totalAmount += totalPrice
          pricedLines.push({ productId: item.productId, totalPrice })
        }

        // Task 100/115: PROMOTION — automatic, no code, no opt-in — applied
        // BEFORE the coupon (the coupon then reads the promoted total, so the
        // stack is honest: goods → promotion → coupon → + shipping). Every
        // active campaign pinning any of these products is scored on the
        // lines it actually pins; the best discount wins (tie → ends
        // soonest). The usage counter is claimed ATOMICALLY — a campaign
        // exhausted between read and write refuses the order (409) rather
        // than repricing it behind the buyer's back.
        // TWO OWNERS (Task 115): supplierId NULL = platform-curated,
        // PLATFORM-FUNDED (subOrders keep full value). supplierId SET = a
        // seller's own campaign — only that supplier's lines may feed it,
        // and it is SELLER-FUNDED: the discount also comes off THAT
        // supplier's subOrder subtotal (seller earns less, honestly).
        let appliedPromotion: { id: string; name: string; discount: number; supplierId: string | null } | null = null
        {
          const now = new Date()
          const rows = await tx.promotionProducts.findMany({
            where: { product: { id: { in: pricedLines.map((l) => l.productId) } }, promotion: activePromotionFilter(now) },
            include: {
              product: { select: { supplierId: true } },
              promotion: {
                select: {
                  id: true, name: true, type: true, value: true, minOrderAmount: true,
                  maxDiscount: true, usageLimit: true, usedCount: true, isActive: true, validFrom: true, validUntil: true,
                  supplierId: true,
                },
              },
            },
          })
          if (rows.length > 0) {
            const campaigns = new Map<string, { promotion: (typeof rows)[number]['promotion']; pinnedProductIds: Set<string> }>()
            for (const row of rows) {
              // SUPPLIER GUARD: a seller campaign only ever scores lines
              // from its own supplier — creation enforces this; the guard
              // makes it true even if a pin somehow drifts.
              if (row.promotion.supplierId !== null && row.product.supplierId !== row.promotion.supplierId) continue
              let entry = campaigns.get(row.promotion.id)
              if (!entry) {
                entry = { promotion: row.promotion, pinnedProductIds: new Set() }
                campaigns.set(row.promotion.id, entry)
              }
              entry.pinnedProductIds.add(row.productId)
            }
            const best = resolveBestPromotionApplication([...campaigns.values()], pricedLines, now)
            if (best) {
              await claimPromotionUsage(tx, best.promotion)
              totalAmount -= best.discount
              const fundingSupplierId = best.promotion.supplierId
              if (fundingSupplierId && supplierGroups[fundingSupplierId]) {
                // SELLER-FUNDED: the subOrder subtotal is written
                // POST-discount — escrow, payouts and every revenue reader
                // stay consistent without touching them.
                supplierGroups[fundingSupplierId].subtotal -= best.discount
              }
              appliedPromotion = { id: best.promotion.id, name: best.promotion.name, discount: best.discount, supplierId: fundingSupplierId }
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

        // Task 74: coupon application is HONEST and ENFORCED. The old block
        // silently ignored every failure (unknown code, expired, below the
        // minimum, exhausted) — a buyer could think they had a discount and
        // be charged full, and usageLimit was never counted. Now: a
        // couponCode that cannot be honored refuses the order with the real
        // reason, and the usage counter increments atomically inside this
        // transaction (updateMany re-checks usedCount < usageLimit AT the
        // write, so concurrent orders can never overrun the limit).
        let appliedCoupon: { code: string; discount: number } | null = null
        // Task 144: a free-delivery prize (lucky spin) discounts the QUOTED
        // shipping fee, not the goods — resolved after shipping is priced.
        let shippingVoucher: { id: string; savingsBDT: number; code: string } | null = null
        let shippingDiscount = 0
        if (couponCode) {
          // Task 144: the buyer's OWN claimed/earned voucher wins the code.
          // Claim rows carry the platform coupon's code, and claiming already
          // counted against the platform row's usedCount — consuming the
          // CLAIM row keeps every counter single-counted. SPIN-/CRATE-/WELCOME-
          // prefixed prizes exist ONLY in userCoupons. The platform campaign
          // row remains the path for unclaimed public codes (t74/t131).
          const mine = await tx.userCoupons.findFirst({
            where: { code: couponCode, userId: buyerId, status: 'active' },
          })
          if (mine) {
            const nowMine = new Date()
            if (new Date(mine.validUntil) < nowMine) {
              throw new CouponError(`Coupon "${couponCode}" has expired`)
            }
            if (mine.minOrderBDT && totalAmount < mine.minOrderBDT) {
              throw new CouponError(
                `Coupon "${couponCode}" requires a minimum order of ৳${mine.minOrderBDT.toLocaleString()} — this order totals ৳${totalAmount.toLocaleString()}`
              )
            }
            let discount = 0
            if (mine.discountStyle === 'percentage') {
              discount = totalAmount * (mine.savingsBDT / 100)
            } else if (mine.discountStyle === 'free-shipping') {
              shippingVoucher = { id: mine.id, savingsBDT: mine.savingsBDT, code: mine.code }
            } else {
              discount = Math.min(mine.savingsBDT, totalAmount)
            }
            totalAmount -= discount
            appliedCoupon = discount > 0 ? { code: mine.code, discount } : null
            // Consume the voucher AT the write (the t74 race guard pattern):
            // only a still-active row can be spent, and concurrent orders
            // with the same code cannot both win.
            const consumed = await tx.userCoupons.updateMany({
              where: { id: mine.id, status: 'active' },
              data: { status: 'used', usedAt: new Date() },
            })
            if (consumed.count === 0) {
              throw new CouponError(`Coupon "${couponCode}" has already been used`)
            }
          } else {
          const coupon = await tx.coupons.findUnique({ where: { code: couponCode } })
          if (!coupon) {
            throw new CouponError(`Coupon code "${couponCode}" does not exist`)
          }
          if (!coupon.isActive) {
            throw new CouponError(`Coupon "${coupon.code}" is no longer active`)
          }
          const now = new Date()
          if (now < coupon.validFrom) {
            throw new CouponError(`Coupon "${coupon.code}" is not active yet`)
          }
          if (now > coupon.validUntil) {
            throw new CouponError(`Coupon "${coupon.code}" has expired`)
          }
          if (coupon.minOrderAmount && totalAmount < coupon.minOrderAmount) {
            throw new CouponError(
              `Coupon "${coupon.code}" requires a minimum order of ৳${coupon.minOrderAmount.toLocaleString()} — this order totals ৳${totalAmount.toLocaleString()}`
            )
          }
          if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
            throw new CouponError(`Coupon "${coupon.code}" has reached its usage limit`)
          }
          // Task 143: earned vouchers are personal money promises — a code
          // bound to another account is not yours to spend.
          if (coupon.userId && coupon.userId !== buyerId) {
            throw new CouponError(`Coupon "${coupon.code}" belongs to another account`)
          }

          const discount =
            coupon.discountType === 'fixed'
              ? Math.min(coupon.discountPercent, totalAmount)
              : Math.min(totalAmount * (coupon.discountPercent / 100), coupon.maxDiscount ?? Number.POSITIVE_INFINITY)
          totalAmount -= discount
          appliedCoupon = { code: coupon.code, discount }

          const counted = await tx.coupons.updateMany({
            where: {
              id: coupon.id,
              ...(coupon.usageLimit !== null ? { usedCount: { lt: coupon.usageLimit } } : {}),
            },
            data: { usedCount: { increment: 1 } },
          })
          if (counted.count === 0) {
            throw new CouponError(`Coupon "${coupon.code}" has reached its usage limit`)
          }
          }
        }

        // Task 95: SHIPPING — the buyer's per-shipment choices are re-quoted
        // SERVER-SIDE from the live zones/methods/rates book. The client
        // sends only (supplierId, methodId); the price is whatever THIS
        // database quotes for THIS shipment right now: weight =
        // Σ(quantity × product.weightKg), district from the buyer's own
        // address, subtotal = the server-priced goods of that supplier
        // group. No choice, no weight on file, or no covering method →
        // honest errors / null shippingCost (settle with supplier) — never
        // a fabricated fee.
        let shippingFee = 0
        const shippingLegs: Array<{
          supplierId: string
          methodId: string
          methodName: string
          price: number
          weightKg: number
        }> = []
        if (shippingChoices && shippingChoices.length > 0) {
          if (!shippingDistrict) {
            throw new ShippingChoiceError(
              'A shipping address with a district is required when a shipping method is selected',
              400
            )
          }
          const seenSuppliers = new Set<string>()
          for (const choice of shippingChoices) {
            if (seenSuppliers.has(choice.supplierId)) {
              throw new ShippingChoiceError('Duplicate shipping choice for the same supplier', 400)
            }
            seenSuppliers.add(choice.supplierId)
            const group = supplierGroups[choice.supplierId]
            if (!group) {
              throw new ShippingChoiceError(
                'Shipping choice does not match any supplier in this order',
                400
              )
            }
            const weightKg = shipmentWeightKg(group.items)
            if (weightKg === null) {
              const unweighed = group.items.find((i) => i.weightKg === null || i.weightKg === undefined)
              throw new ShippingChoiceError(
                `Shipping cannot be quoted: "${unweighed?.productName ?? 'a product'}" has no weight on file — place the order without a shipping choice and settle shipping with the supplier`,
                400
              )
            }
            const [zones, methods, rates] = await Promise.all([
              tx.shippingZones.findMany(),
              tx.shippingMethods.findMany(),
              tx.shippingRates.findMany(),
            ])
            const options = computeQuote(zones, methods, rates, shippingDistrict, weightKg, group.subtotal)
            const picked = options.find((o) => o.methodId === choice.methodId)
            if (!picked) {
              throw new ShippingChoiceError(
                `The selected shipping method no longer covers this shipment (${weightKg}kg to ${shippingDistrict}) — refresh the shipping options and pick again`,
                409
              )
            }
            shippingFee += picked.price
            shippingLegs.push({
              supplierId: choice.supplierId,
              methodId: picked.methodId,
              methodName: picked.methodName,
              price: picked.price,
              weightKg,
            })
          }
        }
        // The ORDER total = goods after coupon + quoted shipping − any
        // free-delivery voucher discount. Every downstream payment math
        // (wallet-pay below, payment-submit default, seller/admin verify)
        // reads totalAmount, so everything rides the paid amount together.
        // Task 144: a free-delivery voucher with NOTHING to discount (the
        // buyer picked no shipping method) refuses the order — the whole
        // transaction rolls back, so the voucher is NOT consumed for a
        // benefit that never existed.
        if (shippingVoucher) {
          if (shippingFee <= 0) {
            throw new CouponError(
              `Free-delivery voucher "${shippingVoucher.code}" needs a shipping method — select one at checkout so there is a delivery fee to discount`
            )
          }
          shippingDiscount = Math.min(shippingVoucher.savingsBDT, shippingFee)
        }
        const orderTotal = totalAmount + shippingFee - shippingDiscount

        // Task 70: WALLET-PAY — debit the buyer's REAL balance inside the SAME
        // transaction that prices the order and decrements stock. A balance
        // that cannot cover the server-priced total throws an honest 402
        // carrying the real balance; the conditional updateMany makes an
        // overspend race impossible (balance >= total is re-checked AT the
        // write, not at the read).
        let walletLeg: { walletId: string; balanceAfter: number } | null = null
        if (wantsWallet) {
          const wallet = await tx.wallets.findFirst({ where: { userId: buyerId } })
          if (!wallet || wallet.balance < orderTotal) {
            throw new WalletInsufficientError(wallet?.balance ?? 0)
          }
          const debited = await tx.wallets.updateMany({
            where: { id: wallet.id, balance: { gte: orderTotal } },
            data: { balance: { decrement: orderTotal } },
          })
          if (debited.count === 0) {
            const current = await tx.wallets.findFirst({ where: { userId: buyerId } })
            throw new WalletInsufficientError(current?.balance ?? 0)
          }
          walletLeg = { walletId: wallet.id, balanceAfter: wallet.balance - orderTotal }
        }

        const newOrder = await tx.orders.create({
          data: {
            buyerId,
            orderNumber,
            totalAmount: orderTotal,
            shippingFee,
            // Task 100: the applied campaign is stamped on the order (name
            // snapshot survives promotion deletion; discount is the real
            // number the buyer was charged).
            promotionId: appliedPromotion?.id ?? null,
            promotionName: appliedPromotion?.name ?? null,
            promotionDiscount: appliedPromotion?.discount ?? 0,
            // Task 70: a wallet-paid order is verified money the moment the
            // balance debits — it NEVER passes through 'unpaid'.
            paymentStatus: wantsWallet ? 'paid' : 'unpaid',
            shippingAddressId,
            shippingAddressSnapshot,
          },
        })

        // Task 70 (cont.): the wallet ledger row + the REAL payments row land
        // after the order exists — method 'wallet', status 'success', paidAt
        // now. This is a VERIFIED payment by construction (the money was
        // already the buyer's, held by the platform), so the house payment
        // doctrine treats it exactly like a verified webhook/manual leg.
        let walletPaymentId: string | null = null
        if (walletLeg) {
          const walletTx = await tx.walletTransactions.create({
            data: {
              walletId: walletLeg.walletId,
              type: 'payment',
              amount: -orderTotal,
              balanceAfter: walletLeg.balanceAfter,
              description: `Order ${orderNumber} paid from wallet balance`,
              relatedEntityId: newOrder.id,
            },
          })
          const walletPayment = await tx.payments.create({
            data: {
              orderId: newOrder.id,
              method: 'wallet',
              amount: orderTotal,
              status: 'success',
              transactionId: `WALLET-${orderNumber}`,
              gatewayResponse: JSON.stringify({
                walletTransactionId: walletTx.id,
                paidFrom: 'wallet_balance',
                balanceAfter: walletLeg.balanceAfter,
              }),
              paidAt: new Date(),
            },
          })
          // Task 71 escrow hold happens AFTER the subOrders loop below — the
          // per-supplier rows must exist first.
          walletPaymentId = walletPayment.id
        }

        // t194: manual methods (bank_transfer / mobile_banking) get a REAL
        // pending payments row in the SAME transaction — the order is born
        // with a payment awaiting verification, never a silent free order.
        // 'cod' intentionally leaves no row: the cash is collected on
        // delivery, and the buyer explicitly chose that at checkout.
        let manualPaymentId: string | null = null
        if (effectiveMethod === 'bank_transfer' || effectiveMethod === 'mobile_banking') {
          const manualPayment = await tx.payments.create({
            data: {
              orderId: newOrder.id,
              method: effectiveMethod,
              amount: orderTotal,
              status: 'pending',
            },
          })
          manualPaymentId = manualPayment.id
        }

        // Create sub-orders for each supplier
        // sellerFeed = what each affected seller is told in real time
        // (order:new push) — order/sub-order ids and counts only, NEVER
        // buyer PII; sellers refetch through their authenticated GET.
        // stockFeed = what PDP watchers of each bought product are told
        // (product:stock push, Task 56-c) — the REAL post-decrement
        // stock/soldCount read back from the same transaction.
        const sellerFeed: Array<{
          supplierId: string
          subOrderIds: string[]
          itemCount: number
          subtotal: number
        }> = []
        const stockFeed = new Map<
          string,
          { stockQuantity: number; unit: string; bundleSize: number | null; soldCount: number }
        >()
        for (const [supplierId, group] of Object.entries(supplierGroups)) {
          // Task 95: this supplier's quoted shipping leg, if the buyer chose one.
          const leg = shippingLegs.find((l) => l.supplierId === supplierId) ?? null
          const subOrder = await tx.subOrders.create({
            data: {
              orderId: newOrder.id,
              supplierId,
              subtotal: group.subtotal,
              // Task 115: the stamp that explains subtotal vs the full
              // orderItems line truth — non-zero only when a SELLER-FUNDED
              // campaign took its discount off this shipment's goods.
              campaignDiscount: appliedPromotion?.supplierId === supplierId ? (appliedPromotion?.discount ?? 0) : 0,
              shippingCost: leg ? leg.price : null,
              shippingMethodId: leg?.methodId ?? null,
              shippingMethodName: leg?.methodName ?? null,
              status: 'pending',
            },
          })
          if (leg) {
            // Task 95: every shipping decision is audited — who chose which
            // method, for which shipment, at what quoted price and weight.
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
                  methodId: leg.methodId,
                  methodName: leg.methodName,
                  price: leg.price,
                  weightKg: leg.weightKg,
                  district: shippingDistrict,
                }),
              },
            })
          }
          sellerFeed.push({
            supplierId,
            subOrderIds: [subOrder.id],
            itemCount: group.items.reduce((sum, i) => sum + i.quantity, 0),
            subtotal: group.subtotal,
          })

          // Task 80: the cart flow now writes the SAME 'Order placed'
          // timeline row create-direct already writes — every buyer path
          // starts its tracking story the same honest way.
          await tx.orderTracking.create({
            data: {
              subOrderId: subOrder.id,
              status: 'pending',
              location: 'Order placed',
              note: 'Order has been created and is awaiting payment and supplier confirmation.',
            },
          })

          // Create order items
          for (const item of group.items) {
            await tx.orderItems.create({
              data: {
                subOrderId: subOrder.id,
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              },
            })

            // VARIANT STOCK: decrement the exact variant that was bought,
            // guarded by a conditional update so oversell is impossible.
            // The whole transaction rolls back on failure.
            if (item.variantId) {
              const decremented = await tx.productVariants.updateMany({
                where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
                data: { stockQuantity: { decrement: item.quantity } },
              })
              if (decremented.count === 0) {
                const current = await tx.productVariants.findUnique({
                  where: { id: item.variantId },
                  select: { variantName: true, variantValue: true, stockQuantity: true },
                })
                throw new VariantStockError(
                  `Insufficient stock for ${current?.variantName ?? 'variant'} ${current?.variantValue ?? ''}`.trim(),
                  current?.stockQuantity ?? 0
                )
              }
            }

            // Product-level stock decrement + soldCount (existing behaviour kept).
            // The update returns the REAL persisted after-values so the
            // product:stock broadcast after commit carries server truth
            // (never the pre-read row — another concurrent order could have
            // decremented between the findUnique and this write). Reads are
            // sequential, so the last write per product wins the map entry.
            const updatedProduct = await tx.products.update({
              where: { id: item.productId },
              data: {
                stockQuantity: { decrement: item.quantity },
                soldCount: { increment: item.quantity },
              },
              select: { stockQuantity: true, soldCount: true },
            })
            stockFeed.set(item.productId, {
              stockQuantity: updatedProduct.stockQuantity,
              unit: item.unit,
              bundleSize: item.bundleSize,
              soldCount: updatedProduct.soldCount,
            })
          }
        }

        // Task 71: wallet money is platform-held by definition — the escrow
        // rows (one per supplier subOrder, amount = the real subtotal) are
        // created NOW, after the subOrders exist, inside the same tx.
        if (walletLeg) {
          await holdEscrowInTx(tx, newOrder.id, buyerId)
        }

        // Clear cart
        const cart = await tx.carts.findFirst({ where: { buyerId } })
        if (cart) {
          await tx.cartItems.deleteMany({ where: { cartId: cart.id } })
        }

        return { order: newOrder, sellerFeed, stockFeed, walletPaymentId, manualPaymentId, paymentMethod: effectiveMethod, appliedCoupon, appliedPromotion, shippingLegs, shippingFee, poolSavingsTotal, shippingDiscount }
      })

      // Real-time (Task 51-a): every seller with a slice of this order gets a
      // live order:new push on their seller:<supplierId> room — real persisted
      // values only, no buyer PII (sellers refetch via authenticated GET).
      for (const feed of order.sellerFeed) {
        void broadcastToRoom(`seller:${feed.supplierId}`, 'order:new', {
          orderId: order.order.id,
          subOrderIds: feed.subOrderIds,
          itemCount: feed.itemCount,
          totalAmount: feed.subtotal,
          createdAt: order.order.createdAt.toISOString(),
        })
      }

      // Task 159 cohesion fix: the socket push above is TRANSIENT — a seller
      // who wasn't online never saw the order arrive. Persist a durable
      // notification row per supplier (one per feed, never per subOrder) so
      // the seller's notification list records every new order slice.
      {
        const supplierIds = order.sellerFeed.map((f) => f.supplierId)
        const sellerUsers = await db.supplierProfiles.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, userId: true },
        })
        const userIdBySupplier = new Map(sellerUsers.map((s) => [s.id, s.userId]))
        for (const feed of order.sellerFeed) {
          const sellerUserId = userIdBySupplier.get(feed.supplierId)
          if (sellerUserId) {
            await notifySellerNewOrder(
              sellerUserId,
              order.order.orderNumber,
              order.order.id,
              feed.itemCount,
              feed.subtotal
            )
          }
        }
      }

      // Task 159 cohesion fix (admin half): admins run the payment-verification
      // gate — a plain UNPAID order previously produced NO admin signal. Push
      // order:new to every admin room AND persist a durable row per admin.
      {
        const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
        const totalItemCount = order.sellerFeed.reduce((s, f) => s + f.itemCount, 0)
        for (const a of admins) {
          void broadcastToRoom(`admin:${a.id}`, 'order:new', {
            orderId: order.order.id,
            orderNumber: order.order.orderNumber,
            itemCount: totalItemCount,
            totalAmount: order.order.totalAmount,
            createdAt: order.order.createdAt.toISOString(),
          })
          await notifyAdminNewOrder(a.id, order.order.orderNumber, order.order.id, totalItemCount, order.order.totalAmount)
        }
      }

      // Real-time (Task 56-c): every bought product's PUBLIC PDP room gets the
      // canonical product:stock availability event — the REAL post-decrement
      // stock/soldCount read back inside the transaction (fire-and-forget,
      // same doctrine as order:new; all fields are public-parity: stock,
      // unit, bundleSize, soldCount are rendered on the public PDP anyway).
      for (const [productId, s] of order.stockFeed) {
        void broadcastToRoom(`product:${productId}`, 'product:stock', {
          productId,
          stockQuantity: s.stockQuantity,
          unit: s.unit,
          bundleSize: s.bundleSize,
          soldCount: s.soldCount,
          inStock: s.stockQuantity > 0,
        })
      }

      // Task 70: a wallet-paid order broadcasts the SAME verified-payment
      // event shape the manual/webhook legs emit — sellers and admins see
      // 'payment:verified' (money is real), the buyer's order room tickles
      // the Task 69-c live refetch, and the buyer gets the notification row.
      if (order.walletPaymentId) {
        const adminsW = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
        const payPayload = {
          orderId: order.order.id,
          orderNumber: order.order.orderNumber,
          paymentId: order.walletPaymentId,
          paymentStatus: 'success',
          orderPaymentStatus: 'paid',
          amountPaid: order.order.totalAmount,
          orderTotal: order.order.totalAmount,
        }
        void Promise.allSettled([
          broadcastToRoom(`order:${order.order.id}`, 'payment:verified', payPayload),
          ...order.sellerFeed.map((feed) =>
            broadcastToRoom(`seller:${feed.supplierId}`, 'payment:verified', payPayload)
          ),
          ...adminsW.map((a) => broadcastToRoom(`admin:${a.id}`, 'payment:verified', payPayload)),
        ])
        void notifyPaymentVerified(
          order.order.buyerId,
          order.order.orderNumber,
          order.order.id,
          order.walletPaymentId,
          order.order.totalAmount,
          order.order.totalAmount,
          'paid'
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.order.id,
          orderNumber: order.order.orderNumber,
          totalAmount: order.order.totalAmount,
          // Task 95: the honest receipt — what shipping was quoted, and the
          // per-shipment legs the buyer picked.
          shippingFee: order.shippingFee,
          shippingLegs: order.shippingLegs,
          paymentStatus: order.order.paymentStatus,
          subOrdersCount: order.sellerFeed.length,
          walletPaymentId: order.walletPaymentId,
          // t194: the honest receipt — WHICH payment method the buyer chose,
          // and the pending payment row awaiting verification (manual legs).
          paymentMethod: order.paymentMethod,
          manualPaymentId: order.manualPaymentId,
          // Task 74: the honest receipt — what the coupon actually took off.
          couponApplied: order.appliedCoupon,
          // Task 144: the honest receipt — what the free-delivery voucher
          // took off the quoted shipping.
          shippingDiscount: order.shippingDiscount > 0 ? { amount: order.shippingDiscount } : null,
          // Task 100: the honest receipt — the campaign that applied, and
          // the ৳ it actually took off (buyer-paid truth).
          promotionApplied: order.appliedPromotion,
          // Task 141: the honest receipt — what the completed group pools
          // actually took off this order.
          groupPoolDiscount: order.poolSavingsTotal > 0 ? { amount: order.poolSavingsTotal } : null,
        },
      }, { status: 201 })
    } catch (txError) {
      if (txError instanceof VariantStockError) {
        return NextResponse.json(
          { error: txError.message, available: txError.available },
          { status: 409 }
        )
      }
      if (txError instanceof WalletInsufficientError) {
        // 402 Payment Required — with the REAL balance so the checkout can
        // state exactly how much is missing.
        return NextResponse.json(
          { error: 'Insufficient wallet balance for this order — top up or pay manually after placing the order.', walletBalance: txError.balance },
          { status: 402 }
        )
      }
      if (txError instanceof CouponError) {
        return NextResponse.json({ error: txError.message }, { status: 409 })
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
    console.error('Order POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
