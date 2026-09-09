import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { items, shippingMethod } = body as {
      items?: Array<{
        itemId: string
        reason: string
        quantity: number
        evidence?: string[]
        comments?: string
      }>
      shippingMethod?: string
    }

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Please select at least one item to return' }, { status: 400 })
    }

    const invalidItem = items.find((item) => !item.reason)
    if (invalidItem) {
      return NextResponse.json({ error: 'Please provide a reason for each returned item' }, { status: 400 })
    }

    const order = await db.orders.findUnique({
      where: { id },
      select: { id: true, buyerId: true, orderNumber: true },
    })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.buyerId !== auth.user.id && auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Verify all items belong to this order and compute refund
    const itemIds = items.map(i => i.itemId)
    const dbItems = await db.orderItems.findMany({
      where: { id: { in: itemIds }, subOrder: { orderId: id } },
    })
    if (dbItems.length === 0) {
      return NextResponse.json({ error: 'No matching items found' }, { status: 404 })
    }

    // Mark the sub-orders containing returned items as 'returned'
    const subOrderIds = [...new Set(dbItems.map(i => i.subOrderId))]
    for (const subOrderId of subOrderIds) {
      await db.subOrders.update({
        where: { id: subOrderId },
        data: { status: 'returned', updatedAt: new Date() },
      })
    }

    const estimatedRefund = dbItems.reduce((sum, i) => sum + i.totalPrice, 0)

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'order_return_request',
        entityType: 'orders',
        entityId: id,
        metadata: JSON.stringify({
          items: items.map(i => ({ itemId: i.itemId, reason: i.reason, quantity: i.quantity })),
          shippingMethod: shippingMethod || 'pickup',
          estimatedRefund,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        returnId: `RET-${Date.now().toString(36).toUpperCase()}`,
        orderId: id,
        status: 'requested',
        items: items.map((item) => ({
          ...item,
          returnItemId: `RTI-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        })),
        shippingMethod: shippingMethod || 'pickup',
        estimatedRefund,
        refundCurrency: 'BDT',
        pickupScheduled: true,
        estimatedPickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      },
      message: 'Return request submitted successfully. We will schedule a pickup shortly.',
    })
  } catch (error) {
    console.error('Return request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}