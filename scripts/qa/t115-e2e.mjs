/**
 * Task 115 E2E — ONE CAMPAIGN ENGINE, TWO OWNERS (seller campaigns with
 * REAL seller-funded pricing teeth).
 *
 *   A. gates — seller rails 401-first, buyer 403 profile-required, public rail honest zeros
 *   B. seller creation validation — strict keys, engine-scope refusals
 *      (bogo/free_shipping), phantom vs FOREIGN vs unavailable pins, window math
 *   C. public buyer rail — live-only, pinned visible products, banner verbatim
 *   D. SELLER-FUNDED checkout — buyer total AND subOrder subtotal shrink,
 *      campaignDiscount stamp, orderItems keep line truth, escrow holds the
 *      REDUCED subtotal, audit says funding 'seller', usedCount claims
 *   E. platform-funded regression — platform promo keeps subOrder FULL (t100 intact)
 *   F. best-of + supplier guard — bigger discount wins; a seller campaign
 *      can never price another seller's lines (guard-dropped drift row)
 *   G. PATCH/DELETE discipline — only-arrived keys, empty 400, window vs
 *      stored counterpart, no-leak 404s, used campaign DELETE 409, park instead
 *   H. admin tap — ownerType/ownerName on every row; admin parks a seller campaign
 *   I. public platform rail stays platform-only
 *   J. seller stats mirror the churn exactly
 *   K. audits — exact action counts in raw DB
 *
 * Run: bun scripts/qa/t115-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.115.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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

async function registerAndLogin(session, userType, email, password, businessName) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA115 ${userType}`,
    ...(userType === 'supplier' && businessName ? { businessName } : {}),
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
  const PASSWORD = 't115-E2e-Str0ng1!'
  const admin = makeSession(), sellerA = makeSession(), sellerB = makeSession(), buyer = makeSession(), anon = makeSession()
  await registerAndLogin(admin, 'admin', 'qa115-admin@qa.local', PASSWORD)
  await registerAndLogin(sellerA, 'supplier', 'qa115-supa-a@qa.local', PASSWORD, 'QA115 Alpha Traders')
  await registerAndLogin(sellerB, 'supplier', 'qa115-supa-b@qa.local', PASSWORD, 'QA115 Beta Traders')
  await registerAndLogin(buyer, 'buyer', 'qa115-buyer@qa.local', PASSWORD)
  console.log('  accounts ready')

  const profA = await db.supplierProfiles.findFirst({ where: { companyName: 'QA115 Alpha Traders' }, select: { id: true } })
  const profB = await db.supplierProfiles.findFirst({ where: { companyName: 'QA115 Beta Traders' }, select: { id: true } })
  ok(Boolean(profA?.id && profB?.id), 'both supplier profiles resolved from real rows')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA115 Campaign Goods', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id

  const mkProduct = async (session, name, basePrice, opts = {}) => {
    const p = await session('POST', '/api/supplier/products', {
      name, description: `${name} — QA115 fixture`, categoryId, unit: 'pcs', bundleSize: null,
      moq: 1, basePrice, stockQuantity: 1000,
      priceTiers: [{ minQty: 1, pricePerUnit: basePrice }],
      images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    })
    const id = p.json?.data?.id ?? p.json?.id
    if (!opts.leaveUnapproved) {
      const ap = await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'QA115' })
      if (ap.status !== 200) throw new Error(`approve failed ${ap.status}`)
    }
    return id
  }
  const prodA1 = await mkProduct(sellerA, 'QA115 Hydraulic Fitting', 1000)
  const prodA2 = await mkProduct(sellerA, 'QA115 Packing Rope', 500)
  const prodB1 = await mkProduct(sellerB, 'QA115 Steel Bracket', 700)
  const prodAHidden = await mkProduct(sellerA, 'QA115 Unapproved Widget', 300, { leaveUnapproved: true })
  ok(Boolean(prodA1 && prodA2 && prodB1 && prodAHidden), 'four products created (one deliberately unapproved)')

  const addr = await buyer('POST', '/api/addresses', {
    label: 'Home', address_line1: 'House 115, Road 10',
    city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000115',
    postal_code: '1200',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  ok(Boolean(addressId), 'buyer address ready')

  // Fund the buyer's REAL wallet — the wallet path creates escrow rows,
  // proving the seller-funded HOLD carries the REDUCED subtotal.
  const buyerUser = await db.users.findUnique({ where: { email: 'qa115-buyer@qa.local' } })
  await db.wallets.create({ data: { userId: buyerUser.id, balance: 999999 } })

  const now = Date.now()
  const day = 86_400_000
  const liveWindow = { validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 7 * day).toISOString() }

  /* ── A. gates ── */
  console.log('— A. gates —')
  ok((await anon('GET', '/api/supplier/promotions')).status === 401, 'anon seller list → 401')
  ok((await anon('POST', '/api/supplier/promotions', { name: 'X' })).status === 401, 'anon seller create → 401')
  ok((await anon('GET', '/api/supplier/promotions/nonexistent')).status === 401, 'anon seller [id] → 401')
  const buyerRail = await buyer('GET', '/api/supplier/promotions')
  ok(buyerRail.status === 401 && /Access denied/i.test(buyerRail.json?.error ?? ''), 'buyer on seller rail → 401 Access denied (requireUserType gate)', JSON.stringify(buyerRail.json?.error))
  const pubUnknown = await anon('GET', '/api/suppliers/no-such-supplier/campaigns')
  ok(pubUnknown.status === 404, 'public campaigns of unknown supplier → 404')
  const pubEmpty = await anon('GET', `/api/suppliers/${profA.id}/campaigns`)
  ok(pubEmpty.status === 200 && pubEmpty.json?.data?.campaigns?.length === 0, 'public campaigns of real supplier, none live → 200 honest zero')
  ok((await buyer('GET', '/api/admin/promotions')).status === 401, 'buyer on admin rail → 401')

  /* ── B. seller creation validation ── */
  console.log('— B. seller creation validation —')
  const base = { name: 'QA115 Seller Campaign', type: 'percentage', value: 15, productIds: [prodA1], isActive: true, ...liveWindow }
  ok((await sellerA('POST', '/api/supplier/promotions', { ...base, bogus: 1 })).status === 400, 'strict keys → 400')
  const bogo = await sellerA('POST', '/api/supplier/promotions', { ...base, type: 'bogo' })
  ok(bogo.status === 400 && /pricing engine/i.test(bogo.json?.error ?? ''), 'bogo → 400 naming the engine scope', JSON.stringify(bogo.json?.error))
  ok((await sellerA('POST', '/api/supplier/promotions', { ...base, type: 'free_shipping' })).status === 400, 'free_shipping → 400')
  ok((await sellerA('POST', '/api/supplier/promotions', { ...base, value: 150 })).status === 400, 'percentage > 100 → 400')
  ok((await sellerA('POST', '/api/supplier/promotions', { ...base, value: 0 })).status === 400, 'value 0 → 400')
  ok((await sellerA('POST', '/api/supplier/promotions', { ...base, productIds: [] })).status === 400, 'empty productIds → 400')
  const phantom = await sellerA('POST', '/api/supplier/promotions', { ...base, productIds: ['phantom-product'] })
  ok(phantom.status === 400 && /phantom-product/.test(phantom.json?.error ?? ''), 'phantom pin → 400 naming it', JSON.stringify(phantom.json?.error))
  const foreign = await sellerB('POST', '/api/supplier/promotions', { ...base, productIds: [prodA1] })
  ok(foreign.status === 403 && /YOUR products/i.test(foreign.json?.error ?? ''), 'FOREIGN product pin → 403 (seller boundary)', JSON.stringify(foreign.json?.error))
  const unapproved = await sellerA('POST', '/api/supplier/promotions', { ...base, productIds: [prodAHidden] })
  ok(unapproved.status === 400 && /hidden or not approved/i.test(unapproved.json?.error ?? ''), 'own but unapproved pin → 400', JSON.stringify(unapproved.json?.error))
  ok((await sellerA('POST', '/api/supplier/promotions', { ...base, validUntil: new Date(now - 2 * day).toISOString() })).status === 400, 'window reversed → 400')

  /* ── C. create + public buyer rail ── */
  console.log('— C. create + public rail —')
  const camp = await sellerA('POST', '/api/supplier/promotions', {
    ...base, name: 'Fitting Fortnight', value: 15,
    description: '15% off every hydraulic fitting — seller-funded, automatic at checkout',
    bannerImageUrl: '/uploads/products/qa115-banner.jpg',
    maxDiscount: 500,
  })
  ok(camp.status === 201, 'seller campaign created', JSON.stringify(camp.json?.error))
  const campId = camp.json?.data?.id
  ok(camp.json?.data?.isActive === true && camp.json?.data?.pinnedProducts?.[0]?.id === prodA1, 'created live with the pinned product')
  ok(camp.json?.data?.bannerImageUrl === '/uploads/products/qa115-banner.jpg', 'banner verbatim')
  ok(camp.json?.data?.usageLimit === null && camp.json?.data?.minOrderAmount === null, '0/absent floors normalized to unlimited/none')

  const pub = await anon('GET', `/api/suppliers/${profA.id}/campaigns`)
  ok(pub.status === 200 && pub.json?.data?.campaigns?.length === 1, 'public rail serves the LIVE seller campaign')
  const pubC = pub.json?.data?.campaigns?.[0]
  ok(pubC?.name === 'Fitting Fortnight' && pubC?.value === 15 && pubC?.type === 'percentage', 'campaign facts verbatim')
  ok(pubC?.bannerImageUrl === '/uploads/products/qa115-banner.jpg', 'banner verbatim on the public rail')
  ok(pubC?.products?.length === 1 && pubC?.products?.[0]?.id === prodA1 && pubC?.products?.[0]?.unitPrice === 1000, 'pinned product with real basePrice')
  ok(!('usedCount' in pubC) && !('usageLimit' in pubC), 'public shape leaks no operational counters')
  ok(pub.json?.data?.supplier?.companyName === 'QA115 Alpha Traders', 'supplier identity on the rail')

  // A parked campaign must never appear publicly.
  const parked = await sellerA('POST', '/api/supplier/promotions', {
    ...base, name: 'Parked Ropes Deal', value: 5, productIds: [prodA2], isActive: false,
  })
  ok(parked.status === 201 && parked.json?.data?.isActive === false, 'second campaign created parked')
  const pub2 = await anon('GET', `/api/suppliers/${profA.id}/campaigns`)
  ok(pub2.json?.data?.campaigns?.length === 1 && pub2.json?.data?.campaigns?.[0]?.name === 'Fitting Fortnight', 'PARKED campaign hidden from the public rail')
  // A scheduled (future window) campaign must never appear publicly.
  const scheduled = await sellerA('POST', '/api/supplier/promotions', {
    ...base, name: 'Future Brackets', value: 9, productIds: [prodA1],
    validFrom: new Date(now + 30 * day).toISOString(), validUntil: new Date(now + 40 * day).toISOString(),
  })
  ok(scheduled.status === 201, 'scheduled campaign created')
  const pub3 = await anon('GET', `/api/suppliers/${profA.id}/campaigns`)
  ok(pub3.json?.data?.campaigns?.length === 1, 'SCHEDULED campaign hidden from the public rail')
  // Seller B's store stays honest-zero even though seller A has live campaigns.
  const pubB = await anon('GET', `/api/suppliers/${profB.id}/campaigns`)
  ok(pubB.status === 200 && pubB.json?.data?.campaigns?.length === 0, "seller B's rail honest-zero (no cross-store leakage)")

  /* ── D. SELLER-FUNDED checkout (cart path + escrow) ── */
  console.log('— D. seller-funded checkout —')
  const ord1 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodA1, quantity: 2 }], shippingAddressId: addressId, payWithWallet: true,
  })
  ok(ord1.status === 201, 'order created through the cart path', JSON.stringify(ord1.json?.error))
  ok(ord1.json?.data?.promotionApplied?.name === 'Fitting Fortnight' && Math.abs(ord1.json?.data?.promotionApplied?.discount - 300) < 0.001,
    '15% of 2×1000 → discount exactly ৳300', JSON.stringify(ord1.json?.data?.promotionApplied))
  ok(Math.abs(ord1.json?.data?.totalAmount - 1700) < 0.001, 'buyer total 1700 (2000 − 300)', JSON.stringify(ord1.json?.data?.totalAmount))
  const ord1db = await db.orders.findUnique({ where: { id: ord1.json?.data?.orderId }, include: { subOrders: { include: { items: true } } } })
  ok(ord1db?.promotionName === 'Fitting Fortnight' && Math.abs(ord1db.promotionDiscount - 300) < 0.001, 'order row stamped (name + discount)')
  ok(Math.abs(ord1db?.subOrders[0]?.subtotal - 1700) < 0.001, 'SELLER-FUNDED: subOrder subtotal POST-discount 1700', JSON.stringify(ord1db?.subOrders[0]?.subtotal))
  ok(Math.abs(ord1db?.subOrders[0]?.campaignDiscount - 300) < 0.001, 'subOrder.campaignDiscount stamped 300', JSON.stringify(ord1db?.subOrders[0]?.campaignDiscount))
  ok(ord1db?.subOrders?.[0]?.items?.length === 1 && Math.abs(ord1db.subOrders[0].items[0].totalPrice - 2000) < 0.001, 'orderItems keep LINE truth (2000 full)', JSON.stringify(ord1db?.subOrders?.[0]?.items?.[0]?.totalPrice))
  const escrow1 = await db.escrowAccounts.findFirst({ where: { orderId: ord1db.id } })
  ok(escrow1 && Math.abs(escrow1.amount - 1700) < 0.001, 'escrow holds the REDUCED subtotal 1700 (seller funds the gap)', JSON.stringify(escrow1?.amount))
  const afterUse = await db.promotions.findUnique({ where: { id: campId } })
  ok(afterUse?.usedCount === 1, 'usedCount claimed exactly once')
  const audit1 = await db.auditLogs.findFirst({ where: { action: 'promotion_applied', entityId: ord1db.orderNumber } })
  ok(audit1?.metadata && JSON.parse(audit1.metadata).funding === 'seller', 'audit says funding: seller', audit1?.metadata ?? 'MISSING')

  // buy-now path — the single-product engine, same seller-funded math.
  const direct = await buyer('POST', '/api/orders/create-direct', {
    productId: prodA2, quantity: 2, shippingAddressId: addressId,
  })
  // No campaign on prodA2 yet — the seller-funded section proves the PARKED
  // Ropes Deal (5%) does NOT price. Assert full price.
  ok(direct.status === 201 && Math.abs(direct.json?.data?.totalAmount - 1000) < 0.001, 'buy-now: PARKED campaign does not price (full ৳1000)', JSON.stringify(direct.json?.data?.totalAmount))

  // Flip the parked ropes campaign live, then buy again — the parked→live
  // flip must start pricing immediately.
  const flipLive = await sellerA('PATCH', `/api/supplier/promotions/${parked.json?.data?.id}`, { isActive: true })
  ok(flipLive.status === 200 && flipLive.json?.data?.isActive === true, 'parked campaign flipped live via PATCH')
  const direct2 = await buyer('POST', '/api/orders/create-direct', {
    productId: prodA2, quantity: 2, shippingAddressId: addressId,
  })
  ok(direct2.status === 201 && Math.abs(direct2.json?.data?.totalAmount - 950) < 0.001,
    'buy-now after flip: 5% of 2×500 = ৳50 off → 950', JSON.stringify(direct2.json?.data?.totalAmount))
  const direct2db = await db.orders.findUnique({ where: { id: direct2.json?.data?.orderId }, include: { subOrders: true } })
  ok(Math.abs(direct2db?.subOrders[0]?.subtotal - 950) < 0.001 && Math.abs(direct2db?.subOrders[0]?.campaignDiscount - 50) < 0.001,
    'buy-now subOrder carries the seller-funded reduction + stamp')

  /* ── E. platform-funded regression ── */
  console.log('— E. platform regression —')
  const plat = await admin('POST', '/api/admin/promotions', {
    name: 'QA115 Platform Fair', type: 'percentage', value: 10, isActive: true,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 7 * day).toISOString(),
    productIds: [prodA1],
  })
  ok(plat.status === 201, 'platform promotion created (admin-curated)')
  const platId = plat.json?.data?.id
  const ord2 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodA1, quantity: 1 }], shippingAddressId: addressId, payWithWallet: true,
  })
  // Both campaigns now pin prodA1: seller 15% (450) vs platform 10% (100) — best wins.
  ok(ord2.status === 201 && Math.abs(ord2.json?.data?.promotionApplied?.discount - 150) < 0.001,
    'best-of: seller 15% of 1×1000 (৳150) beats platform 10% (৳100)', JSON.stringify(ord2.json?.data?.promotionApplied))
  ok(Math.abs(ord2.json?.data?.totalAmount - 850) < 0.001, 'buyer total 850 (1000 − 150)')
  const ord2db = await db.orders.findUnique({ where: { id: ord2.json?.data?.orderId }, include: { subOrders: true } })
  ok(Math.abs(ord2db?.subOrders[0]?.subtotal - 850) < 0.001 && Math.abs(ord2db?.subOrders[0]?.campaignDiscount - 150) < 0.001,
    'winner is the seller campaign → seller-funded reduction again')
  const afterUse2 = await db.promotions.findUnique({ where: { id: campId } })
  ok(afterUse2?.usedCount === 2, 'seller campaign usedCount → 2')
  const afterUsePlat = await db.promotions.findUnique({ where: { id: platId } })
  ok(afterUsePlat?.usedCount === 0, 'losing platform campaign usedCount still 0')

  // PLATFORM-funded proof on a fresh product: platform promo pins prodB1
  // (seller B's product) — the subOrder must keep FULL value.
  const platB = await admin('POST', '/api/admin/promotions', {
    name: 'QA115 Bracket Fair', type: 'fixed', value: 100, isActive: true,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 7 * day).toISOString(),
    productIds: [prodB1],
  })
  const ord3 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodB1, quantity: 1 }], shippingAddressId: addressId, payWithWallet: true,
  })
  ok(ord3.status === 201 && Math.abs(ord3.json?.data?.totalAmount - 600) < 0.001, 'platform promo: buyer pays 600 (700−100)')
  const ord3db = await db.orders.findUnique({ where: { id: ord3.json?.data?.orderId }, include: { subOrders: true } })
  ok(Math.abs(ord3db?.subOrders[0]?.subtotal - 700) < 0.001, 'PLATFORM-FUNDED: seller B subOrder keeps FULL 700', JSON.stringify(ord3db?.subOrders[0]?.subtotal))
  ok(Math.abs(ord3db?.subOrders[0]?.campaignDiscount - 0) < 0.001, 'campaignDiscount stays 0 on platform-funded path')
  const escrow3 = await db.escrowAccounts.findFirst({ where: { orderId: ord3db.id } })
  ok(escrow3 && Math.abs(escrow3.amount - 700) < 0.001, 'escrow holds FULL 700 for the platform promo')

  /* ── F. supplier guard (drift row via direct DB) ── */
  console.log('— F. supplier guard —')
  // Simulate pin drift: a seller-B campaign row pinning seller-A's product
  // (creation would refuse this; the row exists only through direct DB).
  const drift = await db.promotions.create({
    data: {
      name: 'QA115 Drift Attack', type: 'percentage', value: 99, isActive: true,
      validFrom: new Date(now - day), validUntil: new Date(now + day),
      supplierId: profB.id,
    },
  })
  await db.promotionProducts.create({ data: { promotionId: drift.id, productId: prodA1 } })
  const ord4 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodA1, quantity: 1 }], shippingAddressId: addressId, payWithWallet: true,
  })
  ok(ord4.status === 201 && Math.abs(ord4.json?.data?.promotionApplied?.discount - 150) < 0.001,
    'guard: drifted 99% seller-B row NEVER prices seller-A lines (990 would beat 150; seller 15% wins)', JSON.stringify(ord4.json?.data?.promotionApplied))
  const driftAfter = await db.promotions.findUnique({ where: { id: drift.id } })
  ok(driftAfter?.usedCount === 0, 'drifted campaign usedCount stays 0')
  const campAfterGuard = await db.promotions.findUnique({ where: { id: campId } })
  ok(campAfterGuard?.usedCount === 3, 'seller campaign usedCount → 3 (the guard test priced under IT, not the drift row)')

  /* ── G. PATCH/DELETE discipline ── */
  console.log('— G. PATCH/DELETE discipline —')
  ok((await sellerA('PATCH', `/api/supplier/promotions/${campId}`, {})).status === 400, 'empty PATCH → 400')
  const noFields = await sellerA('PATCH', `/api/supplier/promotions/${campId}`, {})
  ok(/No fields to update/i.test(noFields.json?.error ?? ''), 'empty PATCH message verbatim', JSON.stringify(noFields.json?.error))
  const beforePatch = await db.promotions.findUnique({ where: { id: campId } })
  const patchName = await sellerA('PATCH', `/api/supplier/promotions/${campId}`, { name: 'Fitting Fortnight Extended' })
  ok(patchName.status === 200 && patchName.json?.data?.name === 'Fitting Fortnight Extended', 'PATCH name only')
  const afterPatch = await db.promotions.findUnique({ where: { id: campId } })
  ok(Math.abs(afterPatch.value - beforePatch.value) < 0.001 && afterPatch.validFrom.getTime() === beforePatch.validFrom.getTime() && afterPatch.validUntil.getTime() === beforePatch.validUntil.getTime(),
    'only-arrived-keys: value + window untouched')
  const patchForeign = await sellerB('PATCH', `/api/supplier/promotions/${campId}`, { name: 'Hijacked' })
  ok(patchForeign.status === 404, 'FOREIGN seller PATCH → same 404 (no-leak)')
  const patchForeignDelete = await sellerB('DELETE', `/api/supplier/promotions/${campId}`)
  ok(patchForeignDelete.status === 404, 'FOREIGN seller DELETE → same 404 (no-leak)')
  const patchUnknown = await sellerA('PATCH', '/api/supplier/promotions/no-such-campaign', { name: 'X' })
  ok(patchUnknown.status === 404, 'unknown campaign PATCH → 404')
  const badWindow = await sellerA('PATCH', `/api/supplier/promotions/${campId}`, { validFrom: new Date(now + 30 * day).toISOString() })
  ok(badWindow.status === 400 && /after the start date/i.test(badWindow.json?.error ?? ''), 'validFrom moved past stored validUntil → 400 vs stored counterpart', JSON.stringify(badWindow.json?.error))
  const patchPins = await sellerA('PATCH', `/api/supplier/promotions/${campId}`, { productIds: [prodA1, prodA2] })
  ok(patchPins.status === 200 && patchPins.json?.data?.pinnedProducts?.length === 2, 'pin set replaced (full-set sync)')
  const patchForeignPin = await sellerA('PATCH', `/api/supplier/promotions/${campId}`, { productIds: [prodB1] })
  ok(patchForeignPin.status === 403, 'PATCH pins a FOREIGN product → 403')
  // The used campaign (3 orders priced) refuses deletion — park instead.
  const delUsed = await sellerA('DELETE', `/api/supplier/promotions/${campId}`)
  ok(delUsed.status === 409 && /3 orders/.test(delUsed.json?.error ?? ''), 'DELETE of a used campaign → 409 verbatim', JSON.stringify(delUsed.json?.error))
  // An UNUSED campaign deletes cleanly.
  const schedId = scheduled.json?.data?.id
  const delUnused = await sellerA('DELETE', `/api/supplier/promotions/${schedId}`)
  ok(delUnused.status === 200, 'DELETE of an unused campaign → 200')
  const delAgain = await sellerA('DELETE', `/api/supplier/promotions/${schedId}`)
  ok(delAgain.status === 404, 're-DELETE → 404')

  /* ── H. admin tap ── */
  console.log('— H. admin tap —')
  const adminList = await admin('GET', '/api/admin/promotions')
  ok(adminList.status === 200 && Array.isArray(adminList.json?.data), 'admin list serves all campaigns')
  const sellerRow = adminList.json?.data?.find((c) => c.id === campId)
  ok(sellerRow?.ownerType === 'seller' && sellerRow?.ownerName === 'QA115 Alpha Traders', 'seller row carries ownerType+ownerName', JSON.stringify(sellerRow?.ownerType))
  const platRow = adminList.json?.data?.find((c) => c.id === platId)
  ok(platRow?.ownerType === 'platform' && platRow?.ownerName === 'Platform', 'platform row carries platform owner')
  const adminPark = await admin('PATCH', `/api/admin/promotions/${parked.json?.data?.id}`, { isActive: false })
  ok(adminPark.status === 200 && adminPark.json?.data?.isActive === false, 'admin parks a seller campaign')
  const pubAfterPark = await anon('GET', `/api/suppliers/${profA.id}/campaigns`)
  ok(pubAfterPark.json?.data?.campaigns?.length === 1 && pubAfterPark.json?.data?.campaigns?.[0]?.name === 'Fitting Fortnight Extended',
    'parked-by-admin campaign leaves the public rail; the still-live one stays')

  /* ── I. public platform rail stays platform-only ── */
  console.log('— I. platform-only public rail —')
  const globalRail = await anon('GET', '/api/promotions')
  ok(globalRail.status === 200 && Array.isArray(globalRail.json?.data), 'global public rail serves')
  const names = (globalRail.json?.data ?? []).map((c) => c.name)
  ok(!names.includes('Fitting Fortnight Extended'), 'seller campaign NOT on the platform rail')
  ok(names.includes('QA115 Platform Fair') && names.includes('QA115 Bracket Fair'), 'both platform campaigns on the platform rail')

  /* ── J. seller stats ── */
  console.log('— J. seller stats —')
  const myList = await sellerA('GET', '/api/supplier/promotions')
  ok(myList.status === 200 && Array.isArray(myList.json?.data), 'seller list serves own campaigns')
  const st = myList.json?.stats
  // rows created: camp, parked(now parked by admin), scheduled(deleted) → total 2;
  // live: camp (still active+in-window) = 1; paused: parked = 1.
  ok(st?.total === 2 && st?.live === 1 && st?.paused === 1 && st?.scheduled === 0 && st?.ended === 0, 'stats mirror the churn exactly', JSON.stringify(st))
  ok(st?.totalUses === 4, 'totalUses = 4 (camp priced 3 orders, ropes priced 1)', JSON.stringify(st))
  const myNames = (myList.json?.data ?? []).map((c) => c.name)
  ok(myNames.includes('Fitting Fortnight Extended') && myNames.includes('Parked Ropes Deal') && !myNames.includes('Future Brackets'), 'seller sees own rows incl. parked, not deleted')

  /* ── K. audits ── */
  console.log('— K. audits —')
  const createdAudits = await db.auditLogs.count({ where: { action: 'seller_campaign_created' } })
  ok(createdAudits === 3, 'seller_campaign_created audits = 3', JSON.stringify(createdAudits))
  const updatedAudits = await db.auditLogs.count({ where: { action: 'seller_campaign_updated' } })
  ok(updatedAudits === 3, 'seller_campaign_updated audits = 3 (flip, name, pins — refusals and admin park write none/other actions)', JSON.stringify(updatedAudits))
  const deletedAudits = await db.auditLogs.count({ where: { action: 'seller_campaign_deleted' } })
  ok(deletedAudits === 1, 'seller_campaign_deleted audit = 1')
  const sellerFundingAudits = await db.auditLogs.count({ where: { action: 'promotion_applied', metadata: { contains: '"funding":"seller"' } } })
  const platformFundingAudits = await db.auditLogs.count({ where: { action: 'promotion_applied', metadata: { contains: '"funding":"platform"' } } })
  ok(sellerFundingAudits === 4, 'funding:seller applied-audits = 4', JSON.stringify(sellerFundingAudits))
  ok(platformFundingAudits === 1, 'funding:platform applied-audits = 1', JSON.stringify(platformFundingAudits))

  console.log(`\n=== t115 RESULT: ${PASS} PASS, ${FAIL} FAIL ===`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('FATAL:', e)
  try { await db.$disconnect() } catch {}
  process.exit(1)
})
