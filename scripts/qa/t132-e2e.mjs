// Task 132 E2E — the invoice family: /api/invoices (list), /api/invoices/[id]
// (Mushak 6.3), /api/orders/[id]/invoice (company tax invoice). All three had
// the receipt-route identity trap (supplierProfiles.id compared to users.id)
// that locked suppliers out of their own documents forever. Run on a FRESH wipe.
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T132 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't132-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), buyer = makeSession(), outsider = makeSession()
ok(await reg(admin, 'admin', `t132-admin-${STAMP}@t132.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t132-seller-${STAMP}@t132.test`, PW, 'T132 Invoice Depot'), 'seller registered')
ok(await reg(buyer, 'buyer', `t132-buyer-${STAMP}@t132.test`, PW), 'buyer registered')
ok(await reg(outsider, 'supplier', `t132-outsider-${STAMP}@t132.test`, PW, 'T132 Unrelated Co'), 'outsider seller registered')

// Category lookup — the GET /api/categories cache (5-min TTL) can outlive a
// DB wipe in BOTH directions (stale-positive skips creation too — Task 129
// lesson): Prisma is the ONLY authority. Create via the API when the row is
// genuinely absent, then read the id back from Prisma.
let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) {
  await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true })
  categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
}
ok(Boolean(categoryId), 'category Garments ready (Prisma-authoritative id)')
const p = await seller('POST', '/api/supplier/products', { name: 'T132 Jacket', description: 'drill', categoryId, unit: 'pcs', moq: 1, basePrice: 2000, stockQuantity: 100, priceTiers: [{ minQty: 1, pricePerUnit: 2000 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
const productId = p.json?.data?.id ?? p.json?.id
ok(Boolean(productId), 'product created', JSON.stringify(p.json)?.slice(0, 220))
const ap = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T132' })
ok(ap.status === 200, 'product approved', JSON.stringify(ap.json)?.slice(0, 220))
if (!productId) { console.log('T132 RESULT: product step failed — aborting'); await db.$disconnect(); process.exit(1) }
const addr = await buyer('POST', '/api/addresses', { label: 'Office', address_line1: 'Road 12', city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000132', postal_code: '1212' })
const addressId = addr.json?.data?.id ?? addr.json?.id
ok(Boolean(addressId), 'address created', JSON.stringify(addr.json)?.slice(0, 220))
if (!addressId) { console.log('T132 RESULT: address step failed — aborting'); await db.$disconnect(); process.exit(1) }
const buyerUser = await db.users.findUnique({ where: { email: `t132-buyer-${STAMP}@t132.test` } })
await db.wallets.create({ data: { userId: buyerUser.id, balance: 999999 } })
const o = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }], shippingAddressId: addressId, payWithWallet: true })
const orderId = o.json?.data?.orderId ?? o.json?.data?.id
ok(o.status === 201 && Boolean(orderId), 'wallet-paid order placed (2 × ৳2000 = ৳4000)', JSON.stringify(o.json)?.slice(0, 220))
if (!orderId) { console.log('T132 RESULT: order step failed — aborting'); await db.$disconnect(); process.exit(1) }
const orderRow = await db.orders.findUnique({ where: { id: orderId } })
ok(orderRow?.paymentStatus === 'paid', 'order is PAID')

// ── LIST: /api/invoices ──
ok((await makeSession()('GET', '/api/invoices')).status === 401, 'list: anon → 401')
let r = await buyer('GET', '/api/invoices')
ok(r.status === 200 && r.json?.data?.length === 1, 'list: buyer sees their 1 invoice')
ok(r.json?.data?.[0]?.grandTotal === 4000, 'list: buyer row grandTotal = ৳4000 (order truth)')
r = await seller('GET', '/api/invoices')
ok(r.status === 200 && r.json?.data?.length === 1, 'list: SUPPLIER SEES THE ORDER INVOICE (was always empty — the identity trap)', JSON.stringify(r.json?.data?.length))
r = await admin('GET', '/api/invoices')
ok(r.status === 200 && r.json?.data?.length === 1, 'list: admin sees the full book')
r = await outsider('GET', '/api/invoices')
ok(r.status === 200 && (r.json?.data?.length ?? 0) === 0, 'list: unrelated seller sees zero (no leak)')

// ── MUSHAK: /api/invoices/[id] ──
ok((await makeSession()('GET', `/api/invoices/${orderId}`)).status === 401, 'mushak: anon → 401')
r = await buyer('GET', `/api/invoices/${orderId}`)
ok(r.status === 200 && r.json?.data?.invoiceNumber === `INV-${orderRow.orderNumber}`, 'mushak: buyer 200 with real invoice number')
ok(r.json?.data?.mushakNumber?.startsWith('MUSHAK-6.3-'), 'mushak: MUSHAK-6.3 number present')
ok(r.json?.data?.subtotal === 4000 && r.json?.data?.vatAmount === 200, 'mushak: subtotal ৳4000, 5% VAT = ৳200', JSON.stringify({ s: r.json?.data?.subtotal, v: r.json?.data?.vatAmount }))
r = await seller('GET', `/api/invoices/${orderId}`)
ok(r.status === 200, 'mushak: SUPPLIER ON THE ORDER → 200 (was 404 forever)', JSON.stringify(r.json))
r = await seller('GET', `/api/invoices/${orderRow.orderNumber}`)
ok(r.status === 200, 'mushak: resolves by orderNumber too')
r = await outsider('GET', `/api/invoices/${orderId}`)
ok(r.status === 404, 'mushak: unrelated seller → 404 no-leak')
r = await admin('GET', `/api/invoices/${orderId}`)
ok(r.status === 200, 'mushak: admin 200')
r = await buyer('GET', '/api/invoices/nonexistent999')
ok(r.status === 404, 'mushak: missing id → 404')

// ── TAX INVOICE: /api/orders/[id]/invoice ──
ok((await makeSession()('GET', `/api/orders/${orderId}/invoice`)).status === 401, 'tax invoice: anon → 401')
r = await buyer('GET', `/api/orders/${orderId}/invoice`)
ok(r.status === 200 && r.json?.data?.grandTotal === 4000, 'tax invoice: buyer 200, grandTotal ৳4000')
ok(r.json?.data?.items?.length === 1 && r.json?.data?.items?.[0]?.total === 4000, 'tax invoice: 1 line, total ৳4000')
ok(typeof r.json?.data?.tax === 'number' && r.json?.data?.company?.name === 'Zylod', 'tax invoice: server-computed VAT + company identity present')
ok(r.json?.data?.discount === 0, 'tax invoice: NO phantom discount on an undiscounted order (VAT artifact was masquerading as one)', JSON.stringify({ d: r.json?.data?.discount }))
ok(r.json?.data?.subtotal + r.json?.data?.shipping - r.json?.data?.discount === r.json?.data?.grandTotal, 'tax invoice: subtotal + shipping − discount === charged total (money identity)')
r = await seller('GET', `/api/orders/${orderId}/invoice`)
ok(r.status === 200, 'tax invoice: SUPPLIER ON THE ORDER → 200 (was 403 forever)', JSON.stringify(r.json))
r = await outsider('GET', `/api/orders/${orderId}/invoice`)
ok(r.status === 403, 'tax invoice: unrelated seller → 403')
r = await admin('GET', `/api/orders/${orderId}/invoice`)
ok(r.status === 200, 'tax invoice: admin 200')
r = await buyer('GET', `/api/orders/nonexistent999/invoice`)
ok(r.status === 404, 'tax invoice: missing order → 404')

console.log(`\nT132 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
