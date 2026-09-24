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
    const { originalItemId, replacementOptionId, reason, notes } = body

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    if (!originalItemId) return NextResponse.json({ error: 'Please specify the original item to exchange' }, { status: 400 })
    if (!replacementOptionId) return NextResponse.json({ error: 'Please select a replacement option' }, { status: 400 })

    const order = await db.orders.findUnique({
      where: { id },
      select: { id: true, buyerId: true, orderNumber: true },
    })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.buyerId !== auth.user.id && auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Verify the item belongs to this order
    const item = await db.orderItems.findFirst({
      where: { id: originalItemId, subOrder: { orderId: id } },
      include: { subOrder: { select: { id: true } } },
    })
    if (!item) return NextResponse.json({ error: 'Original item not found in this order' }, { status: 404 })

    // Mark sub-order as returned for exchange
    await db.subOrders.update({
      where: { id: item.subOrder.id },
      data: { status: 'returned', updatedAt: new Date() },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'order_exchange_request',
        entityType: 'orders',
        entityId: id,
        metadata: JSON.stringify({ originalItemId, replacementOptionId, reason, notes }),
      },
    })

    const originalValue = item.unitPrice * item.quantity

    // De-fake campaign: no invented financials. Any price difference of a
    // real exchange must come from real replacement pricing once a proper
    // exchanges workflow (table + pricing rules) exists — the previous
    // hardcoded balanceDue (20%) / newValue (1.2x) figures were fabricated.
    return NextResponse.json({
      success: true,
      data: {
        exchangeId: `EXC-${Date.now().toString(36).toUpperCase()}`,
        orderId: id,
        originalItemId,
        replacementOptionId,
        reason: reason || null,
        notes: notes || null,
        status: 'requested',
        originalValue,
        currency: 'BDT',
        createdAt: new Date().toISOString(),
      },
      message: 'Exchange request submitted successfully. You will be notified once it is processed.',
    })
  } catch (error) {
    console.error('Exchange request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}