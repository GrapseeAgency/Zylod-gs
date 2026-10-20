import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveUnitPrice, PricingError } from '@/lib/wholesale-pricing'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { notifyPaymentVerified } from '@/lib/notifications'
import { holdEscrowInTx } from '@/lib/escrow'
import { roundQty } from '@/lib/product-contract'
import { buildAddressSnapshot } from '@/lib/addresses'

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
  shippingAddressId: z.string().min(1).optional().nullable(),
  couponCode: z.string().min(1).optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required').max(50, 'Too many items per order'),
  // Task 70: pay the (server-priced) total straight from the buyer's real
  // wallet balance — the order lands PAID in the same transaction that
  // decrements stock. Omitted/false keeps the classic UNPAID manual leg.
  payWithWallet: z.boolean().optional(),
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
    const { shippingAddressId, couponCode, items, payWithWallet } = parsed.data
    // Unit-bearing decimals: normalize to 2 dp so float drift never reaches DB rows.
    for (const item of items) {
      item.quantity = roundQty(item.quantity)
    }

    // Validate shipping address belongs to this buyer — and CAPTURE it for
    // the order's immutable snapshot (Task 87): addresses are user-deletable,
    // the FK is SetNull, so without this a deleted address would erase the
    // order's real shipping history.
    let shippingAddressSnapshot: string | null = null
    if (shippingAddressId) {
      const address = await db.addresses.findFirst({
        where: { id: shippingAddressId, userId: buyerId },
      })
      if (!address) {
        return NextResponse.json({ error: 'Invalid shipping address' }, { status: 400 })
      }
      shippingAddressSnapshot = buildAddressSnapshot(address)
    }

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
          { items: Array<{ productId: string; variantId: string | null; quantity: number; unitPrice: number; totalPrice: number; unit: string; bundleSize: number | null }>; subtotal: number }
        > = {}
        let totalAmount = 0

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

          const totalPrice = resolved.unitPrice * item.quantity

          const supplierId = product.supplierId
          if (!supplierGroups[supplierId]) {
            supplierGroups[supplierId] = { items: [], subtotal: 0 }
          }
          supplierGroups[supplierId].items.push({
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: item.quantity,
            unitPrice: resolved.unitPrice,
            totalPrice,
            // unit/bundleSize ride along for the product:stock broadcast
            unit: product.unit,
            bundleSize: product.bundleSize,
          })
          supplierGroups[supplierId].subtotal += totalPrice
          totalAmount += totalPrice
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
        if (couponCode) {
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

        // Task 70: WALLET-PAY — debit the buyer's REAL balance inside the SAME
        // transaction that prices the order and decrements stock. A balance
        // that cannot cover the server-priced total throws an honest 402
        // carrying the real balance; the conditional updateMany makes an
        // overspend race impossible (balance >= total is re-checked AT the
        // write, not at the read).
        let walletLeg: { walletId: string; balanceAfter: number } | null = null
        if (payWithWallet) {
          const wallet = await tx.wallets.findFirst({ where: { userId: buyerId } })
          if (!wallet || wallet.balance < totalAmount) {
            throw new WalletInsufficientError(wallet?.balance ?? 0)
          }
          const debited = await tx.wallets.updateMany({
            where: { id: wallet.id, balance: { gte: totalAmount } },
            data: { balance: { decrement: totalAmount } },
          })
          if (debited.count === 0) {
            const current = await tx.wallets.findFirst({ where: { userId: buyerId } })
            throw new WalletInsufficientError(current?.balance ?? 0)
          }
          walletLeg = { walletId: wallet.id, balanceAfter: wallet.balance - totalAmount }
        }

        const newOrder = await tx.orders.create({
          data: {
            buyerId,
            orderNumber,
            totalAmount,
            // Task 70: a wallet-paid order is verified money the moment the
            // balance debits — it NEVER passes through 'unpaid'.
            paymentStatus: payWithWallet ? 'paid' : 'unpaid',
            shippingAddressId: shippingAddressId || null,
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
              amount: -totalAmount,
              balanceAfter: walletLeg.balanceAfter,
              description: `Order ${orderNumber} paid from wallet balance`,
              relatedEntityId: newOrder.id,
            },
          })
          const walletPayment = await tx.payments.create({
            data: {
              orderId: newOrder.id,
              method: 'wallet',
              amount: totalAmount,
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
          const subOrder = await tx.subOrders.create({
            data: {
              orderId: newOrder.id,
              supplierId,
              subtotal: group.subtotal,
              status: 'pending',
            },
          })
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

        return { order: newOrder, sellerFeed, stockFeed, walletPaymentId, appliedCoupon }
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
          paymentStatus: order.order.paymentStatus,
          subOrdersCount: order.sellerFeed.length,
          walletPaymentId: order.walletPaymentId,
          // Task 74: the honest receipt — what the coupon actually took off.
          couponApplied: order.appliedCoupon,
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
