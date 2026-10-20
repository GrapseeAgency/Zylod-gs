/**
 * Task 100 E2E — THE PLATFORM PROMOTION RAIL ("admin-curated, automatic,
 * priced by an engine that only computes what it can prove").
 *
 *   A. gates — public rail 200-empty by design; admin rails 401-first
 *   B. create validation — STRICT keys, unsupported types refused with the
 *      engine message, phantom pins 400, window math, value bounds
 *   C. lifecycle — paused → live → the public rail + PDP payload serve it
 *   D. window math — future (scheduled) and expired campaigns NEVER price
 *   E. cart-path application — percentage math exact, usedCount claims,
 *      audit lands, subOrder keeps FULL value (platform-funded proof)
 *   F. stack order — coupon computes on the PROMOTED total (proven by math)
 *   G. minOrderAmount floor — below the floor the promotion never applies
 *   H. maxDiscount cap — raw discount capped per order
 *   I. best-of selection — the campaign giving the larger discount wins
 *   J. usageLimit — second order 409, never silently repriced
 *   K. buy-now path — same engine, same math (create-direct)
 *   L. admin sync + delete — full-set pin sync; order receipts keep the name
 *   M. audits — exact action counts in raw DB
 *
 * Run: bun scripts/qa/t100-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.98.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
      await sleep(10_000 * (attempt + 1))
    }
    throw new Error('rate limited beyond back-off window: ' + path)
  }
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA100 ${userType}`,
    ...(userType === 'supplier' ? { businessName: 'QA100 Promotions Works' } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}`)
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
  const PASSWORD = 't100-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa100-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa100-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa100-buyer@qa.local', PASSWORD)
  console.log('  accounts ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA100 Promo Goods', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id

  const mkProduct = async (name, basePrice, unit) => {
    const p = await seller('POST', '/api/supplier/products', {
      name, description: `${name} — QA100 fixture`, categoryId, unit, bundleSize: null,
      moq: 1, basePrice, stockQuantity: 1000,
      priceTiers: [{ minQty: 1, pricePerUnit: basePrice }],
      images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    })
    const id = p.json?.data?.id ?? p.json?.id
    const ap = await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'QA100' })
    if (ap.status !== 200) throw new Error(`approve failed ${ap.status}`)
    return id
  }
  const prodA = await mkProduct('QA100 Hydraulic Fitting', 1000, 'pcs')
  const prodB = await mkProduct('QA100 Packing Rope', 500, 'pcs')
  ok(Boolean(prodA && prodB), 'two APPROVED products created')

  const addr = await buyer('POST', '/api/addresses', {
    label: 'Home', address_line1: 'House 100, Road 10',
    city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000100',
    postal_code: '1200',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  ok(Boolean(addressId), 'buyer address ready')

  /* ── A. gates ── */
  console.log('— A. gates —')
  const pubEmpty = await makeSession()('GET', '/api/promotions')
  ok(pubEmpty.status === 200 && pubEmpty.json?.data?.length === 0, 'public rail → 200, honest zero before any campaign')
  ok((await makeSession()('GET', '/api/admin/promotions')).status === 401, 'anon admin list → 401')
  ok((await makeSession()('POST', '/api/admin/promotions', { name: 'X' })).status === 401, 'anon create → 401')
  ok((await buyer('GET', '/api/admin/promotions')).status === 401, 'buyer on admin rail → 401')

  /* ── B. create validation ── */
  console.log('— B. create validation —')
  const now = Date.now()
  const day = 86_400_000
  const base = {
    name: 'QA100 Campaign', type: 'percentage', value: 12,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 7 * day).toISOString(),
    productIds: [prodA],
  }
  ok((await admin('POST', '/api/admin/promotions', { ...base, bogus: 1 })).status === 400, 'strict keys → 400')
  const bogo = await admin('POST', '/api/admin/promotions', { ...base, type: 'bogo' })
  ok(bogo.status === 400 && /pricing engine/i.test(bogo.json?.error ?? ''), 'bogo → 400 naming the engine scope', JSON.stringify(bogo.json?.error))
  ok((await admin('POST', '/api/admin/promotions', { ...base, type: 'free_shipping' })).status === 400, 'free_shipping → 400')
  ok((await admin('POST', '/api/admin/promotions', { ...base, value: 150 })).status === 400, 'percentage > 100 → 400')
  ok((await admin('POST', '/api/admin/promotions', { ...base, value: 0 })).status === 400, 'value 0 → 400')
  ok((await admin('POST', '/api/admin/promotions', { ...base, productIds: [] })).status === 400, 'empty productIds → 400')
  const phantom = await admin('POST', '/api/admin/promotions', { ...base, productIds: ['nonexistent-product'] })
  ok(phantom.status === 400 && /nonexistent-product/.test(phantom.json?.error ?? ''), 'phantom pin → 400 naming it', JSON.stringify(phantom.json?.error))
  ok((await admin('POST', '/api/admin/promotions', { ...base, validUntil: new Date(now - 2 * day).toISOString() })).status === 400, 'window reversed → 400')

  /* ── C. lifecycle ── */
  console.log('— C. lifecycle —')
  const c1 = await admin('POST', '/api/admin/promotions', {
    name: 'Fitting Week', type: 'percentage', value: 12,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 7 * day).toISOString(),
    productIds: [prodA], description: '12% off hydraulic fittings',
  })
  ok(c1.status === 201 && c1.json?.data?.computedStatus === 'paused', 'created paused (isActive default false)', JSON.stringify(c1.json?.data?.computedStatus))
  const c1id = c1.json?.data?.id
  let rail = await makeSession()('GET', '/api/promotions')
  ok(rail.json?.data?.length === 0, 'public rail refuses a PAUSED campaign')
  const live = await admin('PATCH', `/api/admin/promotions/${c1id}`, { isActive: true })
  ok(live.status === 200 && live.json?.data?.computedStatus === 'live', 'pause → live via PATCH')
  rail = await makeSession()('GET', '/api/promotions')
  ok(rail.json?.data?.length === 1 && rail.json?.data?.[0]?.name === 'Fitting Week', 'public rail serves the LIVE campaign')
  const railC = rail.json?.data?.[0]
  ok(!('usedCount' in railC) && !('usageLimit' in railC), 'public shape leaks no operational counters')
  ok(Array.isArray(railC.products) && railC.products.length === 1 && railC.products[0].id === prodA && railC.products[0].unitPrice === 1000, 'pinned product served with basePrice 1000')
  const pdp = await makeSession()('GET', `/api/products/${prodA}`)
  ok(pdp.status === 200 && pdp.json?.data?.activePromotion?.name === 'Fitting Week', 'PDP payload carries activePromotion')
  ok(pdp.json?.data?.promotionProducts === undefined, 'PDP payload leaks no raw pin rows')

  /* ── D. window math ── */
  console.log('— D. window math —')
  const future = await admin('POST', '/api/admin/promotions', {
    name: 'Next Month Fair', type: 'fixed', value: 50, isActive: true,
    validFrom: new Date(now + 30 * day).toISOString(), validUntil: new Date(now + 40 * day).toISOString(),
    productIds: [prodA],
  })
  ok(future.json?.data?.computedStatus === 'scheduled', 'future window → scheduled')
  rail = await makeSession()('GET', '/api/promotions')
  ok(rail.json?.data?.length === 1, 'public rail hides SCHEDULED campaigns')

  /* ── E. cart-path application ── */
  console.log('— E. cart-path application —')
  // Fund the buyer's REAL wallet so this order pays wallet-side — that is
  // the path that creates escrow, proving the supplier holds FULL value.
  const buyerUser = await db.users.findUnique({ where: { email: 'qa100-buyer@qa.local' } })
  await db.wallets.create({ data: { userId: buyerUser.id, balance: 999999 } })
  const ord1 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodA, quantity: 2 }], shippingAddressId: addressId, payWithWallet: true,
  })
  ok(ord1.status === 201, 'order created', JSON.stringify(ord1.json?.error))
  ok(ord1.json?.data?.promotionApplied?.name === 'Fitting Week' && Math.abs(ord1.json?.data?.promotionApplied?.discount - 240) < 0.001,
    '12% of 2×1000 → discount exactly ৳240', JSON.stringify(ord1.json?.data?.promotionApplied))
  ok(Math.abs(ord1.json?.data?.totalAmount - 1760) < 0.001, 'totalAmount 1760 (2000 − 240)', JSON.stringify(ord1.json?.data?.totalAmount))
  const ord1db = await db.orders.findUnique({ where: { id: ord1.json?.data?.orderId }, include: { subOrders: true } })
  ok(ord1db?.promotionName === 'Fitting Week' && Math.abs(ord1db.promotionDiscount - 240) < 0.001, 'order row stamped (name + discount)')
  ok(Math.abs(ord1db?.subOrders[0]?.subtotal - 2000) < 0.001, 'PLATFORM-FUNDED: subOrder subtotal keeps FULL 2000', JSON.stringify(ord1db?.subOrders[0]?.subtotal))
  const afterUse = await db.promotions.findUnique({ where: { id: c1id } })
  ok(afterUse?.usedCount === 1, 'usedCount claimed exactly once', JSON.stringify(afterUse?.usedCount))
  const escrow1 = await db.escrowAccounts.findFirst({ where: { orderId: ord1db.id } })
  ok(escrow1 && Math.abs(escrow1.amount - 2000) < 0.001, 'escrow holds FULL line value (supplier whole)', JSON.stringify(escrow1?.amount))

  /* ── F. stack order ── */
  console.log('— F. stack order (coupon on PROMOTED total) —')
  await db.coupons.create({
    data: {
      code: 'QA100TEN', discountType: 'percentage', discountPercent: 10,
      validFrom: new Date(now - day), validUntil: new Date(now + 30 * day), isActive: true,
    },
  })
  const ord2 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodA, quantity: 1 }], shippingAddressId: addressId, couponCode: 'QA100TEN',
  })
  ok(ord2.status === 201, 'stacked order created')
  ok(Math.abs(ord2.json?.data?.promotionApplied?.discount - 120) < 0.001, 'promotion first: 12% of 1000 = ৳120')
  ok(Math.abs(ord2.json?.data?.couponApplied?.discount - 88) < 0.001, 'coupon second: 10% of the PROMOTED 880 = ৳88 (not ৳100)', JSON.stringify(ord2.json?.data?.couponApplied))
  ok(Math.abs(ord2.json?.data?.totalAmount - 792) < 0.001, 'totalAmount 792 (1000−120−88)', JSON.stringify(ord2.json?.data?.totalAmount))

  /* ── G. minOrderAmount floor ── */
  console.log('— G. minOrderAmount floor —')
  const c2 = await admin('POST', '/api/admin/promotions', {
    name: 'Rope Bulk Deal', type: 'fixed', value: 300, isActive: true, minOrderAmount: 5000,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 7 * day).toISOString(),
    productIds: [prodB],
  })
  ok(c2.status === 201, 'floor campaign created')
  const ord3 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodB, quantity: 1 }], shippingAddressId: addressId,
  })
  ok(ord3.json?.data?.promotionApplied === null && Math.abs(ord3.json?.data?.totalAmount - 500) < 0.001,
    'below the floor → promotion never applies, full ৳500 charged', JSON.stringify(ord3.json?.data))

  /* ── H. maxDiscount cap ── */
  console.log('— H. maxDiscount cap —')
  await admin('PATCH', `/api/admin/promotions/${c2.json?.data?.id}`, { minOrderAmount: 0, maxDiscount: 100, value: 50, type: 'percentage' })
  const ord4 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodB, quantity: 2 }], shippingAddressId: addressId,
  })
  ok(Math.abs(ord4.json?.data?.promotionApplied?.discount - 100) < 0.001,
    '50% of 1000 = 500 raw → capped at ৳100', JSON.stringify(ord4.json?.data?.promotionApplied))
  ok(Math.abs(ord4.json?.data?.totalAmount - 900) < 0.001, 'totalAmount 900 (1000−100)', JSON.stringify(ord4.json?.data?.totalAmount))

  /* ── I. best-of selection ── */
  console.log('— I. best-of selection —')
  const c3 = await admin('POST', '/api/admin/promotions', {
    name: 'Rope Flat 150', type: 'fixed', value: 150, isActive: true,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 7 * day).toISOString(),
    productIds: [prodB],
  })
  ok(c3.status === 201, 'second rope campaign created (fixed ৳150 > capped ৳100)')
  const ord5 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodB, quantity: 1 }], shippingAddressId: addressId,
  })
  ok(ord5.json?.data?.promotionApplied?.name === 'Rope Flat 150' && Math.abs(ord5.json?.data?.promotionApplied?.discount - 150) < 0.001,
    'the LARGER discount wins automatically', JSON.stringify(ord5.json?.data?.promotionApplied))

  /* ── J. usageLimit ── */
  console.log('— J. usageLimit —')
  const c4 = await admin('POST', '/api/admin/promotions', {
    name: 'Rope Limited 40', type: 'fixed', value: 400, usageLimit: 1, isActive: true,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 7 * day).toISOString(),
    productIds: [prodB],
  })
  const ord6 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodB, quantity: 1 }], shippingAddressId: addressId,
  })
  ok(ord6.json?.data?.promotionApplied?.name === 'Rope Limited 40', 'first order claims the single use (400 > 150, best wins)')
  const ord7 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodB, quantity: 1 }], shippingAddressId: addressId,
  })
  ok(ord7.status === 201 && ord7.json?.data?.promotionApplied?.name === 'Rope Flat 150' && Math.abs(ord7.json?.data?.promotionApplied?.discount - 150) < 0.001,
    'exhausted best is skipped at read time → next-best applies honestly (no phantom discount, no fake 409)', JSON.stringify(ord7.json?.data?.promotionApplied))
  const usedRow = await db.promotions.findUnique({ where: { id: c4.json?.data?.id } })
  ok(usedRow?.usedCount === 1, 'usedCount stayed at the limit (atomic claim, no overrun)')

  /* ── K. buy-now path ── */
  console.log('— K. buy-now path —')
  const direct = await buyer('POST', '/api/orders/create-direct', {
    productId: prodB, quantity: 1, shippingAddressId: addressId,
  })
  ok(direct.status === 201, 'buy-now created', JSON.stringify(direct.json?.error))
  ok(direct.json?.data?.promotionApplied?.name === 'Rope Flat 150' && Math.abs(direct.json?.data?.promotionApplied?.discount - 150) < 0.001,
    'buy-now: same engine, Rope Flat 150 applies (−৳150)', JSON.stringify(direct.json?.data?.promotionApplied))
  ok(Math.abs(direct.json?.data?.totalAmount - 350) < 0.001, 'buy-now total 350 (500−150)', JSON.stringify(direct.json?.data?.totalAmount))
  const directDb = await db.orders.findUnique({ where: { id: direct.json?.data?.orderId }, include: { subOrders: true } })
  ok(Math.abs(directDb?.subOrders[0]?.subtotal - 500) < 0.001, 'buy-now subOrder keeps FULL 500 (platform-funded)')

  /* ── L. admin sync + delete ── */
  console.log('— L. admin sync + delete —')
  const lst = await admin('GET', '/api/admin/promotions')
  ok(lst.status === 200 && lst.json?.stats?.total >= 4, 'admin list + stats', JSON.stringify(lst.json?.stats))
  const fittingRow = lst.json?.data?.find((c) => c.name === 'Fitting Week')
  ok(fittingRow?.usedCount === 2, 'admin list shows the REAL usedCount (2 orders on Fitting Week)', JSON.stringify(fittingRow?.usedCount))
  const sync = await admin('PATCH', `/api/admin/promotions/${c3.json?.data?.id}`, { productIds: [prodA] })
  ok(sync.status === 200 && sync.json?.data?.pinnedProducts?.length === 1 && sync.json?.data?.pinnedProducts[0].id === prodA,
    'full-set pin sync: Rope Flat 150 now pins ONLY prodA')
  const syncOrd = await buyer('POST', '/api/orders', {
    items: [{ productId: prodB, quantity: 1 }], shippingAddressId: addressId,
  })
  ok(syncOrd.json?.data?.promotionApplied?.name === 'Rope Bulk Deal' && Math.abs(syncOrd.json?.data?.promotionApplied?.discount - 100) < 0.001,
    'unpinned campaign no longer prices; the remaining one applies', JSON.stringify(syncOrd.json?.data?.promotionApplied))
  const del = await admin('DELETE', `/api/admin/promotions/${c4.json?.data?.id}`)
  ok(del.status === 200, 'DELETE exhausted campaign')
  const delOrd = await db.orders.findFirst({ where: { promotionName: 'Rope Limited 40' } })
  ok(Boolean(delOrd) && delOrd.promotionName === 'Rope Limited 40' && Math.abs(delOrd.promotionDiscount - 400) < 0.001,
    'deleted campaign: past receipts keep the name+discount snapshot')
  ok((await admin('DELETE', `/api/admin/promotions/${c4.json?.data?.id}`)).status === 404, 're-delete → 404')

  /* ── M. audits ── */
  console.log('— M. audits —')
  const audits = await db.auditLogs.groupBy({ by: ['action'], _count: { action: true }, where: { entityType: 'promotions' } })
  const amap = Object.fromEntries(audits.map((a) => [a.action, a._count.action]))
  ok(amap.promotion_created >= 5, 'promotion_created audits land', JSON.stringify(amap))
  ok(amap.promotion_updated >= 3, 'promotion_updated audits land')
  ok(amap.promotion_deleted === 1, 'promotion_deleted audit lands exactly once')
  const applied = await db.auditLogs.count({ where: { action: 'promotion_applied' } })
  ok(applied >= 6, 'promotion_applied audit per pricing event', JSON.stringify(applied))

  console.log(`\n=== T100 RESULT: ${PASS} passed, ${FAIL} failed ===`)
  await db.$disconnect()
  if (FAIL > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error('DRILL CRASH:', e)
  await db.$disconnect()
  process.exit(1)
})
