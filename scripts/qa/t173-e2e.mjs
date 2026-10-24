// Task 173 E2E — the link-generator / deep-link-handler / shipping-faq
// honesty cluster + the queries-writer circuit re-proof.
//
//   1. link-generator-page — fabricated default ids (`clx8919`,
//      `dhaka_expo_2026`) generated broken deep links. Now the entity picker
//      pulls REAL rows from /api/products, /api/suppliers, /api/deals,
//      /api/live-shopping; the campaign field is empty by default.
//   2. deep-link-handler-page — fabricated default `zylod://product/clx8919`
//      seeded the simulator with a phantom id. Now seeded with a REAL product
//      id (or a templated `{id}` placeholder when the catalog is empty).
//   3. shipping-faq-page — `bg-indigo-600` button violated the no-indigo
//      brand rule. Now `bg-primary`.
//   4. RE-PROOF: the sellerCustomerQueries writer circuit (noted "decision
//      pending" in t168-t171 worklogs) is actually CLOSED end-to-end:
//      buyer asks via POST /api/queries → seller inbox /api/supplier/queries
//      → detail /api/supplier/queries/[id] → reply PATCH → buyer reads it
//      back via GET /api/queries.
//
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't173-Qa-Str0ng1!'

function makeSession() {
  let cookie = ''
  const ip = `10.173.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        'X-Forwarded-For': ip,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const p = c.split(';')[0]
      if (p) cookie = cookie ? `${cookie}; ${p}` : p
    }
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

async function reg(session, userType, email, pw, businessName) {
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T173 ' + userType, ...(businessName ? { businessName } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) {
      const l = await session('POST', '/api/auth/login', { email, password: pw })
      return l.status === 200 || l.status === 201
    }
    await sleep(4000 * (a + 1))
  }
  return false
}

async function main() {
  const admin = makeSession(), buyer = makeSession(), supplier = makeSession(), anon = makeSession()
  ok(await reg(admin, 'admin', `t173-admin-${STAMP}@t173.test`, PW), 'admin registered')
  ok(await reg(buyer, 'buyer', `t173-buyer-${STAMP}@t173.test`, PW), 'buyer registered')
  ok(await reg(supplier, 'supplier', `t173-supp-${STAMP}@t173.test`, PW, 'T173 Mill'), 'supplier registered')

  let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
  if (!categoryId) {
    await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true })
    categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
  }
  ok(Boolean(categoryId), 'category ready')

  // One approved product (drives the products picker, the deep-link seed,
  // and the queries productId target)
  const mkProd = async (name) => {
    const p = await supplier('POST', '/api/supplier/products', {
      name, description: 'drill', categoryId, unit: 'pcs', moq: 10,
      basePrice: 500, currency: 'BDT', stockQuantity: 100,
      priceTiers: [{ minQty: 10, pricePerUnit: 500 }],
      images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    })
    const id = p.json?.data?.id ?? p.json?.id
    await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'T173' })
    return id
  }
  const prodA = await mkProd('T173 Fabric A')
  ok(Boolean(prodA), 'approved product ready')

  // Approve the supplier so the suppliers picker serves them
  const suppProfile = await db.supplierProfiles.findFirst({ where: { companyName: 'T173 Mill' } })
  if (suppProfile) {
    await db.supplierProfiles.update({ where: { id: suppProfile.id }, data: { verificationStatus: 'approved' } })
    ok(true, 'supplier approved (visible to the storefronts picker)')
  }

  console.log('\n── DEFECT #1: link-generator entity pickers serve REAL rows ──')

  // Products picker
  const prodList = await anon('GET', '/api/products?limit=50')
  ok(prodList.status === 200, 'GET /api/products → 200')
  const prodRows = Array.isArray(prodList.json?.data) ? prodList.json.data : (prodList.json?.data?.products ?? [])
  ok(prodRows.some(p => p.id === prodA), 'products picker serves the real product (no phantom ids)')

  // Suppliers picker
  const suppList = await anon('GET', '/api/suppliers?limit=50')
  ok(suppList.status === 200, 'GET /api/suppliers → 200')
  const suppRows = Array.isArray(suppList.json?.data) ? suppList.json.data : (suppList.json?.data?.suppliers ?? [])
  ok(suppRows.some(s => s.id === suppProfile.id), 'suppliers picker serves the real approved supplier')

  // Deals picker (may be empty — honest empty state, no phantom)
  const dealsList = await anon('GET', '/api/deals?limit=50')
  ok(dealsList.status === 200, 'GET /api/deals → 200 (rail up; empty is honest)')

  // Live-shopping picker
  const liveList = await anon('GET', '/api/live-shopping?limit=50')
  ok(liveList.status === 200, 'GET /api/live-shopping → 200 (rail up; empty is honest)')

  console.log('\n── DEFECT #2: deep-link-handler seed rail (real product shape) ──')
  // The page seeds testUrl from /api/products?limit=1 — pin the shape it expects.
  const seed = await anon('GET', '/api/products?limit=1')
  const seedRows = Array.isArray(seed.json?.data) ? seed.json.data : (seed.json?.data?.products ?? [])
  ok(seed.status === 200, 'seed rail /api/products?limit=1 → 200')
  ok(seedRows.length === 1 && typeof seedRows[0].id === 'string', 'seed row has a real string id (no phantom placeholder needed)')

  console.log('\n── DEFECT #3: shipping-faq indigo→primary (structural pin) ──')
  const fs = await (await import('node:fs/promises')).readFile('src/components/pages/shipping-faq-page.tsx', 'utf8')
  ok(!fs.includes('bg-indigo-600') && !fs.includes('hover:bg-indigo-700'), 'no indigo-600/700 classes remain in shipping-faq-page')
  ok(fs.includes('bg-primary'), 'shipping-faq Back button now uses bg-primary')

  // Also pin the link-generator + deep-link-handler no longer carry the phantom ids
  const lg = await (await import('node:fs/promises')).readFile('src/components/pages/link-generator-page.tsx', 'utf8')
  ok(!lg.includes('clx8919') && !lg.includes('dhaka_expo_2026'), 'link-generator: no fabricated clx8919 / dhaka_expo_2026 defaults remain')
  ok(lg.includes('/api/products') && lg.includes('/api/suppliers') && lg.includes('/api/deals') && lg.includes('/api/live-shopping'), 'link-generator: all 4 real entity rails wired')
  const dl = await (await import('node:fs/promises')).readFile('src/components/pages/deep-link-handler-page.tsx', 'utf8')
  ok(!dl.includes("'zylod://product/clx8919'"), 'deep-link-handler: no fabricated clx8919 default testUrl remains')
  ok(dl.includes('/api/products?limit=1'), 'deep-link-handler: seeds testUrl from the real products rail')

  console.log('\n── RE-PROOF: sellerCustomerQueries writer circuit is CLOSED end-to-end ──')
  // The worklog noted this as "decision pending" — but the writer rail
  // (POST /api/queries) and the buyer-side ask form (seller-storefront-page)
  // both exist. Pin the full circuit so the worklog note can be retired.

  // 1. Anon cannot file → 401
  const anonAsk = await anon('POST', '/api/queries', {
    supplierId: suppProfile.id, queryType: 'pre_order', subject: 'Anon ask', message: 'Should not land',
  })
  ok(anonAsk.status === 401, 'anon POST /api/queries → 401', `got ${anonAsk.status}`)

  // 2. Buyer files a real pre-order question
  const ask = await buyer('POST', '/api/queries', {
    supplierId: suppProfile.id, queryType: 'pre_order',
    subject: 'T173 pre-order MOQ ask',
    message: 'Can you do 500 units of T173 Fabric A at a tiered price?',
  })
  ok(ask.status === 201, 'buyer POST /api/queries → 201', `got ${ask.status}`)
  const queryId = ask.json?.data?.id
  ok(Boolean(queryId), 'query id returned')

  // 3. The supplier's inbox sees it
  const inbox = await supplier('GET', '/api/supplier/queries')
  ok(inbox.status === 200, 'supplier GET /api/supplier/queries → 200')
  const inboxRows = inbox.json?.data ?? []
  ok(inboxRows.some(q => q.id === queryId), 'supplier inbox contains the new query')

  // 4. The supplier reads the detail
  const detail = await supplier('GET', `/api/supplier/queries/${queryId}`)
  ok(detail.status === 200, 'supplier GET /api/supplier/queries/[id] → 200')
  ok(detail.json?.data?.subject === 'T173 pre-order MOQ ask', 'detail returns the real subject')

  // 5. The supplier replies
  const reply = await supplier('PATCH', `/api/supplier/queries/${queryId}`, {
    replyMessage: 'T173 reply — yes, 500 units at ৳450/unit.',
  })
  ok(reply.status === 200, 'supplier PATCH reply → 200', `got ${reply.status}`)

  // 6. The buyer reads the reply back via GET /api/queries
  const buyerInbox = await buyer('GET', '/api/queries')
  ok(buyerInbox.status === 200, 'buyer GET /api/queries → 200')
  const buyerRows = buyerInbox.json?.data?.queries ?? []
  const buyerRow = buyerRows.find(q => q.id === queryId)
  ok(Boolean(buyerRow), 'buyer inbox contains the query')
  ok(buyerRow?.replyMessage === 'T173 reply — yes, 500 units at ৳450/unit.', 'buyer sees the real supplier reply')
  ok(buyerRow?.status === 'replied', 'buyer sees status=replied')

  // 7. product_question is refused (must use the product Q&A rail — one question, one home)
  const wrongType = await buyer('POST', '/api/queries', {
    supplierId: suppProfile.id, queryType: 'product_question', subject: 'Wrong rail', message: 'Should be refused',
  })
  ok(wrongType.status === 400, 'product_question queryType refused with 400 (use the product Q&A rail)')

  console.log(`\n═ T173 RESULT: ${PASS} pass / ${FAIL} fail`)
  await db.$disconnect()
  if (FAIL > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
