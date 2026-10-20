/**
 * Task 81 E2E — THE FULL COMMERCE SPINE IN ONE SESSION: register → product →
 * approve → order → manual payment → seller verify (escrow held) → ship →
 * deliver (escrow released + wallet payout) → REVIEW with a REAL
 * verifiedPurchase flag — the one leg no prior E2E ever proved against a
 * delivered order (t74 proved dedupe only, on a review with no purchase).
 *
 * Run: bun scripts/qa/t81-e2e.mjs   (DB EMPTY — first-admin window; dev FRESH)
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
  const ip = `10.97.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA81 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA81 Shop ${email.slice(5, 12)}` } : {}),
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
  const PASSWORD = 't81-Spine-Qa1!'
  const anon = makeSession()
  const admin = makeSession()
  const seller = makeSession()
  const buyer = makeSession()
  const passerby = makeSession()

  section('A. accounts + product')
  await registerAndLogin(admin, 'admin', 'qa81-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa81-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa81-buyer@qa.local', PASSWORD)
  await registerAndLogin(passerby, 'buyer', 'qa81-passerby@qa.local', PASSWORD)
  const cat = await admin('POST', '/api/admin/categories', { name: 'QA81 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA81 Spine Product', description: 'QA t81 full spine', categoryId, unit: 'pcs',
    moq: 1, basePrice: 200, stockQuantity: 10,
    priceTiers: [{ minQty: 1, pricePerUnit: 200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], variants: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'product created')
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA81' })

  section('B. order + manual payment doctrine leg')
  const order = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 3 }] })
  const orderId = order.json?.data?.orderId
  ok(Boolean(orderId), 'buyer ordered 3 × 200 (total 600)')
  const sub = await buyer('POST', `/api/orders/${orderId}/payment-submit`, {
    method: 'mobile_banking', transactionId: 'QA81TXN0001', brand: 'bKash',
  })
  ok(sub.status === 201, 'buyer submitted payment credentials (PENDING — money NOT claimed)', `got ${sub.status}`)
  const orderRow1 = await db.orders.findUnique({ where: { id: orderId }, select: { paymentStatus: true } })
  ok(orderRow1?.paymentStatus === 'unpaid', 'order honestly still unpaid while pending')
  const verify = await seller('POST', `/api/seller/payments/${sub.json?.data?.paymentId}/verify`, { action: 'verify' })
  ok(verify.status === 200, 'seller verified the transfer')
  const orderRow2 = await db.orders.findUnique({ where: { id: orderId }, select: { paymentStatus: true } })
  ok(orderRow2?.paymentStatus === 'paid', 'payment verified → order PAID (full 600 of 600)')
  const escrow = await db.escrowAccounts.findFirst({ where: { orderId } })
  ok(escrow?.status === 'held' && escrow?.amount === 600, 'escrow HELD at 600')

  section('C. lifecycle leg (Task 80 timeline rides along)')
  const detail = await buyer('GET', `/api/orders/${orderId}`)
  const soId = detail.json?.data?.subOrders?.[0]?.id
  const s1 = await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'confirmed', subOrderId: soId })
  const s2 = await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'shipped', subOrderId: soId, trackingNumber: 'WB81SPINE01' })
  const s3 = await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: soId })
  ok(s1.status === 200 && s2.status === 200 && s3.status === 200, 'confirmed → shipped → delivered all landed')
  const detail2 = await buyer('GET', `/api/orders/${orderId}`)
  const so = detail2.json?.data?.subOrders?.[0]
  ok(so?.status === 'delivered', 'subOrder delivered')
  ok((so?.tracking ?? []).length === 4, 'timeline carries 4 rows (placed/confirmed/shipped/delivered)', `got ${so?.tracking?.length}`)
  const escrow2 = await db.escrowAccounts.findFirst({ where: { orderId } })
  ok(escrow2?.status === 'released', 'escrow RELEASED on delivery')
  const payout = await db.walletTransactions.findFirst({
    where: { type: 'payout', relatedEntityId: orderId },
  })
  ok(payout?.amount === 600, 'seller wallet payout ledger row = 600', JSON.stringify(payout?.amount))

  section('D. THE REVIEW LEG — verified purchase, proven live')
  {
    const rAnon = await anon('POST', '/api/reviews', { productId, rating: 5, comment: 'anon' })
    ok(rAnon.status === 401, 'anon review -> 401', `got ${rAnon.status}`)
    const r = await buyer('POST', '/api/reviews', { productId, rating: 5, comment: 'Arrived fast, wholesale price held.' })
    ok(r.status === 201, 'buyer reviewed the delivered product', `got ${r.status}`)
    ok(r.json?.data?.verifiedPurchase === true, 'verifiedPurchase TRUE (real delivered order item)', JSON.stringify(r.json?.data ?? {}))
    const p = await passerby('POST', '/api/reviews', { productId, rating: 2, comment: 'Never bought, just saying.' })
    ok(p.status === 201 && p.json?.data?.verifiedPurchase === false, 'passerby review flagged verifiedPurchase FALSE', JSON.stringify(p.json?.data ?? {}))
    const dup = await buyer('POST', '/api/reviews', { productId, rating: 1, comment: 'again' })
    ok(dup.status === 409, 'duplicate review still 409 (t74 guarantee holds in the spine)')
    const pr = await anon('GET', `/api/products/${productId}`)
    const ratingAvg = pr.json?.data?.ratingAvg ?? pr.json?.ratingAvg
    const reviewCount = pr.json?.data?.reviewCount ?? pr.json?.reviewCount
    ok(reviewCount === 2, 'product reviewCount = 2', `got ${reviewCount}`)
    ok(Math.abs((ratingAvg ?? 0) - 3.5) < 0.01, 'ratingAvg = 3.5 ((5+2)/2, honest math)', `got ${ratingAvg}`)
  }

  section('E. stock truth at the end of the spine')
  {
    const pr = await anon('GET', `/api/products/${productId}`)
    const stock = pr.json?.data?.stockQuantity
    ok(stock === 7, 'stock decremented 10 → 7 by the real order', `got ${stock}`)
  }

  console.log(`\n═══ t81 RESULT: ${PASS} PASS / ${FAIL} FAIL ═══`)
  if (FAIL > 0) { console.log('FAILURES:', failures.join(' | ')); process.exit(1) }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1) }).finally(async () => { await db.$disconnect() })
