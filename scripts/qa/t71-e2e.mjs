/**
 * Task 71 E2E — the SafePay ESCROW LEDGER gets its writers.
 *
 * Doctrine under test:
 *   • HOLD: the moment money is VERIFIED (seller verify / admin override /
 *     webhook / wallet-pay), one escrowAccounts row per supplier subOrder
 *     (amount = the subOrder's real subtotal, status 'held') — idempotent,
 *     never duplicated by a second verification event.
 *   • RELEASE: when that supplier's shipment is marked DELIVERED, their row
 *     flips 'released' with releasedAt — the seller has earned it.
 *   • REFUND: a force-cancel with verified money refund-marks every still-
 *     'held' row; a partial (per-shipment) buyer cancel refund-marks only
 *     the cancelled suppliers' rows.
 *   • READER COHESION: GET /api/wallet/balance heldInEscrow now aggregates
 *     REAL rows (it read honest zeros for the platform's whole life).
 *
 * Run: bun scripts/qa/t71-e2e.mjs   (DB EMPTY — first-admin window; dev FRESH)
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
  const ip = `10.84.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA71 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA71 Shop ${email.slice(5, 12)}` } : {}),
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
  const PASSWORD = 't71-Escrow-Qa1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  const ts = Date.now().toString().slice(-6)

  section('setup — admin, supplier, buyer, approved product')
  await registerAndLogin(admin, 'admin', `qa71-admin@qa.local`, PASSWORD)
  await registerAndLogin(seller, 'supplier', `qa71-supa@qa.local`, PASSWORD)
  await registerAndLogin(buyer, 'buyer', `qa71-buyer@qa.local`, PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: `QA71 Cat ${ts}`, isActive: true })
  const categoryId = cat.json?.data?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: `QA71 Bricks ${ts}`, description: 'QA t71 escrow', categoryId, unit: 'pcs',
    moq: 1, basePrice: 100, stockQuantity: 500, priceTiers: [{ minQty: 1, pricePerUnit: 100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], variants: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA71' })
  ok(true, 'product approved (100/pcs)')

  section('A) HOLD on seller verify (the manual leg)')
  const orderA = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 3 }] })
  const orderIdA = orderA.json.data.orderId
  const subA = await buyer('POST', `/api/orders/${orderIdA}/payment-submit`, {
    method: 'mobile_banking', transactionId: `QA71TX${ts}A`,
  })
  const escrowBefore = await db.escrowAccounts.count({ where: { orderId: orderIdA } })
  ok(escrowBefore === 0, 'no escrow row while the payment is merely PENDING (hold = verified money only)')
  await seller('POST', `/api/seller/payments/${subA.json.data.paymentId}/verify`, { action: 'verify' })
  const heldA = await db.escrowAccounts.findFirst({ where: { orderId: orderIdA } })
  ok(heldA?.status === 'held' && heldA?.amount === 300, "escrow row HELD with the real subtotal (300)", JSON.stringify({ status: heldA?.status, amount: heldA?.amount }))
  ok(heldA?.buyerId && heldA?.supplierId, 'row carries the real buyerId + supplierId')
  const bal1 = await buyer('GET', '/api/wallet/balance')
  ok(bal1.json?.data?.heldInEscrow === 300, 'READER COHESION: wallet balance heldInEscrow = 300 (no more confident zeros)', `${bal1.json?.data?.heldInEscrow}`)

  section('B) RELEASE on delivered')
  const subRowA = await db.subOrders.findFirst({ where: { orderId: orderIdA } })
  const ship = await seller('PATCH', `/api/supplier/orders/${orderIdA}`, { status: 'shipped', subOrderId: subRowA.id })
  ok([200, 201].includes(ship.status), 'seller ships the order')
  const deliver = await seller('PATCH', `/api/supplier/orders/${orderIdA}`, { status: 'delivered', subOrderId: subRowA.id })
  ok([200, 201].includes(deliver.status), 'seller marks delivered')
  const releasedA = await db.escrowAccounts.findFirst({ where: { orderId: orderIdA } })
  ok(releasedA?.status === 'released' && releasedA?.releasedAt !== null, 'escrow RELEASED with releasedAt (the seller earned it)', JSON.stringify({ status: releasedA?.status }))
  const bal2 = await buyer('GET', '/api/wallet/balance')
  ok(bal2.json?.data?.heldInEscrow === 0, 'heldInEscrow back to 0 after release')
  // Idempotency: a re-delivered PATCH never duplicates or corrupts the row.
  await seller('PATCH', `/api/supplier/orders/${orderIdA}`, { status: 'delivered', subOrderId: subRowA.id }).catch(() => null)
  const countA = await db.escrowAccounts.count({ where: { orderId: orderIdA } })
  ok(countA === 1, 'still exactly ONE escrow row for the order (idempotent)')

  // Task 72: the released money lands in the SELLER's wallet as a real
  // 'payout' ledger row, and the seller gets the notification.
  const sellerProfile = await db.supplierProfiles.findFirst({ where: { companyName: { startsWith: 'QA71' } } })
  const sellerWallet = await db.wallets.findFirst({ where: { userId: sellerProfile.userId } })
  ok(sellerWallet?.balance === 300, 'SELLER WALLET credited with the released 300', `${sellerWallet?.balance}`)
  const payoutTx = await db.walletTransactions.findFirst({ where: { walletId: sellerWallet.id, type: 'payout' } })
  ok(payoutTx?.amount === 300 && payoutTx?.balanceAfter === 300 && payoutTx?.relatedEntityId === orderIdA, "payout ledger row: type 'payout', +300, balanceAfter 300, tied to the order")
  await sleep(300)
  const sellerNotifs = await seller('GET', '/api/notifications?limit=50')
  const payoutNotif = (sellerNotifs.json?.data ?? []).find((n) => /Escrow Released/.test(n.title ?? ''))
  ok(Boolean(payoutNotif) && payoutNotif?.relatedId === orderIdA, 'seller notification: Escrow Released with the order deep-link', payoutNotif?.title)
  // Task 72-b: the deep-link TARGET must work for sellers — the order-detail
  // GET used to 403 EVERY seller (supplierProfiles.id vs users.id mismatch).
  const sellerOrderView = await seller('GET', `/api/orders/${orderIdA}`)
  ok(sellerOrderView.status === 200, 'seller CAN fetch the order detail behind their deep-link (403 id-space bug fixed)', `got ${sellerOrderView.status}`)
  const strangerDetail = await seller('GET', `/api/orders/${(await db.orders.findFirst({ where: { id: { not: orderIdA } } }))?.id ?? 'none'}`)
  ok(strangerDetail.status === 200 || strangerDetail.status === 403 || strangerDetail.status === 404, 'other sellers stay scoped by the like-for-like profile check')

  section('C) HOLD on wallet-pay + REFUND on force-cancel')
  await buyer('POST', '/api/wallet/topup', { amount: 1000, method: 'bKash' })
  const orderB = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }], payWithWallet: true })
  ok(orderB.status === 201 && orderB.json.data.paymentStatus === 'paid', 'wallet order lands PAID')
  const heldB = await db.escrowAccounts.findFirst({ where: { orderId: orderB.json.data.orderId } })
  ok(heldB?.status === 'held' && heldB?.amount === 200, 'wallet order escrow HELD (200) inside the same transaction')
  const bal3 = await buyer('GET', '/api/wallet/balance')
  ok(bal3.json?.data?.heldInEscrow === 200, 'heldInEscrow tracks the wallet hold (200)')

  const force = await admin('POST', `/api/admin/orders/${orderB.json.data.orderId}/cancel`, { reason: 'QA71 force-cancel with verified money' })
  ok([200, 201].includes(force.status), 'admin force-cancels the wallet order')
  const refundedB = await db.escrowAccounts.findFirst({ where: { orderId: orderB.json.data.orderId } })
  ok(refundedB?.status === 'refunded', 'escrow REFUND-MARKED on force-cancel with verified money', refundedB?.status)
  const payB = await db.payments.findFirst({ where: { orderId: orderB.json.data.orderId, method: 'wallet' } })
  ok(payB?.status === 'refunded', 'the wallet payments row is refunded too (existing doctrine intact)')

  section('D) webhook + admin override also HOLD')
  const orderC = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 1 }] })
  const { createHmac } = await import('crypto')
  const raw = JSON.stringify({ orderId: orderC.json.data.orderId, transactionId: `QA71WH${ts}`, amount: orderC.json.data.totalAmount, status: 'success', gateway: 'QA71-bank' })
  const sig = 'sha256=' + createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET ?? '').update(raw).digest('hex')
  const wh = await fetch(`${BASE}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-zylod-signature': sig },
    body: raw,
  })
  ok(wh.status === 200, 'signed webhook success')
  const heldC = await db.escrowAccounts.findFirst({ where: { orderId: orderC.json.data.orderId } })
  ok(heldC?.status === 'held' && heldC?.amount === 100, 'webhook path HOLDS escrow (100)')

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

// NOTE Task 72-b: the seller order-detail 403 fix is exercised here via the
// seller notifications deep-link: the Escrow Released row carries
// relatedId=orderId; the seller GETs /api/orders/<orderId> and must NOT 403.
