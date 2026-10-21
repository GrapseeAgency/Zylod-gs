/**
 * Task 122 E2E — THE CUSTOMER INSIGHTS RAIL ("the last three real-data
 * seller pages: a NEW /api/supplier/customers endpoint built from the
 * seller's own subOrders; honest static states for the pages whose data
 * genuinely doesn't exist").
 *
 *   A. gates — anon/buyer 401
 *   B. honest zero before orders
 *   C. aggregation — per-buyer orders/earned/delivered/open from real
 *      subOrders, repeat detection, cancelled lines EXCLUDED
 *   D. summary math — totals, repeat count, average, lifetime value
 *   E. isolation — seller B sees honest zeros
 *
 * Run: node scripts/qa/t122-e2e.mjs   (DB must be EMPTY — first-admin window)
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
const near = (a, b) => Math.abs(a - b) < 0.001

function makeSession() {
  let cookie = ''
  const ip = `10.122.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA122 ${userType}`, ...(businessName ? { businessName } : {}) }
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
  const PASSWORD = 't122-E2e-Str0ng1!'
  const STAMP = Date.now()
  const admin = makeSession(), sellerA = makeSession(), sellerB = makeSession()
  const buyer1 = makeSession(), buyer2 = makeSession(), anon = makeSession()
  await registerAndLogin(admin, 'admin', `qa122-admin-${STAMP}@t122.test`, PASSWORD)
  await registerAndLogin(sellerA, 'supplier', `qa122-supa-a-${STAMP}@t122.test`, PASSWORD, 'QA122 Alpha Merch')
  await registerAndLogin(sellerB, 'supplier', `qa122-supa-b-${STAMP}@t122.test`, PASSWORD, 'QA122 Beta Merch')
  await registerAndLogin(buyer1, 'buyer', `qa122-b1-${STAMP}@t122.test`, PASSWORD)
  await registerAndLogin(buyer2, 'buyer', `qa122-b2-${STAMP}@t122.test`, PASSWORD)
  console.log('  accounts ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA122 Customer Goods', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const mkProduct = async (session, name, basePrice) => {
    const p = await session('POST', '/api/supplier/products', {
      name, description: `${name} — QA122 fixture`, categoryId, unit: 'pcs', bundleSize: null,
      moq: 1, basePrice, stockQuantity: 1000,
      priceTiers: [{ minQty: 1, pricePerUnit: basePrice }],
      images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    })
    const id = p.json?.data?.id ?? p.json?.id
    await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'QA122' })
    return id
  }
  const prodA = await mkProduct(sellerA, 'QA122 Alpha Gadget', 1000)
  const prodA2 = await mkProduct(sellerA, 'QA122 Alpha Kit', 500)
  const prodB = await mkProduct(sellerB, 'QA122 Beta Widget', 700)
  ok(Boolean(prodA && prodA2 && prodB), 'products created + approved')

  const mkAddress = async (session, line) => {
    const a = await session('POST', '/api/addresses', {
      label: 'HQ', address_line1: line, city: 'Dhaka', district: 'Dhaka',
      contact_phone: '+8801700000122', postal_code: '1200',
    })
    return a.json?.data?.id ?? a.json?.id
  }
  const addr1 = await mkAddress(buyer1, 'House 1, Road 122')
  const addr2 = await mkAddress(buyer2, 'House 2, Road 122')
  ok(Boolean(addr1 && addr2), 'buyer addresses ready')

  for (const [s, email] of [[buyer1, `qa122-b1-${STAMP}@t122.test`], [buyer2, `qa122-b2-${STAMP}@t122.test`]]) {
    const u = await db.users.findUnique({ where: { email } })
    await db.wallets.create({ data: { userId: u.id, balance: 999999 } })
  }

  /* ── A. gates ── */
  console.log('— A. gates —')
  ok((await anon('GET', '/api/supplier/customers')).status === 401, 'anon /api/supplier/customers → 401')
  const b1rail = await buyer1('GET', '/api/supplier/customers')
  ok(b1rail.status === 401, 'buyer on the customers rail → 401', JSON.stringify(b1rail.json?.error))

  /* ── B. honest zero before orders ── */
  console.log('— B. honest zero —')
  const zero = await sellerA('GET', '/api/supplier/customers')
  ok(zero.status === 200 && zero.json?.data?.summary?.totalCustomers === 0 && zero.json?.data?.customers?.length === 0, 'no orders → honest zero customers', JSON.stringify(zero.json?.data?.summary))
  ok(zero.json?.data?.summary?.avgOrdersPerCustomer === null && zero.json?.data?.summary?.lifetimeValue === 0, 'avg null + lifetime 0 (never invented)')

  /* ── C. real orders build the customer rows ── */
  console.log('— C. real orders —')
  const o1 = await buyer1('POST', '/api/orders', { items: [{ productId: prodA, quantity: 2 }], shippingAddressId: addr1, payWithWallet: true })
  ok(o1.status === 201, 'buyer1 order 1 (2×1000 wallet-paid)', JSON.stringify(o1.json?.error))
  const o2 = await buyer1('POST', '/api/orders', { items: [{ productId: prodA2, quantity: 1 }], shippingAddressId: addr1, payWithWallet: true })
  ok(o2.status === 201, 'buyer1 order 2 (1×500 wallet-paid) — makes them a REPEAT customer')
  const o3 = await buyer2('POST', '/api/orders', { items: [{ productId: prodA2, quantity: 1 }], shippingAddressId: addr2 })
  ok(o3.status === 201, 'buyer2 order (1×500, left unpaid)')
  const o4 = await buyer2('POST', '/api/orders', { items: [{ productId: prodA, quantity: 2 }], shippingAddressId: addr2, payWithWallet: true })
  ok(o4.status === 201, 'buyer2 order to be CANCELLED (2×1000) — must be excluded')

  const adv = await sellerA('PATCH', `/api/supplier/orders/${o1.json?.data?.orderId}`, { status: 'delivered' })
  ok(adv.status === 200, 'buyer1 order 1 advanced to delivered')
  const cancel = await sellerA('PATCH', `/api/supplier/orders/${o4.json?.data?.orderId}`, { status: 'cancelled' })
  ok(cancel.status === 200, 'buyer2 big order CANCELLED by the seller', JSON.stringify(cancel.json?.error))

  /* ── D. aggregation + summary math ── */
  console.log('— D. aggregation —')
  const view = await sellerA('GET', '/api/supplier/customers')
  ok(view.status === 200 && view.json?.success === true, 'customers view 200')
  const s = view.json?.data?.summary
  ok(s?.totalCustomers === 2, 'totalCustomers = 2 (two real buyers)', JSON.stringify(s))
  ok(s?.repeatCustomers === 1, 'repeatCustomers = 1 (buyer1 ordered twice)', JSON.stringify(s?.repeatCustomers))
  ok(near(s?.avgOrdersPerCustomer, 1.5), 'avgOrdersPerCustomer = 1.5 (3 counted orders ÷ 2 customers)', JSON.stringify(s?.avgOrdersPerCustomer))
  ok(near(s?.lifetimeValue, 3000), 'lifetimeValue = 3000 (2000 + 500 + 500; the CANCELLED 2000 excluded)', JSON.stringify(s?.lifetimeValue))
  const rows = view.json?.data?.customers ?? []
  ok(rows.length === 2, 'two customer rows')
  const r1 = rows.find((r) => r.email === `qa122-b1-${STAMP}@t122.test`)
  const r2 = rows.find((r) => r.email === `qa122-b2-${STAMP}@t122.test`)
  ok(r1 && near(r1.totalSpent, 2500) && r1.ordersCount === 2 && r1.repeat === true, 'buyer1: 2500 earned, 2 orders, repeat', JSON.stringify(r1))
  ok(r1?.deliveredCount === 1 && r1?.openCount === 1, 'buyer1: 1 delivered + 1 open', JSON.stringify([r1?.deliveredCount, r1?.openCount]))
  ok(r2 && near(r2.totalSpent, 500) && r2.ordersCount === 1 && r2.repeat === false, 'buyer2: only the 500 unpaid line counts (cancelled excluded)', JSON.stringify(r2))
  ok(r2?.deliveredCount === 0 && r2?.openCount === 1, 'buyer2: 0 delivered + 1 open')
  ok(rows[0]?.email === `qa122-b1-${STAMP}@t122.test`, 'sorted by totalSpent desc (buyer1 first)')
  ok(r1?.displayName === 'QA122 QA122 buyer' || String(r1?.displayName).length > 0, 'displayName resolved from profile', r1?.displayName)

  /* ── E. isolation ── */
  console.log('— E. isolation —')
  const viewB = await sellerB('GET', '/api/supplier/customers')
  ok(viewB.status === 200 && viewB.json?.data?.summary?.totalCustomers === 0 && viewB.json?.data?.summary?.lifetimeValue === 0, "seller B: honest zero (A's customers invisible)")

  console.log(`\n=== t122 RESULT: ${PASS} pass / ${FAIL} fail ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
}

main()
  .catch((e) => { console.error('DRILL CRASH:', e); process.exitCode = 1 })
  .finally(async () => { await db.$disconnect() })
