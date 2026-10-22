// Task 138 E2E — the event-driven price-drop rail: the price mirror of the
// back-in-stock family (Task 65). The WRITE rails (PDP price-alert create,
// alerts console) always existed; the ENGINE only ran from a buried manual
// full-sweep button. Now the ONLY real price-change writer (the supplier
// full-replace PATCH) evaluates the product's active watches AFTER its
// transaction commits. Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function makeSession() {
  let cookie = ''
  const ip = `10.131.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    for (let a = 0; a < 7; a++) {
      const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
      for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
      const json = await res.json().catch(() => null)
      if (res.status !== 429) return { status: res.status, json }
      await sleep(10_000 * (a + 1))
    }
    throw new Error('429 exhausted: ' + path)
  }
}
async function reg(session, userType, email, pw, company) {
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T138 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't138-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), buyer1 = makeSession(), buyer2 = makeSession()
ok(await reg(admin, 'admin', `t138-admin-${STAMP}@t138.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t138-seller-${STAMP}@t138.test`, PW, 'T138 Price Depot'), 'seller registered')
ok(await reg(buyer1, 'buyer', `t138-b1-${STAMP}@t138.test`, PW), 'buyer1 registered')
ok(await reg(buyer2, 'buyer', `t138-b2-${STAMP}@t138.test`, PW), 'buyer2 registered')

let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
ok(Boolean(categoryId), 'category ready (Prisma-authoritative)')

const fullPayload = (basePrice) => ({
  name: 'T138 Wholesale Jacket',
  description: 'drill product for the price-drop rail',
  categoryId,
  unit: 'pcs',
  moq: 10,
  basePrice,
  currency: 'BDT',
  stockQuantity: 600,
  priceTiers: [{ minQty: 10, pricePerUnit: basePrice }],
  images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }],
  videos: [],
})

const p = await seller('POST', '/api/supplier/products', fullPayload(2000))
const productId = p.json?.data?.id ?? p.json?.id
ok(Boolean(productId), 'product created at ৳2,000')
ok((await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T138' })).status < 500, 'product approved')
await sleep(500)

// Helper: count the buyer's REAL price-drop ALERT rows (the drop itself, not
// the "Price Watch Activated" confirmation which shares the type).
const dropCount = async (userId) => db.notifications.count({ where: { userId, title: { startsWith: 'Price Drop Alert' } } })
const patchPrice = async (price) => {
  const r = await seller('PATCH', `/api/supplier/products/${productId}`, fullPayload(price))
  ok(r.status === 200, `seller PATCH price → ৳${price.toLocaleString()}`, JSON.stringify(r.json)?.slice(0, 200))
  // fire-and-forget evaluator — give it a beat before asserting
  await sleep(700)
  return r
}

// ── write-rail gates (pre-existing surface, re-proven) ──
ok((await makeSession()('POST', '/api/price-alerts', { productId, targetPrice: 1500 })).status === 401, 'alert create: anon → 401')
ok((await buyer1('POST', '/api/price-alerts', { productId, targetPrice: 0 })).status === 400, 'alert create: targetPrice 0 → 400')
ok((await buyer1('POST', '/api/price-alerts', { productId: 'nonexistent999', targetPrice: 1500 })).status === 404, 'alert create: phantom product → 404')
let r = await buyer1('POST', '/api/price-alerts', { productId, targetPrice: 1500 })
ok(r.status === 201, 'buyer1 watches at target ৳1,500 (current ৳2,000)')
const alert1Id = r.json?.data?.id
ok((await buyer1('POST', '/api/price-alerts', { productId, targetPrice: 1600 })).status === 409, 'alert create: duplicate active → 409')
const confirm1 = await db.notifications.findFirst({ where: { userId: (await db.users.findUnique({ where: { email: `t138-b1-${STAMP}@t138.test` } })).id, title: { startsWith: 'Price Watch Activated' } } })
ok(Boolean(confirm1), 'watch confirmation notification persisted')

// ── increase: never notifies ──
const b1 = (await db.users.findUnique({ where: { email: `t138-b1-${STAMP}@t138.test` } })).id
const b2 = (await db.users.findUnique({ where: { email: `t138-b2-${STAMP}@t138.test` } })).id
await patchPrice(2500)
ok(await db.priceAlerts.findUnique({ where: { id: alert1Id } }).then((a) => a.status === 'active'), 'price UP: alert stays active')
ok((await dropCount(b1)) === 0, 'price UP: no drop notification')

// ── decrease but above target: never notifies ──
await patchPrice(1800)
ok(await db.priceAlerts.findUnique({ where: { id: alert1Id } }).then((a) => a.status === 'active'), 'decrease above target: alert stays active')
ok((await dropCount(b1)) === 0, 'decrease above target: no drop notification')

// ── THE GOLDEN PATH: genuine drop below target ──
await patchPrice(1400)
const a1 = await db.priceAlerts.findUnique({ where: { id: alert1Id } })
ok(a1?.status === 'triggered', 'DROP below target: alert flips to triggered', JSON.stringify(a1))
ok(a1?.lastNotifiedAt != null, 'triggered alert stamps lastNotifiedAt')
ok(a1?.currentPrice === 1400, 'triggered alert records the REAL current price')
ok((await dropCount(b1)) === 1, 'buyer1 has exactly one Price Drop Alert row')
const dropRow = await db.notifications.findFirst({ where: { userId: b1, title: { startsWith: 'Price Drop Alert' } } })
ok(dropRow?.relatedEntityId === productId, 'drop row deep-links to the product (relatedEntityId)')
ok((dropRow?.body ?? '').includes('1,400'), 'drop body names the real new price')
const list = await buyer1('GET', '/api/notifications?limit=50')
ok((list.json?.data?.notifications ?? list.json?.data ?? []).some((n) => (n.title || '').startsWith('Price Drop Alert')), 'drop row served by the live notifications list API')

// ── no-double: a second drop never re-notifies a triggered alert ──
r = await buyer2('POST', '/api/price-alerts', { productId, targetPrice: 1350 })
ok(r.status === 201, 'buyer2 watches at target ৳1,350 (current ৳1,400)')
await patchPrice(1300)
ok(await db.priceAlerts.findUnique({ where: { id: alert1Id } }).then((a) => a.status === 'triggered'), 'second drop: buyer1 alert stays triggered (no re-arm — alerts fire once)')
const a1b = await db.priceAlerts.findUnique({ where: { id: alert1Id } })
ok(a1b?.currentPrice === 1400, 'triggered row untouched by the second drop (flip scope = active only)')
ok((await dropCount(b1)) === 1, 'NO second drop notification for buyer1 (race guard)')
const a2 = await db.priceAlerts.findFirst({ where: { userId: b2 } })
ok(a2?.status === 'triggered', 'buyer2 alert fired on the same drop')
ok((await dropCount(b2)) === 1, 'buyer2 has exactly one drop row')

// ── full-sweep engine: dedupes against triggered rows ──
const beforeSweep1 = await dropCount(b1), beforeSweep2 = await dropCount(b2)
const sweep = await admin('POST', '/api/notifications/evaluate-alerts')
ok(sweep.status === 200, 'full-sweep evaluate-alerts runs (backstop path)')
await sleep(500)
ok((await dropCount(b1)) === beforeSweep1 && (await dropCount(b2)) === beforeSweep2, 'sweep sends ZERO duplicates for already-triggered alerts')

console.log(`\nT138 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
