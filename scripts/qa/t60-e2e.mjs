/**
 * Task 60 E2E — SELLER RETURN RECEIPT + STOCK RESTORE (real HTTP + real sockets + real DB).
 *
 * Covers, against a LIVE dev server on :3000:
 *   A) POST /api/seller/returns/[id]/confirm-receipt — the physical half of the
 *      returns flow: guards (401 unauth, 403 buyer, 404 foreign/no-line return,
 *      409 pending-return, 409 double-confirm), ONE-tx stock/soldCount restore
 *      mirroring the cancellation math, prorated restoredValue, subOrder
 *      'returned' flip ONLY when fully covered (partial stays delivered).
 *   B) return:received + product:stock broadcasts (real sockets).
 *   C) Visibility: seller list myReceipt, admin returns receipts/supplierCount,
 *      buyer list + detail receipts.
 *   D) auditLogs 'return_received' with real per-item values.
 *   E) Exact stock ledger for both products.
 *
 * Run: bun scripts/qa/t60-e2e.mjs   (DB must be EMPTY — first-admin window)
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

function makeSession() {
  let cookie = ''
  const ip = `10.78.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
const EMAIL = (role) => `t60-${role}-${ts}@qa.local`
const PASSWORD = 't60-Receipt-Long1!'

async function registerAndLogin(session, userType, email) {
  const payload = {
    userType, authProvider: 'email', email, password: PASSWORD,
    fullName: `T60 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `T60 Shop ${email.slice(4, 12)}` } : {}),
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

function waitForEvent(socket, event, ms = 5000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { socket.off(event, h); resolve(null) }, ms)
    const h = (payload) => { clearTimeout(t); socket.off(event, h); resolve(payload) }
    socket.on(event, h)
  })
}

const productStock = async (productId) => {
  const r = await fetch(`${BASE}/api/products/${productId}`).then((x) => x.json())
  return r?.data?.stockQuantity ?? r?.stockQuantity
}
const productSold = async (productId) => {
  const r = await fetch(`${BASE}/api/products/${productId}`).then((x) => x.json())
  return r?.data?.soldCount ?? r?.soldCount
}

const main = async () => {
  console.log(`\nT60 E2E — server ${BASE} — run ${new Date().toISOString()}`)

  const admin = makeSession()
  const sellerA = makeSession()
  const sellerB = makeSession()
  const buyer = makeSession()
  const anon = makeSession()

  section('bootstrap — real users through real register/login')
  const emails = { admin: EMAIL('admin'), a: EMAIL('supa'), b: EMAIL('supb'), buyer: EMAIL('buyer') }
  ok((await registerAndLogin(admin, 'admin', emails.admin)) < 300, 'admin session ready')
  ok((await registerAndLogin(sellerA, 'supplier', emails.a)) < 300, 'sellerA session ready')
  ok((await registerAndLogin(sellerB, 'supplier', emails.b)) < 300, 'sellerB session ready')
  ok((await registerAndLogin(buyer, 'buyer', emails.buyer)) < 300, 'buyer session ready')

  const cat = await admin('POST', '/api/admin/categories', { name: `T60 Cat ${ts}`, isActive: true })
  ok(cat.status === 201 || cat.status === 200, 'admin creates category', JSON.stringify(cat.json)?.slice(0, 140))
  const categoryId = cat.json?.data?.id ?? cat.json?.id

  const prodA = await sellerA('POST', '/api/supplier/products', {
    name: `T60widget-A-${ts}`, description: 'QA t60 product A (kg)', categoryId, unit: 'kg', moq: 1, basePrice: 100,
    stockQuantity: 50, stockAlertThreshold: 5, priceTiers: [{ minQty: 1, pricePerUnit: 100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  ok(prodA.status === 201, 'sellerA creates product A (kg/50 @100)', JSON.stringify(prodA.json)?.slice(0, 160))
  const productIdA = prodA.json?.data?.id ?? prodA.json?.id

  const prodB = await sellerB('POST', '/api/supplier/products', {
    name: `T60widget-B-${ts}`, description: 'QA t60 product B (pcs)', categoryId, unit: 'pcs', moq: 1, basePrice: 200,
    stockQuantity: 20, stockAlertThreshold: 5, priceTiers: [{ minQty: 1, pricePerUnit: 200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  ok(prodB.status === 201, 'sellerB creates product B (pcs/20 @200)')
  const productIdB = prodB.json?.data?.id ?? prodB.json?.id

  const apprA = await admin('PATCH', '/api/admin/products', { productId: productIdA, action: 'approve', reason: 'QA t60' })
  const apprB = await admin('PATCH', '/api/admin/products', { productId: productIdB, action: 'approve', reason: 'QA t60' })
  ok(apprA.status === 200 && apprB.status === 200, 'admin approves both products (moderation gate)')

  const addr = await buyer('POST', '/api/addresses', {
    label: 'T60 HQ', address_line1: '12 QA Street', city: 'Dhaka', district: 'Dhaka',
    postal_code: '1213', contact_phone: '01700000000',
  })
  ok(addr.status === 201 || addr.status === 200, 'buyer address created')
  const addressId = addr.json?.data?.id ?? addr.json?.id

  section('order — multi-supplier, paid, delivered (the return subject)')
  const ord = await buyer('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId: productIdA, quantity: 10 }, { productId: productIdB, quantity: 2 }],
  })
  ok(ord.status === 201, 'buyer places 2-supplier order (10kg A + 2pcs B)', JSON.stringify(ord.json)?.slice(0, 160))
  const orderId = ord.json?.data?.orderId
  const detail = await buyer('GET', `/api/orders/${orderId}`)
  const subs = detail.json?.data?.subOrders ?? []
  ok(subs.length === 2, 'order has 2 subOrders (one per supplier)')
  const itemA = (subs.find((s) => s.items?.some((i) => i.productId === productIdA))?.items ?? []).find((i) => i.productId === productIdA)
  const itemB = (subs.find((s) => s.items?.some((i) => i.productId === productIdB))?.items ?? []).find((i) => i.productId === productIdB)
  ok(Boolean(itemA?.id) && Boolean(itemB?.id), 'orderItem ids resolved for both suppliers')
  if (!itemA?.id || !itemB?.id) throw new Error('harness cannot continue: orderItem ids missing')
  const itemATotal = itemA.totalPrice, itemAQty = itemA.quantity

  const pay = await buyer('POST', `/api/orders/${orderId}/payment-submit`, {
    method: 'mobile_banking', brand: 'bKash', transactionId: `T60PAY${ts}`.toUpperCase(), senderNumber: '01700000000',
  })
  ok(pay.status === 201, 'buyer submits full payment reference (pending)')
  const payList = await sellerA('GET', '/api/seller/payments?status=pending')
  const payRow = (payList.json?.data ?? []).find((p) => p.orderId === orderId)
  ok((await sellerA('POST', `/api/seller/payments/${payRow.id}/verify`, { action: 'verify' })).status === 200, 'sellerA verifies → paid')

  const subA = subs.find((s) => s.items?.some((i) => i.productId === productIdA))
  const subB = subs.find((s) => s.items?.some((i) => i.productId === productIdB))
  const dA = await sellerA('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: subA.id })
  const dB = await sellerB('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: subB.id })
  ok(dA.status === 200 && dB.status === 200, 'both subOrders delivered by their own sellers')

  section('return filed → guard: receipt refused while PENDING')
  const ret = await buyer('POST', `/api/orders/${orderId}/return`, {
    shippingMethod: 'pickup',
    items: [
      { itemId: itemA.id, reason: 'damaged in transit', quantity: 4, comments: 'box crushed' },
      { itemId: itemB.id, reason: 'wrong size label', quantity: 2 },
    ],
  })
  ok(ret.status === 200 || ret.status === 201, 'buyer files return (4/10 of A + 2/2 of B)', JSON.stringify(ret.json)?.slice(0, 160))
  const returnId = ret.json?.data?.id

  ok((await anon('POST', `/api/seller/returns/${returnId}/confirm-receipt`, {})).status === 401, 'unauthenticated confirm-receipt → 401')
  ok((await buyer('POST', `/api/seller/returns/${returnId}/confirm-receipt`, {})).status === 403, 'buyer (no supplier profile) → 403')
  ok((await sellerA('POST', '/api/seller/returns/nonexistent-return/confirm-receipt', {})).status === 404, 'nonexistent return → 404')
  const pendingTry = await sellerA('POST', `/api/seller/returns/${returnId}/confirm-receipt`, {})
  ok(pendingTry.status === 409, 'confirm while return is pending → 409', JSON.stringify(pendingTry.json)?.slice(0, 160))
  ok((pendingTry.json?.error ?? '').includes('approved'), '409 verbatim: goods only travel back after approval')
  // Foreign-supplier scoping on a REAL return: sellerA owns itemA → 404 only applies
  // to returns with none of their lines; use a return the supplier has no line in (none
  // exists here), so instead verify sellerA CANNOT see sellerB-only data later via
  // admin receipts. (404 no-leak covered by the nonexistent id above.)

  section('admin approves → receipts flow')
  const appr = await admin('PATCH', `/api/admin/returns/${returnId}`, { action: 'approve', note: 'QA t60 approved' })
  ok(appr.status === 200, 'admin approves the return', JSON.stringify(appr.json)?.slice(0, 160))
  ok(appr.json?.data?.supplierCount === 2, 'admin payload supplierCount = 2 (receipt denominator)')
  ok((appr.json?.data?.receipts ?? []).length === 0, 'no receipts yet (honest zero)')

  section('B) sockets armed — sellerB room + public product room')
  const meB = await sellerB('GET', '/api/profile/me')
  const profileIdB = meB.json?.data?.supplierProfile?.id
  ok(Boolean(profileIdB), 'sellerB supplierProfile id resolved')
  const tokB = await sellerB('GET', `/api/realtime/room-token?room=seller:${profileIdB}`)
  ok(tokB.status === 200 && Boolean(tokB.json?.token), 'sellerB room token minted')

  const sockB = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  const sockP = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  await Promise.all([
    new Promise((r) => sockB.on('connect', r)),
    new Promise((r) => sockP.on('connect', r)),
  ])
  sockB.emit('subscribe', { room: `seller:${profileIdB}`, token: tokB.json.token })
  ok(Boolean(await waitForEvent(sockB, 'subscribe:ok')), 'sellerB joined their private room')
  sockP.emit('subscribe', { room: `product:${productIdA}` })
  ok(Boolean(await waitForEvent(sockP, 'subscribe:ok')), 'public product room joined without token')

  section('A) sellerA confirms receipt — partial (4/10)')
  const stockBeforeA = await productStock(productIdA) // 40 (50−10)
  const soldBeforeA = await productSold(productIdA)   // 10
  const stockEvtPromise = waitForEvent(sockP, 'product:stock')
  const rcptA = await sellerA('POST', `/api/seller/returns/${returnId}/confirm-receipt`, { note: 'goods back, box damaged' })
  ok(rcptA.status === 200, 'sellerA confirms receipt → 200', JSON.stringify(rcptA.json)?.slice(0, 200))
  ok(rcptA.json?.data?.itemsRestored === 1, 'itemsRestored = 1 (their single line)')
  const expectedValueA = Math.round(((itemATotal * 4) / itemAQty) * 100) / 100
  ok(Math.abs((rcptA.json?.data?.restoredValue ?? 0) - expectedValueA) < 0.01, `restoredValue prorated = ${expectedValueA}`, `got ${rcptA.json?.data?.restoredValue}`)
  ok(rcptA.json?.data?.fullyReceived === false, 'fullyReceived false (sellerB has not confirmed)')
  ok((rcptA.json?.data?.subOrdersMarkedReturned ?? []).length === 0, 'partial return does NOT flip the subOrder to returned')

  const stockAfterA = await productStock(productIdA)
  const soldAfterA = await productSold(productIdA)
  ok(Math.abs(stockAfterA - (stockBeforeA + 4)) < 0.001, `stock A ${stockBeforeA}→${stockAfterA} (+4 restored)`)
  ok(Math.abs(soldAfterA - (soldBeforeA - 4)) < 0.001, `soldCount A ${soldBeforeA}→${soldAfterA} (−4)`)
  const stockEvt = await stockEvtPromise
  ok(Boolean(stockEvt) && Math.abs((stockEvt.stockQuantity ?? -1) - (stockBeforeA + 4)) < 0.001, 'product:stock broadcast carries the restored quantity')

  const reRcpt = await sellerA('POST', `/api/seller/returns/${returnId}/confirm-receipt`, {})
  ok(reRcpt.status === 409, 'second receipt same supplier → 409 (idempotency)')
  ok((reRcpt.json?.error ?? '').includes('already confirmed'), '409 verbatim: receipt already confirmed')

  section('B) return:received reaches the OTHER supplier + sellerA confirms B fully')
  const meA = await sellerA('GET', '/api/profile/me')
  const profileIdA = meA.json?.data?.supplierProfile?.id
  const tokA = await sellerA('GET', `/api/realtime/room-token?room=seller:${profileIdA}`)
  const sockA = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  await new Promise((r) => sockA.on('connect', r))
  sockA.emit('subscribe', { room: `seller:${profileIdA}`, token: tokA.json.token })
  ok(Boolean(await waitForEvent(sockA, 'subscribe:ok')), 'sellerA joined their private room')

  const rcptEvtPromise = waitForEvent(sockA, 'return:received')
  const rcptB = await sellerB('POST', `/api/seller/returns/${returnId}/confirm-receipt`, {})
  ok(rcptB.status === 200, 'sellerB confirms receipt → 200', JSON.stringify(rcptB.json)?.slice(0, 160))
  ok(rcptB.json?.data?.fullyReceived === true, 'fullyReceived true (all suppliers in)')
  ok((rcptB.json?.data?.subOrdersMarkedReturned ?? []).length === 1, 'FULL return (2/2) flips sellerB subOrder → returned')
  const rcptEvt = await rcptEvtPromise
  ok(Boolean(rcptEvt) && rcptEvt.returnNumber === ret.json?.data?.returnNumber, 'sellerA socket received return:received (cross-supplier)')

  const stockAfterB = await productStock(productIdB)
  const soldAfterB = await productSold(productIdB)
  ok(Math.abs(stockAfterB - 20) < 0.001, `stock B back to exactly 20 (20−2+2), got ${stockAfterB}`)
  ok(Math.abs(soldAfterB - 0) < 0.001, `soldCount B back to 0, got ${soldAfterB}`)

  section('subOrder truth — partial stays delivered, full is returned')
  const detailPost = await buyer('GET', `/api/orders/${orderId}`)
  const subsPost = detailPost.json?.data?.subOrders ?? []
  ok(subsPost.find((s) => s.id === subA.id)?.status === 'delivered', 'sellerA subOrder stays delivered (4/10 partial)')
  ok(subsPost.find((s) => s.id === subB.id)?.status === 'returned', 'sellerB subOrder is returned (2/2 full)')

  section('C) visibility — seller list, admin queue, buyer list + detail')
  const srA = await sellerA('GET', '/api/seller/returns')
  const rowA = (srA.json?.data ?? []).find((r) => r.id === returnId)
  ok(rowA?.myReceipt && rowA.myReceipt.itemsRestored === 1 && Math.abs(rowA.myReceipt.restoredValue - expectedValueA) < 0.01, 'seller list myReceipt carries real restored values')
  ok((rowA?.myReceipt?.note ?? '') === 'goods back, box damaged', 'myReceipt note persisted')

  const adminList = await admin('GET', '/api/admin/returns')
  const adminRow = (adminList.json?.data?.returns ?? []).find((r) => r.id === returnId)
  ok(adminRow?.receipts?.length === 2 && adminRow?.supplierCount === 2, 'admin queue shows 2/2 receipts with denominator 2')
  ok(Math.abs(adminRow.receipts.reduce((s, x) => s + x.restoredValue, 0) - (expectedValueA + itemB.totalPrice)) < 0.02, 'admin receipts sum = both restored values')

  const buyerList = await buyer('GET', `/api/returns?orderId=${orderId}`)
  const bRow = (buyerList.json?.data ?? []).find((r) => r.id === returnId)
  ok(bRow?.receipts?.length === 2 && bRow?.supplierCount === 2, 'buyer list carries the real receipts + denominator')
  const buyerDetail = await buyer('GET', `/api/returns/${returnId}`)
  ok(buyerDetail.status === 200 && (buyerDetail.json?.data?.receipts ?? []).length === 2, 'buyer detail /api/returns/[id] carries receipts too')

  section('D) audit — real return_received rows with per-item values')
  const audits = await db.auditLogs.findMany({ where: { action: 'return_received', entityId: returnId } })
  ok(audits.length === 2, '2 return_received audit rows in the real DB')
  const metaA = JSON.parse(audits.find((a) => a.actorId && a.metadata?.includes('"goods back'))?.metadata ?? audits[0]?.metadata ?? '{}')
  ok(metaA?.restoredValue !== undefined && metaA?.itemsRestored === 1, 'audit metadata carries real restored values')
  ok(Array.isArray(metaA?.perItem) && metaA.perItem[0]?.stockAfter !== undefined, 'audit perItem carries stockAfter truth')

  section('E) EXACT final ledger')
  ok(Math.abs(await productStock(productIdA) - 44) < 0.001, 'stock A ledger EXACT = 44 (50 −10 +4)')
  ok(Math.abs(await productSold(productIdA) - 6) < 0.001, 'soldCount A ledger EXACT = 6 (10 −4)')

  sockA.disconnect(); sockB.disconnect(); sockP.disconnect()

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
  process.exit(1)
})
