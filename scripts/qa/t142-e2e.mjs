// Task 142 E2E — the live-shopping honesty pass. The old POST wrote a users
// id into a supplierProfiles column (every created stream rendered a null
// supplier — the id-space trap, fourth sighting), let ANY user broadcast as
// any store, and stamped scheduled sessions isLive:true with a fake viewer.
// Now: supplier-owned schedules, honest live state, owner-controlled start/
// end with audit evidence. Run on a FRESH wipe.
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T142 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't142-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), seller2 = makeSession(), buyer = makeSession()
ok(await reg(admin, 'admin', `t142-admin-${STAMP}@t142.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t142-seller-${STAMP}@t142.test`, PW, 'T142 Live Mill'), 'seller (host) registered')
ok(await reg(seller2, 'supplier', `t142-s2-${STAMP}@t142.test`, PW, 'T142 Other Mill'), 'seller2 registered')
ok(await reg(buyer, 'buyer', `t142-buyer-${STAMP}@t142.test`, PW), 'buyer registered')

let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
ok(Boolean(categoryId), 'category ready')
const mkProd = async (sess, name) => {
  const r = await sess('POST', '/api/supplier/products', { name, description: 'drill', categoryId, unit: 'pcs', moq: 10, basePrice: 600, currency: 'BDT', stockQuantity: 300, priceTiers: [{ minQty: 10, pricePerUnit: 600 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
  const id = r.json?.data?.id ?? r.json?.id
  await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'T142' })
  return id
}
const ownProductId = await mkProd(seller, 'T142 Feature Knit')
const foreignProductId = await mkProd(seller2, 'T142 Foreign Knit')
ok(Boolean(ownProductId) && Boolean(foreignProductId), 'both products created + approved')

// ── creation gates ──
ok((await makeSession()('POST', '/api/live-shopping', { title: 'Anon show', description: 'x' })).status === 401, 'create: anon → 401')
ok((await buyer('POST', '/api/live-shopping', { title: 'Buyer show', description: 'Buyer show description' })).status === 401, 'create: buyer → 401 (401-first mandate — only a store broadcasts)')
ok((await seller('POST', '/api/live-shopping', { title: 'x' })).status === 400, 'create: missing description → 400')
ok((await seller('POST', '/api/live-shopping', { title: 'T142 show', description: 'x', extraField: 1 })).status === 400, 'create: unknown field → 400 (strict)')
const foreignFeat = await seller('POST', '/api/live-shopping', { title: 'T142 show', description: 'Featuring goods that are not mine', featuredProductIds: [foreignProductId] })
ok(foreignFeat.status === 403, 'create: featuring ANOTHER store product → 403', JSON.stringify(foreignFeat.json)?.slice(0, 120))
let r = await seller('POST', '/api/live-shopping', { title: 'T142 Factory Floor Live', description: 'Knitting line walkthrough', featuredProductIds: [ownProductId] })
ok(r.status === 201, 'host schedules a real broadcast', JSON.stringify(r.json)?.slice(0, 150))
const streamId = r.json?.data?.id
ok(r.json?.data?.isLive === false && r.json?.data?.viewerCount === 0, 'a schedule is NOT live (isLive false, no fake viewers)')
const streamRow = await db.liveStreams.findUnique({ where: { id: streamId } })
const prof = await db.supplierProfiles.findUnique({ where: { userId: (await db.users.findUnique({ where: { email: `t142-seller-${STAMP}@t142.test` } })).id } })
ok(streamRow.supplierId === prof.id, 'supplierId stores the PROFILE id (the id-space trap is dead)')
await sleep(300)
r = await seller('GET', '/api/live-shopping')
const listed = (r.json?.data ?? []).find((s) => s.id === streamId)
ok(listed?.supplierName === 'T142 Live Mill', 'list resolves the REAL supplier name (was null forever before)')
ok(await db.auditLogs.findFirst({ where: { action: 'live_stream_scheduled', entityId: streamId } }).then(Boolean), 'scheduling leaves a REAL audit row')

// ── broadcast control: owner only, honest state machine ──
ok((await buyer('PATCH', `/api/live-shopping/${streamId}`, { action: 'start' })).status === 401, 'control: buyer → 401')
ok((await seller2('PATCH', `/api/live-shopping/${streamId}`, { action: 'start' })).status === 403, 'control: non-host supplier → 403')
ok((await seller('PATCH', `/api/live-shopping/${streamId}`, { action: 'end' })).status === 409, 'control: end while not live → 409')
r = await seller('PATCH', `/api/live-shopping/${streamId}`, { action: 'start' })
ok(r.status === 200 && r.json?.data?.isLive === true, 'host goes LIVE')
ok((await seller('PATCH', `/api/live-shopping/${streamId}`, { action: 'start' })).status === 409, 'double start → 409')
r = await seller('PATCH', `/api/live-shopping/${streamId}`, { action: 'end' })
ok(r.status === 200 && r.json?.data?.isLive === false && r.json?.data?.endedAt != null, 'host ends — endedAt stamped')
await sleep(300)
ok(await db.auditLogs.findFirst({ where: { action: 'live_stream_started', entityId: streamId } }).then(Boolean), 'go-live leaves a REAL audit row')
ok(await db.auditLogs.findFirst({ where: { action: 'live_stream_ended', entityId: streamId } }).then(Boolean), 'end leaves a REAL audit row')
ok((await admin('PATCH', `/api/live-shopping/${streamId}`, { action: 'start' })).status === 200, 'admin may control broadcasts (platform oversight)')

// ── detail resolves featured products of the OWN store ──
r = await buyer('GET', `/api/live-shopping/${streamId}`)
ok(r.status === 200, 'detail: public read works')
const detail = r.json?.data
ok(Array.isArray(detail?.featuredProducts) && detail.featuredProducts[0]?.id === ownProductId, 'featuredProducts resolve the host store real product', JSON.stringify(detail?.featuredProducts)?.slice(0, 150))
ok(detail?.supplierName === 'T142 Live Mill', 'detail resolves the real supplier')

console.log(`\nT142 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
