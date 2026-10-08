import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { issueDeliveryRoomToken } from '@/lib/delivery-room-token'

/**
 * GET /api/delivery/orders/[orderId]/room-token — issue a short-lived signed
 * token that authorizes its bearer to join the delivery socket.io room for
 * exactly ONE order (`order:<orderId>`).
 *
 * Authorization mirrors GET /api/delivery/orders/[orderId]/live exactly: the
 * order's buyer, an admin, or a driver with an ACTIVE assignment on one of
 * the order's sub-orders. The socket service (mini-services/delivery-service)
 * verifies the HMAC signature, expiry and room binding itself, so a token can
 * neither be minted client-side nor replayed into another order's room.
 *
 * Read-only: no DB writes (tokens are stateless and self-verifying).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  const rl = checkRateLimit(request, 'delivery-room-token', 30, 60_000)
  if (!rl.ok) {
    return rateLimitResponse(rl)
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
      include: { subOrders: { select: { id: true } } },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const assignments = await db.deliveryAssignments.findMany({
      where: {
        subOrderId: { in: order.subOrders.map((so) => so.id) },
        status: 'active',
      },
      select: { driverId: true },
    })

    const isBuyer = order.buyerId === auth.user.id
    const isAdmin = auth.user.userType === 'admin'
    const isAssignedDriver = assignments.some((a) => a.driverId === auth.user?.id)
    if (!isBuyer && !isAdmin && !isAssignedDriver) {
      return NextResponse.json(
        { error: 'Not authorized to view this delivery' },
        { status: 403 }
      )
    }

    const { token, expiresIn } = issueDeliveryRoomToken({
      roomId: `order:${orderId}`,
      userId: auth.user.id,
      userType: auth.user.userType,
    })

    return NextResponse.json({ success: true, token, roomId: `order:${orderId}`, expiresIn })
  } catch (err) {
    console.error('Delivery room-token GET error:', err)
    return NextResponse.json(
      { error: 'Failed to issue delivery room token' },
      { status: 500 }
    )
  }
}
