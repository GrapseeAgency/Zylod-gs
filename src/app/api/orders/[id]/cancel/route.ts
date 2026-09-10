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
    const { itemIds, reason, notes } = body as {
      itemIds?: string[]
      reason?: string
      notes?: string
    }

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    if (!itemIds || itemIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one item to cancel' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ error: 'Please provide a reason for cancellation' }, { status: 400 })
    }

    const order = await db.orders.findUnique({
      where: { id },
      select: { id: true, buyerId: true, orderNumber: true, totalAmount: true },
    })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.buyerId !== auth.user.id && auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Cancel the order items by updating their sub-order status
    const items = await db.orderItems.findMany({
      where: { id: { in: itemIds }, subOrder: { orderId: id } },
      include: { subOrder: { select: { id: true, supplierId: true } } },
    })
    if (items.length === 0) {
      return NextResponse.json({ error: 'No matching items found' }, { status: 404 })
    }

    // Group by sub-order and cancel each
    for (const item of items) {
      await db.subOrders.update({
        where: { id: item.subOrder.id },
        data: { status: 'cancelled', updatedAt: new Date() },
      })
    }

    const totalRefund = items.reduce((sum, i) => sum + i.totalPrice, 0)

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'order_cancel',
        entityType: 'orders',
        entityId: id,
        metadata: JSON.stringify({ reason, notes, itemIds, refundAmount: totalRefund }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        cancellationId: `CNL-${Date.now().toString(36).toUpperCase()}`,
        orderId: id,
        orderNumber: order.orderNumber,
        cancelledItems: itemIds,
        reason,
        notes: notes || null,
        status: 'cancelled',
        refundAmount: totalRefund,
        refundCurrency: 'BDT',
        cancelledAt: new Date().toISOString(),
      },
      message: 'Order items cancelled successfully. Refund will be processed within 3-5 business days.',
    })
  } catch (error) {
    console.error('Cancel order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}