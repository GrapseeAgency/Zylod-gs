// Task 139 E2E — the admin audit-trail reader: GET /api/admin/audit-logs.
// The platform has written REAL auditLogs rows on every audited write since
// the doctrine sweep; this route + console finally make them readable by the
// admin they were written for. Gates, filters, pagination, actor resolution,
// metadata evidence. Seed = REAL audited actions through the live APIs (no
// fabricated rows). Run on a FRESH wipe.
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T139 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't139-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), buyer = makeSession()
ok(await reg(admin, 'admin', `t139-admin-${STAMP}@t139.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t139-seller-${STAMP}@t139.test`, PW, 'T139 Audit Depot'), 'seller registered')
ok(await reg(buyer, 'buyer', `t139-buyer-${STAMP}@t139.test`, PW), 'buyer registered')

let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
ok(Boolean(categoryId), 'category ready (Prisma-authoritative)')

const fullPayload = (basePrice) => ({
  name: 'T139 Audit Jacket', description: 'drill product for the audit trail', categoryId,
  unit: 'pcs', moq: 10, basePrice, currency: 'BDT', stockQuantity: 500,
  priceTiers: [{ minQty: 10, pricePerUnit: basePrice }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
})

// ── REAL audited actions (the seed IS the platform's own writes) ──
const p = await seller('POST', '/api/supplier/products', fullPayload(2000))
const productId = p.json?.data?.id ?? p.json?.id
ok(Boolean(productId), 'product created (product_created audit row expected)')
const toggle = await seller('PATCH', `/api/supplier/products/${productId}`, { isActive: false })
ok(toggle.status === 200, 'visibility toggled (product_visibility_changed row expected)')
const edit = await seller('PATCH', `/api/supplier/products/${productId}`, fullPayload(1800))
ok(edit.status === 200, 'product edited ৳2,000→৳1,800 (product_updated row expected)')
await sleep(400)

const sellerUser = await db.users.findUnique({ where: { email: `t139-seller-${STAMP}@t139.test` }, select: { id: true } })
const sellerId = sellerUser.id
const dbCount = await db.auditLogs.count()
ok(dbCount >= 3, `auditLogs table holds the REAL rows (${dbCount} ≥ 3)`)

// ── gates ──
ok((await makeSession()('GET', '/api/admin/audit-logs')).status === 401, 'anon → 401')
ok((await buyer('GET', '/api/admin/audit-logs')).status === 401, 'buyer → 401')
ok((await seller('GET', '/api/admin/audit-logs')).status === 401, 'seller → 401')
let r = await admin('GET', '/api/admin/audit-logs')
ok(r.status === 200, 'admin → 200')
ok(r.json?.success === true && Array.isArray(r.json?.data), 'payload shape: success + data[]')
ok(r.json?.data?.length >= 3, `admin sees the seeded rows (${r.json?.data?.length})`)

// ── query validation ──
ok((await admin('GET', '/api/admin/audit-logs?page=0')).status === 400, 'page=0 → 400')
ok((await admin('GET', '/api/admin/audit-logs?limit=101')).status === 400, 'limit=101 → 400')

// ── filters ──
r = await admin('GET', '/api/admin/audit-logs?action=product_updated')
ok(r.status === 200 && r.json.data.every((x) => x.action.includes('product_updated')), 'action contains filter narrows to product_updated')
const upd = r.json.data[0]
ok(upd?.metadata != null && JSON.parse(upd.metadata).before?.basePrice === 2000 && JSON.parse(upd.metadata).after?.basePrice === 1800, 'product_updated evidence: before 2000 → after 1800 (REAL before/after)')

r = await admin('GET', '/api/admin/audit-logs?entityType=products')
ok(r.status === 200 && r.json.data.length > 0 && r.json.data.every((x) => x.entityType === 'products'), 'entityType filter returns only products rows')

r = await admin('GET', `/api/admin/audit-logs?entityId=${productId}`)
ok(r.status === 200 && r.json.data.length >= 3, `entityId filter returns the product's full history (${r.json.data.length} rows)`)
ok(r.json.data.every((x) => x.entityId === productId), 'entityId filter: every row is that product')
ok(r.json.data.some((x) => x.action === 'product_created') && r.json.data.some((x) => x.action === 'product_visibility_changed') && r.json.data.some((x) => x.action === 'product_updated'), 'history contains created + visibility + updated')

r = await admin('GET', `/api/admin/audit-logs?actorId=${sellerId}`)
ok(r.status === 200 && r.json.data.length > 0 && r.json.data.every((x) => x.actor?.id === sellerId), 'actorId filter returns only that actor rows')
ok(r.json.data.every((x) => x.actor?.name === 'T139 Audit Depot' && x.actor?.userType === 'supplier'), 'actor resolved to the REAL company name + supplier type')

// ── pagination ──
r = await admin('GET', '/api/admin/audit-logs?limit=1&page=1')
const pag = r.json?.pagination
ok(pag?.total >= 3 && pag?.totalPages >= 3, `pagination honest (total ${pag?.total}, pages ${pag?.totalPages})`)
const firstPageRow = r.json?.data?.[0]?.id
r = await admin('GET', '/api/admin/audit-logs?limit=1&page=2')
ok(r.json?.data?.[0]?.id !== firstPageRow, 'page 2 serves a different row (newest-first across pages)')
const times = (await admin('GET', '/api/admin/audit-logs?limit=30')).json.data.map((x) => x.createdAt)
ok(times.every((t, i) => i === 0 || times[i - 1] >= t), 'rows ordered newest-first')

// ── summary ──
r = await admin('GET', '/api/admin/audit-logs')
ok(Array.isArray(r.json?.summary?.byEntityType) && r.json.summary.byEntityType.some((t) => t.entityType === 'products'), 'byEntityType summary present')
ok(r.json.data.every((x) => x.actor === null || typeof x.actor.name === 'string'), 'every row carries a resolved actor or honest null')

console.log(`\nT139 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
