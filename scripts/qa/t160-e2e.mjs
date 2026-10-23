// Task 160 E2E — the four one-sided realtime circuits closed. Audit unit 18
// found four events PRODUCED with ZERO client consumers (the exact class the
// cohesion mandate targets). This drill proves, over a REAL socket.io
// connection with REAL token-gated room joins:
//   1. moderation:decision — admin approves a product → the seller's joined
//      seller:<profileId> room receives it (listings manager now listens).
//   2. qa:new — buyer asks a product question → seller room receives it.
//   3. supplier:reviewed — buyer reviews the store → seller room receives it.
//   4. rfq:status — admin closes an RFQ → the buyer-owner's joined rfq:<id>
//      room receives it (rfq-list-page now listens).
// Plus the room-gate negatives (no token / foreign room) and the two API
// surface fields the new consumers derive their rooms from
// (GET /api/supplier/products items[].supplierId, GET /api/supplier/reviews
// rows[].supplierId). Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const { io } = await import('socket.io-client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't160-Qa-Str0ng1!'

function makeSession() {
  let cookie = ''
  const ip = `10.160.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

async function reg(session, userType, local, company) {
  const payload = { userType, authProvider: 'email', email: `${local}-${STAMP}@t160.test`, password: PW, fullName: 'T160 ' + userType, ...(company ? { businessName: company, businessType: 'manufacturer' } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email: payload.email, password: PW }); return l.status === 200 || l.status === 201 }
    await sleep(3000)
  }
  return false
}

/** Wait for one matching event on a connected socket; resolve null on timeout. */
function waitForEvent(socket, eventName, timeoutMs, match = () => true) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { socket.offAny(onAny); resolve(null) }, timeoutMs)
    const onAny = (ev, ...args) => {
      if (ev !== eventName) return
      if (!match(args[0])) return
      clearTimeout(t)
      socket.offAny(onAny)
      resolve(args[0])
    }
    socket.onAny(onAny)
  })
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const s = io('http://127.0.0.1:3005', { path: '/', transports: ['websocket', 'polling'], reconnection: false, timeout: 8000 })
    s.on('connect', () => resolve(s))
    s.on('connect_error', (e) => reject(e))
    setTimeout(() => reject(new Error('socket connect timeout')), 9000)
  })
}

async function main() {
  const admin = makeSession(), seller = makeSession(), buyer = makeSession(), other = makeSession()
  ok(await reg(admin, 'admin', 't160-adm'), 'admin registered')
  ok(await reg(seller, 'supplier', 't160-sel', 'T160 Depot'), 'seller registered')
  ok(await reg(buyer, 'buyer', 't160-buy'), 'buyer registered')
  ok(await reg(other, 'supplier', 't160-oth', 'T160 Rival'), 'foreign seller registered')

  const cat = await admin('POST', '/api/admin/categories', { name: 'T160Cat', isActive: true })
  let categoryId = cat.json?.data?.id ?? cat.json?.id
  if (!categoryId) categoryId = (await db.categories.findFirst({ where: { name: 'T160Cat' } }))?.id

  // product 1: created + approved (a published listing the buyer can interact with)
  const p1 = await seller('POST', '/api/supplier/products', { name: 'T160 Circuit Widget', description: 'drill', categoryId, unit: 'pcs', moq: 1, basePrice: 40, currency: 'BDT', stockQuantity: 50, priceTiers: [{ minQty: 1, pricePerUnit: 40 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
  const productId = p1.json?.data?.id ?? p1.json?.id
  ok(Boolean(productId), 'product created (real API)')
  // product 2: left PENDING — its approval is the live moderation:decision payload
  const p2 = await seller('POST', '/api/supplier/products', { name: 'T160 Pending Widget', description: 'drill', categoryId, unit: 'pcs', moq: 1, basePrice: 55, currency: 'BDT', stockQuantity: 30, priceTiers: [{ minQty: 1, pricePerUnit: 55 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
  const pendingId = p2.json?.data?.id ?? p2.json?.id
  ok(Boolean(pendingId), 'pending product created')
  const appr = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T160' })
  ok(appr.status === 200, 'product 1 approved (baseline)')

  const sellerUser = await db.users.findFirst({ where: { email: { contains: 't160-sel-' } } })
  const sellerProfile = await db.supplierProfiles.findFirst({ where: { userId: sellerUser.id } })
  ok(Boolean(sellerProfile), 'seller profile resolved from DB')

  // ── API surface fields the new consumers derive their rooms from ──
  const listings = await seller('GET', '/api/supplier/products?limit=100')
  const items = listings.json?.data?.items ?? []
  ok(items.length === 2 && items.every((i) => typeof i.supplierId === 'string' && i.supplierId === sellerProfile.id), 'GET /api/supplier/products items carry the real supplierId (listings room source)', JSON.stringify(items.map((i) => i.supplierId)))

  // ── Room-gate negatives (the circuit stays gated) ──
  const buyerMint = await buyer('GET', `/api/realtime/room-token?room=seller:${sellerProfile.id}`)
  ok(buyerMint.status === 401 || buyerMint.status === 403, `buyer CANNOT mint a seller-room token (${buyerMint.status})`)
  const foreignMint = await other('GET', `/api/realtime/room-token?room=seller:${sellerProfile.id}`)
  ok(foreignMint.status === 403, `a DIFFERENT supplier CANNOT mint for the seller's room (${foreignMint.status})`)

  // ── Seller joins their own room with a real minted token ──
  const mint = await seller('GET', `/api/realtime/room-token?room=seller:${sellerProfile.id}`)
  ok(mint.status === 200 && typeof mint.json?.token === 'string', 'seller minted a room token for their own room')
  const sellerSock = await connectSocket()
  const subResult = await new Promise((resolve) => {
    sellerSock.once('subscribe:ok', (d) => resolve(d))
    sellerSock.once('subscribe:denied', (d) => resolve({ denied: d }))
    sellerSock.emit('subscribe', { room: `seller:${sellerProfile.id}`, token: mint.json.token })
    setTimeout(() => resolve(null), 6000)
  })
  ok(subResult && !subResult.denied && subResult.roomId === `seller:${sellerProfile.id}`, 'seller socket joined the token-gated seller room', JSON.stringify(subResult))

  // ── CIRCUIT 1: moderation:decision reaches the joined seller room ──
  const decisionP = waitForEvent(sellerSock, 'moderation:decision', 10000, (d) => d?.entityType === 'product' && d?.entityId === pendingId)
  const appr2 = await admin('PATCH', '/api/admin/products', { productId: pendingId, action: 'approve', reason: 'T160 live' })
  ok(appr2.status === 200, 'admin approved the pending product (real moderation)')
  const decision = await decisionP
  ok(!!decision && decision.decision === 'approved' && decision.entityType === 'product', 'LIVE: moderation:decision landed on the seller room (approved)', JSON.stringify(decision))

  // ── CIRCUIT 2: qa:new reaches the seller room when the buyer asks ──
  const qaP = waitForEvent(sellerSock, 'qa:new', 10000, (d) => d?.productId === productId)
  const qa = await buyer('POST', `/api/products/${productId}/qa`, { question: 'T160 — is this available in bulk cartons?' })
  ok(qa.status === 201, 'buyer asked a product question (real QA row)')
  const qaEv = await qaP
  ok(!!qaEv && typeof qaEv.question === 'string' && qaEv.question.includes('bulk cartons'), 'LIVE: qa:new landed on the seller room with the question', JSON.stringify(qaEv))

  // ── CIRCUIT 3: supplier:reviewed reaches the seller room on a real review ──
  // The review gate is verified-purchase doctrine: the buyer needs a REAL
  // order from this supplier first (that gate is itself a real pin).
  const gate = await buyer('POST', `/api/suppliers/${sellerProfile.id}/reviews`, { rating: 5, comment: 'T160 gate probe' })
  ok(gate.status === 403, 'review gate holds without a real order (verified-purchase doctrine)', JSON.stringify(gate.json)?.slice(0, 100))
  const ord = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }] })
  ok(ord.status === 201, `buyer placed a real order (${ord.status})`, JSON.stringify(ord.json)?.slice(0, 120))
  const revP = waitForEvent(sellerSock, 'supplier:reviewed', 10000, (d) => d?.supplierId === sellerProfile.id)
  const rev = await buyer('POST', `/api/suppliers/${sellerProfile.id}/reviews`, { rating: 5, comment: 'T160 — great wholesale prices and fast replies.' })
  ok(rev.status === 201 || rev.status === 200, `buyer reviewed the store (${rev.status})`, JSON.stringify(rev.json)?.slice(0, 140))
  const revEv = await revP
  ok(!!revEv && revEv.rating === 5 && revEv.action === 'added', 'LIVE: supplier:reviewed landed on the seller room with the rating', JSON.stringify(revEv))

  // the reviews list the new consumer page reads now carries supplierId per row
  const revList = await seller('GET', '/api/supplier/reviews')
  const revRows = revList.json?.data?.reviews ?? []
  ok(revRows.length >= 1 && revRows.every((r) => r.supplierId === sellerProfile.id), 'GET /api/supplier/reviews rows carry supplierId (reviews page room source)', JSON.stringify(revRows.map((r) => r.supplierId)))

  // ── CIRCUIT 4: rfq:status reaches the buyer-owner's rfq room on admin close ──
  const rfq = await buyer('POST', '/api/rfq', { title: 'T160 bulk order', description: 'Need 500 units of the circuit widget.', quantity: 500, unit: 'pcs' })
  const rfqId = rfq.json?.data?.id ?? rfq.json?.id ?? rfq.json?.data?.rfq?.id
  ok(rfq.status === 201 && Boolean(rfqId), `RFQ created (${rfq.status}) → ${rfqId}`, JSON.stringify(rfq.json)?.slice(0, 140))
  const rfqMint = await buyer('GET', `/api/realtime/room-token?room=rfq:${rfqId}`)
  ok(rfqMint.status === 200 && typeof rfqMint.json?.token === 'string', 'buyer-owner minted the rfq room token')
  const buyerSock = await connectSocket()
  const rfqSub = await new Promise((resolve) => {
    buyerSock.once('subscribe:ok', (d) => resolve(d))
    buyerSock.once('subscribe:denied', (d) => resolve({ denied: d }))
    buyerSock.emit('subscribe', { room: `rfq:${rfqId}`, token: rfqMint.json.token })
    setTimeout(() => resolve(null), 6000)
  })
  ok(rfqSub && !rfqSub.denied, 'buyer socket joined the token-gated rfq room', JSON.stringify(rfqSub))
  const rfqP = waitForEvent(buyerSock, 'rfq:status', 10000, (d) => d?.rfqId === rfqId)
  const close = await admin('PATCH', `/api/admin/rfqs/${rfqId}`, { status: 'closed' })
  ok(close.status === 200, 'admin closed the RFQ ({status:closed} strict body)', JSON.stringify(close.json)?.slice(0, 120))
  const rfqEv = await rfqP
  ok(!!rfqEv && rfqEv.status === 'closed', 'LIVE: rfq:status landed on the buyer room (closed)', JSON.stringify(rfqEv))

  sellerSock.disconnect()
  buyerSock.disconnect()
  console.log(`\nT160 RESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('DRILL CRASH:', e); await db.$disconnect().catch(() => null); process.exit(1) })
