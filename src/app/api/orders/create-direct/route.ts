import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { notifyOrderMilestone } from '@/lib/notifications'

/**
 * POST /api/orders/create-direct — Buy Now (single product, no cart).
 *
 * SECURITY CONTRACT (de-fake campaign Task 37/38):
 * - The server is the ONLY source of price: unitPrice comes from the product
 *   row (or its variant priceOverride) in the database. Any client-sent
 *   unitPrice/supplierId/total is ignored, not validated — a client cannot
 *   choose what it pays.
 * - Orders are ALWAYS created paymentStatus='unpaid'. No payment method in
 *   this request (or any client request) can mark an order paid. The only
 *   paths to 'paid' are the HMAC-verified payment webhook
 *   (/api/payments/webhook) or audited admin verification
 *   (/api/admin/orders/[id]/verify-payment).
 * - supplierId is taken from the product row, never from the client.
 */
export async function POST(request: NextRequest) {
  try {
    // Purchase abuse guard: direct order creation is limited per IP
    const rl = checkRateLimit(request, 'orders-create-direct', 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const authResult = await requireUserType(request, ['buyer'])
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
    }
    const buyerId = authResult.user.id

    const body = await request.json()
    // NOTE: unitPrice / supplierId / totalAmount are deliberately NOT read
    // from the body — the server derives all of them from the database.
    const { productId, quantity, variantId, shippingAddressId } = body

    if (!productId || quantity === undefined) {
      return NextResponse.json({ error: 'Missing required fields: productId, quantity' }, { status: 400 })
    }

    // Validate quantity: positive integer, sane upper bound
    const qty = Math.floor(Number(quantity))
    if (isNaN(qty) || qty < 1 || qty > 10000) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
    }

    // Validate shipping address belongs to this buyer
    if (shippingAddressId) {
      const address = await db.addresses.findFirst({
        where: { id: shippingAddressId, userId: buyerId },
      })
      if (!address) {
        return NextResponse.json({ error: 'Invalid shipping address' }, { status: 400 })
      }
    }

    // Load the real product — the only source of truth for price & supplier
    const product = await db.products.findUnique({ where: { id: productId } })
    if (!product || !product.isActive || !product.isApproved) {
      return NextResponse.json({ error: 'Product not available' }, { status: 404 })
    }

    // Resolve unit price from DB (variant priceOverride only if the variant
    // really belongs to this product) and validate stock/MOQ
    let unitPrice = product.basePrice
    if (variantId) {
      const variant = await db.productVariants.findUnique({ where: { id: variantId } })
      if (!variant || variant.productId !== productId) {
        return NextResponse.json({ error: 'Invalid variant for this product' }, { status: 400 })
      }
      unitPrice = variant.priceOverride ?? product.basePrice
      if (qty > variant.stockQuantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${variant.variantName} ${variant.variantValue}`, available: variant.stockQuantity },
          { status: 400 }
        )
      }
    } else {
      if (qty > product.stockQuantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}`, available: product.stockQuantity },
          { status: 400 }
        )
      }
    }

    if (qty < product.moq) {
      return NextResponse.json({ error: `Minimum order for ${product.name} is ${product.moq}` }, { status: 400 })
    }

    // SECURITY: supplier always comes from the product row (anti-manipulation)
    const supplierId = product.supplierId
    if (!supplierId) {
      return NextResponse.json({ error: 'Product has no supplier assigned' }, { status: 409 })
    }

    const totalPrice = unitPrice * qty
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()

    // Atomic creation — order + sub-order + item + tracking + stock decrement
    const order = await db.$transaction(async (tx) => {
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
          unitPrice,
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

      await tx.products.update({
        where: { id: productId },
        data: {
          stockQuantity: { decrement: qty },
          soldCount: { increment: qty },
        },
      })

      return newOrder
    })

    await notifyOrderMilestone(buyerId, order.orderNumber, 'confirmed', order.id)

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Direct order creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
