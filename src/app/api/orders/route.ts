import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveUnitPrice, PricingError } from '@/lib/wholesale-pricing'

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireUserType(request, ['buyer', 'admin'])
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
    }

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
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(10000, 'Quantity exceeds the per-line limit of 10000'),
})

const createOrderSchema = z.object({
  shippingAddressId: z.string().min(1).optional().nullable(),
  couponCode: z.string().min(1).optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required').max(50, 'Too many items per order'),
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

export async function POST(request: NextRequest) {
  try {
    // Checkout abuse guard: order creation is limited per IP
    const rl = checkRateLimit(request, 'orders-post', 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    // Require buyer authentication
    const authResult = await requireUserType(request, ['buyer'])
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
    }

    const buyerId = authResult.user.id // Use authenticated user's ID, not from body

    const parsed = createOrderSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const { shippingAddressId, couponCode, items } = parsed.data

    // Validate shipping address belongs to this buyer
    if (shippingAddressId) {
      const address = await db.addresses.findFirst({
        where: { id: shippingAddressId, userId: buyerId },
      })
      if (!address) {
        return NextResponse.json({ error: 'Invalid shipping address' }, { status: 400 })
      }
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
          { items: Array<{ productId: string; variantId: string | null; quantity: number; unitPrice: number; totalPrice: number }>; subtotal: number }
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
          })
          supplierGroups[supplierId].subtotal += totalPrice
          totalAmount += totalPrice
        }

        // Apply coupon if provided
        if (couponCode) {
          const coupon = await tx.coupons.findUnique({ where: { code: couponCode } })
          if (coupon && coupon.isActive && new Date() >= coupon.validFrom && new Date() <= coupon.validUntil) {
            const discount = totalAmount * (coupon.discountPercent / 100)
            const maxDiscount = coupon.maxDiscount || discount
            totalAmount -= Math.min(discount, maxDiscount)
          }
        }

        const newOrder = await tx.orders.create({
          data: {
            buyerId,
            orderNumber,
            totalAmount,
            paymentStatus: 'unpaid',
            shippingAddressId: shippingAddressId || null,
          },
        })

        // Create sub-orders for each supplier
        for (const [supplierId, group] of Object.entries(supplierGroups)) {
          const subOrder = await tx.subOrders.create({
            data: {
              orderId: newOrder.id,
              supplierId,
              subtotal: group.subtotal,
              status: 'pending',
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

            // Product-level stock decrement + soldCount (existing behaviour kept)
            await tx.products.update({
              where: { id: item.productId },
              data: {
                stockQuantity: { decrement: item.quantity },
                soldCount: { increment: item.quantity },
              },
            })
          }
        }

        // Clear cart
        const cart = await tx.carts.findFirst({ where: { buyerId } })
        if (cart) {
          await tx.cartItems.deleteMany({ where: { cartId: cart.id } })
        }

        return { order: newOrder, subOrdersCount: Object.keys(supplierGroups).length }
      })

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.order.id,
          orderNumber: order.order.orderNumber,
          totalAmount: order.order.totalAmount,
          paymentStatus: order.order.paymentStatus,
          subOrdersCount: order.subOrdersCount,
        },
      }, { status: 201 })
    } catch (txError) {
      if (txError instanceof VariantStockError) {
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
    console.error('Order POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
