import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { notifyOrderMilestone, notifyDeliveryDispatch } from '@/lib/notifications'

/**
 * GET /api/orders/[id]/track — real tracking timeline + latest live GPS position for a sub-order.
 * Query params: subOrderId (optional — if omitted uses the first sub-order)
 *
 * POST /api/orders/[id]/track — driver pushes live GPS coordinates.
 * Body: { subOrderId, lat, lng, accuracy?, speed?, status?, note?, driverSessionId? }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const subOrderId = searchParams.get('subOrderId')

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const order = await db.orders.findUnique({
      where: { id },
      include: {
        subOrders: {
          include: {
            trackingHistory: { orderBy: { trackedAt: 'desc' } },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const isParticipatingSupplier = order.subOrders.some(so => so.supplierId === auth.user?.id)
    if (order.buyerId !== auth.user.id && !isParticipatingSupplier && auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const subOrders = subOrderId
      ? order.subOrders.filter(so => so.id === subOrderId)
      : order.subOrders

    const data = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      subOrders: subOrders.map(so => {
        const history = so.trackingHistory
        const latest = history[0]
        return {
          id: so.id,
          status: so.status,
          trackingNumber: so.trackingNumber,
          estimatedDelivery: so.estimatedDelivery?.toISOString() || null,
          latest: latest
            ? {
                status: latest.status,
                location: latest.location,
                note: latest.note,
                lat: latest.lat,
                lng: latest.lng,
                accuracy: latest.accuracy,
                speed: latest.speed,
                trackedAt: latest.trackedAt.toISOString(),
              }
            : null,
          timeline: history.map(t => ({
            id: t.id,
            status: t.status,
            location: t.location,
            note: t.note,
            lat: t.lat,
            lng: t.lng,
            speed: t.speed,
            trackedAt: t.trackedAt.toISOString(),
          })),
        }
      }),
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Order tracking GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { subOrderId, lat, lng, accuracy, speed, status, note, driverSessionId } = body

    if (!subOrderId || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'subOrderId, lat and lng are required' }, { status: 400 })
    }

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    // Verify the sub-order belongs to this order
    const subOrder = await db.subOrders.findFirst({
      where: { id: subOrderId, orderId: id },
    })
    if (!subOrder) {
      return NextResponse.json({ error: 'Sub-order not found in this order' }, { status: 404 })
    }

    // Only the supplier/driver can push location
    if (subOrder.supplierId !== auth.user.id && auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Only the assigned supplier can push tracking' }, { status: 403 })
    }

    const tracking = await db.orderTracking.create({
      data: {
        subOrderId,
        status: status || subOrder.status,
        location: typeof body.location === 'string' ? body.location : null,
        note: note || null,
        lat,
        lng,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
        speed: typeof speed === 'number' ? speed : null,
        driverSessionId: driverSessionId || null,
      },
    })

    // Update sub-order status if a new status was provided
    if (status && status !== subOrder.status) {
      await db.subOrders.update({
        where: { id: subOrderId },
        data: { status, updatedAt: new Date() },
      })

      // Dispatch real milestone and delivery notifications to buyer
      const parentOrder = await db.orders.findUnique({ where: { id }, select: { buyerId: true, orderNumber: true } })
      if (parentOrder) {
        await notifyOrderMilestone(parentOrder.buyerId, parentOrder.orderNumber, status, id)
        if (status === 'shipped' && subOrder.trackingNumber) {
          await notifyDeliveryDispatch(parentOrder.buyerId, parentOrder.orderNumber, 'Steadfast Logistics', subOrder.trackingNumber, id)
        }
      }

      // If delivered, mark it delivered
      if (status === 'delivered') {
        const allSubOrders = await db.subOrders.findMany({
          where: { orderId: id },
          select: { status: true },
        })
        if (allSubOrders.every(so => so.status === 'delivered')) {
          await db.orders.update({
            where: { id },
            data: { paymentStatus: 'paid' },
          })
        }
      }
    }

    return NextResponse.json({ success: true, data: tracking }, { status: 201 })
  } catch (error) {
    console.error('Order tracking POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
