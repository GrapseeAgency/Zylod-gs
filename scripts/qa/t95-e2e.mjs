/**
 * Task 95 E2E — CHECKOUT SHIPPING WIRING ("settled with supplier" dies).
 *
 * After Task 94 the zones/methods/rates book existed and was quotable, but
 * checkout still charged NOTHING to move wholesale weight and every receipt
 * said "Shipping & fees: Settled with supplier". This loop proves the whole
 * circuit end-to-end:
 *   A. back-compat — an order with NO shipping choices still lands exactly
 *      as before (shippingFee 0, subOrders.shippingCost null)
 *   B. cart path — per-supplier choices re-quoted SERVER-SIDE: weight =
 *      Σ(quantity × product.weightKg), band boundaries honored, freeAbove
 *      crossings make the leg free, method snapshot written to the subOrder,
 *      honest refusals (unknown supplier 400, uncovered weight 409,
 *      duplicate choice 400, no address 400, unweighed product 400 naming it)
 *   C. coupon × shipping — the discount eats GOODS, shipping rides on top
 *   D. wallet × shipping — the wallet pays goods + shipping (payments row
 *      amount proves the Task-56 math reads the shipping-inclusive total)
 *   E. direct path — create-direct carries shippingMethodId through the
 *      same server-truth quote
 *   F. payment math pairing — buyer payment-submit defaults to the
 *      shipping-inclusive total; seller verify marks the order paid
 *   G. audit trail — every chosen leg audited with method/price/weight
 *
 * Run: bun scripts/qa/t95-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
function ok(cond, label, extra = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.95.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    for (let attempt = 0; attempt < 7; attempt++) {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          'X-Forwarded-For': ip,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      const setCookie = res.headers.getSetCookie?.() ?? []
      for (const c of setCookie) {
        const pair = c.split(';')[0]
        if (pair) cookie = cookie ? `${cookie}; ${pair}` : pair
      }
      const json = await res.json().catch(() => null)
      if (res.status !== 429) return { status: res.status, json }
      // Back-off MUST clear a 60s rolling window: 10+20+30+40+50+60 = 210s.
      await sleep(10_000 * (attempt + 1))
    }
    return { status: 429, json: null }
  }
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA95 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA95 Works ${email.slice(7, 14)}` } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json)}`)
    await sleep(4000 * (attempt + 1))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't95-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa95-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa95-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa95-buyer@qa.local', PASSWORD)
  console.log('  users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA95 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id

  // Product A: 8 kg per purchasable unit, ৳1000 each.
  const pA = await seller('POST', '/api/supplier/products', {
    name: 'QA95 Heavy Cast Iron Press', description: 'QA95 8kg each, bulk kitchens', categoryId, unit: 'pcs',
    weightKg: 8, moq: 1, basePrice: 1000, stockQuantity: 200,
    priceTiers: [{ minQty: 1, pricePerUnit: 1000 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productIdA = pA.json?.data?.id ?? pA.json?.id
  ok(Boolean(productIdA), 'product A (weightKg 8) created')

  // Product B: NO weight on file — honestly unquotable.
  const pB = await seller('POST', '/api/supplier/products', {
    name: 'QA95 Unweighed Goods', description: 'QA95 no weight filed', categoryId, unit: 'pcs',
    moq: 1, basePrice: 500, stockQuantity: 50,
    priceTiers: [{ minQty: 1, pricePerUnit: 500 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productIdB = pB.json?.data?.id ?? pB.json?.id
  await admin('PATCH', '/api/admin/products', { productId: productIdA, action: 'approve', reason: 'QA95' })
  await admin('PATCH', '/api/admin/products', { productId: productIdB, action: 'approve', reason: 'QA95' })

  // The buyer's supplier id as the CLIENT sees it (public product payload).
  const pubA = await makeSession()('GET', `/api/products/${productIdA}`)
  const supplierId = pubA.json?.data?.supplier?.id
  ok(Boolean(supplierId), 'public product payload carries supplier.id for the choice body', JSON.stringify(pubA.json?.data?.supplier))

  // Buyer address in the covered district.
  const addr = await buyer('POST', '/api/addresses', {
    label: 'QA95 Warehouse', addressLine1: '12 Gulshan Ave', city: 'Dhaka City',
    district: 'Dhaka', postalCode: '1212', contactName: 'QA95 Buyer', contactPhone: '01700000000',
    country: 'Bangladesh', isDefault: true,
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  ok(Boolean(addressId), 'buyer address created (district Dhaka)', JSON.stringify(addr.json))

  // The rate book (Task 94 admin circuit):
  //   Steady: [0,10) 140 · [10,50) 420 · [50,∞) 900
  //   Swift:  [0,50) 250 — freeAbove 5000 (free crossings at ≥ 5000 subtotal)
  const zone = await admin('POST', '/api/admin/shipping/zones', { name: 'Dhaka Metro', districts: ['Dhaka'] })
  const zoneId = zone.json?.data?.id
  const mSteady = await admin('POST', '/api/admin/shipping/methods', { name: 'Steady Courier', estimatedDays: '2-3 days' })
  const mSwift = await admin('POST', '/api/admin/shipping/methods', { name: 'Swift Air', estimatedDays: '1 day' })
  const steadyId = mSteady.json?.data?.id
  const swiftId = mSwift.json?.data?.id
  await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId: steadyId, weightMin: 0, weightMax: 10, price: 140 })
  await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId: steadyId, weightMin: 10, weightMax: 50, price: 420 })
  await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId: steadyId, weightMin: 50, weightMax: null, price: 900 })
  await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId: swiftId, weightMin: 0, weightMax: 50, price: 250, freeAbove: 5000 })
  console.log('  rate book ready')

  const placeOrder = (body) => buyer('POST', '/api/orders', body)
  const cartBody = (over = {}) => ({
    shippingAddressId: addressId,
    items: [{ productId: productIdA, quantity: over?.items?.[0]?.quantity ?? 1 }],
    ...over,
    ...(over.items ? { items: over.items } : {}),
  })

  /* ── A. back-compat: no choices → exactly the old honest shape ── */
  console.log('— A. back-compat (no shipping choices) —')
  const a = await placeOrder(cartBody({ items: [{ productId: productIdA, quantity: 2 }] }))
  ok(a.status === 201, 'order without choices → 201', JSON.stringify(a.json))
  ok(a.json?.data?.shippingFee === 0, 'shippingFee 0 when nothing chosen')
  ok(a.json?.data?.totalAmount === 2000, 'totalAmount = goods only (2 × 1000)', JSON.stringify(a.json?.data))
  const aRow = await db.orders.findUnique({ where: { id: a.json?.data?.orderId }, include: { subOrders: true } })
  ok(aRow?.subOrders?.[0]?.shippingCost === null && aRow?.subOrders?.[0]?.shippingMethodId === null, 'subOrder ships un-quoted (null cost + method) — the honest "settles with supplier"')

  /* ── B. cart path with choices — server-truth quoting ── */
  console.log('— B. cart path with per-supplier choices —')
  const b1 = await placeOrder(cartBody({ shippingChoices: [{ supplierId, methodId: steadyId }] }))
  ok(b1.status === 201, 'qty 1 (8kg) + Steady → 201', JSON.stringify(b1.json))
  ok(b1.json?.data?.shippingFee === 140, '8kg prices into the [0,10) band = ৳140', JSON.stringify(b1.json?.data))
  ok(b1.json?.data?.totalAmount === 1140, 'totalAmount = 1000 goods + 140 shipping')
  ok(b1.json?.data?.shippingLegs?.[0]?.weightKg === 8 && b1.json?.data?.shippingLegs?.[0]?.price === 140, 'response legs carry the server weight + price')
  const b1Row = await db.orders.findUnique({ where: { id: b1.json?.data?.orderId }, include: { subOrders: true } })
  ok(b1Row?.subOrders?.[0]?.shippingCost === 140 && b1Row?.subOrders?.[0]?.shippingMethodName === 'Steady Courier', 'subOrder row: shippingCost 140 + method-name snapshot', JSON.stringify(b1Row?.subOrders?.[0]?.shippingCost))

  const b2 = await placeOrder(cartBody({ items: [{ productId: productIdA, quantity: 7 }], shippingChoices: [{ supplierId, methodId: steadyId }] }))
  ok(b2.status === 201 && b2.json?.data?.shippingFee === 900, 'qty 7 (56kg) prices into the open [50,∞) band = ৳900', JSON.stringify(b2.json?.data))
  ok(b2.json?.data?.totalAmount === 7900, 'total = 7000 + 900')
  const b2OrderId = b2.json?.data?.orderId

  const b3 = await placeOrder(cartBody({ items: [{ productId: productIdA, quantity: 6 }], shippingChoices: [{ supplierId, methodId: swiftId }] }))
  ok(b3.status === 201 && b3.json?.data?.shippingFee === 0, 'qty 6 (48kg, goods 6000 ≥ freeAbove 5000) → Swift leg FREE', JSON.stringify(b3.json?.data))
  ok(b3.json?.data?.totalAmount === 6000, 'free crossing: total = goods only')
  const b3Row = await db.orders.findUnique({ where: { id: b3.json?.data?.orderId }, include: { subOrders: true } })
  ok(b3Row?.subOrders?.[0]?.shippingCost === 0 && b3Row?.subOrders?.[0]?.shippingMethodName === 'Swift Air', 'free leg persisted as cost 0 WITH the method snapshot (never dropped)')

  const b4 = await placeOrder(cartBody({ items: [{ productId: productIdA, quantity: 4 }], shippingChoices: [{ supplierId, methodId: swiftId }] }))
  ok(b4.status === 201 && b4.json?.data?.shippingFee === 250, 'qty 4 (32kg, goods 4000 < 5000) → Swift full ৳250 (one taka below the threshold pays)')

  ok((await placeOrder(cartBody({ shippingChoices: [{ supplierId: 'cuid-phantom-supplier', methodId: steadyId }] }))).status === 400, 'choice for a supplier not in the order → 400')
  const b6 = await placeOrder(cartBody({ items: [{ productId: productIdA, quantity: 7 }], shippingChoices: [{ supplierId, methodId: swiftId }] }))
  ok(b6.status === 409 && /no longer covers/i.test(String(b6.json?.error)), 'Swift does not cover 56kg → 409 (re-pick honestly)', JSON.stringify(b6.json))
  ok((await placeOrder({ shippingAddressId: addressId, items: [{ productId: productIdA, quantity: 1 }], shippingChoices: [{ supplierId, methodId: steadyId }, { supplierId, methodId: swiftId }] })).status === 400, 'duplicate supplier choice → 400')
  ok((await buyer('POST', '/api/orders', { items: [{ productId: productIdA, quantity: 1 }], shippingChoices: [{ supplierId, methodId: steadyId }] })).status === 400, 'choices without an address → 400')
  const b9 = await placeOrder({ shippingAddressId: addressId, items: [{ productId: productIdB, quantity: 1 }], shippingChoices: [{ supplierId, methodId: steadyId }] })
  ok(b9.status === 400 && String(b9.json?.error).includes('QA95 Unweighed Goods'), 'unweighed product + choice → 400 NAMING the product', JSON.stringify(b9.json))

  /* ── C. coupon × shipping ── */
  console.log('— C. coupon discounts GOODS, shipping rides on top —')
  const now = new Date()
  await db.coupons.create({
    data: {
      code: 'QA95SAVE1K', discountType: 'fixed', discountPercent: 1000, minOrderAmount: 5000,
      validFrom: new Date(now.getTime() - 86_400_000), validUntil: new Date(now.getTime() + 86_400_000),
      usageLimit: 10, isActive: true,
    },
  })
  const c1 = await placeOrder({
    shippingAddressId: addressId,
    couponCode: 'QA95SAVE1K',
    items: [{ productId: productIdA, quantity: 8 }],
    shippingChoices: [{ supplierId, methodId: steadyId }],
  })
  ok(c1.status === 201, 'qty 8 (64kg, goods 8000, coupon −1000) + Steady 900 → 201', JSON.stringify(c1.json))
  ok(c1.json?.data?.couponApplied?.discount === 1000, 'coupon discount lands on goods', JSON.stringify(c1.json?.data?.couponApplied))
  ok(c1.json?.data?.totalAmount === 7900, 'total = (8000 − 1000) goods + 900 shipping = 7900', JSON.stringify(c1.json?.data))
  ok(c1.json?.data?.shippingFee === 900, 'shippingFee untouched by the coupon')

  /* ── D. wallet × shipping ── */
  console.log('— D. wallet pays goods + shipping (Task-56 math reads the real total) —')
  const buyerUser = await db.users.findUnique({ where: { email: 'qa95-buyer@qa.local' } })
  await db.wallets.create({ data: { userId: buyerUser.id, balance: 5000 } })
  const d1 = await placeOrder({ shippingAddressId: addressId, items: [{ productId: productIdA, quantity: 1 }], shippingChoices: [{ supplierId, methodId: steadyId }], payWithWallet: true })
  ok(d1.status === 201 && d1.json?.data?.paymentStatus === 'paid', 'wallet-covered order (1140 ≤ 5000) lands PAID', JSON.stringify(d1.json?.data))
  const d1Pay = await db.payments.findFirst({ where: { orderId: d1.json?.data?.orderId } })
  ok(d1Pay?.amount === 1140 && d1Pay?.status === 'success', 'payments row amount = 1000 + 140 — shipping inside the verified money', JSON.stringify({ amount: d1Pay?.amount }))
  const d1Wallet = await db.wallets.findFirst({ where: { userId: buyerUser.id } })
  ok(d1Wallet?.balance === 3860, 'wallet debited the shipping-inclusive total (5000 → 3860)', JSON.stringify({ balance: d1Wallet?.balance }))
  await db.wallets.update({ where: { id: d1Wallet.id }, data: { balance: 500 } })
  const d2 = await placeOrder({ shippingAddressId: addressId, items: [{ productId: productIdA, quantity: 1 }], shippingChoices: [{ supplierId, methodId: steadyId }], payWithWallet: true })
  ok(d2.status === 402, 'wallet below goods+shipping → honest 402', JSON.stringify(d2.json))

  /* ── E. direct path (create-direct) ── */
  console.log('— E. buy-now direct path —')
  const e1 = await buyer('POST', '/api/orders/create-direct', { productId: productIdA, quantity: 2, shippingAddressId: addressId })
  ok(e1.status === 201 && e1.json?.data?.shippingFee === 0 && e1.json?.data?.totalAmount === 2000, 'direct without method → shippingFee 0 (back-compat)', JSON.stringify(e1.json?.data))
  const e2 = await buyer('POST', '/api/orders/create-direct', { productId: productIdA, quantity: 6, shippingAddressId: addressId, shippingMethodId: swiftId })
  ok(e2.status === 201 && e2.json?.data?.shippingFee === 0 && e2.json?.data?.totalAmount === 6000, 'direct + Swift at goods 6000 ≥ 5000 → FREE leg, total 6000', JSON.stringify(e2.json?.data))
  const e2Row = await db.orders.findUnique({ where: { id: e2.json?.data?.orderId }, include: { subOrders: true } })
  ok(e2Row?.subOrders?.[0]?.shippingCost === 0 && e2Row?.subOrders?.[0]?.shippingMethodName === 'Swift Air', 'direct free leg persisted with method snapshot')
  const e3 = await buyer('POST', '/api/orders/create-direct', { productId: productIdA, quantity: 2, shippingAddressId: addressId, shippingMethodId: steadyId })
  ok(e3.status === 201 && e3.json?.data?.shippingFee === 420 && e3.json?.data?.totalAmount === 2420, 'direct 16kg → second band ৳420, total 2420', JSON.stringify(e3.json?.data))
  const e4 = await buyer('POST', '/api/orders/create-direct', { productId: productIdA, quantity: 7, shippingAddressId: addressId, shippingMethodId: 'cuid-phantom-method' })
  ok(e4.status === 409, 'direct phantom methodId → 409', JSON.stringify(e4.json))
  const e5 = await buyer('POST', '/api/orders/create-direct', { productId: productIdB, quantity: 1, shippingAddressId: addressId, shippingMethodId: steadyId })
  ok(e5.status === 400 && String(e5.json?.error).includes('QA95 Unweighed Goods'), 'direct on unweighed product + method → 400 naming it', JSON.stringify(e5.json))
  const e6 = await buyer('POST', '/api/orders/create-direct', { productId: productIdA, quantity: 1, shippingMethodId: steadyId })
  ok(e6.status === 400, 'direct method without address → 400')

  /* ── F. payment math pairing (Task 56) ── */
  console.log('— F. payment math reads the shipping-inclusive total —')
  const f1 = await buyer('POST', `/api/orders/${b2OrderId}/payment-submit`, {
    method: 'mobile_banking', brand: 'bKash', transactionId: 'TRX95SHIP00001', senderNumber: '01711223344',
  })
  ok(f1.status === 201, 'buyer submits payment credentials for the 7900 order → 201', JSON.stringify(f1.json))
  const f1Pay = await db.payments.findFirst({ where: { orderId: b2OrderId } })
  ok(f1Pay?.amount === 7900 && f1Pay?.status === 'pending', 'submitted payment defaults to the FULL shipping-inclusive total (7900), status pending', JSON.stringify({ amount: f1Pay?.amount, status: f1Pay?.status }))
  const f2 = await seller('POST', `/api/seller/payments/${f1Pay.id}/verify`, { action: 'verify', note: 'QA95 verified reference' })
  ok(f2.status === 200, 'seller verifies → 200', JSON.stringify(f2.json))
  const f2Order = await db.orders.findUnique({ where: { id: b2OrderId } })
  ok(f2Order?.paymentStatus === 'paid', 'order lands paid — goods + shipping both covered', JSON.stringify({ paymentStatus: f2Order?.paymentStatus }))

  /* ── G. audit trail + aggregates ── */
  console.log('— G. audit trail —')
  const audited = await db.auditLogs.groupBy({ by: ['action'], where: { action: 'shipping_selected' }, _count: { _all: true } })
  const legCount = audited.find((r) => r.action === 'shipping_selected')?._count._all ?? 0
  ok(legCount === 8, 'exactly 8 audited shipping_selected legs (B1-4, C, D1, E2, E3)', JSON.stringify(audited))
  const sampleAudit = await db.auditLogs.findFirst({ where: { action: 'shipping_selected' }, orderBy: { createdAt: 'desc' } })
  const meta = JSON.parse(sampleAudit?.metadata ?? '{}')
  ok(meta.methodId && typeof meta.price === 'number' && typeof meta.weightKg === 'number' && meta.district === 'Dhaka', 'audit metadata carries method/price/weight/district', JSON.stringify(meta))
  const ordersWithFee = await db.orders.findMany({ where: { shippingFee: { gt: 0 } }, include: { subOrders: true } })
  const sumsHonest = ordersWithFee.every((o) =>
    Math.abs(o.subOrders.reduce((s, so) => s + (so.shippingCost ?? 0), 0) - o.shippingFee) < 0.001
  )
  ok(sumsHonest && ordersWithFee.length >= 4, 'every shipping-fee order: subOrders.shippingCost sums to orders.shippingFee', JSON.stringify(ordersWithFee.map((o) => ({ fee: o.shippingFee }))))

  console.log(`\n=== t95 RESULT: ${PASS} PASS / ${FAIL} FAIL ===`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('DRILL CRASH:', e)
  try { await db.$disconnect() } catch {}
  process.exit(1)
})
