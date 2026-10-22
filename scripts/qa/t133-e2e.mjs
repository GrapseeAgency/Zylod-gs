// Task 133 E2E — the customer-queries circuit: list → detail (GET) → reply +
// status transitions (PATCH). The placeholder detail page (fake hardcoded
// bubble, dead input) is replaced by the real consumer. NOTE: the platform
// has NO writer for sellerCustomerQueries yet (documented) — the drill seeds
// the row via Prisma (fixture pattern) and exercises the REAL APIs.
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T133 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't133-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), buyer = makeSession(), outsider = makeSession()
ok(await reg(admin, 'admin', `t133-admin-${STAMP}@t133.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t133-seller-${STAMP}@t133.test`, PW, 'T133 Query Depot'), 'seller registered')
ok(await reg(buyer, 'buyer', `t133-buyer-${STAMP}@t133.test`, PW), 'buyer registered')
ok(await reg(outsider, 'supplier', `t133-outsider-${STAMP}@t133.test`, PW, 'T133 Other Co'), 'outsider seller registered')

let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
const p = await seller('POST', '/api/supplier/products', { name: 'T133 Workwear', description: 'drill', categoryId, unit: 'pcs', moq: 5, basePrice: 700, stockQuantity: 800, priceTiers: [{ minQty: 5, pricePerUnit: 700 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
const productId = p.json?.data?.id ?? p.json?.id
ok(Boolean(productId), 'product created')
await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T133' })

// The writer-less truth: seed the query via Prisma (documented in worklog).
const sellerUser = await db.users.findUnique({ where: { email: `t133-seller-${STAMP}@t133.test` } })
const buyerUser = await db.users.findUnique({ where: { email: `t133-buyer-${STAMP}@t133.test` } })
const profile = await db.supplierProfiles.findUnique({ where: { userId: sellerUser.id } })
const query = await db.sellerCustomerQueries.create({
  data: {
    supplierId: profile.id,
    buyerId: buyerUser.id,
    productId,
    queryType: 'pre_order',
    subject: 'Bulk pre-order for March',
    message: 'Can you produce 500 units in navy by the first week of March?',
    status: 'open',
  },
})
ok(Boolean(query.id), 'query row seeded (Prisma fixture — no platform writer yet)')

// ── LIST ──
ok((await makeSession()('GET', '/api/supplier/queries')).status === 401, 'list: anon → 401')
let r = await buyer('GET', '/api/supplier/queries')
ok(r.status === 401, 'list: buyer → 401 (seller surface)')
r = await seller('GET', '/api/supplier/queries')
ok(r.status === 200 && r.json?.data?.length === 1 && r.json?.data?.[0]?.subject === 'Bulk pre-order for March', 'list: owner seller sees the query')
r = await outsider('GET', '/api/supplier/queries')
ok(r.status === 200 && (r.json?.data?.length ?? 0) === 0, 'list: foreign seller sees zero (scoped)')

// ── DETAIL ──
ok((await makeSession()('GET', `/api/supplier/queries/${query.id}`)).status === 401, 'detail: anon → 401')
r = await seller('GET', `/api/supplier/queries/${query.id}`)
ok(r.status === 200 && r.json?.data?.buyerName?.includes('T133'), 'detail: owner 200 with resolved buyer name', JSON.stringify(r.json?.data?.buyerName))
ok(r.json?.data?.productName === 'T133 Workwear', 'detail: product name resolved')
r = await outsider('GET', `/api/supplier/queries/${query.id}`)
ok(r.status === 404, 'detail: foreign seller → 404 (no existence leak)')
r = await seller('GET', '/api/supplier/queries/nonexistent999')
ok(r.status === 404, 'detail: missing id → 404')
r = await admin('GET', `/api/supplier/queries/${query.id}`)
ok(r.status === 403, 'detail: admin without supplier profile → 403 (route design: seller-owned surface)', JSON.stringify(r.json))

// ── PATCH: reply ──
r = await seller('PATCH', `/api/supplier/queries/${query.id}`, {})
ok(r.status === 400 && /nothing to update/i.test(r.json?.error ?? ''), 'patch: empty payload → 400 (a no-op must not 200 + write a fake audit row)')
r = await seller('PATCH', `/api/supplier/queries/${query.id}`, { replyMessage: '   ' })
ok(r.status === 400 && /empty/i.test(r.json?.error ?? ''), 'patch: whitespace reply → 400 names it')
r = await seller('PATCH', `/api/supplier/queries/${query.id}`, { status: 'exploded' })
ok(r.status === 400, 'patch: invalid status → 400')
r = await outsider('PATCH', `/api/supplier/queries/${query.id}`, { replyMessage: 'mine now' })
ok(r.status === 404, 'patch: foreign seller → 404')

r = await seller('PATCH', `/api/supplier/queries/${query.id}`, { replyMessage: 'Yes — 500 navy units by March 7 is confirmed. Sample ships this week.' })
ok(r.status === 200 && r.json?.data?.status === 'replied', 'patch: reply flips status to replied', JSON.stringify({ s: r.json?.data?.status }))
ok(r.json?.data?.replyMessage?.includes('March 7') && r.json?.data?.repliedAt, 'patch: replyMessage + repliedAt stamped')
const audit = await db.auditLogs.findFirst({ where: { action: 'seller_query_updated', entityId: query.id } })
ok(Boolean(audit), 'patch: REAL auditLogs row written')
r = await seller('GET', `/api/supplier/queries/${query.id}`)
ok(r.json?.data?.status === 'replied', 'detail reflects the replied state')

// ── PATCH: explicit status transitions ──
r = await seller('PATCH', `/api/supplier/queries/${query.id}`, { status: 'resolved' })
ok(r.status === 200 && r.json?.data?.status === 'resolved', 'patch: mark resolved')
r = await seller('PATCH', `/api/supplier/queries/${query.id}`, { status: 'open' })
ok(r.status === 200 && r.json?.data?.status === 'open', 'patch: reopen')
r = await seller('PATCH', `/api/supplier/queries/${query.id}`, { status: 'closed' })
ok(r.status === 200 && r.json?.data?.status === 'closed', 'patch: close')

console.log(`\nT133 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
