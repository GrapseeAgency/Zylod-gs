/**
 * Server-side bridge from Next.js API routes to the socket.io mini-service
 * (mini-services/delivery-service) control surface for ANY real-time event —
 * not just delivery pings. Socket.io listens on port 3005 (gateway:
 * /?XTransformPort=3005); the internal /broadcast control endpoint lives on
 * 127.0.0.1:3006 and is loopback-only.
 *
 * Fire-and-forget, same doctrine as delivery-broadcast.ts: the socket
 * service being down NEVER fails the API request — the DB write is the
 * source of truth and clients degrade to HTTP polling.
 *
 * ROOM VOCABULARY (enforced by the socket service's subscribe handler):
 *   order:${orderId}      — token-gated (buyer-owner / admin / assigned driver)
 *   product:${productId}  — PUBLIC (parity: product stock/availability is
 *                           already public data on the PDP); events carry
 *                           only fields a public PDP visitor could already see
 *   seller:${supplierId}  — token-gated via GET /api/realtime/room-token
 *                           (supplier owns supplierId, or admin)
 *   admin:${adminUserId}  — token-gated via GET /api/realtime/room-token
 *                           (userType === 'admin', own id only)
 *   rfq:${rfqId}          — token-gated via GET /api/realtime/room-token
 *                           (Task 52-a: rfq buyer-owner, admin, or a supplier
 *                           with a quote on the RFQ — quotes carry supplier
 *                           pricing, so rfq rooms are NOT public)
 *
 * EVENT VOCABULARY (producers → consumers):
 *   inventory:updated    — PATCH /api/supplier/inventory → PDP stock widgets,
 *                          seller inventory page (cross-session live edits)
 *   product:stock        — PATCH /api/supplier/inventory + PATCH
 *                          /api/supplier/products/[id] (stock actually
 *                          changed) + POST /api/orders + POST
 *                          /api/rfq/[id]/convert-order (Task 56-c) →
 *                          product:<productId> PUBLIC room; canonical
 *                          availability payload {productId, stockQuantity,
 *                          unit, bundleSize, inStock, soldCount?} consumed
 *                          by the PDP live-stock UI (desktop + mobile)
 *   order:new            — POST /api/orders + /api/orders/create-direct →
 *                          seller live order feed (minimal, non-PII payload;
 *                          sellers refetch via authenticated GET)
 *   order:status         — PATCH /api/supplier/orders/[id] → order room
 *                          (buyer tracking + admin watch)
 *   moderation:decision  — PATCH /api/admin/products + /api/admin/suppliers →
 *                          seller feed + admin feed
 *   rfq:new-quote        — POST /api/supplier/rfqs/[id]/quote (Task 52-a)
 *                          → rfq room (buyer live quote feed)
 *   rfq:quote-accepted   — PATCH /api/rfq/[id]/quotes/[quoteId] (Task 52-b)
 *                          → rfq room + seller room
 *   rfq:quote-rejected   — PATCH /api/rfq/[id]/quotes/[quoteId] (Task 52-b)
 *                          → rfq room + seller room
 *   rfq:status           — PATCH /api/admin/rfqs/[id] → rfq:<rfqId> room
 *                          (buyers/suppliers watching the RFQ see the closure)
 *
 * Producers MUST only broadcast REAL, already-persisted state — never
 * optimistic payloads (if the DB write failed, nothing is broadcast).
 */

const CONTROL_URL =
  process.env.DELIVERY_SOCKET_URL || 'http://127.0.0.1:3006'

/** Room names must match this exactly; the socket service rejects others.
 *  Task 52-a added the `rfq` prefix (token-gated — see vocabulary above); the
 *  socket service re-derives this pattern locally (no shared import).
 *  Task 62 added the `user` prefix (token-gated, own-id only — per-user live
 *  notifications). */
export const REALTIME_ROOM_PATTERN = /^(order|product|seller|admin|rfq|user):[A-Za-z0-9_-]+$/

export function isValidRealtimeRoom(room: string): boolean {
  return REALTIME_ROOM_PATTERN.test(room)
}

/**
 * Broadcast an event to a room. Returns true when the control surface
 * acknowledged it; false when the service is unreachable (callers proceed
 * silently — this is a designed degradation, not an error).
 */
export async function broadcastToRoom(
  room: string,
  event: string,
  data: unknown
): Promise<boolean> {
  if (!isValidRealtimeRoom(room)) {
    console.warn(`realtime-broadcast: rejected malformed room "${room}"`)
    return false
  }
  if (typeof event !== 'string' || event.length === 0 || event.length > 64) {
    console.warn(`realtime-broadcast: rejected malformed event name`)
    return false
  }
  try {
    const res = await fetch(`${CONTROL_URL}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, event, data }),
      signal: AbortSignal.timeout(2_000),
    })
    return res.ok
  } catch {
    // Service down or timeout: non-fatal, clients fall back to polling.
    return false
  }
}
