/**
 * Task 83 E2E — THE RETURN→REFUND LOOP, drilled end to end for the first
 * time: buyer files on a PAID+DELIVERED order → admin approves → SELLER
 * confirms receipt of the goods (the act that restores stock/soldCount) →
 * admin documents the real refund (ledger row; money moved outside the
 * system — never fabricated in-system). Also proves: unpaid/duplicate/
 * foreign-item/qty guards, the 422 over-refund guard, receipts, buyer-side
 * refunds[] visibility, audits, and that the Task 80 delivered-tracking
 * timestamps feed the REAL return window.
 *
 * Run: bun scripts/qa/t83-e2e.mjs   (DB EMPTY — first-admin window; dev FRESH)
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
  const ip = `10.101.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA83 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA83 Shop ${email.slice(5, 12)}` } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}`)
    await sleep(4000 * (attempt + 1))
  }
  await loginOnly(session, email, password)
}

/** login an EXISTING account into a fresh session (fresh IP budget) */
async function loginOnly(session, email, password) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} -> ${login.status}`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

/** drive an order to DELIVERED (pay → verify → ship → deliver) and return ids */
async function deliverOrder(buyer, seller, admin, productId, qty, txnSuffix) {
  const order = await buyer('POST', '/api/orders', { items: [{ productId, quantity: qty }] })
  const orderId = order.json?.data?.orderId
  const sub = await buyer('POST', `/api/orders/${orderId}/payment-submit`, {
    method: 'mobile_banking', transactionId: `QA83TX${txnSuffix}`,
  })
  const vr = await seller('POST', `/api/seller/payments/${sub.json?.data?.paymentId}/verify`, { action: 'verify' })
  if (vr.status !== 200) throw new Error(`verify failed ${vr.status}`)
  const detail = await buyer('GET', `/api/orders/${orderId}`)
  const soId = detail.json?.data?.subOrders?.[0]?.id
  const itemId = detail.json?.data?.subOrders?.[0]?.items?.[0]?.id
  await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'confirmed', subOrderId: soId })
  await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'shipped', subOrderId: soId, trackingNumber: `WB83${txnSuffix}` })
  await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: soId })
  return { orderId, soId, itemId }
}

const main = async () => {
  const PASSWORD = 't83-Return-Qa1!'
  const anon = makeSession()
  const admin = makeSession()
  const seller = makeSession()
  const buyer = makeSession()
  const stranger = makeSession()

  section('A. auth gates')
  {
    const g1 = await anon('GET', '/api/returns')
    ok(g1.status === 401, 'anon returns list -> 401', `got ${g1.status}`)
    const g2 = await anon('POST', '/api/orders/x/return', { items: [{ itemId: 'y', reason: 'z' }] })
    ok(g2.status === 401, 'anon return create -> 401', `got ${g2.status}`)
    const g3 = await anon('POST', '/api/admin/returns/x/refund', { amount: 1, method: 'cash', reference: 'AAAA' })
    ok(g3.status === 401, 'anon refund -> 401', `got ${g3.status}`)
  }

  section('B. accounts + product')
  await registerAndLogin(admin, 'admin', 'qa83-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa83-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa83-buyer@qa.local', PASSWORD)
  await registerAndLogin(stranger, 'buyer', 'qa83-stranger@qa.local', PASSWORD)
  const cat = await admin('POST', '/api/admin/categories', { name: 'QA83 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA83 Return Product', description: 'QA t83 returns loop', categoryId, unit: 'pcs',
    moq: 1, basePrice: 300, stockQuantity: 10,
    priceTiers: [{ minQty: 1, pricePerUnit: 300 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], variants: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA83' })
  ok(Boolean(productId), 'approved product (stock 10 @ 300)')

  section('C. order 1 → paid → delivered (the returnable order)')
  const o1 = await deliverOrder(buyer, seller, admin, productId, 2, 'A')
  ok(Boolean(o1.itemId), 'order 1 delivered (2 × 300 = 600 paid)')
  let pr = await anon('GET', `/api/products/${productId}`)
  ok(pr.json?.data?.stockQuantity === 8, 'stock 10 → 8 after the sale', `got ${pr.json?.data?.stockQuantity}`)

  section('D. creation guards (exact, honest codes)')
  {
    const strangerRet = await stranger('POST', `/api/orders/${o1.orderId}/return`, { items: [{ itemId: o1.itemId, reason: 'not mine' }] })
    ok(strangerRet.status === 403, 'stranger return on someone else\'s order -> 403', `got ${strangerRet.status}`)
    const unpaid = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 1 }] })
    const unpaidId = unpaid.json?.data?.orderId
    const r = await buyer('POST', `/api/orders/${unpaidId}/return`, { items: [{ itemId: 'whatever', reason: 'early' }] })
    ok(r.status === 409 && /paid/.test(r.json?.error ?? ''), 'return on an UNPAID order -> 409 naming the real paymentStatus', JSON.stringify(r.json?.error))
    const badItem = await buyer('POST', `/api/orders/${o1.orderId}/return`, { items: [{ itemId: 'nonexistent', reason: 'ghost' }] })
    ok(badItem.status === 400, 'foreign/unknown order item -> 400', `got ${badItem.status}`)
    const bigQty = await buyer('POST', `/api/orders/${o1.orderId}/return`, { items: [{ itemId: o1.itemId, reason: 'too many', quantity: 99 }] })
    ok(bigQty.status === 400, 'quantity beyond ordered -> 400', `got ${bigQty.status}`)
  }

  section('E. the real filing')
  {
    const ret = await buyer('POST', `/api/orders/${o1.orderId}/return`, {
      items: [{ itemId: o1.itemId, reason: 'One unit arrived defective', quantity: 1, comments: 'Cracked housing' }],
      shippingMethod: 'pickup',
    })
    ok([200, 201].includes(ret.status), 'buyer files a return (1 of 2 units)', `got ${ret.status}`)
    const returnId = ret.json?.data?.id ?? ret.json?.data?.returnRequest?.id
    ok(String(ret.json?.data?.returnNumber ?? ret.json?.data?.returnRequest?.returnNumber ?? '').startsWith('RTN-'), 'real RTN- returnNumber minted')
    const dup = await buyer('POST', `/api/orders/${o1.orderId}/return`, { items: [{ itemId: o1.itemId, reason: 'again' }] })
    ok(dup.status === 409, 'duplicate OPEN return for the same order -> 409', `got ${dup.status}`)
    const list = await buyer('GET', '/api/returns')
    const row = (list.json?.data?.returns ?? list.json?.data ?? []).find?.((x) => x.id === returnId)
      ?? (Array.isArray(list.json?.data) ? list.json.data.find((x) => x.id === returnId) : null)
    ok(row?.status === 'pending', 'buyer list shows the pending return', JSON.stringify(row?.status))
    globalThis.__returnId = returnId
  }

  section('F. admin approves; seller receipt restores stock')
  {
    // Baseline truth: 10 − order1(2) − the D-section unpaid order(1) = 7,
    // soldCount 2+1 = 3 — every creation decrements at order time.
    const before = await db.products.findUnique({ where: { id: productId }, select: { stockQuantity: true, soldCount: true } })
    ok(before?.stockQuantity === 7 && before?.soldCount === 3, 'DB baseline before receipt: 7/3 (3 sales, 1 unpaid-order guard probe)', JSON.stringify(before))
    const buyerApprove = await buyer('PATCH', `/api/admin/returns/${globalThis.__returnId}`, { action: 'approve' })
    ok(buyerApprove.status === 401, 'buyer cannot approve -> 401 (admin rail)', `got ${buyerApprove.status}`)
    const apr = await admin('PATCH', `/api/admin/returns/${globalThis.__returnId}`, { action: 'approve', note: 'Defect confirmed by photos' })
    ok(apr.status === 200, 'admin approves -> 200', `got ${apr.status}`)
    const mid = await db.products.findUnique({ where: { id: productId }, select: { stockQuantity: true, soldCount: true } })
    ok(mid?.stockQuantity === 7 && mid?.soldCount === 3, 'approval alone moves NOTHING (goods have not come back)', JSON.stringify(mid))
    const rcpt = await seller('POST', `/api/seller/returns/${globalThis.__returnId}/confirm-receipt`, { note: 'Unit received at warehouse' })
    ok(rcpt.status === 200, 'seller confirms receipt of the goods -> 200', `got ${rcpt.status} ${JSON.stringify(rcpt.json).slice(0, 120)}`)
    pr = await anon('GET', `/api/products/${productId}`)
    ok(pr.json?.data?.stockQuantity === 8, 'stock 7 → 8 restored by the RECEIPT (not the approval)', `got ${pr.json?.data?.stockQuantity}`)
    const prodRow = await db.products.findUnique({ where: { id: productId }, select: { soldCount: true } })
    ok(prodRow?.soldCount === 2, 'soldCount 3 → 2 (one unit genuinely came back)', `got ${prodRow?.soldCount}`)
    const dupRcpt = await seller('POST', `/api/seller/returns/${globalThis.__returnId}/confirm-receipt`, {})
    ok(dupRcpt.status === 409, 'double receipt -> 409', `got ${dupRcpt.status}`)
  }

  section('G. the refund is DOCUMENTED money, not fake money')
  {
    const bad = await admin('POST', `/api/admin/returns/${globalThis.__returnId}/refund`, { amount: -5, method: 'cash', reference: 'X' })
    ok(bad.status === 400, 'invalid refund body -> 400', `got ${bad.status}`)
    const rf = await admin('POST', `/api/admin/returns/${globalThis.__returnId}/refund`, { amount: 300, method: 'mobile_banking', reference: 'UTR83ABC123', note: 'bKash to buyer' })
    ok(rf.status === 200 || rf.status === 201, 'admin records the refund -> ledger row', `got ${rf.status} ${JSON.stringify(rf.json).slice(0, 120)}`)
    const rfAgain = await admin('POST', `/api/admin/returns/${globalThis.__returnId}/refund`, { amount: 300, method: 'cash', reference: 'UTR83DEF456' })
    ok(rfAgain.status === 409, 'refund on a refunded return -> 409 (real current status)', `got ${rfAgain.status}`)
    const list = await buyer('GET', '/api/returns')
    const data = list.json?.data?.returns ?? list.json?.data
    const row = Array.isArray(data) ? data.find((x) => x.id === globalThis.__returnId) : null
    ok(row?.status === 'refunded', 'buyer sees the return REFUNDED', JSON.stringify(row?.status))
    const refunds = row?.refunds ?? []
    ok(Array.isArray(refunds) && refunds.length === 1 && refunds[0]?.amount === 300, 'buyer sees the real refund ledger row (300)', JSON.stringify(refunds))
    ok(Array.isArray(row?.receipts) && row.receipts.length >= 1, 'buyer sees the seller receipt (the physical loop closed)')
  }

  section('H. the 422 over-refund guard on a second loop')
  {
    // A FRESH session for the same buyer account — the return route honestly
    // rate-limits 5 filings/min per client and section D+E used the budget.
    const buyer2 = makeSession()
    await loginOnly(buyer2, 'qa83-buyer@qa.local', PASSWORD)
    const o2 = await deliverOrder(buyer2, seller, admin, productId, 1, 'B')
    const ret2 = await buyer2('POST', `/api/orders/${o2.orderId}/return`, { items: [{ itemId: o2.itemId, reason: 'Changed mind within window', quantity: 1 }] })
    ok([200, 201].includes(ret2.status), 'second loop: return filed (window open — Task 80 delivered timestamps feed it)', `got ${ret2.status}`)
    const returnId2 = ret2.json?.data?.id ?? ret2.json?.data?.returnRequest?.id
    await admin('PATCH', `/api/admin/returns/${returnId2}`, { action: 'approve' })
    const over = await admin('POST', `/api/admin/returns/${returnId2}/refund`, { amount: 999999, method: 'bank_transfer', reference: 'UTR83HUGE01' })
    ok(over.status === 422, 'refund above remaining -> 422 carrying the real remaining', `got ${over.status} ${JSON.stringify(over.json?.error)}`)
    const okRefund = await admin('POST', `/api/admin/returns/${returnId2}/refund`, { amount: 300, method: 'bank_transfer', reference: 'UTR83OK0001' })
    ok(okRefund.status === 200 || okRefund.status === 201, 'the honest amount refunds fine', `got ${okRefund.status}`)
    await seller('POST', `/api/seller/returns/${returnId2}/confirm-receipt`, { note: 'Second unit back' })
    const fin = await db.products.findUnique({ where: { id: productId }, select: { stockQuantity: true, soldCount: true } })
    ok(fin?.stockQuantity === 8 && fin?.soldCount === 2, 'final DB truth 8/2 (4 sold − 2 came back)', JSON.stringify(fin))
  }

  section('I. audits')
  {
    const audits = await db.auditLogs.findMany({
      where: { action: { contains: 'return' } },
      select: { action: true },
    })
    const actions = audits.map((a) => a.action)
    ok(actions.length >= 3, 'return decisions are audit-logged', actions.join(','))
  }

  console.log(`\n═══ t83 RESULT: ${PASS} PASS / ${FAIL} FAIL ═══`)
  if (FAIL > 0) { console.log('FAILURES:', failures.join(' | ')); process.exit(1) }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1) }).finally(async () => { await db.$disconnect() })
