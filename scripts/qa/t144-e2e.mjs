// Task 144 E2E — personal vouchers (claimed platform coupons, lucky-spin
// prizes, mystery-crate drops, referral welcomes — ALL stored in userCoupons)
// get REAL checkout teeth. The order write and the validate preview resolve
// the buyer's OWN claim row FIRST (claiming already counted the platform
// row's usedCount — consuming the claim keeps every counter single-counted);
// unclaimed public codes keep the platform path. Free-delivery prizes
// discount the QUOTED shipping fee and refuse (rollback-safe, voucher NOT
// consumed) when there is no shipping to discount. Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function makeSession() {
  let cookie = ''
  const ip = `10.144.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T144 ' + userType, ...(company ? { businessName: company } : {}) }
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
const PW = 't144-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), buyer1 = makeSession(), buyer2 = makeSession(), buyer3 = makeSession()
ok(await reg(admin, 'admin', `t144-admin-${STAMP}@t144.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t144-seller-${STAMP}@t144.test`, PW, 'T144 Voucher Depot'), 'seller registered')
ok(await reg(buyer1, 'buyer', `t144-b1-${STAMP}@t144.test`, PW), 'buyer1 registered')
ok(await reg(buyer2, 'buyer', `t144-b2-${STAMP}@t144.test`, PW), 'buyer2 registered')
ok(await reg(buyer3, 'buyer', `t144-b3-${STAMP}@t144.test`, PW), 'buyer3 registered')

// catalog
let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
const p = await seller('POST', '/api/supplier/products', { name: 'T144 Voucher Widget', description: 'drill', categoryId, unit: 'pcs', moq: 1, basePrice: 100, weightKg: 1, stockQuantity: 5000, priceTiers: [{ minQty: 1, pricePerUnit: 100 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
const productId = p.json?.data?.id ?? p.json?.id
ok(Boolean(productId), 'product created ৳100 × weightKg 1')
const appr = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T144' })
ok(appr.status === 200, 'product approved', JSON.stringify(appr.json)?.slice(0, 120))
const supplierId = (await db.products.findUnique({ where: { id: productId }, select: { supplierId: true } })).supplierId

const addr = await buyer1('POST', '/api/addresses', { label: 'Home', address_line1: 'House 1', city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000144', postal_code: '1200' })
const addressId = addr.json?.data?.id ?? addr.json?.id
ok(Boolean(addressId), 'buyer1 address (Dhaka) created')

// shipping book (t95 pattern): Steady ৳140 for 0–10 kg to Dhaka
const zone = await admin('POST', '/api/admin/shipping/zones', { name: 'T144 Dhaka Metro', districts: ['Dhaka'] })
const zoneId = zone.json?.data?.id ?? zone.json?.id
const mSteady = await admin('POST', '/api/admin/shipping/methods', { name: 'T144 Steady Courier', estimatedDays: '2-3 days' })
const steadyId = mSteady.json?.data?.id ?? mSteady.json?.id
await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId: steadyId, weightMin: 0, weightMax: 10, price: 140 })
await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId: steadyId, weightMin: 10, weightMax: 50, price: 420 })
ok(Boolean(zoneId && steadyId), 'shipping book ready (৳140 / 0–10kg, ৳420 / 10–50kg / Dhaka)')

// platform coupons via the REAL admin route (t131 pattern)
const until = (d) => new Date(Date.now() + d * day).toISOString()
let r1 = null
r1 = await admin('POST', '/api/coupons', { code: 'T144PUB', discountType: 'fixed', discountPercent: 100, validUntil: until(7), usageLimit: 100 })
ok(r1.status === 201, 'platform coupon T144PUB (fixed ৳100) created', JSON.stringify(r1.json)?.slice(0, 150))
r1 = await admin('POST', '/api/coupons', { code: 'T144PCT', discountType: 'percentage', discountPercent: 10, maxDiscount: 200, validUntil: until(7), usageLimit: 100 })
ok(r1.status === 201, 'platform coupon T144PCT (10% cap ৳200) created', JSON.stringify(r1.json)?.slice(0, 150))
r1 = await admin('POST', '/api/coupons', { code: 'T144RACE', discountType: 'fixed', discountPercent: 50, validUntil: until(7), usageLimit: 100 })
ok(r1.status === 201, 'platform coupon T144RACE (fixed ৳50) created', JSON.stringify(r1.json)?.slice(0, 150))

// ── the claim circuit ──
let rc = await buyer1('POST', '/api/coupons/claim', { code: 'T144PUB' })
ok(rc.status === 201, 'buyer1 claims T144PUB → 201', JSON.stringify(rc.json)?.slice(0, 150))
rc = await buyer1('POST', '/api/coupons/claim', { code: 'T144PUB' })
ok(rc.status === 409, 'double-claim → 409', JSON.stringify(rc.json)?.slice(0, 120))
const b1Id = (await db.users.findUnique({ where: { email: `t144-b1-${STAMP}@t144.test` } })).id
const platformRow = await db.coupons.findUnique({ where: { code: 'T144PUB' } })
ok(platformRow.usedCount === 1, 'claim counted the platform row ONCE (usedCount 1)')
const claimRow = await db.userCoupons.findFirst({ where: { userId: b1Id, code: 'T144PUB', status: 'active' } })
ok(!!claimRow && claimRow.discountStyle === 'fixed' && claimRow.savingsBDT === 100, 'claim row: active, fixed ৳100')

// preview through the SAME precedence the order write uses
let rv = await buyer1('POST', '/api/coupons/validate', { code: 'T144PUB', orderAmount: 500 })
ok(rv.status === 200 && rv.json?.valid === true && rv.json?.data?.source === 'personal' && rv.json?.data?.discountAmount === 100, 'validate: claim row wins (source personal, ৳100 estimate)', JSON.stringify(rv.json))
rv = await buyer2('POST', '/api/coupons/validate', { code: 'T144PUB', orderAmount: 500 })
ok(rv.status === 200 && rv.json?.data?.source === 'platform', 'validate: buyer2 (never claimed) previews via the platform fallback')
rv = await buyer2('POST', '/api/coupons/validate', { code: 'NOSUCH', orderAmount: 500 })
ok(rv.status === 404, 'validate: unknown code → 404')

// ── the ORDER teeth: claim row consumed, platform counter untouched ──
let ro = await buyer1('POST', '/api/orders', { items: [{ productId, quantity: 3 }], couponCode: 'T144PUB' })
ok(ro.status === 201, 'buyer1 order 3×৳100 with the claimed voucher → 201', JSON.stringify(ro.json)?.slice(0, 200))
ok(ro.json?.data?.couponApplied?.code === 'T144PUB' && Math.abs(ro.json?.data?.couponApplied?.discount - 100) < 0.01, `receipt: couponApplied ৳100 (got ${JSON.stringify(ro.json?.data?.couponApplied)})`)
const ord1 = await db.orders.findUnique({ where: { id: ro.json?.data?.orderId ?? ro.json?.id } })
ok(ord1 && Math.abs(ord1.totalAmount - 200) < 0.01, 'order total: 300 − 100 voucher = ৳200', JSON.stringify({ total: ord1?.totalAmount }))
const claimAfter = await db.userCoupons.findUnique({ where: { id: claimRow.id } })
ok(claimAfter.status === 'used', 'claim row consumed (status used)')
const platformAfter = await db.coupons.findUnique({ where: { code: 'T144PUB' } })
ok(platformAfter.usedCount === 1, 'THE SINGLE-COUNT PROOF: platform usedCount still 1 after the claim was spent')
ro = await buyer1('POST', '/api/orders', { items: [{ productId, quantity: 3 }], couponCode: 'T144PUB' })
ok(ro.status === 201, 'same code again → the PUBLIC campaign still governs itself (documented semantics: claim spent, platform row public)', JSON.stringify(ro.json)?.slice(0, 140))
ok((await db.coupons.findUnique({ where: { code: 'T144PUB' } })).usedCount === 2, 'public use counted on the platform row (usedCount 2)')

// ── percentage claim ──
rc = await buyer2('POST', '/api/coupons/claim', { code: 'T144PCT' })
ok(rc.status === 201, 'buyer2 claims T144PCT', JSON.stringify(rc.json)?.slice(0, 120))
ro = await buyer2('POST', '/api/orders', { items: [{ productId, quantity: 10 }], couponCode: 'T144PCT' })
ok(ro.status === 201 && Math.abs(ro.json?.data?.couponApplied?.discount - 100) < 0.01, 'percentage claim: 10% of ৳1,000 = ৳100 off', JSON.stringify(ro.json?.data?.couponApplied))
const ord2 = await db.orders.findUnique({ where: { id: ro.json?.data?.orderId ?? ro.json?.id } })
ok(ord2 && Math.abs(ord2.totalAmount - 900) < 0.01, 'order total ৳900 (percentage math on the claim row)')

// ── referral welcome voucher (the deterministic earned prize) ──
const refGet = await buyer1('GET', '/api/referrals')
const refCode = refGet.json?.data?.code
ok(Boolean(refCode), `buyer1 referral code ${refCode}`)
rc = await buyer3('POST', '/api/referrals/claim', { referralCode: refCode })
ok(rc.status === 200 || rc.status === 201, 'buyer3 claims the referral welcome', JSON.stringify(rc.json)?.slice(0, 120))
const welcomeRow = await db.userCoupons.findFirst({ where: { code: { startsWith: 'WELCOME-' }, status: 'active' } })
ok(!!welcomeRow && welcomeRow.savingsBDT === 200 && welcomeRow.minOrderBDT === 1000, 'WELCOME voucher row: fixed ৳200, min ৳1,000')
rv = await buyer3('POST', '/api/coupons/validate', { code: welcomeRow.code, orderAmount: 500 })
ok(rv.status === 400 && String(rv.json?.error || '').includes('Minimum order amount is 1000'), 'validate: WELCOME below minimum → 400')
ro = await buyer3('POST', '/api/orders', { items: [{ productId, quantity: 12 }], couponCode: welcomeRow.code })
ok(ro.status === 201 && Math.abs(ro.json?.data?.couponApplied?.discount - 200) < 0.01, 'referral voucher: ৳200 off a ৳1,200 order', JSON.stringify(ro.json?.data?.couponApplied))

// ── free-delivery prize (lucky spin's RNG deal — row seeded verbatim to the
//    spin writer's shape; the WRITE path under test is the order engine) ──
await db.userCoupons.create({
  data: { userId: b1Id, couponId: 'spin-win', code: 'SPIN-300-T144', title: 'Lucky Wheel: Free Cargo Delivery', discountStyle: 'free-shipping', discountLabel: 'Free Cargo Delivery', status: 'active', validUntil: new Date(Date.now() + 7 * day), savingsBDT: 300, minOrderBDT: 1200, categoryLabel: 'Lucky Spin', categoryColor: '#E53935' },
})
ro = await buyer1('POST', '/api/orders', { items: [{ productId, quantity: 15 }], couponCode: 'SPIN-300-T144' })
ok(ro.status === 409 && String(ro.json?.error || '').includes('needs a shipping method'), 'free-delivery voucher with NO shipping choice → 409 (honest refusal)', JSON.stringify(ro.json)?.slice(0, 160))
ok((await db.userCoupons.findFirst({ where: { code: 'SPIN-300-T144' } })).status === 'active', 'rollback protection: the voucher was NOT consumed by the refused order')
ro = await buyer1('POST', '/api/orders', { items: [{ productId, quantity: 15 }], couponCode: 'SPIN-300-T144', shippingAddressId: addressId, shippingDistrict: 'Dhaka', shippingChoices: [{ supplierId, methodId: steadyId }] })
ok(ro.status === 201, 'free-delivery voucher WITH a shipping choice → 201', JSON.stringify(ro.json)?.slice(0, 200))
ok(Math.abs((ro.json?.data?.shippingDiscount?.amount ?? 0) - 300) < 0.01, 'shipping discount: min(৳300 voucher, ৳420 quoted fee) = ৳300', JSON.stringify(ro.json?.data?.shippingDiscount))
const ord3 = await db.orders.findUnique({ where: { id: ro.json?.data?.orderId ?? ro.json?.id } })
ok(ord3 && Math.abs(ord3.totalAmount - 1620) < 0.01, 'order total: 1,500 goods + 420 shipping − 300 delivery voucher = ৳1,620', JSON.stringify({ total: ord3?.totalAmount }))
ok((await db.userCoupons.findFirst({ where: { code: 'SPIN-300-T144' } })).status === 'used', 'free-delivery voucher consumed only when the benefit was real')

// ── the race: one claim voucher, two concurrent orders ──
await buyer1('POST', '/api/coupons/claim', { code: 'T144RACE' })
const [raceA, raceB] = await Promise.all([
  buyer1('POST', '/api/orders', { items: [{ productId, quantity: 3 }], couponCode: 'T144RACE' }),
  buyer1('POST', '/api/orders', { items: [{ productId, quantity: 3 }], couponCode: 'T144RACE' }),
])
// THE RACE INVARIANT: the CLAIM row is consumed exactly ONCE no matter how
// the two orders interleave. The loser either refuses (409) or — the
// documented semantics — falls through to the still-public platform row,
// whose counter counts claims AND public uses (1 claim-time + 1 use here).
// What can NEVER happen: two consumptions of the claim row, or a discount
// without a consumption behind it.
const raceClaim = await db.userCoupons.findFirst({ where: { code: 'T144RACE' } })
const racePlatform = await db.coupons.findUnique({ where: { code: 'T144RACE' } })
ok(raceA.status === 201 && raceB.status === 201, `both orders 201 — winner via the claim row, loser via the documented public fallback (got ${[raceA.status, raceB.status]})`, JSON.stringify([raceA.json?.error, raceB.json?.error]))
ok(Math.abs((raceA.json?.data?.totalAmount ?? -1) - 250) < 0.01 && Math.abs((raceB.json?.data?.totalAmount ?? -1) - 250) < 0.01, 'both discounts were real (each order 300 − 50)')
ok(raceClaim.status === 'used' && raceClaim.usedAt !== null, 'race: the claim row consumed EXACTLY once (status used + usedAt stamped)')
ok(racePlatform.usedCount === 2, `race: platform counter single-counted per semantics (1 claim-time + 1 public use = 2, got ${racePlatform.usedCount})`)

console.log(`\nT144 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
