/**
 * Task 59 E2E — SELLER RETURNS LEG + ADMIN FORCE-CANCEL (real HTTP + real sockets + real DB).
 *
 * Covers, against a LIVE dev server on :3000:
 *   A) GET /api/seller/returns — scoping (only YOUR items of a multi-supplier
 *      return), prorated sellerShare math, status filter, guards (401/403/400).
 *   B) return:new broadcast on the seller room when the buyer files a return.
 *   C) POST /api/admin/orders/[id]/cancel (force) — unpaid path (paymentsFailed,
 *      total→0, stock restored), paid path (success payments → refunded,
 *      paymentStatus refunded, total intact, stock restored), guards
 *      (401 buyer, 404 unknown, 409 already-cancelled, 400 bad body), audit row.
 *   D) product:stock broadcast on force-cancel (public product room).
 *   E) Buyer self-cancel regression (Task 57) still green.
 *
 * Run: bun scripts/qa/t59-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
import { io } from 'socket.io-client'
import { PrismaClient } from '@prisma/client'

const BASE = 'http://127.0.0.1:3000'
const db = new PrismaClient()

let pass = 0
let fail = 0
const failures = []
function ok(cond, label, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; failures.push(label); console.log(`  ✗ FAIL: ${label} ${extra}`) }
}
const section = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 62 - t.length))}`)

/** Tiny cookie-jar session with a STABLE per-session client IP (the
 *  register/login limiters are per-IP and x-forwarded-for aware — a QA run
 *  presents itself as its own client, like any real gateway-proxied user). */
function makeSession() {
  let cookie = ''
  const ip = `10.77.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body, opts = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        'X-Forwarded-For': ip,
        ...(opts.headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const setCookie = res.headers.getSetCookie?.() ?? []
    for (const c of setCookie) {
      const pair = c.split(';')[0]
      if (pair) cookie = cookie ? `${cookie}; ${pair}` : pair
    }
    const json = await res.json().catch(() => null)
    return { status: res.status, json }
  }
}

const ts = Date.now().toString(36)
const EMAIL = (role) => `t59-${role}-${ts}@qa.local`
const PASSWORD = 't59-Force-Long1!'

/** Register → fallback login. Retries on 429 with backoff. Returns the
 *  FINAL auth status; anything non-2xx is a real failure and the caller
 *  asserts on it (no more <500 false positives). */
async function registerAndLogin(session, userType, email) {
  const payload = {
    userType, authProvider: 'email', email, password: PASSWORD,
    fullName: `T59 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `T59 Shop ${email.slice(4, 12)}` } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) return reg.status
    if (reg.status !== 429) break
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password: PASSWORD })
    if (login.status === 200 || login.status === 201) return login.status
    if (login.status !== 429) return login.status
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
  }
  return 429
}

function waitForEvent(socket, event, ms = 4000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { socket.off(event, h); resolve(null) }, ms)
    const h = (payload) => { clearTimeout(t); socket.off(event, h); resolve(payload) }
    socket.on(event, h)
  })
}

const main = async () => {
  console.log(`\nT59 E2E — server ${BASE} — run ${new Date().toISOString()}`)

  const admin = makeSession()
  const sellerA = makeSession()
  const sellerB = makeSession()
  const buyer = makeSession()

  section('bootstrap — real users through real register/login')
  const emails = { admin: EMAIL('admin'), a: EMAIL('supa'), b: EMAIL('supb'), buyer: EMAIL('buyer') }
  ok((await registerAndLogin(admin, 'admin', emails.admin)) < 300, 'admin session ready')
  ok((await registerAndLogin(sellerA, 'supplier', emails.a)) < 300, 'sellerA session ready')
  ok((await registerAndLogin(sellerB, 'supplier', emails.b)) < 300, 'sellerB session ready')
  ok((await registerAndLogin(buyer, 'buyer', emails.buyer)) < 300, 'buyer session ready')

  // Category (admin).
  const cat = await admin('POST', '/api/admin/categories', { name: `T59 Cat ${ts}`, isActive: true })
  ok(cat.status === 201 || cat.status === 200, 'admin creates category', JSON.stringify(cat.json))
  const categoryId = cat.json?.data?.id ?? cat.json?.id

  // Products (sellers) — A: kg 50 stock @100; B: pcs 20 stock @200.
  const prodA = await sellerA('POST', '/api/supplier/products', {
    name: `T59widget-A-${ts}`, description: 'QA t59 product A (kg)', categoryId, unit: 'kg', moq: 1, basePrice: 100,
    stockQuantity: 50, stockAlertThreshold: 5, priceTiers: [{ minQty: 1, pricePerUnit: 100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  ok(prodA.status === 201, 'sellerA creates product (kg/50)', JSON.stringify(prodA.json)?.slice(0, 200))
  const productIdA = prodA.json?.data?.id ?? prodA.json?.id

  const prodB = await sellerB('POST', '/api/supplier/products', {
    name: `T59widget-B-${ts}`, description: 'QA t59 product B (pcs)', categoryId, unit: 'pcs', moq: 1, basePrice: 200,
    stockQuantity: 20, stockAlertThreshold: 5, priceTiers: [{ minQty: 1, pricePerUnit: 200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  ok(prodB.status === 201, 'sellerB creates product (pcs/20)')
  const productIdB = prodB.json?.data?.id ?? prodB.json?.id

  // Real moderation: admin approves both products (a fresh product is NOT
  // purchasable until a real admin approves it — orders POST enforces
  // isApproved; this is the platform's honest moderation gate).
  const apprA = await admin('PATCH', '/api/admin/products', { productId: productIdA, action: 'approve', reason: 'QA t59' })
  const apprB = await admin('PATCH', '/api/admin/products', { productId: productIdB, action: 'approve', reason: 'QA t59' })
  ok(apprA.status === 200 && apprB.status === 200, 'admin approves both products (real moderation gate)', JSON.stringify(apprA.json)?.slice(0, 140))

  // Buyer address.
  const addr = await buyer('POST', '/api/addresses', {
    label: 'T59 HQ', address_line1: '12 QA Street', city: 'Dhaka', district: 'Dhaka',
    postal_code: '1213', contact_phone: '01700000000',
  })
  ok(addr.status === 201 || addr.status === 200, 'buyer address created')
  const addressId = addr.json?.data?.id ?? addr.json?.id

  section('order #1 — multi-supplier, paid, delivered (the return subject)')
  const ord = await buyer('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId: productIdA, quantity: 10 }, { productId: productIdB, quantity: 2 }],
  })
  ok(ord.status === 201, 'buyer places 2-supplier order (10kg A + 2pcs B)', JSON.stringify(ord.json)?.slice(0, 200))
  const orderId = ord.json?.data?.orderId
  ok(Boolean(orderId), 'orderId present')
  const detail = await buyer('GET', `/api/orders/${orderId}`)
  const subs = detail.json?.data?.subOrders ?? []
  ok(subs.length === 2, 'order has 2 subOrders (one per supplier)')
  const itemA = (subs.find((s) => s.items?.some((i) => i.productId === productIdA))?.items ?? []).find((i) => i.productId === productIdA)
  const itemB = (subs.find((s) => s.items?.some((i) => i.productId === productIdB))?.items ?? []).find((i) => i.productId === productIdB)
  ok(Boolean(itemA?.id) && Boolean(itemB?.id), 'orderItem ids resolved for both suppliers')
  if (!itemA?.id || !itemB?.id) throw new Error('harness cannot continue: orderItem ids missing')
  const total = detail.json?.data?.totalAmount
  const itemATotal = itemA?.totalPrice, itemBTotal = itemB?.totalPrice

  // Pay in full → sellerA verifies → paid.
  const pay = await buyer('POST', `/api/orders/${orderId}/payment-submit`, {
    method: 'mobile_banking', brand: 'bKash', transactionId: `T59PAY${ts}`.toUpperCase(), senderNumber: '01700000000',
  })
  ok(pay.status === 201, 'buyer submits full payment reference (pending)', JSON.stringify(pay.json)?.slice(0, 140))
  const payList = await sellerA('GET', '/api/seller/payments?status=pending')
  const payRow = (payList.json?.data ?? []).find((p) => p.orderId === orderId)
  ok(Boolean(payRow?.id), 'sellerA sees the pending payment in their inbox')
  if (!payRow?.id) throw new Error('harness cannot continue: pending payment row missing')
  const verify = await sellerA('POST', `/api/seller/payments/${payRow.id}/verify`, { action: 'verify' })
  ok(verify.status === 200, 'sellerA verifies → honest math')
  const detailAfterPay = await buyer('GET', `/api/orders/${orderId}`)
  ok(detailAfterPay.json?.data?.paymentStatus === 'paid', 'order paymentStatus → paid')

  // Both sellers deliver their own shipments.
  const subA = subs.find((s) => s.items?.some((i) => i.productId === productIdA))
  const subB = subs.find((s) => s.items?.some((i) => i.productId === productIdB))
  const dA = await sellerA('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: subA.id })
  const dB = await sellerB('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: subB.id })
  ok(dA.status === 200 && dB.status === 200, 'both subOrders moved to delivered by their own sellers')

  section('B) return:new broadcast + buyer files the multi-supplier return')
  // Socket: sellerA private room + public product room for later force-cancel.
  const meA = await sellerA('GET', '/api/profile/me')
  const profileIdA = meA.json?.data?.supplierProfile?.id
  ok(Boolean(profileIdA), 'sellerA supplierProfile id resolved')
  const tokA = await sellerA('GET', `/api/realtime/room-token?room=seller:${profileIdA}`)
  ok(tokA.status === 200 && Boolean(tokA.json?.token), 'sellerA room token minted')

  const sockA = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  const sockP = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  const connected = Promise.all([
    new Promise((r) => sockA.on('connect', r)),
    new Promise((r) => sockP.on('connect', r)),
  ])
  await connected
  sockA.emit('subscribe', { room: `seller:${profileIdA}`, token: tokA.json.token })
  const subAck = await waitForEvent(sockA, 'subscribe:ok')
  ok(Boolean(subAck), 'sellerA joined their private room (subscribe:ok)')
  sockP.emit('subscribe', { room: `product:${productIdA}` })
  const subAckP = await waitForEvent(sockP, 'subscribe:ok')
  ok(Boolean(subAckP), 'public product room joined without token')

  const retPromise = waitForEvent(sockA, 'return:new')
  const ret = await buyer('POST', `/api/orders/${orderId}/return`, {
    shippingMethod: 'pickup',
    items: [
      { itemId: itemA.id, reason: 'damaged in transit', quantity: 4, comments: 'box crushed' },
      { itemId: itemB.id, reason: 'wrong size label', quantity: 2 },
    ],
  })
  ok(ret.status === 200 || ret.status === 201, 'buyer files return (4/10 of A + 2/2 of B)', JSON.stringify(ret.json)?.slice(0, 160))
  const returnId = ret.json?.data?.id
  const retEvent = await retPromise
  ok(Boolean(retEvent) && retEvent.returnNumber === ret.json?.data?.returnNumber, 'sellerA socket received return:new (real persisted values)')

  section('A) GET /api/seller/returns — scoping + honest share math')
  const srA = await sellerA('GET', '/api/seller/returns')
  ok(srA.status === 200 && srA.json?.success, 'sellerA list 200')
  const rowA = (srA.json?.data ?? []).find((r) => r.id === returnId)
  ok(Boolean(rowA), 'sellerA sees the return that touches their goods')
  ok(rowA?.items?.length === 1 && rowA.items[0].orderItemId === itemA.id, 'sellerA sees ONLY their item (B line invisible)')
  ok(rowA?.items?.[0]?.quantity === 4, 'returned quantity 4/10 shown')
  const expectedShareA = Math.round(((itemATotal * 4) / itemA.quantity) * 100) / 100
  ok(Math.abs((rowA?.sellerShare ?? 0) - expectedShareA) < 0.01, `sellerShare prorated = ${expectedShareA}`, `got ${rowA?.sellerShare}`)
  ok(rowA?.status === 'pending', 'status pending (admin not resolved yet)')

  const srB = await sellerB('GET', '/api/seller/returns')
  const rowB = (srB.json?.data ?? []).find((r) => r.id === returnId)
  ok(Boolean(rowB) && rowB?.items?.length === 1 && rowB.items[0].orderItemId === itemB.id, 'sellerB sees ONLY their item')
  ok(Math.abs((rowB?.sellerShare ?? 0) - itemBTotal) < 0.01, 'sellerB share = full B line value (2/2 returned)')

  const srPending = await sellerA('GET', '/api/seller/returns?status=pending')
  ok((srPending.json?.data ?? []).some((r) => r.id === returnId), '?status=pending includes it')
  const srRef = await sellerA('GET', '/api/seller/returns?status=refunded')
  ok(!(srRef.json?.data ?? []).some((r) => r.id === returnId), '?status=refunded excludes it (real filter)')
  const srBad = await sellerA('GET', '/api/seller/returns?status=bogus')
  ok(srBad.status === 400, 'invalid ?status → 400')
  const srAnon = await makeSession()('GET', '/api/seller/returns')
  ok(srAnon.status === 401, 'unauthenticated → 401')
  const srBuyer = await buyer('GET', '/api/seller/returns')
  ok(srBuyer.status === 403, 'buyer (no supplier profile) → 403 SUPPLIER_PROFILE_REQUIRED')

  section('C) force-cancel — UNPAID order (paymentsFailed, total→0, stock restored)')
  const ord2 = await buyer('POST', '/api/orders', { shippingAddressId: addressId, items: [{ productId: productIdA, quantity: 5 }] })
  ok(ord2.status === 201, 'order #2 placed (5kg A) — stock A 40→35')
  const orderId2 = ord2.json?.data?.orderId
  const anon = makeSession()
  ok((await anon('POST', `/api/admin/orders/${orderId2}/cancel`, {})).status === 401, 'unauthenticated force-cancel → 401')
  ok((await buyer('POST', `/api/admin/orders/${orderId2}/cancel`, {})).status === 401, 'buyer cannot force-cancel → 401')
  ok((await admin('POST', '/api/admin/orders/nonexistent-id/cancel', {})).status === 404, 'unknown order → 404')
  ok((await admin('POST', `/api/admin/orders/${orderId2}/cancel`, { reason: 'x'.repeat(501) })).status === 400, 'reason > 500 chars → 400')

  const stockBefore = await fetch(`${BASE}/api/products/${productIdA}`).then((r) => r.json())
  const stockBeforeVal = stockBefore?.data?.stockQuantity ?? stockBefore?.stockQuantity
  const stockPromise = waitForEvent(sockP, 'product:stock')
  const fc1 = await admin('POST', `/api/admin/orders/${orderId2}/cancel`, { reason: 'QA t59 unpaid force-cancel' })
  ok(fc1.status === 200, 'admin force-cancels unpaid order → 200', JSON.stringify(fc1.json)?.slice(0, 160))
  ok(fc1.json?.data?.paymentStatus === 'unpaid', 'paymentStatus stays unpaid (no verified money)')
  ok(fc1.json?.data?.totalAmount === 0, 'totalAmount → 0 (nothing owed once nothing ships)')
  ok(fc1.json?.data?.paymentsFailed === 0 && fc1.json?.data?.paymentsRefunded === 0, 'no payments to touch on this path')
  const stockEvent = await stockPromise
  ok(Boolean(stockEvent), 'product:stock broadcast fired on force-cancel')
  const stockAfter = await fetch(`${BASE}/api/products/${productIdA}`).then((r) => r.json())
  const stockAfterVal = stockAfter?.data?.stockQuantity ?? stockAfter?.stockQuantity
  ok(Math.abs(stockAfterVal - (stockBeforeVal + 5)) < 0.001, `stock restored ${stockBeforeVal}→${stockAfterVal} (+5)`)
  ok((await admin('POST', `/api/admin/orders/${orderId2}/cancel`, {})).status === 409, 're-cancel → 409 already cancelled')
  const buyerSelfOnCancelled = await buyer('POST', `/api/orders/${orderId2}/cancel`)
  ok(buyerSelfOnCancelled.status === 409, 'buyer self-cancel on force-cancelled order → 409 (guard intact)')

  section('C) force-cancel — PAID order (success payment → refunded, total intact)')
  const ord3 = await buyer('POST', '/api/orders', { shippingAddressId: addressId, items: [{ productId: productIdB, quantity: 3 }] })
  ok(ord3.status === 201, 'order #3 placed (3pcs B) — stock B 18→15')
  const orderId3 = ord3.json?.data?.orderId
  const d3 = await buyer('GET', `/api/orders/${orderId3}`)
  const total3 = d3.json?.data?.totalAmount
  await buyer('POST', `/api/orders/${orderId3}/payment-submit`, {
    method: 'bank_transfer', brand: 'Bank', transactionId: `T59BNK${ts}`.toUpperCase(), senderNumber: '01700000001',
  })
  const payListB = await sellerB('GET', '/api/seller/payments?status=pending')
  const payRowB = (payListB.json?.data ?? []).find((p) => p.orderId === orderId3)
  ok((await sellerB('POST', `/api/seller/payments/${payRowB.id}/verify`, { action: 'verify' })).status === 200, 'sellerB verifies → paid')
  const fc2 = await admin('POST', `/api/admin/orders/${orderId3}/cancel`, { reason: 'QA t59 paid force-cancel (fraud check)' })
  ok(fc2.status === 200, 'admin force-cancels PAID order → 200')
  ok(fc2.json?.data?.paymentsRefunded === 1, 'verified payment → refunded')
  ok(Math.abs((fc2.json?.data?.refundedAmount ?? 0) - total3) < 0.01, `refundedAmount = verified money ৳${total3}`)
  ok(fc2.json?.data?.paymentStatus === 'refunded', 'order paymentStatus → refunded')
  ok(Math.abs((fc2.json?.data?.totalAmount ?? 0) - total3) < 0.01, 'totalAmount stays INTACT (charged historical value)')
  const stockBAfter = await fetch(`${BASE}/api/products/${productIdB}`).then((r) => r.json())
  const stockBVal = stockBAfter?.data?.stockQuantity ?? stockBAfter?.stockQuantity
  ok(Math.abs(stockBVal - 18) < 0.001, `stock B restored to 18 (got ${stockBVal})`)
  const refundedPayments = await admin('GET', '/api/admin/payments?status=refunded')
  ok(JSON.stringify(refundedPayments.json).includes(orderId3), 'admin payments list shows the refunded row')

  section('audit — real order_force_cancelled row with before/after')
  const audits = await db.auditLogs.findMany({ where: { action: 'order_force_cancelled', entityId: { in: [orderId2, orderId3] } } })
  ok(audits.length === 2, '2 force-cancel audit rows in the real DB')
  const auditPaid = audits.find((a) => a.entityId === orderId3)
  const meta = JSON.parse(auditPaid?.metadata ?? '{}')
  ok(meta?.before?.paymentStatus === 'paid' && meta?.after?.paymentStatus === 'refunded', 'audit before/after carries the real money transition')
  ok(meta?.reason === 'QA t59 paid force-cancel (fraud check)', 'audit keeps the admin reason')
  ok(meta?.actorType === 'admin', 'audit marks actorType admin')

  section('E) Task 57 regression — buyer self-cancel on an UNPAID order still works')
  const ord4 = await buyer('POST', '/api/orders', { shippingAddressId: addressId, items: [{ productId: productIdA, quantity: 1 }] })
  const orderId4 = ord4.json?.data?.orderId
  const selfCancel = await buyer('POST', `/api/orders/${orderId4}/cancel`)
  ok(selfCancel.status === 200, 'buyer self-cancels unpaid order #4 → 200')
  // Exact stock ledger for A: 50 start −10 (order1) −5 (order2) +5 (force-cancel #2) −1 (order4) +1 (self-cancel) = 40.
  const stockA2 = await fetch(`${BASE}/api/products/${productIdA}`).then((r) => r.json())
  const stockAFinal = stockA2?.data?.stockQuantity ?? -1
  ok(Math.abs(stockAFinal - 40) < 0.001, `EXACT stock A ledger = 40 (50 −10 −5 +5 −1 +1), got ${stockAFinal}`)

  sockA.disconnect(); sockP.disconnect()

  console.log(`\n${'═'.repeat(66)}`)
  console.log(`RESULT: ${pass} passed, ${fail} failed`)
  if (failures.length) { console.log('FAILURES:'); for (const f of failures) console.log(`  - ${f}`) }
  console.log('═'.repeat(66))
  await db.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('HARNESS CRASH:', e)
  await db.$disconnect()
  process.exit(2)
})
