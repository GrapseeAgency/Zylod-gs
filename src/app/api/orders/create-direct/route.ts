import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { notifyOrderMilestone, notifyEscrowDeposit } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, quantity, variantId, unitPrice, supplierId, shippingAddressId, paymentMethod } = body

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const buyerId = auth.user.id

    if (!productId || !quantity || !unitPrice || !supplierId) {
      return NextResponse.json({ error: 'Missing required fields: productId, quantity, unitPrice, supplierId' }, { status: 400 })
    }

    // Generate order number
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
    const totalPrice = unitPrice * quantity

    // Create order in database
    const order = await db.orders.create({
      data: {
        buyerId,
        orderNumber,
        totalAmount: totalPrice,
        paymentStatus: paymentMethod === 'cod' ? 'unpaid' : 'paid',
        shippingAddressId: shippingAddressId || null,
      },
    })

    // Create sub-order
    const subOrder = await db.subOrders.create({
      data: {
        orderId: order.id,
        supplierId,
        subtotal: totalPrice,
        status: 'pending',
        estimatedDelivery: new Date(Date.now() + 7 * 86400000),
      },
    })

    // Create order item
    await db.orderItems.create({
      data: {
        subOrderId: subOrder.id,
        productId,
        variantId: variantId || null,
        quantity,
        unitPrice,
        totalPrice,
      },
    })

    // Create initial tracking entry
    await db.orderTracking.create({
      data: {
        subOrderId: subOrder.id,
        status: 'pending',
        location: 'Order placed',
        note: 'Order has been created and is awaiting confirmation.',
      },
    })

    // Dispatch real wholesale order & escrow notifications
    await notifyOrderMilestone(buyerId, order.orderNumber, 'confirmed', order.id)
    if (order.paymentStatus === 'paid') {
      await notifyEscrowDeposit(buyerId, order.totalAmount, order.orderNumber, order.id)
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        subOrderId: subOrder.id,
        estimatedDelivery: subOrder.estimatedDelivery?.toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Direct order creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}