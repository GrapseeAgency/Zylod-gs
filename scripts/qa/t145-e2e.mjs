// Task 145 E2E — the seller Live Studio: the console that finally consumes
// the broadcast-control API. GET /api/supplier/live-shopping scopes the
// seller's OWN streams (profile-id keyed, Task 142 id-space rule), resolves
// featured products to real rows, and the PATCH control matrix is re-proven
// THROUGH the new list (start → isLive true in MY list, end → endedAt).
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function makeSession() {
  let cookie = ''
  const ip = `10.145.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T145 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't145-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), seller2 = makeSession(), buyer = makeSession()
ok(await reg(admin, 'admin', `t145-admin-${STAMP}@t145.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t145-seller-${STAMP}@t145.test`, PW, 'T145 Live Mill'), 'seller (host) registered')
ok(await reg(seller2, 'supplier', `t145-s2-${STAMP}@t145.test`, PW, 'T145 Other Mill'), 'seller2 registered')
ok(await reg(buyer, 'buyer', `t145-buyer-${STAMP}@t145.test`, PW), 'buyer registered')

// ── the list gates ──
let r2 = null
ok((await makeSession()('GET', '/api/supplier/live-shopping')).status === 401, 'list: anon → 401')
ok((await buyer('GET', '/api/supplier/live-shopping')).status === 401, 'list: buyer → 401 (401-first mandate)')
ok((await seller('GET', '/api/supplier/live-shopping')).status === 200, 'list: seller → 200')
r2 = await seller2('GET', '/api/supplier/live-shopping')
ok(r2.status === 200 && (r2.json?.data?.streams ?? []).length === 0, 'seller2 (no profile-scoped streams) sees an honest empty list')

// catalog: the host's product + a foreign product
let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
const prodPayload = (name) => ({ name, description: 'drill', categoryId, unit: 'pcs', moq: 5, basePrice: 800, stockQuantity: 500, priceTiers: [{ minQty: 5, pricePerUnit: 800 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
const p1 = await seller('POST', '/api/supplier/products', prodPayload('T145 Live Loom Shawl'))
const productId = p1.json?.data?.id ?? p1.json?.id
ok(Boolean(productId), 'host product created')
await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T145' })
const p2 = await seller2('POST', '/api/supplier/products', prodPayload('T145 Foreign Goods'))
const foreignId = p2.json?.data?.id ?? p2.json?.id
ok(Boolean(foreignId), 'seller2 product created')

// ── schedule through the SAME POST the console dialog uses ──
r2 = await seller('POST', '/api/live-shopping', { title: 'T145 Loom Floor Tour', description: 'Watch the shawls come off the loom', scheduledAt: new Date(Date.now() + 3600_000).toISOString(), featuredProductIds: [productId] })
ok(r2.status === 201, 'schedule via the console contract → 201', JSON.stringify(r2.json)?.slice(0, 150))
const streamId = r2.json?.data?.id ?? r2.json?.id
ok(Boolean(streamId), 'stream id returned')
r2 = await seller('POST', '/api/live-shopping', { title: 'T145 Foreign Feature', description: 'should fail', featuredProductIds: [foreignId] })
ok(r2.status === 403, 'foreign featured product → 403 (ownership enforced)', JSON.stringify(r2.json)?.slice(0, 120))
r2 = await buyer('POST', '/api/live-shopping', { title: 'T145 Buyer Show', description: 'buyers cannot broadcast' })
ok(r2.status === 401 || r2.status === 403, 'buyer schedule → refused', JSON.stringify(r2.json)?.slice(0, 120))

// ── the list reflects MY truth only ──
r2 = await seller('GET', '/api/supplier/live-shopping')
const mine = (r2.json?.data?.streams ?? [])
ok(mine.length === 1 && mine[0].id === streamId, 'list: exactly MY stream (no cross-store leakage)')
ok(mine[0].isLive === false && mine[0].viewerCount === 0 && !mine[0].endedAt, 'honest schedule state: not live, zero viewers, no end')
ok(mine[0].featuredProducts?.length === 1 && mine[0].featuredProducts[0].name === 'T145 Live Loom Shawl' && mine[0].featuredProducts[0].isApproved === true, 'featured products resolved to REAL rows with approval state')
r2 = await seller2('GET', '/api/supplier/live-shopping')
ok((r2.json?.data?.streams ?? []).length === 0, 'seller2 still sees none of it')

// ── the control matrix THROUGH the console's own PATCH consumer ──
r2 = await buyer('PATCH', `/api/live-shopping/${streamId}`, { action: 'start' })
ok(r2.status === 401, 'control: buyer → 401')
r2 = await seller2('PATCH', `/api/live-shopping/${streamId}`, { action: 'start' })
ok(r2.status === 403, 'control: non-host supplier → 403')
r2 = await seller('PATCH', `/api/live-shopping/${streamId}`, { action: 'end' })
ok(r2.status === 409, 'control: end-while-not-live → 409')
r2 = await seller('PATCH', `/api/live-shopping/${streamId}`, { action: 'start' })
ok(r2.status === 200 && r2.json?.data?.isLive === true, 'GO LIVE: start → isLive true')
const auditStart = await db.auditLogs.findFirst({ where: { action: 'live_stream_started', entityId: streamId } })
ok(!!auditStart, 'audit: live_stream_started row')
r2 = await seller('PATCH', `/api/live-shopping/${streamId}`, { action: 'start' })
ok(r2.status === 409, 'control: double-start → 409')
r2 = await seller('GET', '/api/supplier/live-shopping')
const liveRow = (r2.json?.data?.streams ?? []).find((s) => s.id === streamId)
ok(liveRow && liveRow.isLive === true, 'the console list NOW shows the live state (the UI truth buyers see)')
r2 = await seller('PATCH', `/api/live-shopping/${streamId}`, { action: 'end' })
ok(r2.status === 200 && r2.json?.data?.isLive === false && !!r2.json?.data?.endedAt, 'END: isLive false + endedAt stamped')
const auditEnd = await db.auditLogs.findFirst({ where: { action: 'live_stream_ended', entityId: streamId } })
ok(!!auditEnd, 'audit: live_stream_ended row')
r2 = await seller('GET', '/api/supplier/live-shopping')
const endRow = (r2.json?.data?.streams ?? []).find((s) => s.id === streamId)
ok(endRow && endRow.isLive === false && !!endRow.endedAt, 'the console list reflects the ended state')

console.log(`\nT145 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
