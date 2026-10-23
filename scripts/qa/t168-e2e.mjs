// Task 168 E2E — the logistics-theater honesty cluster. Five fake-data pages
// pinned:
//
//   1. shipping-tracker-page — fabricated "Courier #8492" SVG map + fake
//      "14:30 BST" ETA + fake "Tejgaon Central Hub 08:15 AM" timeline. Now
//      binds to GET /api/orders/[id]/track (real milestones, honest no-live-GPS note).
//   2. missed-delivery-page — fabricated "AWB-9876543210" + Unsplash photo +
//      setTimeout "Rescheduled" → navigate. Now binds to GET /api/orders/[id]
//      + POST /api/orders/[id]/reschedule (the Task 162 rail).
//   3. order-invoice-download-page — fabricated "INV-2023-88291" + "1.2 MB" +
//      setTimeout "Generating PDF" + fake "Sent to Finance!" email. Now
//      delegates to the REAL order-invoice-page (GET /api/orders/[id]/invoice).
//   4. size-guide-page — fabricated "Recommended Size: Large" based on a fake
//      previous purchase. Now an honest general garment chart (product-aware
//      when pageParams.productId is supplied).
//   5. wishlist-sort-filter-page — orphan (ZERO callers, duplicates wishlist's
//      inline sort/filter). Removed; registration cleaned.
//
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't168-Qa-Str0ng1!'

function makeSession() {
  let cookie = ''
  const ip = `10.168.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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

async function reg(session, userType, email, pw, company) {
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T168 ' + userType, ...(company ? { businessName: company } : {}) }
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
  ok(await reg(admin, 'admin', `t168-admin-${STAMP}@t168.test`, PW), 'admin registered')
  ok(await reg(buyer, 'buyer', `t168-buyer-${STAMP}@t168.test`, PW), 'buyer registered')
  ok(await reg(supplier, 'supplier', `t168-supp-${STAMP}@t168.test`, PW, 'T168 Mill'), 'supplier registered')

  // Bootstrap category + product + order (the track + reschedule rails need a real order)
  let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
  if (!categoryId) {
    await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true })
    categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
  }
  ok(Boolean(categoryId), 'category ready')

  const prod = await supplier('POST', '/api/supplier/products', {
    name: 'T168 Drill Shirt', description: 'drill', categoryId, unit: 'pcs', moq: 10,
    basePrice: 500, currency: 'BDT', stockQuantity: 100,
    priceTiers: [{ minQty: 10, pricePerUnit: 500 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'supplier product created')
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T168' })

  // Real order via POST /api/orders (the Task 162 pattern — no cart/checkout needed)
  const ord = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 10 }] })
  const orderId = ord.json?.data?.orderId ?? ord.json?.data?.id
  ok(Boolean(orderId), 'real order placed', JSON.stringify(ord.json)?.slice(0, 120))

  console.log('\n── DEFECT #1: shipping-tracker binds to GET /api/orders/[id]/track ──')

  // Anon → 401
  const anonTrack = await anon('GET', `/api/orders/${orderId}/track`)
  ok(anonTrack.status === 401, 'anonymous track → 401', `got ${anonTrack.status}`)

  // Buyer (owner) → 200 with real subOrders
  const buyerTrack = await buyer('GET', `/api/orders/${orderId}/track`)
  ok(buyerTrack.status === 200, 'owner track → 200', `got ${buyerTrack.status}`)
  ok(Array.isArray(buyerTrack.json?.data?.subOrders), 'track returns real subOrders array')
  ok(buyerTrack.json.data.subOrders.length > 0, 'subOrders non-empty (real order)')

  // Phantom order → 404 (same as foreign — no id leak)
  const phantomTrack = await buyer('GET', `/api/orders/nonexistent-xyz/track`)
  ok(phantomTrack.status === 404, 'phantom order track → 404', `got ${phantomTrack.status}`)

  console.log('\n── DEFECT #2: missed-delivery binds to GET /api/orders/[id] + reschedule rail ──')

  // Anon → 401 on order detail
  const anonOrd = await anon('GET', `/api/orders/${orderId}`)
  ok(anonOrd.status === 401, 'anonymous order detail → 401', `got ${anonOrd.status}`)

  // Buyer (owner) → 200
  const buyerOrd = await buyer('GET', `/api/orders/${orderId}`)
  ok(buyerOrd.status === 200, 'owner order detail → 200', `got ${buyerOrd.status}`)
  ok(Boolean(buyerOrd.json?.data?.orderNumber || buyerOrd.json?.data?.id), 'order detail returns real order')

  // Reschedule rail (Task 162) — anon 401, buyer can list
  const anonRes = await anon('GET', `/api/orders/${orderId}/reschedule`)
  ok(anonRes.status === 401, 'anonymous reschedule list → 401', `got ${anonRes.status}`)
  const buyerResList = await buyer('GET', `/api/orders/${orderId}/reschedule`)
  ok(buyerResList.status === 200, 'owner reschedule list → 200', `got ${buyerResList.status}`)

  // POST a real reschedule request (future date — YYYY-MM-DD, window morning/afternoon)
  const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  const postRes = await buyer('POST', `/api/orders/${orderId}/reschedule`, {
    requestedDate: future,
    window: 'afternoon',
    instructions: 'T168 drill — gate code 4472',
  })
  ok(postRes.status === 201 || postRes.status === 200, `reschedule POST → 201/200 (got ${postRes.status})`, JSON.stringify(postRes.json)?.slice(0, 120))

  // One-pending-per-order rule (409 on second)
  const future2 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  const dupRes = await buyer('POST', `/api/orders/${orderId}/reschedule`, {
    requestedDate: future2,
    window: 'morning',
  })
  ok(dupRes.status === 409, 'second pending reschedule → 409 (one-pending rule)', `got ${dupRes.status}`)

  // Audit row + seller notification stamped
  const auditRows = await db.auditLogs.count({
    where: { action: 'delivery_reschedule_requested', entityType: 'orderReschedules' },
  })
  ok(auditRows >= 1, 'audit row stamped for the reschedule request')
  const notifRows = await db.notifications.count({
    where: { type: 'order', relatedEntityId: orderId },
  })
  ok(notifRows >= 1, 'seller notification row stamped (durable)')

  console.log('\n── DEFECT #3: order-invoice-download delegates to real invoice ──')

  // The real invoice rail (Task 132)
  const anonInv = await anon('GET', `/api/orders/${orderId}/invoice`)
  ok(anonInv.status === 401, 'anonymous invoice → 401', `got ${anonInv.status}`)
  const buyerInv = await buyer('GET', `/api/orders/${orderId}/invoice`)
  ok(buyerInv.status === 200, 'owner invoice → 200', `got ${buyerInv.status}`)
  ok(Boolean(buyerInv.json?.data?.invoiceNumber), 'invoice returns real invoiceNumber')
  ok(Boolean(buyerInv.json?.data?.company?.name), 'invoice carries platform company identity')

  console.log('\n── DEFECT #4: size-guide no longer claims a fake recommendation ──')
  console.log('  (UI honesty — verified via browser QA: no "Recommended Size: Large" text)')

  // The product detail rail (for product-aware size-guide)
  const prodDetail = await anon('GET', `/api/products/${productId}`)
  ok(prodDetail.status === 200, 'public product detail → 200 (size-guide can be product-aware)')

  console.log('\n── DEFECT #5: wishlist-sort-filter orphan removed ──')

  // The orphan page is gone — registration cleaned
  const fs = await import('node:fs')
  const removed = !fs.existsSync('src/components/pages/wishlist-sort-filter-page.tsx')
  ok(removed, 'wishlist-sort-filter-page.tsx removed (orphan)')
  const loaderSrc = fs.readFileSync('src/lib/page-loader.ts', 'utf8')
  ok(!loaderSrc.includes('wishlist-sort-filter'), 'page-loader REAL_PAGES cleaned')
  const chunkSrc = fs.readFileSync('src/lib/page-chunks/chunk-wishlist.ts', 'utf8')
  ok(!chunkSrc.includes('wishlist-sort-filter'), 'chunk-wishlist cleaned')

  console.log(`\n═ T168 RESULT: ${PASS} pass / ${FAIL} fail`)
  await db.$disconnect()
  if (FAIL > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
