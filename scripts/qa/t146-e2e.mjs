// Task 146 E2E — the buyer→seller query circuit: the writer half the
// queries inbox always lacked. Buyers file pre_order / custom_request /
// complaint questions to a real store (resolved SERVER-SIDE — by product
// ownership or by supplierId; mismatches refused; product_question is
// honestly routed to the PDP Q&A), the supplier is notified, the buyer can
// read the reply, and the seller's reply TELLS the buyer. Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function makeSession() {
  let cookie = ''
  const ip = `10.146.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T146 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't146-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), seller2 = makeSession(), buyer1 = makeSession(), buyer2 = makeSession()
ok(await reg(admin, 'admin', `t146-admin-${STAMP}@t146.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t146-seller-${STAMP}@t146.test`, PW, 'T146 Query Mill'), 'seller (target store) registered')
ok(await reg(seller2, 'supplier', `t146-s2-${STAMP}@t146.test`, PW, 'T146 Other Mill'), 'seller2 registered')
ok(await reg(buyer1, 'buyer', `t146-b1-${STAMP}@t146.test`, PW), 'buyer1 registered')
ok(await reg(buyer2, 'buyer', `t146-b2-${STAMP}@t146.test`, PW), 'buyer2 registered')

let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
const prodPayload = (name) => ({ name, description: 'drill', categoryId, unit: 'pcs', moq: 5, basePrice: 800, stockQuantity: 500, priceTiers: [{ minQty: 5, pricePerUnit: 800 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
const p1 = await seller('POST', '/api/supplier/products', prodPayload('T146 Query Shawl'))
const productId = p1.json?.data?.id ?? p1.json?.id
await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T146' })
const p2 = await seller2('POST', '/api/supplier/products', prodPayload('T146 Foreign Goods'))
const foreignProductId = p2.json?.data?.id ?? p2.json?.id
await admin('PATCH', '/api/admin/products', { foreignProductId, action: 'approve', reason: 'T146' })
const foreignSupplierId = (await db.products.findUnique({ where: { id: foreignProductId }, select: { supplierId: true } })).supplierId
ok(Boolean(productId && foreignProductId && foreignSupplierId), 'catalog ready (two stores, two approved products)')

// ── the writer gates (buyer2 spends the gate budget; buyer1 stays clean) ──
ok((await makeSession()('POST', '/api/queries', { supplierId: foreignSupplierId, queryType: 'pre_order', subject: 'anon q', message: 'hello there' })).status === 401, 'query: anon → 401')
const gate = (body) => buyer2('POST', '/api/queries', body)
let r2 = await seller('POST', '/api/queries', { supplierId: foreignSupplierId, queryType: 'pre_order', subject: 's', message: 'hello there' })
ok(r2.status === 401 || r2.status === 403, 'query: a SELLER cannot file buyer queries', JSON.stringify(r2.json)?.slice(0, 120))
r2 = await gate({ supplierId: foreignSupplierId, queryType: 'pre_order', subject: 'x', message: 'hello there' })
ok(r2.status === 400, 'gate sanity: a real buyer with a 1-char subject → 400 (validation, not auth)', JSON.stringify(r2.json)?.slice(0, 120))
r2 = await gate({ supplierId: foreignSupplierId, queryType: 'product_question', subject: 'which loom?', message: 'what is the thread count here' })
ok(r2.status === 400, "query: 'product_question' refused — the PDP Q&A rail is its home", JSON.stringify(r2.json)?.slice(0, 140))
r2 = await gate({ queryType: 'pre_order', subject: 'no target', message: 'hello there' })
ok(r2.status === 400, 'query: no store and no product → 400')
r2 = await gate({ productId: 'phantom000000000000000000', queryType: 'pre_order', subject: 'ghost', message: 'hello there' })
ok(r2.status === 404, 'query: phantom product → 404')
r2 = await gate({ productId, supplierId: foreignSupplierId, queryType: 'pre_order', subject: 'steered', message: 'hello there' })
ok(r2.status === 400, 'query: steering a product question to ANOTHER store → 400', JSON.stringify(r2.json)?.slice(0, 140))
r2 = await gate({ supplierId: 'phantom000000000000000000', queryType: 'complaint', subject: 'ghost store', message: 'hello there' })
ok(r2.status === 404, 'query: phantom supplier → 404')

// ── the writer circuit: buyer1 files against the product's OWN store ──
r2 = await buyer1('POST', '/api/queries', { productId, queryType: 'pre_order', subject: 'Pre-order 500 units for Eid', message: 'Can you hold production capacity for a 500-unit pre-order with custom woven labels?' })
ok(r2.status === 201, 'buyer1 files a pre-order query → 201', JSON.stringify(r2.json)?.slice(0, 140))
const queryId = r2.json?.data?.id
ok(Boolean(queryId), 'query id returned')
const sellerProfileId = (await db.products.findUnique({ where: { id: productId }, select: { supplierId: true } })).supplierId
const row = await db.sellerCustomerQueries.findUnique({ where: { id: queryId } })
ok(row && row.supplierId === sellerProfileId && row.buyerId === (await db.users.findFirst({ where: { email: `t146-b1-${STAMP}@t146.test` } })).id && row.status === 'open' && row.productId === productId, 'DB: row addressed to the product\'s OWN store, open, product linked')
const audit1 = await db.auditLogs.findFirst({ where: { action: 'buyer_query_created', entityId: queryId } })
ok(!!audit1, 'audit: buyer_query_created row')
const sellerUserId = (await db.supplierProfiles.findUnique({ where: { id: sellerProfileId }, select: { userId: true } })).userId
const notif = await db.notifications.findFirst({ where: { userId: sellerUserId, title: { contains: 'pre order' } }, orderBy: { createdAt: 'desc' } })
ok(!!notif, 'the seller is TOLD (durable notification)')

// ── the reader sides ──
r2 = await buyer1('GET', '/api/queries')
const mine = (r2.json?.data?.queries ?? [])
ok(r2.status === 200 && mine.some((q) => q.id === queryId && q.supplierName === 'T146 Query Mill'), 'buyer1 list: the query with the REAL store name')
r2 = await buyer2('GET', '/api/queries')
ok((r2.json?.data?.queries ?? []).length === 0, 'buyer2 sees none of it (isolation)')
r2 = await seller('GET', '/api/supplier/queries')
ok((r2.json?.data ?? []).some((q) => q.id === queryId && q.buyerName), 'THE SELLER INBOX FINALLY HAS A ROW (the Task 121 reader serves it)')

// ── the reply circuit: the seller replies, the buyer is TOLD ──
r2 = await seller('PATCH', `/api/supplier/queries/${queryId}`, { replyMessage: 'Yes — capacity held. Woven labels add ৳3/unit and 5 days.' })
ok(r2.status === 200, 'seller replies → 200', JSON.stringify(r2.json)?.slice(0, 120))
const notif2 = await db.notifications.findFirst({ where: { userId: (await db.users.findFirst({ where: { email: `t146-b1-${STAMP}@t146.test` } })).id, title: { contains: 'replied' } }, orderBy: { createdAt: 'desc' } })
ok(!!notif2 && notif2.body.includes('capacity held'), 'the buyer is TOLD about the reply (durable, carries the text)')
r2 = await buyer1('GET', '/api/queries')
const replied = (r2.json?.data?.queries ?? []).find((q) => q.id === queryId)
ok(replied && replied.status === 'replied' && replied.replyMessage?.includes('capacity held'), 'buyer list shows the reply + status replied')

// ── the rate limit: 5/min, the 6th hammer gets 429 ──
{
  const res0 = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.146.99.99' }, body: JSON.stringify({ email: `t146-b2-${STAMP}@t146.test`, password: PW }) })
  let cookie = (res0.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  let blocked = null
  for (let i = 0; i < 7; i++) {
    const res = await fetch(`${BASE}/api/queries`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Forwarded-For': '10.146.99.99' }, body: JSON.stringify({ productId, queryType: 'product_question', subject: 'hammer', message: 'limit probe message' }) })
    if (res.status === 429) { blocked = i; await res.json().catch(() => null); break }
    await res.json().catch(() => null)
  }
  ok(blocked === 5, `hammer: the 6th query in a minute → 429 (blocked at call #${blocked === null ? 'none' : blocked + 1})`)
}

console.log(`\nT146 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
