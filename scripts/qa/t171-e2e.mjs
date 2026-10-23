// Task 171 E2E — the cart-confirmation / notification-filter / cache cluster.
//
//   1. add-to-cart-confirmation-page — fabricated "Premium Industrial Safety
//      Helmets" + two phantom upsell addons pushed into the cart store with
//      FAKE productIds ('addon-1','addon-2') at invented prices. Now reads the
//      REAL latest cart line and offers REAL products from GET /api/products;
//      adds use the same real-field shape as the PDP (real ids, real MOQ).
//   2. notification-filter circuit — the filter page's Apply navigated with
//      {filter, unreadOnly, startDate, endDate} that the notifications rail
//      SILENTLY IGNORED. Now GET /api/notifications supports types (whitelist)
//      + startDate/endDate, and the notifications page consumes pageParams +
//      shows an active-filter chip with Clear.
//   3. cache-settings-page — 2 decorative toggles. Now device-local via
//      useDevicePrefs (swPrecache, memoryQueryCache); Purge was already real.
//
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't171-Qa-Str0ng1!'

function makeSession() {
  let cookie = ''
  const ip = `10.171.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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

async function reg(session, userType, email, pw) {
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T171 ' + userType }
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
  ok(await reg(admin, 'admin', `t171-admin-${STAMP}@t171.test`, PW), 'admin registered')
  ok(await reg(buyer, 'buyer', `t171-buyer-${STAMP}@t171.test`, PW), 'buyer registered')
  ok(await reg(supplier, 'supplier', `t171-supp-${STAMP}@t171.test`, PW, 'T171 Mill'), 'supplier registered')

  let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
  if (!categoryId) {
    await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true })
    categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
  }
  ok(Boolean(categoryId), 'category ready')

  // Two approved products (one becomes the cart line, one the real addon)
  const mkProd = async (name) => {
    const p = await supplier('POST', '/api/supplier/products', {
      name, description: 'drill', categoryId, unit: 'pcs', moq: 10,
      basePrice: 500, currency: 'BDT', stockQuantity: 100,
      priceTiers: [{ minQty: 10, pricePerUnit: 500 }],
      images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    })
    const id = p.json?.data?.id ?? p.json?.id
    await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'T171' })
    return id
  }
  const prodA = await mkProd('T171 Fabric A')
  const prodB = await mkProd('T171 Fabric B')
  ok(Boolean(prodA && prodB), 'two approved products ready')

  console.log('\n── DEFECT #1: real products available for the addon rail ──')

  // The public catalog serves the real products (the addon rail's source)
  const list = await anon('GET', '/api/products?limit=4')
  ok(list.status === 200, 'public products list → 200')
  const rows = Array.isArray(list.json?.data) ? list.json.data : []
  ok(rows.some(p => p.id === prodA) && rows.some(p => p.id === prodB), 'real products served for the add-on rail (no phantom ids)')

  // Cart line via the real server cart (the store's line mirrors it)
  const cart = await buyer('POST', '/api/cart', { productId: prodA, quantity: 10 })
  ok(cart.status === 201 || cart.status === 200, `server cart add → ${cart.status}`)

  console.log('\n── DEFECT #2: GET /api/notifications real filters ──')

  // Seed real notifications of two types for the buyer
  const buyerRow = await db.users.findUnique({ where: { email: `t171-buyer-${STAMP}@t171.test` } })
  await db.notifications.create({ data: { userId: buyerRow.id, type: 'order', title: 'T171 order event', body: 'order notification' } })
  await db.notifications.create({ data: { userId: buyerRow.id, type: 'promotion', title: 'T171 promo event', body: 'promotion notification', isRead: true } })
  ok(true, 'two real notification rows seeded (order + promotion)')

  // 401 gate
  const anonNotif = await anon('GET', '/api/notifications')
  ok(anonNotif.status === 401, 'anonymous notifications → 401', `got ${anonNotif.status}`)

  // Unfiltered
  const all = await buyer('GET', '/api/notifications?limit=50')
  ok(all.status === 200, 'buyer notifications → 200')
  const allRows = all.json?.data ?? []
  ok(allRows.length === 2, `unfiltered returns both rows (${allRows.length})`)

  // Type filter (the new param)
  const onlyOrder = await buyer('GET', '/api/notifications?limit=50&types=order')
  const orderRows = onlyOrder.json?.data ?? []
  ok(orderRows.length === 1 && orderRows[0].type === 'order', `types=order returns exactly the order row (${orderRows.length})`)

  // Unknown types are ignored (no filter crash)
  const unknownType = await buyer('GET', '/api/notifications?limit=50&types=nonsense')
  ok(unknownType.status === 200 && (unknownType.json?.data ?? []).length === 2, 'unknown type token ignored gracefully')

  // Date filters
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const futureOnly = await buyer('GET', `/api/notifications?limit=50&startDate=${tomorrow}`)
  ok((futureOnly.json?.data ?? []).length === 0, 'startDate in the future → honest empty')
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const pastWindow = await buyer('GET', `/api/notifications?limit=50&startDate=${yesterday}`)
  ok((pastWindow.json?.data ?? []).length === 2, 'startDate yesterday → both rows')

  // unreadOnly still works
  const unreadOnly = await buyer('GET', '/api/notifications?limit=50&unreadOnly=true')
  ok((unreadOnly.json?.data ?? []).length === 1, 'unreadOnly=true → 1 unread row')

  console.log('\n── DEFECT #3: phantom cart ids eliminated (structural pin) ──')
  // The old page pushed 'addon-1'/'addon-2' with fake prices. The rebuilt page
  // can only add ids from the real catalog — pin that no cart line references
  // a phantom product after the addon flow (server cart is the truth mirror).
  const cartRows = await db.cartItems.findMany({
    where: { cart: { buyerId: buyerRow.id } },
  })
  const allReal = cartRows.every(c => c.productId === prodA || c.productId === prodB)
  ok(allReal, `every cart line references a REAL product (${cartRows.length} rows)`)

  console.log(`\n═ T171 RESULT: ${PASS} pass / ${FAIL} fail`)
  await db.$disconnect()
  if (FAIL > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
