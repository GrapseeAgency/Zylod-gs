import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

const STATUS_ORDER = ['pending', 'confirmed', 'packed', 'shipped', 'delivered']

const STATUS_META: Record<string, { title: string; icon: string; description: string }> = {
  pending: { title: 'Order Placed', icon: 'clipboard-list', description: 'Order has been created and submitted for processing.' },
  confirmed: { title: 'Order Confirmed', icon: 'check-circle', description: 'Supplier has confirmed the order and accepted the terms.' },
  packed: { title: 'Packed', icon: 'package', description: 'All items have been packed and are ready for dispatch.' },
  shipped: { title: 'Shipped', icon: 'truck', description: 'Order has been dispatched from the warehouse.' },
  delivered: { title: 'Delivered', icon: 'check-circle-2', description: 'Order has been delivered and signed for by the recipient.' },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const order = await db.orders.findUnique({
      where: { id },
      include: {
        subOrders: {
          include: {
            trackingHistory: { orderBy: { trackedAt: 'asc' } },
          },
        },
      },
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const isParticipatingSupplier = order.subOrders.some(so => so.supplierId === auth.user?.id)
    if (order.buyerId !== auth.user.id && !isParticipatingSupplier && auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Merge all tracking events across sub-orders, sorted by time
    const allEvents: { id: string; title: string; description: string; timestamp: string; status: 'completed' | 'current' | 'upcoming'; icon: string }[] = []

    for (const so of order.subOrders) {
      // Base lifecycle events from sub-order status
      const currentIndex = STATUS_ORDER.indexOf(so.status)
      STATUS_ORDER.forEach((s, i) => {
        const meta = STATUS_META[s]
        if (!meta) return
        const isReached = i <= currentIndex
        const tracked = so.trackingHistory.find(t => t.status === s)
        allEvents.push({
          id: `${so.id}-${s}`,
          title: meta.title,
          description: tracked?.note || meta.description,
          timestamp: tracked
            ? new Date(tracked.trackedAt).toISOString()
            : i === currentIndex
              ? 'In progress'
              : 'Pending',
          status: i < currentIndex ? 'completed' : i === currentIndex ? 'current' : 'upcoming',
          icon: meta.icon,
        })
      })

      // GPS tracking pings
      for (const t of so.trackingHistory) {
        if (!t.lat || !t.lng) continue
        allEvents.push({
          id: t.id,
          title: `Driver at ${t.location || 'location update'}`,
          description: t.note || `GPS fix: ${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}${t.speed != null ? ` · ${Math.round(t.speed)} km/h` : ''}`,
          timestamp: t.trackedAt.toISOString(),
          status: 'completed',
          icon: 'navigation',
        })
      }
    }

    allEvents.sort((a, b) => {
      if (a.timestamp === 'Pending' || a.timestamp === 'In progress') return 1
      if (b.timestamp === 'Pending' || b.timestamp === 'In progress') return -1
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    })

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.subOrders.some(so => so.status === 'shipped')
          ? 'Shipped'
          : order.subOrders.every(so => so.status === 'delivered')
            ? 'Delivered'
            : order.subOrders[0]?.status || 'pending',
        events: allEvents,
      },
    })
  } catch (error) {
    console.error('Order timeline error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}