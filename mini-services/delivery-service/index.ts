/**
 * delivery-service — socket.io broadcaster for live delivery tracking AND the
 * platform-wide real-time backbone (Task 51-a room generalization).
 * Port 3005 for socket.io (path '/'), port 3006 for the internal control
 * HTTP surface (/broadcast + /health). They must be separate servers because
 * socket.io attached at path '/' intercepts every request on its own server.
 *
 * Flows:
 *   driver phone ──POST /api/delivery/suborders/[id]/location──▶ Next.js API
 *   Next.js API (persists ping via Prisma) ──POST :3006/broadcast──▶ this service
 *   this service ──io.to(room).emit('delivery:ping')──▶ customer's map
 *   Any Next.js API ──POST :3006/broadcast──▶ this service ──io.to(room).emit──▶
 *   subscribed clients (inventory:updated / order:new / order:status … — the
 *   full vocabulary lives in src/lib/realtime-broadcast.ts).
 *
 * ROOM VOCABULARY (subscribe handler, Task 51-a; rfq added Task 52-a;
 * user added Task 62):
 *   order:${orderId}      — token-gated
 *   seller:${supplierId}  — token-gated (minted by GET /api/realtime/room-token)
 *   admin:${adminUserId}  — token-gated (minted by GET /api/realtime/room-token)
 *   rfq:${rfqId}          — TOKEN-GATED (minted by GET /api/realtime/room-token;
 *     Task 52-a: rfq buyer-owner / admin / a supplier with a quote on the RFQ).
 *     Quotes carry supplier pricing — rfq rooms are deliberately NOT public,
 *     unlike product rooms.
 *   user:${userId}        — TOKEN-GATED, OWN-ID ONLY (minted by GET
 *     /api/realtime/room-token; Task 62 — per-user live notifications:
 *     every sendNotification lands here as 'notification:new').
 *   product:${productId}  — PUBLIC, joins WITHOUT a token. This is deliberate
 *     parity: product stock/availability is already public data rendered on
 *     the PDP (/api/products/[id] is a public read), so the push channel
 *     carries nothing a public PDP visitor could not already see. Events on
 *     product rooms must only contain public fields (stockQuantity, delta…).
 *   Room names must match /^(order|product|seller|admin|rfq):[A-Za-z0-9_-]+$.
 *
 * TOKEN-GATED ROOM AUTH (signed-room tokens — no unauthenticated join):
 *   1. Browser asks Next.js: GET /api/delivery/orders/[orderId]/room-token
 *      (buyer-owner / admin / assigned-driver) or
 *      GET /api/realtime/room-token?room=... (seller:/admin:/rfq: rooms —
 *      Task 51-a; rfq added Task 52-a). Next authorizes and returns a
 *      10-minute token.
 *   2. Client emits `subscribe` { room, token } — or the legacy
 *      { orderId, token } which maps to room `order:${orderId}` (identical
 *      behaviour to the original handler).
 *   3. This service verifies: token = `${payload}.${sig}` with
 *      payload = base64url(JSON { r: roomId, u: userId, k: userType, exp })
 *      sig     = base64url(HMAC-SHA256(payload, secret)),
 *      constant-time signature compare, exp > now, claims.r === requested
 *      room. Failure → `subscribe:denied` { reason } and NO room is joined
 *      (the socket then receives no events for that room). Success →
 *      `subscribe:ok` { roomId }.
 *   Secret = DELIVERY_ROOM_SECRET, or — when unset —
 *   sha256(`${AUTH_SECRET || DATABASE_URL}:delivery-rooms`) hex, read from
 *   the repo-root .env (../../.env). Next's src/lib/delivery-room-token.ts
 *   implements the identical derivation; the processes share no imports.
 *
 * The service still holds no auth state and exposes no data of its own —
 * everything it emits was already permission-checked by the Next.js API
 * that forwarded it (product rooms broadcast public-parity fields only).
 *
 * In the sandbox the gateway forwards `/?XTransformPort=3005` here; on
 * Railway, expose this service on its own domain or mount it behind the
 * same reverse proxy (see MAPS.md → Production checklist).
 */
import { Buffer } from 'node:buffer'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3005 // public socket.io (via gateway: /?XTransformPort=3005)
const CONTROL_PORT = 3006 // internal, Next.js API only

/** Room names accepted by the subscribe handler (Task 51-a; rfq: Task 52-a;
 *  user: Task 62). */
const ROOM_PATTERN = /^(order|product|seller|admin|rfq|user):[A-Za-z0-9_-]+$/

/* ── Env: load the repo-root .env explicitly (bun does NOT auto-load it) ── */
const ENV_KEYS = [
  'DELIVERY_ROOM_SECRET',
  'AUTH_SECRET',
  'DATABASE_URL',
  'SOCKET_ALLOWED_ORIGINS', // Task 52-a — see the CORS block below
] as const

function loadRepoRootEnv(): void {
  const candidates = [fileURLToPath(new URL('../../.env', import.meta.url)), '.env']
  for (const path of candidates) {
    let raw: string
    try {
      raw = readFileSync(path, 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      if (!(ENV_KEYS as readonly string[]).includes(key)) continue
      if (process.env[key] !== undefined) continue
      let value = m[2]
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
    break // first existing file wins
  }
}
loadRepoRootEnv()

/* ── Room-token verification (mirrors src/lib/delivery-room-token.ts) ── */
function getDeliveryRoomSecret(): string {
  const explicit = process.env.DELIVERY_ROOM_SECRET
  if (explicit && explicit.trim().length > 0) return explicit.trim()
  const seed = process.env.AUTH_SECRET || process.env.DATABASE_URL || ''
  return createHash('sha256').update(`${seed}:delivery-rooms`).digest('hex')
}

interface RoomTokenClaims {
  r: string
  u: string
  k: string
  exp: number
}

type TokenVerifyResult =
  | { ok: true; claims: RoomTokenClaims }
  | { ok: false; reason: 'invalid_token' | 'token_expired' | 'room_mismatch' }

function verifyRoomToken(token: string, roomId: string): TokenVerifyResult {
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1 || token.slice(dot + 1).includes('.')) {
    return { ok: false, reason: 'invalid_token' }
  }
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  const expected = createHmac('sha256', getDeliveryRoomSecret()).update(payload).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'invalid_token' }
  }

  let claims: RoomTokenClaims
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const obj = parsed as Record<string, unknown> | null
    if (
      typeof obj !== 'object' ||
      obj === null ||
      typeof obj.r !== 'string' ||
      typeof obj.u !== 'string' ||
      typeof obj.k !== 'string' ||
      typeof obj.exp !== 'number'
    ) {
      return { ok: false, reason: 'invalid_token' }
    }
    claims = { r: obj.r, u: obj.u, k: obj.k, exp: obj.exp }
  } catch {
    return { ok: false, reason: 'invalid_token' }
  }

  if (claims.exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'token_expired' }
  }
  if (claims.r !== roomId) {
    return { ok: false, reason: 'room_mismatch' }
  }
  return { ok: true, claims }
}

/* ── Per-socket subscribe rate limit (blunt brute-force of the HMAC) ── */
const SUBSCRIBE_MAX_PER_MINUTE = 10
const SUBSCRIBE_WINDOW_MS = 60_000
const subscribeAttempts = new Map<string, number[]>()
let lastSweep = Date.now()

function subscribeRateLimited(socketId: string): boolean {
  const now = Date.now()
  if (now - lastSweep > 5 * SUBSCRIBE_WINDOW_MS) {
    lastSweep = now
    subscribeAttempts.forEach((hits, id) => {
      const alive = hits.filter((t) => now - t < SUBSCRIBE_WINDOW_MS)
      if (alive.length === 0) subscribeAttempts.delete(id)
      else subscribeAttempts.set(id, alive)
    })
  }
  const hits = (subscribeAttempts.get(socketId) ?? []).filter(
    (t) => now - t < SUBSCRIBE_WINDOW_MS
  )
  if (hits.length >= SUBSCRIBE_MAX_PER_MINUTE) {
    subscribeAttempts.set(socketId, hits)
    return true
  }
  hits.push(now)
  subscribeAttempts.set(socketId, hits)
  return false
}

/* ── Internal control server: broadcast + health ─────────────────────── */
const controlServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    let sockets = 0
    io.sockets.sockets.forEach(() => sockets++)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'delivery-service', auth: 'room-token', sockets }))
    return
  }

  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 64 * 1024) req.destroy() // abuse guard
    })
    req.on('end', () => {
      try {
        const { room, event, data } = JSON.parse(body)
        if (typeof room !== 'string' || typeof event !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'room and event are required strings' }))
          return
        }
        io.to(room).emit(event, data)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, room, event }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

/* ── CORS (Task 52-a): env-driven allowlist instead of a hardcoded '*' ──
 * DEPLOY NOTE: on Railway you MUST set SOCKET_ALLOWED_ORIGINS to a comma-
 * separated list of origins allowed to open a socket (e.g.
 * "https://zylod.com,https://www.zylod.com"). The default stays '*' so the
 * sandbox preview (the gateway proxies same-origin) and local dev keep
 * working — but '*' must not ship to production. A request with no Origin
 * header (non-browser client) is always allowed.
 */
const ALLOWED_ORIGINS: string[] = (process.env.SOCKET_ALLOWED_ORIGINS || '*')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0)

function originOk(origin: string | undefined): boolean {
  if (!origin) return true // non-browser client (no Origin header)
  if (ALLOWED_ORIGINS.includes('*')) return true
  return ALLOWED_ORIGINS.includes(origin)
}

/* ── Public socket.io server (gateway forwards /?XTransformPort=3005) ── */
const io = new Server(
  createServer((req, res) => {
    // socket.io intercepts its own path; anything else 404s
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }),
  {
    // DO NOT change the path — the gateway routes '/' on this port to socket.io
    path: '/',
    cors: {
      origin: (origin, callback) => {
        if (originOk(origin)) callback(null, true)
        else callback(new Error('Origin not allowed by SOCKET_ALLOWED_ORIGINS'))
      },
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60_000,
    pingInterval: 25_000,
  }
)

io.on('connection', (socket) => {
  const joinedRooms = new Set<string>()

  // Generalized room subscribe (Task 51-a; rfq: Task 52-a).
  //  - { room: 'product:<id>' }            → PUBLIC join, token NOT required
  //    (parity: product stock is already public on the PDP).
  //  - { room: 'order:|seller:|admin:|rfq:<id>', token } → valid signed token
  //    bound to that exact room (claims.r === room) is REQUIRED. rfq rooms
  //    are token-gated because quotes carry supplier pricing.
  //  - Legacy { orderId, token }            → identical to the original
  //    handler: room `order:${orderId}` with token verification.
  // The per-socket subscribe rate limit is unchanged and applies to every path.
  socket.on('subscribe', (data: { room?: string; orderId?: string; token?: string }) => {
    if (subscribeRateLimited(socket.id)) {
      console.warn(`delivery-service: subscribe rate limit exceeded by ${socket.id} — disconnecting`)
      socket.disconnect(true)
      return
    }

    const rawRoom = typeof data?.room === 'string' ? data.room.trim() : ''
    const orderId = typeof data?.orderId === 'string' ? data.orderId.trim() : ''
    const token = typeof data?.token === 'string' ? data.token.trim() : ''

    let room: string
    let requiresToken: boolean
    if (rawRoom) {
      if (!ROOM_PATTERN.test(rawRoom)) {
        socket.emit('subscribe:denied', { reason: 'invalid_room' })
        return
      }
      room = rawRoom
      // product: rooms are public by design — a token is neither required
      // nor checked (a stale/mismatched token must not fail a public join).
      requiresToken = !room.startsWith('product:')
    } else if (orderId) {
      // Backward-compatible path — byte-for-byte the original behaviour.
      room = `order:${orderId}`
      requiresToken = true
    } else {
      socket.emit('subscribe:denied', { reason: 'invalid_request' })
      return
    }

    if (requiresToken) {
      if (!token) {
        socket.emit('subscribe:denied', { reason: 'invalid_token' })
        return
      }
      const result = verifyRoomToken(token, room)
      if (result.ok === false) {
        socket.emit('subscribe:denied', { reason: result.reason })
        return
      }
    }

    socket.join(room)
    joinedRooms.add(room)
    socket.emit('subscribe:ok', { roomId: room })
  })

  socket.on('unsubscribe', (data: { room?: string; orderId?: string }) => {
    let room = ''
    if (typeof data?.room === 'string' && ROOM_PATTERN.test(data.room.trim())) {
      room = data.room.trim()
    } else if (typeof data?.orderId === 'string' && data.orderId.trim()) {
      room = `order:${data.orderId.trim()}`
    }
    if (!room) return
    socket.leave(room)
    joinedRooms.delete(room)
  })

  socket.on('disconnect', () => {
    joinedRooms.clear()
    subscribeAttempts.delete(socket.id)
  })

  socket.on('error', (err) => {
    console.error(`socket error (${socket.id}):`, err)
  })
})

// Control surface is internal-only; bind to loopback so nothing outside the
// host can reach /broadcast.
// Fail-fast on bind errors: a second instance must NEVER half-start (it would
// split 3005/3006 across two processes and silently drop broadcasts).
controlServer.on('error', (err) => {
  console.error(`delivery-service: control port ${CONTROL_PORT} bind failed:`, err)
  process.exit(1)
})
controlServer.listen(CONTROL_PORT, '127.0.0.1', () => {
  console.log(`delivery-service control API on 127.0.0.1:${CONTROL_PORT}`)
})

// socket.io must accept gateway-forwarded connections → all interfaces.
const socketHttpServer = io.httpServer as import('http').Server
socketHttpServer.on('error', (err) => {
  console.error(`delivery-service: socket port ${PORT} bind failed:`, err)
  process.exit(1)
})
socketHttpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`delivery-service (socket.io) listening on *:${PORT}`)
})

process.on('SIGTERM', () => {
  controlServer.close()
  io.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  controlServer.close()
  io.close(() => process.exit(0))
})
