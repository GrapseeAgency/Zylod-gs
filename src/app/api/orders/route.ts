import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

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
    const body = await request.json()
    const { shippingAddressId, items, couponCode } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Items are required' }, { status: 400 })
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

    // Generate order number
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()

    // Calculate total and group by supplier
    const supplierGroups: Record<string, { items: typeof items; subtotal: number }> = {}
    let totalAmount = 0

    for (const item of items) {
      // Validate quantity
      const qty = Math.max(1, Math.floor(Number(item.quantity)))
      if (isNaN(qty) || qty > 10000) {
        return NextResponse.json({ error: `Invalid quantity for product ${item.productId}` }, { status: 400 })
      }

      const product = await db.products.findUnique({ where: { id: item.productId } })
      if (!product || !product.isActive || !product.isApproved) {
        return NextResponse.json({ error: `Product ${item.productId} not available` }, { status: 404 })
      }

      // Check stock
      if (qty > product.stockQuantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}`, available: product.stockQuantity }, { status: 400 })
      }

      // Check MOQ
      if (qty < product.moq) {
        return NextResponse.json({ error: `Minimum order for ${product.name} is ${product.moq}` }, { status: 400 })
      }

      const unitPrice = item.variantId
        ? (await db.productVariants.findUnique({ where: { id: item.variantId } }))?.priceOverride || product.basePrice
        : product.basePrice

      const totalPrice = unitPrice * qty

      // SECURITY: supplier grouping always uses the supplier recorded on the
      // product row — never a client-sent supplierId (anti-manipulation).
      const supplierId = product.supplierId
      if (!supplierGroups[supplierId]) {
        supplierGroups[supplierId] = { items: [], subtotal: 0 }
      }
      supplierGroups[supplierId].items.push({ ...item, quantity: qty, unitPrice, totalPrice })
      supplierGroups[supplierId].subtotal += totalPrice
      totalAmount += totalPrice
    }

    // Apply coupon if provided
    if (couponCode) {
      const coupon = await db.coupons.findUnique({ where: { code: couponCode } })
      if (coupon && coupon.isActive && new Date() >= coupon.validFrom && new Date() <= coupon.validUntil) {
        const discount = totalAmount * (coupon.discountPercent / 100)
        const maxDiscount = coupon.maxDiscount || discount
        totalAmount -= Math.min(discount, maxDiscount)
      }
    }

    // Use transaction for atomic order creation
    const order = await db.$transaction(async (tx) => {
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
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            },
          })
        }
      }

      // Decrease stock for each product
      for (const item of items) {
        const qty = Math.max(1, Math.floor(Number(item.quantity)))
        await tx.products.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { decrement: qty },
            soldCount: { increment: qty },
          },
        })
      }

      // Clear cart
      const cart = await tx.carts.findFirst({ where: { buyerId } })
      if (cart) {
        await tx.cartItems.deleteMany({ where: { cartId: cart.id } })
      }

      return newOrder
    })

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        subOrdersCount: Object.keys(supplierGroups).length,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Order POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
