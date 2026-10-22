// Task 141 E2E — group-buy pools get REAL teeth. The pool page promised
// "reserved N units at the volume rate" but NOTHING honored it: anyone could
// create a campaign at any price for any product, and completion did nothing.
// Now: supplier-owned creation (audited), atomic joins that cannot over-promise,
// and the ORDER ENGINE prices participants' lines at the pool rate up to their
// reservation — consumed once, never double-spent. Run on a FRESH wipe.
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T141 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't141-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), seller2 = makeSession(), buyer1 = makeSession(), buyer2 = makeSession(), buyer3 = makeSession()
ok(await reg(admin, 'admin', `t141-admin-${STAMP}@t141.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t141-seller-${STAMP}@t141.test`, PW, 'T141 Pool Depot'), 'seller (pool owner) registered')
ok(await reg(seller2, 'supplier', `t141-s2-${STAMP}@t141.test`, PW, 'T141 Other Depot'), 'seller2 registered')
ok(await reg(buyer1, 'buyer', `t141-b1-${STAMP}@t141.test`, PW), 'buyer1 registered')
ok(await reg(buyer2, 'buyer', `t141-b2-${STAMP}@t141.test`, PW), 'buyer2 registered')
ok(await reg(buyer3, 'buyer', `t141-b3-${STAMP}@t141.test`, PW), 'buyer3 registered')

let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
ok(Boolean(categoryId), 'category ready')

const prodPayload = (name, price, extra = {}) => ({
  name, description: 'drill', categoryId, unit: 'pcs', moq: 10,
  basePrice: price, currency: 'BDT', stockQuantity: 1000,
  priceTiers: [{ minQty: 10, pricePerUnit: price }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], ...extra,
})
let r = await seller('POST', '/api/supplier/products', prodPayload('T141 Pool Hoodie', 1000))
const productId = r.json?.data?.id ?? r.json?.id
ok(Boolean(productId), 'product created at ৳1,000 (MOQ 10)')
const appr1 = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T141' })
ok(appr1.status === 200, 'product approved', JSON.stringify(appr1.json)?.slice(0, 150))
let foreignProductId = null
for (let a = 0; a < 4 && !foreignProductId; a++) {
  r = await seller2('POST', '/api/supplier/products', prodPayload('T141 Foreign Goods', 500))
  foreignProductId = r.json?.data?.id ?? r.json?.id ?? null
  if (!foreignProductId) await sleep(8000)
}
ok(Boolean(foreignProductId), 'seller2 product created', JSON.stringify(r.json)?.slice(0, 150))
if (foreignProductId) {
  let appr2 = null
  for (let a = 0; a < 4; a++) {
    appr2 = await admin('PATCH', '/api/admin/products', { productId: foreignProductId, action: 'approve', reason: 'T141' })
    if (appr2.status === 200) break
    await sleep(8000)
  }
  ok(appr2.status === 200, 'seller2 product approved', JSON.stringify(appr2.json)?.slice(0, 150))
}

// ── campaign creation: ownership + sanity gates ──
ok((await makeSession()('POST', '/api/group-buy', { productId, targetQty: 100, discountedPrice: 800 })).status === 401, 'create: anon → 401')
r = await buyer1('POST', '/api/group-buy', { productId, targetQty: 100, discountedPrice: 800 })
ok(r.status === 403 && r.json?.code === 'SUPPLIER_PROFILE_REQUIRED', 'create: buyer → 403 (pools are seller pricing commitments)')
r = await seller('POST', '/api/group-buy', { productId: foreignProductId, targetQty: 100, discountedPrice: 400 })
ok(r.status === 403, 'create: ANOTHER seller product → 403 (no fake pools on foreign goods)')
r = await seller('POST', '/api/group-buy', { productId, targetQty: 100, discountedPrice: 1500 })
ok(r.status === 422, 'create: pool rate ABOVE factory rate → 422 (that would be a fake discount)', JSON.stringify(r.json)?.slice(0, 120))
r = await seller('POST', '/api/group-buy', { productId, targetQty: 5, discountedPrice: 800 })
ok(r.status === 422, 'create: target below MOQ → 422')
r = await seller('POST', '/api/group-buy', { productId: 'nonexistent999', targetQty: 100, discountedPrice: 800 })
ok(r.status === 404, 'create: phantom product → 404')
r = await seller('POST', '/api/group-buy', { productId, targetQty: 100, discountedPrice: 800, durationHours: 48 })
ok(r.status === 201, 'seller opens a REAL pool: 100 units at ৳800', JSON.stringify(r.json)?.slice(0, 120))
const campaignId = r.json?.data?.id
await sleep(300)
ok(await db.auditLogs.findFirst({ where: { action: 'group_buy_created', entityId: campaignId } }).then(Boolean), 'pool opening leaves a REAL audit row (savings% evidence)')

// ── joins: atomic, capped, same-row top-up ──
ok((await makeSession()('POST', `/api/group-buy/${campaignId}`, { quantity: 10 })).status === 401, 'join: anon → 401')
ok((await buyer1('POST', `/api/group-buy/${campaignId}`, { quantity: 0 })).status === 400, 'join: quantity 0 → 400')
r = await buyer1('POST', `/api/group-buy/${campaignId}`, { quantity: 60 })
ok(r.status === 201 && r.json?.data?.newTotalQty === 60, 'buyer1 reserves 60')
r = await buyer1('POST', `/api/group-buy/${campaignId}`, { quantity: 40 })
ok(r.status === 201 && r.json?.data?.newTotalQty === 100 && r.json?.data?.poolCompleted === true, 'buyer1 tops up 40 → pool FILLS (same row: one reservation per buyer)')
const part1 = await db.groupBuyParticipants.findUnique({ where: { campaignId_userId: { campaignId, userId: (await db.users.findUnique({ where: { email: `t141-b1-${STAMP}@t141.test` } })).id } } })
ok(part1 && part1.quantity === 100 && part1.redeemedQty === 0, 'ONE participant row: quantity 100, redeemed 0')
ok((await db.groupBuyCampaigns.findUnique({ where: { id: campaignId } })).status === 'completed', 'pool status flips to completed')
r = await buyer2('POST', `/api/group-buy/${campaignId}`, { quantity: 1 })
ok(r.status === 409, 'join a FILLED pool → 409 with the real numbers (cannot over-promise)', JSON.stringify(r.json)?.slice(0, 120))
await sleep(600)
const filledNotifs = await db.notifications.count({ where: { OR: [{ title: { startsWith: 'Pool filled' } }, { title: { startsWith: 'Group pool filled' } }] } })
ok(filledNotifs >= 2, `pool-fill notifications fanned out (buyer + seller got real rows: ${filledNotifs})`)

// ── THE TEETH: the order engine honors the pool rate ──
r = await buyer1('POST', '/api/orders', { items: [{ productId, quantity: 40 }] })
ok(r.status === 201 || r.status === 200, 'buyer1 orders 40 units')
const ord1 = r.json?.data?.orderId
ok(r.json?.data?.groupPoolDiscount?.amount === 8000, 'honest receipt: pool discount ৳8,000 (40 × ৳200 saved)', JSON.stringify(r.json?.data?.groupPoolDiscount))
const ord1row = await db.orders.findUnique({ where: { id: ord1 }, include: { subOrders: { include: { items: true } } } })
const line1 = ord1row.subOrders[0].items[0]
ok(Math.abs(line1.totalPrice - 32000) < 0.01 && Math.abs(line1.unitPrice - 800) < 0.01, 'line priced at the POOL RATE (৳800 × 40 = ৳32,000)', JSON.stringify({ unitPrice: line1.unitPrice, total: line1.totalPrice }))
const part1b = await db.groupBuyParticipants.findUnique({ where: { campaignId_userId: { campaignId, userId: part1.userId } } })
ok(part1b.redeemedQty === 40, 'reservation consumed: redeemedQty 40 of 100')
const esc1 = await db.escrowAccounts.count({ where: { orderId: ord1 } })
ok(esc1 === 0, 'no escrow while payment is pending (money doctrine intact)')
await buyer1('POST', `/api/orders/${ord1}/payment-submit`, { method: 'mobile_banking', transactionId: `T141A${STAMP}` })
const pay1 = (await db.payments.findFirst({ where: { orderId: ord1 } }))
await seller('POST', `/api/seller/payments/${pay1.id}/verify`, { action: 'verify' })
ok((await db.orders.findUnique({ where: { id: ord1 } })).paymentStatus === 'paid', 'order paid through the normal rail')

// ── straddle: order MORE than the remaining reservation → blended line ──
r = await buyer1('POST', '/api/orders', { items: [{ productId, quantity: 80 }] })
const ord2 = r.json?.data?.orderId
ok(r.json?.data?.groupPoolDiscount?.amount === 12000, 'straddle receipt: only the 60 reserved units got the pool rate (60 × ৳200 = ৳12,000)', JSON.stringify(r.json?.data?.groupPoolDiscount))
const ord2row = await db.orders.findUnique({ where: { id: ord2 }, include: { subOrders: { include: { items: true } } } })
const line2 = ord2row.subOrders[0].items[0]
ok(Math.abs(line2.totalPrice - 68000) < 0.01 && Math.abs(line2.unitPrice - 850) < 0.01, 'blended line: 60@800 + 20@1000 = ৳68,000 (unit ৳850)', JSON.stringify({ unitPrice: line2.unitPrice, total: line2.totalPrice }))
const part1c = await db.groupBuyParticipants.findUnique({ where: { campaignId_userId: { campaignId, userId: part1.userId } } })
ok(part1c.redeemedQty === 100, 'reservation capped at 100 (never overspent)')

// ── no third bite: the pool is consumed ──
r = await buyer1('POST', '/api/orders', { items: [{ productId, quantity: 10 }] })
ok(r.json?.data?.groupPoolDiscount === null, 'fully-consumed reservation grants NOTHING further')
const ord3row = await db.orders.findUnique({ where: { id: r.json?.data?.orderId }, include: { subOrders: { include: { items: true } } } })
ok(Math.abs(ord3row.subOrders[0].items[0].totalPrice - 10000) < 0.01, 'third order prices by the canonical rule (৳10,000)')

// ── non-participants never get the rate ──
r = await buyer3('POST', '/api/orders', { items: [{ productId, quantity: 10 }] })
ok(r.json?.data?.groupPoolDiscount === null, 'buyer3 (never joined) pays full price')
const ord4row = await db.orders.findUnique({ where: { id: r.json?.data?.orderId }, include: { subOrders: { include: { items: true } } } })
ok(Math.abs(ord4row.subOrders[0].items[0].totalPrice - 10000) < 0.01, 'non-participant line at rule price (৳10,000)')

// ── cancelled/refunded orders do NOT return pool credit (documented scope:
//    redemption tracks units ordered; refund flows are the Task 140 rails) ──
const refundAuditCount = await db.auditLogs.count({ where: { action: 'group_buy_created' } })
ok(refundAuditCount >= 1, 'audit trail carries the pool opening')

console.log(`\nT141 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
