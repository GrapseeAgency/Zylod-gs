import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { broadcastDeliveryPing } from '@/lib/delivery-broadcast'

/**
 * POST /api/delivery/suborders/[subOrderId]/location — DRIVER ONLY
 *
 * The driver's phone app pushes its GPS position here while delivering an
 * assigned sub-order. Every ping:
 *   1. is authenticated as a `driver` account,
 *   2. must match an ACTIVE deliveryAssignments row for this driver on this
 *      sub-order (nobody can track or spoof a delivery they are not on),
 *   3. is Zod-validated and rate-limited (120/min/driver),
 *   4. is persisted as an orderTracking row (status 'gps_ping', grouped by
 *      the assignment id via driverSessionId) so history survives restarts,
 *   5. is broadcast to the order's socket room for live customer maps.
 */

const PingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** GPS horizontal accuracy in metres */
  accuracy: z.number().min(0).max(100_000).nullable().optional(),
  /** device speed in km/h */
  speed: z.number().min(0).max(300).nullable().optional(),
  /** device heading in degrees, 0 = north, clockwise */
  heading: z.number().min(0).max(360).nullable().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subOrderId: string }> }
) {
  const { subOrderId } = await params

  const auth = await requireUserType(request, ['driver'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Driver authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'delivery-ping', 120, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many location updates. Slow down.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid location payload', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }
  const { lat, lng, accuracy, speed } = parsed.data

  try {
    const assignment = await db.deliveryAssignments.findFirst({
      where: {
        subOrderId,
        driverId: auth.user.id,
        status: 'active',
      },
    })
    if (!assignment) {
      return NextResponse.json(
        {
          error:
            'No active delivery assignment for this driver on this sub-order. Location was NOT recorded.',
        },
        { status: 403 }
      )
    }

    const recordedAt = new Date()
    const ping = await db.orderTracking.create({
      data: {
        subOrderId,
        status: 'gps_ping',
        lat,
        lng,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        driverSessionId: assignment.id,
        trackedAt: recordedAt,
      },
    })

    const parent = await db.subOrders.findUnique({
      where: { id: subOrderId },
      select: { orderId: true },
    })

    if (parent) {
      broadcastDeliveryPing({
        orderId: parent.orderId,
        subOrderId,
        lat,
        lng,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        recordedAt: recordedAt.toISOString(),
      })
    }

    return NextResponse.json({
      ok: true,
      pingId: ping.id,
      recordedAt: recordedAt.toISOString(),
    })
  } catch (err) {
    console.error('Driver location POST error:', err)
    return NextResponse.json(
      { error: 'Failed to record location' },
      { status: 500 }
    )
  }
}
