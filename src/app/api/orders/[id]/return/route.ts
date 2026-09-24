import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import type { returnRequests, returnRequestItems } from '@prisma/client'

function generateReturnNumber(): string {
  // RTN-<base36 timestamp>-<random suffix>; uniqueness enforced by the unique column + retry below
  const ts = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `RTN-${ts}-${rnd}`
}

/**
 * POST /api/orders/[id]/return — buyer submits a return request for a PAID, DELIVERED order.
 *
 * Real behavior (no fake success):
 * - Creates a real returnRequests row (status 'pending') + per-item rows.
 * - NOTHING is scheduled (no pickup), NO order status is flipped here.
 * - The Zylod team reviews the request; approval/refund happens server-side later.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const rl = checkRateLimit(request, 'return-request', 5, 60 * 1000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { items, shippingMethod } = (body ?? {}) as {
      items?: Array<{
        itemId?: string
        reason?: string
        quantity?: number
        comments?: string
      }>
      shippingMethod?: string
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Please select at least one item to return' }, { status: 400 })
    }
    if (items.length > 50) {
      return NextResponse.json({ error: 'Too many items in one return request' }, { status: 400 })
    }
    for (const item of items) {
      if (!item?.itemId || typeof item.itemId !== 'string') {
        return NextResponse.json({ error: 'Each returned item must reference an order item' }, { status: 400 })
      }
      if (!item.reason || typeof item.reason !== 'string' || !item.reason.trim()) {
        return NextResponse.json({ error: 'Please provide a reason for each returned item' }, { status: 400 })
      }
      if (item.reason.trim().length > 500) {
        return NextResponse.json({ error: 'Return reason must be 500 characters or fewer' }, { status: 400 })
      }
      if (item.comments != null && typeof item.comments !== 'string') {
        return NextResponse.json({ error: 'Comments must be text' }, { status: 400 })
      }
      const qty = Number(item.quantity ?? 1)
      if (!Number.isInteger(qty) || qty < 1 || qty > 100000) {
        return NextResponse.json({ error: 'Return quantity must be a whole number of at least 1' }, { status: 400 })
      }
    }
    const method = shippingMethod === 'dropoff' ? 'dropoff' : 'pickup'

    const order = await db.orders.findUnique({
      where: { id },
      select: { id: true, buyerId: true, orderNumber: true, paymentStatus: true },
    })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.buyerId !== auth.user.id && auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // A return only makes sense for an order that was actually paid.
    if (order.paymentStatus !== 'paid') {
      return NextResponse.json(
        { error: `Only paid orders can be returned — this order is ${order.paymentStatus}` },
        { status: 409 }
      )
    }

    // No duplicate open return for the same order.
    const openReturn = await db.returnRequests.findFirst({
      where: { orderId: id, status: { in: ['pending', 'approved'] } },
      select: { id: true, returnNumber: true, status: true },
    })
    if (openReturn) {
      return NextResponse.json(
        { error: `A return for this order is already ${openReturn.status} (${openReturn.returnNumber})` },
        { status: 409 }
      )
    }

    // Items must belong to this order, from DELIVERED sub-orders, with sane quantities.
    const itemIds = [...new Set(items.map(i => i.itemId as string))]
    const dbItems = await db.orderItems.findMany({
      where: { id: { in: itemIds }, subOrder: { orderId: id } },
      select: { id: true, quantity: true, subOrderId: true, subOrder: { select: { status: true } } },
    })
    const dbItemsById = new Map(dbItems.map(i => [i.id, i]))

    for (const item of items) {
      const dbItem = dbItemsById.get(item.itemId as string)
      if (!dbItem) {
        return NextResponse.json({ error: 'One or more selected items do not belong to this order' }, { status: 400 })
      }
      const qty = Number(item.quantity ?? 1)
      if (qty > dbItem.quantity) {
        return NextResponse.json(
          { error: `Return quantity cannot exceed the ordered quantity (${dbItem.quantity})` },
          { status: 400 }
        )
      }
      if (dbItem.subOrder.status !== 'delivered') {
        return NextResponse.json(
          { error: `Items can only be returned after delivery — this order is still ${dbItem.subOrder.status}` },
          { status: 409 }
        )
      }
    }

    // Real refund estimate: item total price prorated by returned quantity.
    const fullItems = await db.orderItems.findMany({
      where: { id: { in: itemIds }, subOrder: { orderId: id } },
      select: { id: true, quantity: true, totalPrice: true },
    })
    const fullById = new Map(fullItems.map(i => [i.id, i]))
    const refundEstimate = items.reduce((sum, item) => {
      const dbItem = fullById.get(item.itemId as string)
      if (!dbItem) return sum
      const qty = Number(item.quantity ?? 1)
      return sum + (dbItem.totalPrice * qty) / dbItem.quantity
    }, 0)

    // Persist the request for real. Retry once if the random return number collides.
    // (returnRequestItems has no Prisma relation by design — plain string FK, like auditLogs.)
    let created: returnRequests | null = null
    let createdItems: returnRequestItems[] = []
    for (let attempt = 0; attempt < 2 && !created; attempt++) {
      try {
        created = await db.returnRequests.create({
          data: {
            returnNumber: generateReturnNumber(),
            orderId: id,
            buyerId: auth.user.id,
            status: 'pending',
            shippingMethod: method,
            estimatedRefund: Math.round(refundEstimate * 100) / 100,
          },
        })
        createdItems = await db.returnRequestItems.createManyAndReturn({
          data: items.map(item => ({
            returnRequestId: created!.id,
            orderItemId: item.itemId as string,
            reason: (item.reason as string).trim(),
            quantity: Number(item.quantity ?? 1),
            comments: item.comments?.trim() || null,
          })),
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (attempt === 1 || !msg.includes('Unique constraint')) {
          throw e
        }
      }
    }
    if (!created) {
      return NextResponse.json({ error: 'Failed to create the return request' }, { status: 500 })
    }

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'order_return_request',
        entityType: 'returnRequests',
        entityId: created.id,
        metadata: JSON.stringify({
          orderNumber: order.orderNumber,
          returnNumber: created.returnNumber,
          items: items.map(i => ({ itemId: i.itemId, reason: i.reason, quantity: i.quantity })),
          shippingMethod: method,
          estimatedRefund: created.estimatedRefund,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        returnNumber: created.returnNumber,
        orderId: id,
        orderNumber: order.orderNumber,
        status: created.status,
        shippingMethod: created.shippingMethod,
        estimatedRefund: created.estimatedRefund,
        refundCurrency: 'BDT',
        items: createdItems.map(i => ({
          id: i.id,
          orderItemId: i.orderItemId,
          reason: i.reason,
          quantity: i.quantity,
          comments: i.comments,
        })),
        createdAt: created.createdAt.toISOString(),
      },
      message: 'Return request submitted. It is pending review by the Zylod team — you will see the decision on this order.',
    })
  } catch (error) {
    console.error('Return request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
