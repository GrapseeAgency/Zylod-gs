/**
 * Task 62 E2E — LIVE NOTIFICATION RAIL + SELLER RESTOCK-DEMAND SIGNAL.
 *
 * Real sockets + real HTTP + real DB, on a wiped database:
 *   1. user:<id> rooms — own-id-only token minting (403 otherwise), and a
 *      REAL 'notification:new' push arriving on the buyer's private room the
 *      moment a notification is persisted (back-in-stock restock).
 *   2. seller stock-watches — honest demand queue: active watches per
 *      product, completed watches leave the queue, live 'stock:watch' tick
 *      on the seller room when a buyer subscribes.
 *
 * Run: bun scripts/qa/t62-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { io } from 'socket.io-client'

let PASS = 0, FAIL = 0
function ok(cond, label) {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; console.log(`  ❌ ${label}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.79.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        'X-Forwarded-For': ip,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const setCookie = res.headers.getSetCookie?.() ?? []
    for (const c of setCookie) {
      const pair = c.split(';')[0]
      if (pair) cookie = cookie ? `${cookie}; ${pair}` : pair
    }
    const json = await res.json().catch(() => null)
    return { status: res.status, json }
  }
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA62 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA62 Shop ${email.slice(5, 12)}` } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json)}`)
    await sleep(4000 * (attempt + 1))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} -> ${login.status}: ${JSON.stringify(login.json)}`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

function waitForEvent(socket, event, ms = 6000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { socket.off(event, h); resolve(null) }, ms)
    const h = (payload) => { clearTimeout(t); socket.off(event, h); resolve(payload) }
    socket.on(event, h)
  })
}

async function poll(fn, cond, label, timeoutMs = 6000, stepMs = 400) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await fn()
    if (cond(last)) return last
    await sleep(stepMs)
  }
  ok(false, `${label} (timed out; last=${JSON.stringify(last)?.slice(0, 200)})`)
  return last
}

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't62-E2e-Str0ng1!'
  const admin = makeSession(), sellerA = makeSession(), buyer1 = makeSession(), buyer2 = makeSession()
  await registerAndLogin(admin, 'admin', 'qa62-admin@qa.local', PASSWORD)
  await registerAndLogin(sellerA, 'supplier', 'qa62-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer1, 'buyer', 'qa62-buyer1@qa.local', PASSWORD)
  await registerAndLogin(buyer2, 'buyer', 'qa62-buyer2@qa.local', PASSWORD)
  console.log('  users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA62 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await sellerA('POST', '/api/supplier/products', {
    name: 'QA62 Cement 50kg', description: 'QA t62 demand-signal product', categoryId, unit: 'kg',
    moq: 1, basePrice: 60, stockQuantity: 50, stockAlertThreshold: 5,
    priceTiers: [{ minQty: 1, pricePerUnit: 60 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'product created (stock 50 kg)')
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA62' })

  const profile = await sellerA('GET', '/api/profile/me')
  const supplierProfileId = profile.json?.data?.supplierProfile?.id
  ok(Boolean(supplierProfileId), 'seller profile id resolved (for the seller room)')
  const sellerUserId = profile.json?.data?.id
  ok(Boolean(sellerUserId), 'seller user id resolved (for the 403 user-room check)')

  const addr = await buyer1('POST', '/api/addresses', {
    label: 'QA62 HQ', address_line1: '12 QA Street', city: 'Dhaka', district: 'Dhaka',
    postal_code: '1213', contact_phone: '01700000000',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id

  console.log('— A. guards —')
  const anon = makeSession()
  ok((await anon('GET', '/api/seller/stock-watches')).status === 401, 'stock-watches unauthenticated → 401')
  ok((await buyer1('GET', '/api/seller/stock-watches')).status === 403, 'stock-watches as buyer → 403 SUPPLIER_PROFILE_REQUIRED')
  const foreignRoom = await buyer1('GET', `/api/realtime/room-token?room=user:${sellerUserId}`)
  ok(foreignRoom.status === 403, `user-room token for ANOTHER user → 403 (got ${foreignRoom.status})`)

  const me1 = await buyer1('GET', '/api/profile/me')
  const buyer1UserId = me1.json?.data?.id
  ok(Boolean(buyer1UserId), 'buyer1 user id resolved')
  const ownTok = await buyer1('GET', `/api/realtime/room-token?room=user:${buyer1UserId}`)
  ok(ownTok.status === 200 && Boolean(ownTok.json?.token), 'own user-room token mints 200')

  console.log('— B. empty demand queue —')
  const empty = await sellerA('GET', '/api/seller/stock-watches')
  ok(empty.status === 200 && (empty.json?.data ?? []).length === 0 && empty.json?.totalWatchers === 0, 'no watchers yet → empty demand queue')

  console.log('— C. drain stock, buyers watch, seller demand ticks LIVE —')
  const ord = await buyer1('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId, quantity: 50 }],
  })
  ok(ord.status === 201, `order drains all 50 kg (${ord.status})`)

  // Seller room socket (token-gated) + buyer2 user room socket
  const tokA = await sellerA('GET', `/api/realtime/room-token?room=seller:${supplierProfileId}`)
  ok(tokA.status === 200 && Boolean(tokA.json?.token), 'seller room token mints 200')
  const sockSeller = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  const sockBuyer2 = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  sockSeller.emit('subscribe', { room: `seller:${supplierProfileId}`, token: tokA.json.token })
  ok(Boolean(await waitForEvent(sockSeller, 'subscribe:ok')), 'seller joined their private room')
  const me2 = await buyer2('GET', '/api/profile/me')
  const buyer2UserId = me2.json?.data?.id
  const tok2 = await buyer2('GET', `/api/realtime/room-token?room=user:${buyer2UserId}`)
  sockBuyer2.emit('subscribe', { room: `user:${buyer2UserId}`, token: tok2.json.token })
  ok(Boolean(await waitForEvent(sockBuyer2, 'subscribe:ok')), 'buyer2 joined their private user room')

  const sub1 = await buyer1('POST', '/api/stock-alerts', { productId })
  ok(sub1.status === 201, 'buyer1 watches the sold-out product')
  const tick1 = await waitForEvent(sockSeller, 'stock:watch')
  ok(Boolean(tick1) && tick1.productId === productId && tick1.watchers === 1, `LIVE seller tick: 1 watcher (got ${JSON.stringify(tick1)?.slice(0, 120)})`)

  const sub2 = await buyer2('POST', '/api/stock-alerts', { productId })
  ok(sub2.status === 201, 'buyer2 also watches')
  const tick2 = await waitForEvent(sockSeller, 'stock:watch')
  ok(Boolean(tick2) && tick2.watchers === 2, `LIVE seller tick: 2 watchers`)

  const demand = await sellerA('GET', '/api/seller/stock-watches')
  const row = (demand.json?.data ?? []).find((r) => r.productId === productId)
  ok(Boolean(row) && row.watchers === 2 && row.stockQuantity === 0, `demand queue: ${row?.watchers} watching, stock ${row?.stockQuantity}`)
  ok(demand.json?.totalWatchers === 2, 'totalWatchers = 2')

  console.log('— D. restock completes the watches; buyer user-room gets the LIVE notification —')
  const notifPromise = waitForEvent(sockBuyer2, 'notification:new')
  const inv = await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ productId, newQuantity: 30 }] })
  ok(inv.status === 200, `seller restocks 0 → 30 (${inv.status})`)
  const liveNotif = await notifPromise
  ok(
    Boolean(liveNotif) && /Restocked:/.test(liveNotif.title || '') && /30 units/.test(liveNotif.message || ''),
    `buyer2 user-room received LIVE 'notification:new': "${liveNotif?.title}" — ${(liveNotif?.message || '').slice(0, 60)}`
  )

  const demandAfter = await poll(
    () => sellerA('GET', '/api/seller/stock-watches'),
    (res) => (res.json?.data ?? []).length === 0 && res.json?.totalWatchers === 0,
    'demand queue drains after both watches completed (notified ≠ active)'
  )
  ok(Boolean(demandAfter))

  sockSeller.disconnect()
  sockBuyer2.disconnect()

  console.log(`\nRESULT: ${PASS} passed, ${FAIL} failed`)
  if (FAIL > 0) process.exit(1)
}

main().catch((e) => { console.error('E2E CRASH:', e); process.exit(1) })
