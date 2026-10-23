// Task 170 E2E — the receipt + refund-detail honesty pair. Two more fake
// pages pinned:
//
//   1. order-receipt-page — fabricated items ("Industrial Grade Steel
//      Bearings"), invented money math (subtotal 3460 + fake "Tax (8.25%)"
//      — the platform charges 15% VAT), fake "Corporate Visa ending in
//      4242", fake "Oct 24, 2023 14:32 PST", decorative QR + "TXN: 0x9a8f…".
//      Now binds to GET /api/orders/[id]/receipt (buyer/supplier-on-order/
//      admin; every number server-computed).
//   2. refund-detail-page — fake credit note ("REF-2910-A", "3x Premium
//      Widgets", fake Visa ••42, unconditional "Refund Approved"). Now an
//      honest thin wrapper delegating to the REAL refund-status-page
//      (Task 169, the returns rail).
//
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't170-Qa-Str0ng1!'

function makeSession() {
  let cookie = ''
  const ip = `10.170.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T170 ' + userType, ...(company ? { businessName: company } : {}) }
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
  ok(await reg(admin, 'admin', `t170-admin-${STAMP}@t170.test`, PW), 'admin registered')
  ok(await reg(buyer, 'buyer', `t170-buyer-${STAMP}@t170.test`, PW), 'buyer registered')
  ok(await reg(supplier, 'supplier', `t170-supp-${STAMP}@t170.test`, PW, 'T170 Mill'), 'supplier registered')

  let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
  if (!categoryId) {
    await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true })
    categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
  }
  ok(Boolean(categoryId), 'category ready')

  const prod = await supplier('POST', '/api/supplier/products', {
    name: 'T170 Drill Fabric', description: 'drill', categoryId, unit: 'pcs', moq: 10,
    basePrice: 500, currency: 'BDT', stockQuantity: 100,
    priceTiers: [{ minQty: 10, pricePerUnit: 500 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'product created')
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T170' })

  const ord = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 10 }] })
  const orderId = ord.json?.data?.orderId ?? ord.json?.data?.id
  ok(Boolean(orderId), 'order placed')

  console.log('\n── DEFECT #1: order-receipt binds to GET /api/orders/[id]/receipt ──')

  // Anon → 401
  const anonRec = await anon('GET', `/api/orders/${orderId}/receipt`)
  ok(anonRec.status === 401, 'anonymous receipt → 401', `got ${anonRec.status}`)

  // Buyer (owner) → 200 with REAL numbers
  const buyerRec = await buyer('GET', `/api/orders/${orderId}/receipt`)
  ok(buyerRec.status === 200, 'owner receipt → 200', `got ${buyerRec.status}`)
  const rec = buyerRec.json?.data
  ok(Boolean(rec?.orderNumber), `real orderNumber served (${rec?.orderNumber})`)
  ok(Array.isArray(rec?.items) && rec.items.length > 0, 'real line items served')
  ok(rec?.items?.[0]?.productName === 'T170 Drill Fabric', 'item name is the REAL product name')
  ok(rec?.subtotal === 5000, `server-computed subtotal = qty 10 × 500 (${rec?.subtotal})`)
  ok(rec?.tax === rec.subtotal * 0.15, 'tax is the real 15% VAT of the subtotal (not a fake 8.25%)')
  // The honest money story (Task 132 pattern): total = the amount actually
  // charged (order.totalAmount); VAT is a reference line, never summed.
  ok(rec?.total === rec.subtotal + rec.shipping, 'total (as charged) = subtotal + shipping — VAT is reference-only')
  ok(['paid', 'pending', 'unpaid', 'failed'].includes((rec?.paymentStatus || '').toLowerCase()), `real paymentStatus (${rec?.paymentStatus})`)

  // Foreign buyer → 403/404 (no existence leak)
  const other = makeSession()
  ok(await reg(other, 'buyer', `t170-other-${STAMP}@t170.test`, PW), 'foreign buyer registered')
  const otherRec = await other('GET', `/api/orders/${orderId}/receipt`)
  ok(otherRec.status === 403 || otherRec.status === 404, 'foreign buyer receipt → 403/404 (no leak)', `got ${otherRec.status}`)

  // Phantom → 404
  const phantom = await buyer('GET', `/api/orders/nonexistent-t170/receipt`)
  ok(phantom.status === 404, 'phantom receipt → 404', `got ${phantom.status}`)

  console.log('\n── DEFECT #2: refund-detail delegates to the real refund-status page ──')

  // The delegation is a UI concern; pin the rail it lands on (Task 169 proof).
  const ordRow = await db.orders.findUnique({ where: { id: orderId }, include: { subOrders: { include: { items: true } } } })
  const firstItem = ordRow?.subOrders?.[0]?.items?.[0]

  // Pay + verify + deliver → return request
  const pay = await buyer('POST', `/api/orders/${orderId}/payment-submit`, {
    method: 'mobile_banking', brand: 'bKash', transactionId: `TRXT170${STAMP}`, senderNumber: '01711223344',
  })
  ok(pay.status === 201 || pay.status === 200, `payment submitted → ${pay.status}`)
  const payRow = await db.payments.findFirst({ where: { orderId } })
  if (payRow) {
    await supplier('POST', `/api/seller/payments/${payRow.id}/verify`, { action: 'verify', note: 'T170' })
  }
  const subRow = await db.subOrders.findFirst({ where: { orderId } })
  await supplier('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: subRow.id })

  const ret = await buyer('POST', `/api/orders/${orderId}/return`, {
    items: [{ itemId: firstItem.id, quantity: 1, reason: 'damaged', comments: 'T170 drill' }],
  })
  const returnId = ret.json?.data?.id ?? ret.json?.id
  ok(ret.status === 200 || ret.status === 201, `return request created → ${ret.status}`, JSON.stringify(ret.json)?.slice(0, 120))

  const buyerRet = await buyer('GET', `/api/returns/${returnId}`)
  ok(buyerRet.status === 200, 'refund-detail target rail (returns detail) → 200', `got ${buyerRet.status}`)
  ok(Boolean(buyerRet.json?.data?.returnNumber), 'real returnNumber served for the delegated view')

  console.log(`\n═ T170 RESULT: ${PASS} pass / ${FAIL} fail`)
  await db.$disconnect()
  if (FAIL > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
