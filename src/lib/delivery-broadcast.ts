/**
 * Server-side bridge from Next.js API routes to the delivery socket.io
 * mini-service (mini-services/delivery-service). Socket.io listens on port
 * 3005; the internal /broadcast control endpoint lives on 127.0.0.1:3006.
 *
 * The driver's phone POSTs a GPS ping to /api/delivery/... (which persists
 * it via Prisma); this helper then fire-and-forgets the ping to the socket
 * service so every customer watching that order receives it live. If the
 * socket service is down, customers simply fall back to HTTP polling —
 * delivery data itself is never lost because the DB write happens first.
 */

const DELIVERY_SOCKET_URL =
  process.env.DELIVERY_SOCKET_URL || 'http://127.0.0.1:3006'

export interface DeliveryPingPayload {
  orderId: string
  subOrderId: string
  lat: number
  lng: number
  accuracy: number | null
  speed: number | null
  recordedAt: string
}

export function broadcastDeliveryPing(payload: DeliveryPingPayload): void {
  fetch(`${DELIVERY_SOCKET_URL}/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: `order:${payload.orderId}`,
      event: 'delivery:ping',
      data: payload,
    }),
    signal: AbortSignal.timeout(2_000),
  }).catch(() => {
    // Non-fatal: clients fall back to polling the REST endpoint.
  })
}
