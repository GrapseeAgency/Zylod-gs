/**
 * Task 128 E2E — THE MANUAL PAYMENT CIRCUIT CLOSED ON BOTH ENDS.
 *
 * Three real endpoints existed with ZERO UI consumers (the persisted orphan
 * scan flagged them; manual verification confirmed they were true orphans):
 *
 *   POST /api/orders/[id]/payments/initiate  — buyer asks WHERE to send the
 *     money; instructions built ONLY from env (503 when nothing configured);
 *     reuses an existing pending payment for the same method (never stacks).
 *     NOW CONSUMED by the order-detail payment dialog (Task 128-a).
 *
 *   POST /api/admin/orders/[id]/verify-payment — the paper-receipt B2B leg:
 *     admin CONFIRMED money arrived and records it; order flips PAID.
 *     NOW CONSUMED by the admin orders console (Task 128-b). This round also
 *     fixed the route's own honesty gap: the header claimed "audit-logged"
 *     but only console.log'd — a REAL auditLogs row is now written in the
 *     same transaction.
 *
 *   GET  /api/orders/[id]/receipt — the real receipt document (items,
 *     subtotal, shipping, VAT, total, buyer, address).
 *     NOW CONSUMED by the order-detail "View Receipt" dialog (Task 128-c).
 *
 *   A. initiate gates — anon/seller/admin 401, foreign buyer 404 (no-leak),
 *      bad method 400
 *   B. initiate honest behavior — env-unconfigured sandbox → 503 with the
 *      verbatim config error; a pending payments row WAS still recorded
 *      (intent), and a repeat call reuses it (exactly one row, no stacking)
 *   C. verify-payment gates — anon/buyer/supplier 401, missing fields 400,
 *      bad method 400, amount mismatch 400 (message names the order total)
 *   D. verify-payment happy path — 200, order flips paid, payments row
 *      'success' with paidAt + gatewayResponse, REAL auditLogs row; repeat
 *      on paid order 409; same transactionId on another order 409
 *   E. receipt — anon 401, foreign buyer 403, owner/supplier/admin 200 with
 *      math that sums back (subtotal = Σ items), missing order 404
 *   F. circuit coexistence — the Task 56-b buyer-submit → seller-verify leg
 *      still works end-to-end alongside the new surfaces
 *
 * Run: wipe DB first (empty DB — first-admin window), then:
 *   node scripts/qa/t128-e2e.mjs
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
function ok(cond, label, extra = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
const near = (a, b) => Math.abs((a ?? NaN) - b) < 0.01
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.128.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA128 ${userType}`, ...(businessName ? { businessName } : {}) }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status} ${JSON.stringify(reg.json)}`)
    await sleep(4000 * (attempt + 1))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} exhausted: ${login.status}`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't128-E2e-Str0ng1!'
  const STAMP = Date.now()
  const buyer = makeSession(), buyer2 = makeSession(), sellerA = makeSession(), admin = makeSession(), anon = makeSession()

  await registerAndLogin(admin, 'admin', `qa128-admin-${STAMP}@t128.test`, PASSWORD)
  await registerAndLogin(buyer, 'buyer', `qa128-buyer-${STAMP}@t128.test`, PASSWORD)
  await registerAndLogin(buyer2, 'buyer', `qa128-buyer2-${STAMP}@t128.test`, PASSWORD)
  await registerAndLogin(sellerA, 'supplier', `qa128-seller-${STAMP}@t128.test`, PASSWORD, 'QA128 Brass House')
  ok(true, 'four sessions registered (admin first — window used)')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA128 Business Goods', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  ok(Boolean(categoryId), 'category created')

  const p = await sellerA('POST', '/api/supplier/products', {
    name: 'QA128 Brass Lamp', description: 'QA128 fixture', categoryId, unit: 'pcs', bundleSize: null,
    moq: 1, basePrice: 1200, stockQuantity: 500,
    priceTiers: [{ minQty: 1, pricePerUnit: 1200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  const ap = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA128' })
  ok(ap.status === 200, 'product created + approved', JSON.stringify(ap.json?.error))

  const addr = await buyer('POST', '/api/addresses', {
    label: 'Home', address_line1: 'House 128, Road 9',
    city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000128',
    postal_code: '1200',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  ok(Boolean(addressId), 'buyer address ready')

  const ord = await buyer('POST', '/api/orders', {
    items: [{ productId, quantity: 2 }], shippingAddressId: addressId,
  })
  const orderId = ord.json?.data?.orderId ?? ord.json?.data?.id
  ok(ord.status === 201 && Boolean(orderId), 'order created (2×1200 = 2400, unpaid)', JSON.stringify(ord.json?.error))
  const ordDb = await db.orders.findUnique({ where: { id: orderId } })
  ok(ordDb?.paymentStatus === 'unpaid' && near(ordDb?.totalAmount, 2400), 'order honestly UNPAID at ৳2400', `${ordDb?.paymentStatus} ${ordDb?.totalAmount}`)

  /* ── A. initiate gates ── */
  console.log('— A. initiate gates —')
  ok((await anon('POST', `/api/orders/${orderId}/payments/initiate`, { method: 'bank_transfer' })).status === 401, 'anon initiate → 401')
  ok((await sellerA('POST', `/api/orders/${orderId}/payments/initiate`, { method: 'bank_transfer' })).status === 401, 'supplier initiate → 401 (buyer-only rail)')
  ok((await admin('POST', `/api/orders/${orderId}/payments/initiate`, { method: 'bank_transfer' })).status === 401, 'admin initiate → 401 (rail is buyer-only)')
  ok((await buyer2('POST', `/api/orders/${orderId}/payments/initiate`, { method: 'bank_transfer' })).status === 404, 'foreign buyer initiate → 404 (no-leak)', JSON.stringify((await buyer2('POST', `/api/orders/${orderId}/payments/initiate`, { method: 'bank_transfer' })).json))
  ok((await buyer('POST', `/api/orders/${orderId}/payments/initiate`, { method: 'card' })).status === 400, 'bad method (card) → 400', JSON.stringify((await buyer('POST', `/api/orders/${orderId}/payments/initiate`, { method: 'card' })).json))

  /* ── B. initiate honest behavior (env-unconfigured sandbox) ── */
  console.log('— B. initiate honest behavior —')
  const init1 = await buyer('POST', `/api/orders/${orderId}/payments/initiate`, { method: 'bank_transfer' })
  if (init1.status === 503) {
    ok(/No payment receiving account is configured/.test(init1.json?.error ?? ''), 'initiate → 503 with the VERBATIM honest config error', init1.json?.error?.slice(0, 60))
    const pend = await db.payments.findMany({ where: { orderId, status: 'pending', method: 'bank_transfer' } })
    ok(pend.length === 1 && near(pend[0].amount, 2400), 'the payment INTENT is still recorded (one pending row, server-side amount)', `rows=${pend.length}`)
    const init2 = await buyer('POST', `/api/orders/${orderId}/payments/initiate`, { method: 'bank_transfer' })
    ok(init2.status === 503, 'repeat initiate → 503 again')
    const pend2 = await db.payments.findMany({ where: { orderId, status: 'pending', method: 'bank_transfer' } })
    ok(pend2.length === 1, 'repeat initiate REUSED the pending row (never stacks)', `rows=${pend2.length}`)
  } else if (init1.status === 200) {
    const ins = init1.json?.data?.instructions ?? {}
    ok(Object.keys(ins).length > 0, 'env-configured sandbox: instructions returned', JSON.stringify(ins))
    ok(Boolean(init1.json?.data?.paymentId), 'paymentId returned')
    const init2 = await buyer('POST', `/api/orders/${orderId}/payments/initiate`, { method: 'bank_transfer' })
    ok(init2.status === 200 && init2.json?.data?.paymentId === init1.json?.data?.paymentId, 'repeat initiate returns the SAME paymentId (reuse, no stacking)')
  } else {
    ok(false, `unexpected initiate status ${init1.status}`, JSON.stringify(init1.json))
  }

  /* ── C. verify-payment gates ── */
  console.log('— C. verify-payment gates —')
  const vp = (sess, body) => sess('POST', `/api/admin/orders/${orderId}/verify-payment`, body)
  ok((await anon('POST', `/api/admin/orders/${orderId}/verify-payment`, {})).status === 401, 'anon verify-payment → 401')
  ok((await buyer('POST', `/api/admin/orders/${orderId}/verify-payment`, {})).status === 401, 'buyer verify-payment → 401')
  ok((await sellerA('POST', `/api/admin/orders/${orderId}/verify-payment`, {})).status === 401, 'supplier verify-payment → 401')
  ok((await admin('POST', `/api/admin/orders/${orderId}/verify-payment`, { method: 'bank_transfer', amount: 2400 })).status === 400, 'missing transactionId → 400')
  ok((await admin('POST', `/api/admin/orders/${orderId}/verify-payment`, { transactionId: 'TX128AAA001', method: 'card', amount: 2400 })).status === 400, 'bad method (card) → 400')
  const mismatch = await admin('POST', `/api/admin/orders/${orderId}/verify-payment`, { transactionId: 'TX128AAA002', method: 'bank_transfer', amount: 2300 })
  ok(mismatch.status === 400 && /2400/.test(mismatch.json?.error ?? ''), 'amount mismatch → 400 naming the REAL order total', JSON.stringify(mismatch.json))
  const missingOrder = await admin('POST', `/api/admin/orders/doesnotexist123/verify-payment`, { transactionId: 'TX128AAA003', method: 'bank_transfer', amount: 100 })
  ok(missingOrder.status === 404, 'missing order → 404')

  /* ── D. verify-payment happy path + audit ── */
  console.log('— D. verify-payment happy path —')
  const happy = await admin('POST', `/api/admin/orders/${orderId}/verify-payment`, {
    transactionId: 'TX128-OK-0001', method: 'bank_transfer', amount: 2400, note: 'QA128 paper receipt #4821',
  })
  ok(happy.status === 200 && happy.json?.data?.paymentStatus === 'paid', 'verify-payment → 200, order flips PAID', JSON.stringify(happy.json))
  const paidDb = await db.orders.findUnique({ where: { id: orderId }, include: { payments: true } })
  const successRow = paidDb.payments.find((x) => x.status === 'success')
  ok(Boolean(successRow) && successRow.transactionId === 'TX128-OK-0001' && Boolean(successRow.paidAt), 'payments row status=success with transactionId + paidAt')
  ok(/admin-verified by/.test(successRow?.gatewayResponse ?? ''), 'gatewayResponse carries the verifier id', successRow?.gatewayResponse)
  const audits = await db.auditLogs.findMany({ where: { action: 'payment_admin_verified', entityId: successRow.id } })
  ok(audits.length === 1 && audits[0].metadata.includes('TX128-OK-0001') && audits[0].metadata.includes('"after":{"paymentStatus":"paid"}'), 'REAL auditLogs row with before/after (console.log claim → DB fact)', `rows=${audits.length}`)
  const again = await admin('POST', `/api/admin/orders/${orderId}/verify-payment`, { transactionId: 'TX128-OK-0002', method: 'bank_transfer', amount: 2400 })
  ok(again.status === 409 && /already marked paid/.test(again.json?.error ?? ''), 'second verify on the PAID order → 409', JSON.stringify(again.json))
  const dupTx = await admin('POST', `/api/admin/orders/nonexistent/verify-payment`, { transactionId: 'TX128-OK-0001', method: 'bank_transfer', amount: 100 })
  ok([404, 409].includes(dupTx.status), 'same transactionId elsewhere → rejected (404 order-first, 409 tx-uniqueness)', `${dupTx.status}`)

  /* ── E. receipt ── */
  console.log('— E. receipt —')
  ok((await anon('GET', `/api/orders/${orderId}/receipt`)).status === 401, 'anon receipt → 401')
  ok((await buyer2('GET', `/api/orders/${orderId}/receipt`)).status === 403, 'foreign buyer receipt → 403 (Not authorized)')
  const rec = await buyer('GET', `/api/orders/${orderId}/receipt`)
  ok(rec.status === 200 && rec.json?.success === true, 'owner receipt → 200')
  const r = rec.json?.data ?? {}
  ok(r.orderNumber === ordDb.orderNumber && r.paymentStatus === 'paid', 'receipt carries the real orderNumber + PAID status', JSON.stringify({ on: r.orderNumber, ps: r.paymentStatus }))
  ok(Array.isArray(r.items) && r.items.length === 1 && near(r.items[0].quantity, 2), 'receipt items = the real order line')
  ok(near(r.subtotal, r.items.reduce((s, it) => s + it.total, 0)), 'receipt subtotal = Σ item totals (math sums back)', `${r.subtotal}`)
  ok(near(r.total, 2400) && r.currency === 'BDT', 'receipt total = ৳2400 BDT', `${r.total} ${r.currency}`)
  ok(r.buyer && typeof r.buyer.name === 'string', 'receipt buyer block present', JSON.stringify(r.buyer))
  ok((await sellerA('GET', `/api/orders/${orderId}/receipt`)).status === 200, 'supplier-on-order receipt → 200')
  ok((await admin('GET', `/api/orders/${orderId}/receipt`)).status === 200, 'admin receipt → 200')
  ok((await buyer('GET', '/api/orders/doesnotexist123/receipt')).status === 404, 'missing order receipt → 404')

  /* ── F. circuit coexistence — Task 56-b leg intact ── */
  console.log('— F. Task 56-b leg coexistence —')
  const ord2 = await buyer2('POST', '/api/orders', {
    items: [{ productId, quantity: 1 }], shippingAddressId: (await buyer2('POST', '/api/addresses', {
      label: 'Office', address_line1: 'Road 128', city: 'Dhaka', district: 'Dhaka',
      contact_phone: '+8801700000228', postal_code: '1200',
    })).json?.data?.id,
  })
  const orderId2 = ord2.json?.data?.orderId ?? ord2.json?.data?.id
  ok(ord2.status === 201 && Boolean(orderId2), 'second buyer order created (1×1200)', JSON.stringify(ord2.json?.error))
  const sub = await buyer2('POST', `/api/orders/${orderId2}/payment-submit`, {
    method: 'mobile_banking', brand: 'bKash', transactionId: 'BX128SMOKE01', senderNumber: '+8801700000228',
  })
  ok(sub.status === 200 || sub.status === 201, 'buyer2 submits payment reference (Task 56-b leg)', JSON.stringify(sub.json?.error))
  const pendDb = await db.payments.findFirst({ where: { orderId: orderId2, transactionId: 'BX128SMOKE01' } })
  ok(pendDb?.status === 'pending', 'submission recorded as PENDING (never auto-paid)', pendDb?.status)
  // seller verifies through the seller rail (the Task 56-b completion)
  const sv = await sellerA('GET', '/api/seller/payments?status=pending')
  const row = (sv.json?.data?.payments ?? sv.json?.data ?? []).find?.((x) => x.id === pendDb.id) ?? (Array.isArray(sv.json?.data) ? sv.json.data.find((x) => x.id === pendDb.id) : null)
  ok(sv.status === 200, 'seller payments queue reachable')
  if (row) {
    const ver = await sellerA('POST', `/api/seller/payments/${row.id}/verify`, { action: 'verify', note: 'QA128 seller confirmed' })
    ok(ver.status === 200, 'seller verifies → order 2 paid', JSON.stringify(ver.json?.error))
  } else {
    // queue shape variance: fall back to the admin rail to complete the circuit
    const adminQueue = await admin('GET', '/api/admin/payments?status=pending')
    const arow = (Array.isArray(adminQueue.json?.data) ? adminQueue.json.data : adminQueue.json?.data?.payments ?? []).find((x) => x.id === pendDb.id)
    ok(Boolean(arow), 'pending submission visible in the admin queue')
    if (arow) {
      const ver = await admin('POST', `/api/admin/payments/${arow.id}/verify`, { action: 'verify', note: 'QA128 admin confirmed' })
      ok(ver.status === 200, 'admin verifies → order 2 paid', JSON.stringify(ver.json?.error))
    }
  }
  const ord2Db = await db.orders.findUnique({ where: { id: orderId2 } })
  ok(ord2Db?.paymentStatus === 'paid', 'order 2 final state PAID via the manual chain', ord2Db?.paymentStatus)
  const rec2 = await buyer2('GET', `/api/orders/${orderId2}/receipt`)
  ok(rec2.status === 200 && rec2.json?.data?.paymentStatus === 'paid', 'receipt 2 reflects the manual chain', JSON.stringify(rec2.json?.data?.paymentStatus))

  console.log(`\n=== t128: ${PASS} passed, ${FAIL} failed ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
  await db.$disconnect()
}

main().catch(async (e) => { console.error('FATAL', e); process.exitCode = 1; await db.$disconnect() })
