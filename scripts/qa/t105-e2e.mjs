/**
 * Task 105 E2E — THE SELLER-REVIEW CIRCUIT on the REAL supplierReviews
 * table. The table was read-without-writer: the storefront SERVED reviews
 * and labeled reviewers "Verified buyer" while nothing could create a row.
 * This drill proves the whole circuit:
 *   gates → eligibility (real-order-only, buyer-only) → validation →
 *   one-per-buyer 409 → aggregates recomputed from actual rows →
 *   storefront projection (newest-first, display names, mine-flag) →
 *   remove-own (aggregates fall back honestly) → live seller-room tap →
 *   audit counts.
 *
 * Run: node scripts/qa/wipe.mjs && bun scripts/qa/t105-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
import { io } from 'socket.io-client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
function ok(cond, label, extra = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.105.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    for (let attempt = 0; attempt < 7; attempt++) {
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
      if (res.status !== 429) return { status: res.status, json }
      await sleep(10_000 * (attempt + 1))
    }
    throw new Error('rate limited beyond back-off window: ' + path)
  }
}

async function registerAndLogin(session, userType, email, password, businessName) {
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA105 ${userType}`, ...(businessName ? { businessName } : {}) }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json).slice(0, 200)}`)
    await sleep(4000 * (attempt + 1))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await sleep(4000 * (attempt + 1))
  }
}

function waitForEvent(socket, event, ms = 8000, predicate = null) {
  return new Promise((resolve) => {
    const h = (payload) => {
      if (predicate && !predicate(payload)) return
      clearTimeout(t); socket.off(event, h); resolve(payload)
    }
    const t = setTimeout(() => { socket.off(event, h); resolve(null) }, ms)
    socket.on(event, h)
  })
}

console.log('── A. SETUP (accounts, product, REAL orders) ────────────')
const STAMP = Date.now()
const admin = makeSession()
const seller = makeSession()
const buyer = makeSession()
const buyer2 = makeSession() // never orders — the eligibility refusal
const buyer3 = makeSession() // second purchaser

const B1 = `qa105-buyer-${STAMP}@t105.test`
const B3 = `qa105-b3-${STAMP}@t105.test`

await registerAndLogin(admin, 'admin', `qa105-admin-${STAMP}@t105.test`, 'Passw0rd!105')
await registerAndLogin(seller, 'supplier', `qa105-seller-${STAMP}@t105.test`, 'Passw0rd!105', 'QA105 ReviewWorks')
await registerAndLogin(buyer, 'buyer', B1, 'Passw0rd!105')
await registerAndLogin(buyer2, 'buyer', `qa105-b2-${STAMP}@t105.test`, 'Passw0rd!105')
await registerAndLogin(buyer3, 'buyer', B3, 'Passw0rd!105')

const cat = await admin('POST', '/api/admin/categories', { name: 'QA105 Reviewed', isActive: true })
const categoryId = cat.json?.data?.id ?? cat.json?.id
const prod = await seller('POST', '/api/supplier/products', {
  name: 'QA105 Review Widget', description: 'the product the review rides on', categoryId,
  unit: 'pcs', bundleSize: null, moq: 1, basePrice: 500, stockQuantity: 100, weightKg: 1,
  priceTiers: [{ minQty: 1, pricePerUnit: 500 }],
  images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
})
const productId = prod.json?.data?.id ?? prod.json?.id
await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA105' })
ok(!!productId, 'approved product live')

async function makePurchaser(session, emailLocal) {
  const addr = await session('POST', '/api/addresses', {
    label: 'Home', address_line1: `House 10, Road ${emailLocal}`,
    city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000101', postal_code: '1200',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  const user = await db.users.findUnique({ where: { email: emailLocal } })
  await db.wallets.create({ data: { userId: user.id, balance: 999999 } })
  const ord = await session('POST', '/api/orders', {
    items: [{ productId, quantity: 1 }], shippingAddressId: addressId, payWithWallet: true,
  })
  if (ord.status !== 201) throw new Error(`order for ${emailLocal} -> ${ord.status}: ${JSON.stringify(ord.json).slice(0, 200)}`)
  return ord.json?.data?.orderId ?? ord.json?.id
}

const supplierProfile = await db.supplierProfiles.findFirst({ where: { companyName: 'QA105 ReviewWorks' } })
ok(!!supplierProfile, 'supplier profile resolved')
const SUP = supplierProfile.id

await makePurchaser(buyer, B1)
await makePurchaser(buyer3, B3)
ok(true, 'two purchasers with REAL wallet-paid orders')

console.log('── B. GATES ─────────────────────────────────────────────')
{
  const guest = makeSession()
  const g = await guest('POST', `/api/suppliers/${SUP}/reviews`, { rating: 5 })
  ok(g.status === 401, 'guest POST → 401', `got ${g.status}`)
  const s = await seller('POST', `/api/suppliers/${SUP}/reviews`, { rating: 5 })
  ok(s.status === 401, 'supplier-role POST → 401 (buyer-only rail)', `got ${s.status}`)
  const ph = await buyer('POST', '/api/suppliers/qa105-phantom/reviews', { rating: 5 })
  ok(ph.status === 404, 'phantom supplier → no-leak 404', `got ${ph.status}`)
  const dph = await buyer('DELETE', '/api/suppliers/qa105-phantom/reviews')
  ok(dph.status === 404, 'phantom supplier DELETE → 404', `got ${dph.status}`)
}

console.log('── C. ELIGIBILITY + VALIDATION ──────────────────────────')
{
  const r = await buyer2('POST', `/api/suppliers/${SUP}/reviews`, { rating: 5, comment: 'never bought' })
  ok(r.status === 403, 'buyer WITHOUT a real order → 403 (the "Verified buyer" label stays honest)', `got ${r.status}`)
  ok(typeof r.json?.error === 'string' && /real order/.test(r.json.error), 'refusal message says why')

  const v1 = await buyer('POST', `/api/suppliers/${SUP}/reviews`, { rating: 0 })
  ok(v1.status === 400, 'rating 0 → 400', `got ${v1.status}`)
  const v2 = await buyer('POST', `/api/suppliers/${SUP}/reviews`, { rating: 6 })
  ok(v2.status === 400, 'rating 6 → 400', `got ${v2.status}`)
  const v3 = await buyer('POST', `/api/suppliers/${SUP}/reviews`, { rating: 4.5 })
  ok(v3.status === 400, 'non-integer rating → 400', `got ${v3.status}`)
  const v4 = await buyer('POST', `/api/suppliers/${SUP}/reviews`, { rating: 5, comment: 'x'.repeat(1001) })
  ok(v4.status === 400, '1001-char comment → 400', `got ${v4.status}`)
  const v5 = await buyer('POST', `/api/suppliers/${SUP}/reviews`, { rating: 5, hackerKey: true })
  ok(v5.status === 400, 'strict keys (unknown key → 400)', `got ${v5.status}`)
}

console.log('── D. PUBLISH — aggregates from actual rows ─────────────')
{
  const r = await buyer('POST', `/api/suppliers/${SUP}/reviews`, { rating: 4, comment: 'Solid goods, honest timeline.' })
  ok(r.status === 201, 'verified-purchase review → 201', JSON.stringify(r.json))
  ok(r.json?.data?.id && typeof r.json?.data?.createdAt === 'string', 'row id + createdAt returned')

  const prof = await db.supplierProfiles.findUnique({ where: { id: SUP } })
  ok(prof.ratingCount === 1 && prof.ratingAvg === 4, 'aggregates recomputed: count 1, avg 4', JSON.stringify({ avg: prof.ratingAvg, count: prof.ratingCount }))

  const again = await buyer('POST', `/api/suppliers/${SUP}/reviews`, { rating: 2 })
  ok(again.status === 409, 'second review by same buyer → honest 409', `got ${again.status}`)
  const prof2 = await db.supplierProfiles.findUnique({ where: { id: SUP } })
  ok(prof2.ratingCount === 1 && prof2.ratingAvg === 4, 'the 409 did NOT touch the aggregates')
}

console.log('── E. SELLER ROOM TAP — live, token-gated ───────────────')
{
  const sellerSocket = io('http://127.0.0.1:3005', { transports: ['websocket'], autoConnect: false })
  try {
    sellerSocket.connect()
    // Deterministic connected-poll — the 'connect' event-wait raced the
    // engine handshake once; the state flag cannot lie.
    let joined = false
    for (let i = 0; i < 40 && !joined; i++) {
      joined = sellerSocket.connected
      if (!joined) await sleep(200)
    }
    ok(joined, 'socket connected')
    const tok = await seller('GET', `/api/realtime/room-token?room=seller:${SUP}`)
    ok(tok.status === 200 && !!tok.json?.token, 'seller room token minted via the gated rail', JSON.stringify(tok.json))
    sellerSocket.emit('subscribe', { room: `seller:${SUP}`, token: tok.json?.token ?? '' })
    const subOk = await waitForEvent(sellerSocket, 'subscribe:ok', 8000)
    ok(!!subOk, 'subscribed BEFORE the mutation (no subscribe → no tap)')

    const tapP = waitForEvent(sellerSocket, 'supplier:reviewed', 8000, (p) => p?.action === 'added')
    await sleep(300)
    const r = await buyer3('POST', `/api/suppliers/${SUP}/reviews`, { rating: 5, comment: 'Fast delivery, good packaging.' })
    ok(r.status === 201, 'second purchaser review → 201')
    const tap = await tapP
    ok(!!tap, 'LIVE seller-room tap received (supplier:reviewed / added)', JSON.stringify(tap))
    ok(tap?.rating === 5 && tap?.supplierId === SUP, 'tap carries the real rating + supplierId')

    const prof = await db.supplierProfiles.findUnique({ where: { id: SUP } })
    ok(prof.ratingCount === 2 && prof.ratingAvg === 4.5, 'aggregates recompute: count 2, avg 4.5', JSON.stringify({ avg: prof.ratingAvg, count: prof.ratingCount }))
  } finally {
    sellerSocket.close()
  }
}

console.log('── F. STOREFRONT PROJECTION — display names + mine flag ─')
{
  const guest = makeSession()
  const g = await guest('GET', `/api/supplier/storefront?supplierId=${SUP}`)
  ok(g.status === 200, 'guest storefront 200')
  const rows = g.json?.data?.reviews ?? []
  ok(rows.length === 2, 'both reviews embedded', `got ${rows.length}`)
  ok(rows[0]?.rating === 5, 'newest first (buyer3\'s 5★ on top)')
  ok(typeof rows[0]?.buyerName === 'string' && rows[0].buyerName.length > 0, 'buyerName display name present')
  const raw = JSON.stringify(rows)
  ok(!/@t105\.test/.test(raw), 'NO reviewer email/phone in the public payload')
  ok(rows.every((x) => x.mine === false), 'guest sees mine:false everywhere')
  ok(g.json?.data?.ratingCount === 2 && g.json?.data?.ratingAvg === 4.5, 'header aggregates served from the same truth')

  const b = await buyer('GET', `/api/supplier/storefront?supplierId=${SUP}`)
  const brows = b.json?.data?.reviews ?? []
  ok(brows.find((x) => x.rating === 4)?.mine === true, 'the signed-in buyer sees THEIR row flagged mine', JSON.stringify(brows.map((x) => ({ r: x.rating, m: x.mine }))))
  ok(brows.filter((x) => x.rating === 5).every((x) => x.mine === false), "the other buyer's rows stay mine:false")
}

console.log('── G. REMOVE — aggregates fall back honestly ────────────')
{
  const noRev = await buyer2('DELETE', `/api/suppliers/${SUP}/reviews`)
  ok(noRev.status === 404, 'buyer without a review → same 404 as phantom', `got ${noRev.status}`)

  const rm = await buyer('DELETE', `/api/suppliers/${SUP}/reviews`)
  ok(rm.status === 200, 'buyer removes their OWN review')
  const prof = await db.supplierProfiles.findUnique({ where: { id: SUP } })
  ok(prof.ratingCount === 1 && prof.ratingAvg === 5, 'aggregates recomputed DOWN: count 1, avg 5', JSON.stringify({ avg: prof.ratingAvg, count: prof.ratingCount }))

  const rm2 = await buyer('DELETE', `/api/suppliers/${SUP}/reviews`)
  ok(rm2.status === 404, 're-remove → honest 404', `got ${rm2.status}`)

  const again = await buyer('POST', `/api/suppliers/${SUP}/reviews`, { rating: 3 })
  ok(again.status === 201, 'after removal the buyer may review again (one-live-review rule)')
  const prof2 = await db.supplierProfiles.findUnique({ where: { id: SUP } })
  ok(prof2.ratingCount === 2 && prof2.ratingAvg === 4, 'aggregates: count 2, avg 4 (3★ + 5★)', JSON.stringify({ avg: prof2.ratingAvg, count: prof2.ratingCount }))
}

console.log('── H. AUDIT TRAIL ───────────────────────────────────────')
{
  const counts = await db.auditLogs.groupBy({
    by: ['action'],
    where: { action: { in: ['supplier_review_added', 'supplier_review_removed'] } },
    _count: { _all: true },
  })
  const added = counts.find((c) => c.action === 'supplier_review_added')?._count._all ?? 0
  const removed = counts.find((c) => c.action === 'supplier_review_removed')?._count._all ?? 0
  ok(added === 3, 'supplier_review_added audits exact (4★ + 5★ + re-3★ = 3)', `got ${added}`)
  ok(removed === 1, 'supplier_review_removed audits exact (1)', `got ${removed}`)
}

console.log('════════════════════════════════════════════════════════')
console.log(`PASS ${PASS}  FAIL ${FAIL}`)
process.exit(FAIL === 0 ? 0 : 1)
