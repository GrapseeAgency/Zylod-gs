/**
 * Task 74 E2E — COUPON + REVIEW INTEGRITY.
 *
 * Doctrine under test:
 *   • POST /api/coupons is ADMIN-ONLY now (it authenticated ANY user — a
 *     buyer could mint a 99% coupon and apply it; the exact hole the
 *     payment doctrine exists to prevent). Admin-only 401-first, Zod
 *     strict, audit-logged 'coupon_created'.
 *   • Orders POST honors coupons HONESTLY: unknown/inactive/expired/
 *     below-minimum/exhausted all refuse the order with a real 409 reason
     * (the old block silently ignored everything and usageLimit was never
 *     counted); the usage counter increments atomically inside the order
 *     transaction (updateMany re-checks usedCount < usageLimit AT the
 *     write — concurrent orders can never overrun); percentage vs fixed
 *     types both compute; the receipt echoes couponApplied.
 *   • Reviews: ONE per buyer per product on BOTH creation routes (the twin
 *     route allowed stacking reviews and skewing ratingAvg) — honest 409,
 *     aggregates stay stable.
 *
 * Run: bun scripts/qa/t74-e2e.mjs   (DB EMPTY — first-admin window; dev FRESH)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
const failures = []
function ok(cond, label, extra) {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; failures.push(label + (extra ? ` — ${extra}` : '')); console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
function section(name) { console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.85.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  const call = async function call(method, path_, body) {
    const res = await fetch(`${BASE}${path_}`, {
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
    call.cookie = cookie
    const json = await res.json().catch(() => null)
    return { status: res.status, json }
  }
  call.cookie = ''
  return call
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA74 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA74 Shop ${email.slice(5, 12)}` } : {}),
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
    if (login.status !== 429) throw new Error(`login ${email} -> ${login.status}`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

const main = async () => {
  const PASSWORD = 't74-Coupon-Qa1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession(), buyer2 = makeSession()
  const anon = makeSession()
  const ts = Date.now().toString().slice(-6)

  section('setup — admin, supplier, two buyers, approved product')
  await registerAndLogin(admin, 'admin', `qa74-admin@qa.local`, PASSWORD)
  await registerAndLogin(seller, 'supplier', `qa74-supa@qa.local`, PASSWORD)
  await registerAndLogin(buyer, 'buyer', `qa74-buyer@qa.local`, PASSWORD)
  await registerAndLogin(buyer2, 'buyer', `qa74-buyer2@qa.local`, PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: `QA74 Cat ${ts}`, isActive: true })
  const categoryId = cat.json?.data?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: `QA74 Widgets ${ts}`, description: 'QA t74 coupons + reviews', categoryId, unit: 'pcs',
    moq: 1, basePrice: 100, stockQuantity: 500, priceTiers: [{ minQty: 1, pricePerUnit: 100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], variants: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA74' })
  ok(true, 'product approved (100/pcs)')

  section('A) POST /api/coupons is ADMIN-ONLY (was: any user could mint money)')
  const anonC = await anon('POST', '/api/coupons', { code: `HACK${ts}`, discountPercent: 99, validUntil: new Date(Date.now() + 86400000).toISOString() })
  ok(anonC.status === 401, 'anonymous coupon creation → 401', `got ${anonC.status}`)
  const buyerC = await buyer('POST', '/api/coupons', { code: `HACK${ts}`, discountPercent: 99, validUntil: new Date(Date.now() + 86400000).toISOString() })
  ok(buyerC.status === 401, 'BUYER coupon creation → 401 (the hole is closed)', `got ${buyerC.status}`)
  const hacked = await db.coupons.count({ where: { code: `HACK${ts}` } })
  ok(hacked === 0, 'no 99% coupon row exists (the mint never landed)')

  const badPct = await admin('POST', '/api/coupons', { code: `BAD${ts}`, discountType: 'percentage', discountPercent: 150, validUntil: new Date(Date.now() + 86400000).toISOString() })
  ok(badPct.status === 400, 'percentage > 100 → 400 (Zod refine)', `got ${badPct.status}`)
  const badCode = await admin('POST', '/api/coupons', { code: 'bad code!', discountPercent: 10, validUntil: new Date(Date.now() + 86400000).toISOString() })
  ok(badCode.status === 400, 'invalid code characters → 400')

  const cp1 = await admin('POST', '/api/coupons', {
    code: `QA74P${ts}`, discountType: 'percentage', discountPercent: 10,
    minOrderAmount: 500, usageLimit: 2, validUntil: new Date(Date.now() + 86400000).toISOString(),
  })
  ok(cp1.status === 201, 'admin creates 10% coupon (min ৳500, limit 2)')
  const auditC = await db.auditLogs.count({ where: { action: 'coupon_created', entityType: 'coupons' } })
  ok(auditC === 1, 'coupon_created audit row exists')
  const fixed1 = await admin('POST', '/api/coupons', {
    code: `QA74F${ts}`, discountType: 'fixed', discountPercent: 50, validUntil: new Date(Date.now() + 86400000).toISOString(),
  })
  ok(fixed1.status === 201, 'admin creates ৳50 FIXED coupon')

  section('B) orders REFUSE broken coupons with the real reason')
  const oUnknown = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 6 }], couponCode: 'NOSUCHCODE' })
  ok(oUnknown.status === 409 && /does not exist/.test(oUnknown.json?.error ?? ''), 'unknown code → 409 with the reason', `got ${oUnknown.status}`)
  const oMin = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }], couponCode: `QA74P${ts}` })
  ok(oMin.status === 409 && /minimum order/.test(oMin.json?.error ?? ''), 'below minOrderAmount → 409 (was: silent full charge)', oMin.json?.error)
  const oOk = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 6 }], couponCode: `QA74P${ts}` })
  ok(oOk.status === 201, 'qualifying order (৳600) accepted')
  ok(oOk.json?.data?.totalAmount === 540, '10% discount applied server-side (600 → 540)', `${oOk.json?.data?.totalAmount}`)
  ok(oOk.json?.data?.couponApplied?.code === `QA74P${ts}` && oOk.json?.data?.couponApplied?.discount === 60, 'receipt echoes couponApplied {code, discount:60}')
  const used1 = await db.coupons.findUnique({ where: { code: `QA74P${ts}` } })
  ok(used1?.usedCount === 1, 'usage counter incremented (1/2)')

  const oFixed = await buyer2('POST', '/api/orders', { items: [{ productId, quantity: 1 }], couponCode: `QA74F${ts}` })
  ok(oFixed.status === 201 && oFixed.json?.data?.totalAmount === 50, 'FIXED coupon: ৳100 → ৳50', `${oFixed.json?.data?.totalAmount}`)

  section('C) usage limit enforced under reuse AND concurrency')
  const oOk2 = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 6 }], couponCode: `QA74P${ts}` })
  ok(oOk2.status === 201, 'second use OK (2/2)')
  const oLimit = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 6 }], couponCode: `QA74P${ts}` })
  ok(oLimit.status === 409 && /usage limit/.test(oLimit.json?.error ?? ''), 'third use → 409 usage limit (was: unlimited reuse)', oLimit.json?.error)

  const race = await Promise.all([
    buyer('POST', '/api/orders', { items: [{ productId, quantity: 6 }], couponCode: `QA74F${ts}` }),
    buyer('POST', '/api/orders', { items: [{ productId, quantity: 6 }], couponCode: `QA74F${ts}` }),
  ])
  const fStatuses = race.map((r) => r.status).sort()
  ok(JSON.stringify(fStatuses) === '[201,201]', 'limit-∞ fixed coupon: both concurrent orders fine')
  // Now the REAL concurrency limit test: a limit-1 coupon raced by two orders.
  const once = await admin('POST', '/api/coupons', {
    code: `QA74ONCE${ts}`, discountType: 'fixed', discountPercent: 10, usageLimit: 1, validUntil: new Date(Date.now() + 86400000).toISOString(),
  })
  ok(once.status === 201, 'limit-1 coupon created')
  const onceRace = await Promise.all([
    buyer('POST', '/api/orders', { items: [{ productId, quantity: 1 }], couponCode: `QA74ONCE${ts}` }),
    buyer('POST', '/api/orders', { items: [{ productId, quantity: 1 }], couponCode: `QA74ONCE${ts}` }),
  ])
  const onceStatuses = onceRace.map((r) => r.status).sort()
  ok(JSON.stringify(onceStatuses) === '[201,409]', 'concurrent limit-1: exactly ONE order wins, the other 409s', JSON.stringify(onceStatuses))
  const onceRow = await db.coupons.findUnique({ where: { code: `QA74ONCE${ts}` } })
  ok(onceRow?.usedCount === 1, 'usedCount EXACTLY 1 after the race (never 2)')

  section('D) reviews — ONE per buyer per product on BOTH routes')
  const r1 = await buyer('POST', '/api/reviews', { productId, rating: 5, comment: 'Solid QA74 widgets' })
  ok(r1.status === 201, 'first review created')
  const rDup = await buyer('POST', '/api/reviews', { productId, rating: 1, comment: ' stacking attempt' })
  ok(rDup.status === 409 && /already reviewed/.test(rDup.json?.error ?? ''), 'duplicate review on /api/reviews → 409 (was: silently allowed)')
  const rDup2 = await buyer('POST', `/api/products/${productId}/reviews`, { rating: 1, comment: 'stacking via the twin route' })
  ok(rDup2.status === 409, 'twin route also refuses (pre-existing guard intact)')
  const agg = await db.products.findUnique({ where: { id: productId }, select: { ratingAvg: true, reviewCount: true } })
  ok(agg?.ratingAvg === 5 && agg?.reviewCount === 1, 'ratingAvg/reviewCount stayed EXACT (no skew)', JSON.stringify(agg))
  const rOther = await buyer2('POST', '/api/reviews', { productId, rating: 4, comment: 'Different buyer, fine' })
  ok(rOther.status === 201, 'a DIFFERENT buyer can still review')
  const agg2 = await db.products.findUnique({ where: { id: productId }, select: { ratingAvg: true, reviewCount: true } })
  ok(agg2?.ratingAvg === 4.5 && agg2?.reviewCount === 2, 'aggregates recompute correctly (4.5, 2)', JSON.stringify(agg2))

  console.log(`\n════════════════════════════════════════`)
  console.log(`PASS ${PASS}  FAIL ${FAIL}`)
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log(`  - ${f}`)
  }
  process.exitCode = FAIL ? 1 : 0
  await db.$disconnect()
}

main().catch(async (e) => { console.error('HARNESS CRASH:', e); process.exitCode = 1; await db.$disconnect() })
