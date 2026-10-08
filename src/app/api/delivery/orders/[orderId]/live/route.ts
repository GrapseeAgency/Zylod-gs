import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { routeDriverToDestination } from '@/lib/delivery-routing'

/**
 * GET /api/delivery/orders/[orderId]/live — live delivery tracking feed
 *
 * Access: the order's buyer, an admin, or a driver with an active
 * assignment on one of the order's sub-orders.
 *
 * Response is 100% real:
 *  - legs[] one per sub-order with an ACTIVE delivery assignment, carrying
 *    the driver's latest persisted GPS ping (orderTracking rows written by
 *    the driver's phone via POST /api/delivery/suborders/[id]/location).
 *  - destination from the order's shipping address lat/lng — null (with an
 *    honest note) when the address was never geocoded.
 *  - routing distance/ETA from the OSRM-compatible service; when routing is
 *    unavailable the straight-line distance is returned explicitly labeled
 *    and no ETA is provided. Nothing is ever fabricated.
 *  - live:false with a machine-readable reason when there is nothing to
 *    track (no active assignment = no live delivery for this order yet).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  const rl = checkRateLimit(request, 'delivery-live', 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    )
  }

  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const order = await db.orders.findUnique({
      where: { id: orderId },
      include: {
        shippingAddress: true,
        subOrders: { select: { id: true, status: true } },
      },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const assignments = await db.deliveryAssignments.findMany({
      where: { subOrderId: { in: order.subOrders.map((so) => so.id) }, status: 'active' },
      include: {
        driver: { select: { id: true, email: true, phone: true } },
        subOrder: { select: { id: true, status: true } },
      },
    })

    const isAssignedDriver = assignments.some((a) => a.driverId === auth.user?.id)
    const isBuyer = order.buyerId === auth.user?.id
    const isAdmin = auth.user?.userType === 'admin'
    if (!isBuyer && !isAdmin && !isAssignedDriver) {
      return NextResponse.json(
        { error: 'Not authorized to view this delivery' },
        { status: 403 }
      )
    }

    if (assignments.length === 0) {
      return NextResponse.json({
        live: false,
        reason: 'no_active_delivery',
        message:
          'No driver is currently assigned to a live delivery on this order, so there is no live location to show.',
        orderNumber: order.orderNumber,
      })
    }

    const statusRank: Record<string, number> = {
      pending: 0, confirmed: 1, packed: 2, shipped: 3, delivered: 4, cancelled: 5, returned: 6,
    }

    // Latest ping per active leg
    const legs: Array<{
      subOrderId: string
      status: string
      driver: { id: string; name: string }
      latestPing: {
        lat: number
        lng: number
        accuracy: number | null
        speed: number | null
        heading: number | null
        recordedAt: string
      } | null
    }> = []

    let newestPing: { lat: number; lng: number; recordedAt: Date } | null = null

    for (const a of assignments) {
      const ping =
        (await db.orderTracking.findFirst({
          where: { subOrderId: a.subOrderId, driverSessionId: a.id, status: 'gps_ping' },
          orderBy: { trackedAt: 'desc' },
        })) ?? null

      const driverName =
        a.driver.email?.split('@')[0] ||
        a.driver.phone ||
        `Driver ${a.driverId.slice(-4)}`

      legs.push({
        subOrderId: a.subOrderId,
        status: a.subOrder.status,
        driver: { id: a.driver.id, name: driverName },
        latestPing: ping
          ? {
              lat: ping.lat as number,
              lng: ping.lng as number,
              accuracy: ping.accuracy,
              speed: ping.speed,
              heading: null,
              recordedAt: ping.trackedAt.toISOString(),
            }
          : null,
      })

      if (ping && (!newestPing || ping.trackedAt > newestPing.recordedAt)) {
        newestPing = { lat: ping.lat as number, lng: ping.lng as number, recordedAt: ping.trackedAt }
      }
    }

    const notes: string[] = []

    // Stale ping honesty: GPS is only "live" while the driver's phone is on.
    if (newestPing) {
      const ageSec = Math.floor((Date.now() - newestPing.recordedAt.getTime()) / 1000)
      if (ageSec > 300) {
        notes.push(
          `Last driver position was received ${Math.floor(ageSec / 60)} minute(s) ago — the driver may be offline.`
        )
      }
    } else {
      notes.push('The assigned driver has not sent any location yet.')
    }

    // Destination coordinates (only if the address was actually geocoded)
    const addr = order.shippingAddress
    const destination =
      addr && typeof addr.lat === 'number' && typeof addr.lng === 'number'
        ? {
            lat: addr.lat,
            lng: addr.lng,
            label: addr.label,
            city: addr.city,
            district: addr.district,
            addressLine1: addr.addressLine1,
          }
        : null
    if (!destination) {
      notes.push(
        'The delivery address has no map coordinates yet, so the route and ETA cannot be shown.'
      )
    }

    // Road routing (driver → destination) with honest degradation
    let routing: Awaited<ReturnType<typeof routeDriverToDestination>> | null = null
    if (newestPing && destination) {
      routing = await routeDriverToDestination(
        newestPing.lat,
        newestPing.lng,
        destination.lat,
        destination.lng
      )
      if (routing.routingNote) notes.push(routing.routingNote)
    }

    legs.sort(
      (x, y) => (statusRank[y.status] ?? 0) - (statusRank[x.status] ?? 0)
    )

    return NextResponse.json({
      live: true,
      orderNumber: order.orderNumber,
      legs,
      destination,
      routing: routing
        ? {
            distanceM: routing.route?.distanceM ?? null,
            durationS: routing.route?.durationS ?? null,
            geometry: routing.route?.geometry ?? null,
            straightLineM: routing.straightLineM,
            provider: routing.route?.provider ?? null,
          }
        : null,
      notes,
    })
  } catch (err) {
    console.error('Live delivery GET error:', err)
    return NextResponse.json(
      { error: 'Failed to load live delivery data' },
      { status: 500 }
    )
  }
}
