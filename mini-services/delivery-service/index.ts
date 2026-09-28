/**
 * delivery-service — socket.io broadcaster for live delivery tracking.
 * Port 3005 for socket.io (path '/'), port 3006 for the internal control
 * HTTP surface (/broadcast + /health). They must be separate servers because
 * socket.io attached at path '/' intercepts every request on its own server.
 *
 * Flow:
 *   driver phone ──POST /api/delivery/suborders/[id]/location──▶ Next.js API
 *   Next.js API (persists ping via Prisma) ──POST :3006/broadcast──▶ this service
 *   this service ──io.to(room).emit('delivery:ping')──▶ customer's map
 *
 * Rooms are `order:<orderId>`; customers `subscribe` with an orderId after
 * authenticating against the REST API (this service holds no auth state and
 * exposes no data of its own — everything it emits was already permission-
 * checked by the Next.js API that forwarded it).
 *
 * In the sandbox the gateway forwards `/?XTransformPort=3005` here; on
 * Railway, expose this service on its own domain or mount it behind the
 * same reverse proxy (see MAPS.md → Production checklist).
 */
import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3005 // public socket.io (via gateway: /?XTransformPort=3005)
const CONTROL_PORT = 3006 // internal, Next.js API only

/* ── Internal control server: broadcast + health ─────────────────────── */
const controlServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    let sockets = 0
    io.sockets.sockets.forEach(() => sockets++)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'delivery-service', sockets }))
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
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60_000,
    pingInterval: 25_000,
  }
)

io.on('connection', (socket) => {
  const joinedRooms = new Set<string>()

  socket.on('subscribe', (data: { orderId?: string }) => {
    const orderId = typeof data?.orderId === 'string' ? data.orderId.trim() : ''
    if (!orderId) {
      socket.emit('delivery:error', { error: 'orderId is required to subscribe' })
      return
    }
    const room = `order:${orderId}`
    socket.join(room)
    joinedRooms.add(room)
    socket.emit('delivery:subscribed', { orderId, room })
  })

  socket.on('unsubscribe', (data: { orderId?: string }) => {
    const orderId = typeof data?.orderId === 'string' ? data.orderId.trim() : ''
    if (!orderId) return
    const room = `order:${orderId}`
    socket.leave(room)
    joinedRooms.delete(room)
  })

  socket.on('disconnect', () => {
    joinedRooms.clear()
  })

  socket.on('error', (err) => {
    console.error(`socket error (${socket.id}):`, err)
  })
})

// Control surface is internal-only; bind to loopback so nothing outside the
// host can reach /broadcast.
controlServer.listen(CONTROL_PORT, '127.0.0.1', () => {
  console.log(`delivery-service control API on 127.0.0.1:${CONTROL_PORT}`)
})

// socket.io must accept gateway-forwarded connections → all interfaces.
;(io.httpServer as import('http').Server).listen(PORT, '0.0.0.0', () => {
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
