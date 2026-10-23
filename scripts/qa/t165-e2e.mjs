// Task 165 E2E — the seller "Go Live" console. Task 142 made the schedule
// (POST /api/live-shopping) and broadcast control (PATCH /api/live-shopping/[id])
// honest, but NO seller surface consumed them: creation was API-side only and
// no supplier-scoped read existed. This drills the new scoped rail
// GET /api/supplier/live-streams (own streams only, honest counters, real
// featured-product resolution) and the console control flow through it.
// Run on a FRESH wipe (node scripts/qa/wipe.mjs).
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T165 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't165-Qa-Str0ng1!'
const admin = makeSession(), host = makeSession(), other = makeSession(), buyer = makeSession()
ok(await reg(admin, 'admin', `t165-admin-${STAMP}@t165.test`, PW), 'admin registered')
ok(await reg(host, 'supplier', `t165-host-${STAMP}@t165.test`, PW, 'T165 Console Mill'), 'host (console owner) registered')
ok(await reg(other, 'supplier', `t165-other-${STAMP}@t165.test`, PW, 'T165 Rival Mill'), 'other store registered')
ok(await reg(buyer, 'buyer', `t165-buyer-${STAMP}@t165.test`, PW), 'buyer registered')

let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
ok(Boolean(categoryId), 'category ready')
const mkProd = async (sess, name) => {
  const r = await sess('POST', '/api/supplier/products', { name, description: 'drill', categoryId, unit: 'pcs', moq: 10, basePrice: 750, currency: 'BDT', stockQuantity: 300, priceTiers: [{ minQty: 10, pricePerUnit: 750 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
  const id = r.json?.data?.id ?? r.json?.id
  await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'T143' })
  return id
}
const ownProduct = await mkProd(host, 'T165 Console Knit')
const foreignProduct = await mkProd(other, 'T165 Rival Knit')
ok(Boolean(ownProduct) && Boolean(foreignProduct), 'both products created + approved')

// ── scoped rail gates ──
ok((await makeSession()('GET', '/api/supplier/live-streams')).status === 401, 'scoped rail: anon → 401')
ok((await buyer('GET', '/api/supplier/live-streams')).status === 401, 'scoped rail: buyer → 401 (401-first mandate)')

// ── honest zero before any broadcast ──
let r = await host('GET', '/api/supplier/live-streams')
ok(r.status === 200 && r.json?.success === true, 'host reads the console')
let cons = r.json?.data
ok(cons?.stats?.liveNow === 0 && cons?.stats?.scheduled === 0 && cons?.stats?.ended === 0, 'honest zero: no invented counters before the first broadcast')
ok(Array.isArray(cons?.streams) && cons.streams.length === 0, 'honest empty stream list')

// ── the console flow: schedule through the real POST ──
r = await host('POST', '/api/live-shopping', { title: 'T165 Factory Floor Walkthrough', description: 'Live knitting line, winter lots at console prices', featuredProductIds: [ownProduct], scheduledAt: new Date(Date.now() + 3600_000).toISOString() })
ok(r.status === 201, 'host schedules a broadcast (the console form posts here)', JSON.stringify(r.json)?.slice(0, 120))
const streamA = r.json?.data?.id
r = await host('POST', '/api/live-shopping', { title: 'T165 Second Session', description: 'Afternoon dye-house session' })
ok(r.status === 201, 'second broadcast scheduled (no featured products)')
const streamB = r.json?.data?.id

await sleep(300)
r = await host('GET', '/api/supplier/live-streams')
cons = r.json?.data
ok(cons?.stats?.scheduled === 2, 'stats count the two real schedules')
const rowA = (cons?.streams ?? []).find(s => s.id === streamA)
ok(Boolean(rowA) && rowA.isLive === false && rowA.viewerCount === 0, 'the schedule is honestly NOT live in the console')
ok(Array.isArray(rowA?.featuredProducts) && rowA.featuredProducts[0]?.id === ownProduct && rowA.featuredProducts[0]?.name === 'T165 Console Knit', 'featuredProducts resolve the host store REAL product (id, name, price)', JSON.stringify(rowA?.featuredProducts)?.slice(0, 150))
ok(rowA?.endedAt === null, 'a fresh schedule has no endedAt')

// ── isolation: the console is the OWN store only ──
r = await other('GET', '/api/supplier/live-streams')
cons = r.json?.data
ok(cons?.streams?.length === 0 && cons?.stats?.scheduled === 0, 'rival store sees ZERO of the host sessions (scoped rail, not the public list)')
r = await buyer('GET', '/api/live-shopping')
ok((r.json?.data ?? []).some(s => s.id === streamA), 'public list still carries the sessions for buyers')

// ── console control: start / end through the scoped state ──
ok((await buyer('PATCH', `/api/live-shopping/${streamA}`, { action: 'start' })).status === 401, 'control: buyer → 401')
ok((await other('PATCH', `/api/live-shopping/${streamA}`, { action: 'start' })).status === 403, 'control: non-host supplier → 403 (isolation on the control too)')
r = await host('PATCH', `/api/live-shopping/${streamA}`, { action: 'start' })
ok(r.status === 200 && r.json?.data?.isLive === true, 'host goes LIVE from the console')
ok((await host('PATCH', `/api/live-shopping/${streamA}`, { action: 'start' })).status === 409, 'double start → 409')
await sleep(300)
r = await host('GET', '/api/supplier/live-streams')
cons = r.json?.data
ok(cons?.stats?.liveNow === 1 && cons?.stats?.scheduled === 1, 'counters track the real state (1 live + 1 scheduled)')
const liveRow = (cons?.streams ?? []).find(s => s.id === streamA)
ok(liveRow?.isLive === true, 'the live session renders LIVE in the console')
r = await host('PATCH', `/api/live-shopping/${streamA}`, { action: 'end' })
ok(r.status === 200 && r.json?.data?.isLive === false && r.json?.data?.endedAt != null, 'host ends — endedAt stamped')
r = await host('PATCH', `/api/live-shopping/${streamA}`, { action: 'end' }).catch(e => ({ status: 0, json: null, err: String(e) }))
ok(r.status === 409, 'end while not live → 409')
await sleep(300)
r = await host('GET', '/api/supplier/live-streams')
cons = r.json?.data
ok(cons?.stats?.ended === 1 && cons?.stats?.liveNow === 0, 'counters land on ended (1 ended, 0 live)')
const endedRow = (cons?.streams ?? []).find(s => s.id === streamA)
ok(endedRow?.endedAt != null && endedRow?.isLive === false, 'the archived session carries its real end time')

// ── audit evidence through the console path ──
ok(await db.auditLogs.findFirst({ where: { action: 'live_stream_scheduled', entityId: streamA } }).then(Boolean), 'scheduling leaves a REAL audit row')
ok(await db.auditLogs.findFirst({ where: { action: 'live_stream_started', entityId: streamA } }).then(Boolean), 'go-live leaves a REAL audit row')
ok(await db.auditLogs.findFirst({ where: { action: 'live_stream_ended', entityId: streamA } }).then(Boolean), 'end leaves a REAL audit row')

// ── the second session still scheduled — public detail resolves host products ──
r = await buyer('GET', `/api/live-shopping/${streamB}`)
ok(r.status === 200 && r.json?.data?.isLive === false, 'second session stays honestly scheduled for buyers')
ok(r.json?.data?.supplierName === 'T165 Console Mill', 'public detail resolves the host store name')

console.log(`\nT165 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
