// Task 131 E2E — the coupon circuit: /api/coupons/validate (fixed+percentage
// formula mirrored from the order write) wired into checkout, and the REAL
// order path proving discounts land. Run on a FRESH wipe.
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T131 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const day = 86_400_000
const STAMP = Date.now()
const PW = 't131-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), buyer = makeSession()
ok(await reg(admin, 'admin', `t131-admin-${STAMP}@t131.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t131-seller-${STAMP}@t131.test`, PW, 'T131 Coupon Depot'), 'seller registered')
ok(await reg(buyer, 'buyer', `t131-buyer-${STAMP}@t131.test`, PW), 'buyer registered')

// catalog
const catList = await admin('GET', '/api/categories')
let categoryId = (catList.json?.data ?? []).find((c) => c.slug === 'garments')?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
ok(Boolean(categoryId), 'category ready')
const p = await seller('POST', '/api/supplier/products', { name: 'T131 Hoodie', description: 'drill', categoryId, unit: 'pcs', moq: 1, basePrice: 1000, stockQuantity: 500, priceTiers: [{ minQty: 1, maxQty: 99, pricePerUnit: 1000 }, { minQty: 100, pricePerUnit: 900 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
const productId = p.json?.data?.id ?? p.json?.id
ok(Boolean(productId), 'product created')
await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T131' })

// buyer address + funded wallet
const addr = await buyer('POST', '/api/addresses', { label: 'Home', address_line1: 'House 1', city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000131', postal_code: '1200' })
const addressId = addr.json?.data?.id ?? addr.json?.id
ok(Boolean(addressId), 'address created')
const buyerUser = await db.users.findUnique({ where: { email: `t131-buyer-${STAMP}@t131.test` } })
await db.wallets.create({ data: { userId: buyerUser.id, balance: 999999 } })

// coupons via the REAL admin route
const until = (d) => new Date(Date.now() + d * day).toISOString()
const mk = (code, extra) => admin('POST', '/api/coupons', { code, discountType: 'percentage', discountPercent: 10, validUntil: until(7), usageLimit: 100, ...extra })
const mkOk = async (label, code, extra) => { const rr = await mk(code, extra); if (rr.status !== 201) console.log(`  [dbg] ${label}: ${rr.status} ${JSON.stringify(rr.json).slice(0, 200)}`); return rr }
ok((await mkOk('WELCOME', 'T131WELCOME', { maxDiscount: 200 })).status === 201, 'coupon T131WELCOME (10% cap 200) created')
ok((await mkOk('FLAT', 'T131FLAT', { discountType: 'fixed', discountPercent: 100 })).status === 201, 'coupon T131FLAT (fixed ৳100) created')
ok((await mkOk('MIN2K', 'T131MIN2K', { minOrderAmount: 2000 })).status === 201, 'coupon T131MIN2K (min ৳2000) created')
ok((await mkOk('ONCE', 'T131ONCE', { usageLimit: 1 })).status === 201, 'coupon T131ONCE (usageLimit 1) created')
ok((await mkOk('EARLY', 'T131EARLY', { validFrom: until(1) })).status === 201, 'coupon T131EARLY (starts tomorrow) created')
// The create route refuses already-expired windows, so the expired fixture is
// written directly (established drill-fixture pattern — qa128's wallet row).
await db.coupons.create({ data: { code: 'T131DEAD', discountType: 'percentage', discountPercent: 10, validFrom: new Date(Date.now() - 2 * day), validUntil: new Date(Date.now() - day), usedCount: 0, isActive: true } })
ok((await db.coupons.findUnique({ where: { code: 'T131DEAD' } })) !== null, 'coupon T131DEAD (expired, DB-written) present')

// ── validate gates ──
const v = (body) => buyer('POST', '/api/coupons/validate', body)
ok((await v({})).status === 400, 'validate: no code → 400')
let r = await v({ code: 'NOPE404', orderAmount: 1000 })
ok(r.status === 404 && r.json?.valid === false, 'validate: unknown code → 404 valid:false', JSON.stringify(r.json))
r = await v({ code: 'T131DEAD', orderAmount: 1000 })
ok(r.status === 400 && /expired/i.test(r.json?.error ?? ''), 'validate: expired → 400 real reason')
r = await v({ code: 'T131EARLY', orderAmount: 1000 })
ok(r.status === 400 && /not yet valid/i.test(r.json?.error ?? ''), 'validate: not-yet-valid → 400 real reason')
r = await v({ code: 'T131MIN2K', orderAmount: 1000 })
ok(r.status === 400 && /2000/.test(r.json?.error ?? ''), 'validate: below minimum → 400 names ৳2000')

// ── validate math (mirrors the order write) ──
r = await v({ code: 'T131WELCOME', orderAmount: 1000 })
ok(r.json?.data?.discountAmount === 100 && r.json?.data?.discountType === 'percentage', 'validate: 10% of ৳1000 = ৳100', JSON.stringify(r.json?.data))
r = await v({ code: 'T131WELCOME', orderAmount: 5000 })
ok(r.json?.data?.discountAmount === 200, 'validate: 10% of ৳5000 capped by maxDiscount ৳200', JSON.stringify(r.json?.data))
r = await v({ code: 'T131FLAT', orderAmount: 1000 })
ok(r.json?.data?.discountAmount === 100 && r.json?.data?.discountType === 'fixed', 'validate: fixed ৳100 → ৳100 (old code computed ৳0/percent nonsense)', JSON.stringify(r.json?.data))
r = await v({ code: 'T131FLAT', orderAmount: 50 })
ok(r.json?.data?.discountAmount === 50, 'validate: fixed ৳100 vs ৳50 order → capped at ৳50 (order-write parity)', JSON.stringify(r.json?.data))

// ── REAL ORDER PATH: discounts land, usedCount increments, limits refuse ──
const place = async (code, qty = 1) => buyer('POST', '/api/orders', { items: [{ productId, quantity: qty }], shippingAddressId: addressId, payWithWallet: true, ...(code ? { couponCode: code } : {}) })
r = await place('T131WELCOME')
const orderId1 = r.json?.data?.orderId ?? r.json?.data?.id
ok(r.status === 201 && Boolean(orderId1), 'order with T131WELCOME placed', JSON.stringify(r.json)?.slice(0, 200))
let row = await db.orders.findUnique({ where: { id: orderId1 } })
ok(row?.totalAmount === 900, `order total = ৳900 (৳1000 − ৳100 coupon) — got ৳${row?.totalAmount}`)
ok(row?.paymentStatus === 'paid', 'wallet-paid order lands PAID')
const c1 = await db.coupons.findUnique({ where: { code: 'T131WELCOME' } })
ok(c1?.usedCount === 1, 'usedCount incremented to 1')

r = await place('T131FLAT')
row = await db.orders.findUnique({ where: { id: r.json?.data?.orderId ?? r.json?.data?.id } })
ok(r.status === 201 && row?.totalAmount === 900, 'fixed coupon through the REAL order path → total ৳900')

r = await place('T131ONCE')
ok(r.status === 201, 'T131ONCE first use accepted')
r = await place('T131ONCE')
ok(r.status === 409 && /usage limit/i.test(r.json?.error ?? ''), 'T131ONCE second use → 409 real reason', JSON.stringify(r.json))

r = await place('T131MIN2K')
ok(r.status === 409 && /minimum order/i.test(r.json?.error ?? ''), 'T131MIN2K on a ৳1000 order → 409 names the minimum', JSON.stringify(r.json))

r = await place('T131DEAD')
ok(r.status === 409 && /expired/i.test(r.json?.error ?? ''), 'expired code through the order path → 409')
r = await place('NOSUCH999')
ok(r.status === 409 && /does not exist/i.test(r.json?.error ?? ''), 'unknown code through the order path → 409')

console.log(`\nT131 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
