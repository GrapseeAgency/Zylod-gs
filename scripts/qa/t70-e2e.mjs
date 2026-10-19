/**
 * Task 70 E2E — WALLET-PAY at order time (the money-OUT rail that was
 * missing: the wallet had topup/withdraw but could not pay for orders).
 *
 * Doctrine under test:
 *   • POST /api/orders { payWithWallet: true } debits the buyer's REAL
 *     balance inside the SAME transaction that prices the order and
 *     decrements stock — the order lands paymentStatus 'paid' and NEVER
 *     passes through 'unpaid'.
 *   • Ledger truth: walletTransactions row type 'payment' with a NEGATIVE
 *     amount + balanceAfter; a REAL payments row method 'wallet'
 *     status 'success' paidAt (a VERIFIED payment by construction); the
 *     buyer gets the Payment Verified notification with BOTH deep-link ids.
 *   • Honest 402 when the balance cannot cover the server-priced total —
 *     with the REAL balance in the body — and NO order row is created.
 *   • The overspend race is impossible: concurrent orders re-check
 *     balance >= total AT the write (conditional updateMany), so the final
 *     balance can never go negative.
 *   • Omitting payWithWallet keeps the classic UNPAID manual leg intact.
 *
 * Run: bun scripts/qa/t70-e2e.mjs   (DB must be EMPTY — first-admin window;
 *      dev server must be FRESH — the in-memory cache outlives DB wipes.)
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
  const ip = `10.83.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA70 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA70 Shop ${email.slice(5, 12)}` } : {}),
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
  const PASSWORD = 't70-Wallet-Qa1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession(), poor = makeSession()
  const anon = makeSession()
  const ts = Date.now().toString().slice(-6)

  section('setup — admin, supplier, two buyers, approved product')
  await registerAndLogin(admin, 'admin', `qa70-admin@qa.local`, PASSWORD)
  await registerAndLogin(seller, 'supplier', `qa70-supa@qa.local`, PASSWORD)
  await registerAndLogin(buyer, 'buyer', `qa70-buyer@qa.local`, PASSWORD)
  await registerAndLogin(poor, 'buyer', `qa70-poor@qa.local`, PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: `QA70 Cat ${ts}`, isActive: true })
  const categoryId = cat.json?.data?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: `QA70 Bulk Rice ${ts}`, description: 'QA t70 wallet pay', categoryId, unit: 'kg',
    moq: 1, basePrice: 200, stockQuantity: 1000, priceTiers: [{ minQty: 1, pricePerUnit: 200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], variants: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  const approved = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA70' })
  ok([200, 201].includes(approved.status), 'product approved (200/kg, stock 1000)')

  section('A) auth + the honest 402')
  const anonOrder = await anon('POST', '/api/orders', { items: [{ productId, quantity: 1 }], payWithWallet: true })
  ok(anonOrder.status === 401, 'anonymous wallet order → 401', `got ${anonOrder.status}`)

  const poorTop = await poor('POST', '/api/wallet/topup', { amount: 50, method: 'bKash' })
  ok([200, 201].includes(poorTop.status), 'poor buyer tops up 50')
  const poorOrder = await poor('POST', '/api/orders', { items: [{ productId, quantity: 1 }], payWithWallet: true })
  ok(poorOrder.status === 402, 'insufficient balance → 402 Payment Required', `got ${poorOrder.status}`)
  ok(poorOrder.json?.walletBalance === 50, '402 carries the REAL balance (50)', JSON.stringify(poorOrder.json))
  const poorOrdersCount = await db.orders.count({ where: { buyerId: (await db.users.findFirst({ where: { email: 'qa70-poor@qa.local' } })).id } })
  ok(poorOrdersCount === 0, 'NO order row created on the failed wallet leg')
  const poorWallet = await db.wallets.findFirst({ where: { user: { email: 'qa70-poor@qa.local' } } })
  ok(poorWallet?.balance === 50, 'failed leg leaves the balance untouched (50)')

  section('B) the happy wallet leg — order lands PAID')
  const bal0 = await buyer('GET', '/api/wallet/balance')
  const before = bal0.json?.data?.availableBalance ?? 0
  const top = await buyer('POST', '/api/wallet/topup', { amount: 1000, method: 'bKash' })
  ok([200, 201].includes(top.status), 'buyer tops up 1000')

  const order1 = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }], payWithWallet: true })
  ok(order1.status === 201, 'wallet order created', `got ${order1.status}`)
  ok(order1.json?.data?.paymentStatus === 'paid', 'order paymentStatus = PAID (never passed unpaid)')
  ok(typeof order1.json?.data?.walletPaymentId === 'string', 'response carries the wallet payments row id')
  const orderId1 = order1.json.data.orderId
  const total1 = order1.json.data.totalAmount
  ok(total1 === 400, 'server-priced total = 400 (2 × 200)', `${total1}`)

  const bal1 = await buyer('GET', '/api/wallet/balance')
  ok(bal1.json?.data?.availableBalance === 1000 - total1, `balance debited to exactly ${1000 - total1}`, `${bal1.json?.data?.availableBalance}`)

  section('C) ledger + payments + notification truth (DB audit)')
  const wTx = await db.walletTransactions.findFirst({ where: { relatedEntityId: orderId1 } })
  ok(wTx?.type === 'payment' && wTx?.amount === -total1, "walletTransactions: type 'payment', NEGATIVE amount", JSON.stringify({ type: wTx?.type, amount: wTx?.amount }))
  ok(wTx?.balanceAfter === 1000 - total1, 'balanceAfter states the post-debit truth', `${wTx?.balanceAfter}`)
  const wPay = await db.payments.findUnique({ where: { id: order1.json.data.walletPaymentId } })
  ok(wPay?.method === 'wallet' && wPay?.status === 'success' && wPay?.paidAt !== null, "payments row: method 'wallet', status 'success', paidAt set")
  ok(wPay?.transactionId === `WALLET-${order1.json.data.orderNumber}`, 'transactionId = WALLET-<orderNumber> (globally unique)')
  ok(wPay?.orderId === orderId1, 'payments row belongs to the order')
  await sleep(300)
  const notifs = await buyer('GET', '/api/notifications?limit=50')
  const nRow = (notifs.json?.data ?? []).find((n) => n.type === 'payment' && n.relatedPaymentId === order1.json.data.walletPaymentId)
  ok(Boolean(nRow), 'buyer notification row exists for the wallet payment')
  ok(/Verified/.test(nRow?.title ?? '') && nRow?.relatedId === orderId1, 'row is the Payment Verified deep-link row')

  section('D) overspend race — concurrent orders can never drive balance negative')
  // Balance is now exactly 600 (1000 topup − 400 order). Two concurrent 400
  // orders sum to 800 > 600: exactly ONE may win; the other must 402.
  const race = await Promise.all([
    buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }], payWithWallet: true }),
    buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }], payWithWallet: true }),
  ])
  const statuses = race.map((r) => r.status).sort()
  ok(JSON.stringify(statuses) === '[201,402]', 'exactly ONE of the two concurrent orders wins', JSON.stringify(statuses))
  const bal2 = await buyer('GET', '/api/wallet/balance')
  ok(bal2.json.data.availableBalance === 600 - 400, 'final balance is exactly the survivor debit (200)', `${bal2.json.data.availableBalance}`)
  ok(bal2.json.data.availableBalance >= 0, 'balance NEVER negative')

  section('E) the classic leg untouched — no payWithWallet → UNPAID')
  const order3 = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 1 }] })
  ok(order3.status === 201 && order3.json.data.paymentStatus === 'unpaid', 'manual-leg order still starts UNPAID')
  const order3Row = await db.orders.findUnique({ where: { id: order3.json.data.orderId } })
  const payCount = await db.payments.count({ where: { orderId: order3.json.data.orderId } })
  ok(payCount === 0, 'no payments row invented for the manual leg')
  ok(order3Row.paymentStatus === 'unpaid', 'DB row says unpaid')

  section('F) stock + platform cohesion')
  const prodAfter = await db.products.findUnique({ where: { id: productId } })
  ok(prodAfter.soldCount === 2 + 2 + 1 && prodAfter.stockQuantity === 1000 - 5, 'stock/soldCount exactly reflect the three winning orders', `sold=${prodAfter.soldCount} stock=${prodAfter.stockQuantity}`)
  const auditCount = await db.auditLogs.count({ where: { entityType: 'orders' } })
  ok(auditCount >= 0, 'audit surface reachable (no crash)')

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
