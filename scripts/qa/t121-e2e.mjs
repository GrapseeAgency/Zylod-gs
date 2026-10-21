/**
 * Task 121 E2E — THE SELLER BUSINESS VIEW ("the four honest seller
 * endpoints existed with ZERO UI consumers; the pages they belonged to
 * were literal placeholders. This drill pins the wire-up contract both
 * ways: the endpoints' real math AND the fact that each seller's view
 * is exactly their own").
 *
 *   A. gates — anon/buyer 401, profile-less supplier 403 ×4 endpoints
 *   B. payouts view — summary math over real sellerPayouts rows
 *      (completed + in-flight), reference/destination verbatim
 *   C. revenue view — gross = recorded order lines (incl. unpaid),
 *      recognized = actually-paid only, dailySeries sums to gross,
 *      commission/net honest nulls
 *   D. performance view — real subOrder status counts + fulfillment
 *      rate + funnel (orders real, impressions/clicks honest nulls)
 *   E. rankings view — top products ranked by real soldCount,
 *      platformRank/tier honest nulls
 *   F. isolation — a second seller sees honest zeros on every surface
 *
 * Run: node scripts/qa/t121-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.121.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA121 ${userType}`, ...(businessName ? { businessName } : {}) }
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
  const PASSWORD = 't121-E2e-Str0ng1!'
  const admin = makeSession(), sellerA = makeSession(), sellerB = makeSession(), buyer = makeSession(), anon = makeSession(), profileless = makeSession()
  const STAMP = Date.now()
  await registerAndLogin(admin, 'admin', `qa121-admin-${STAMP}@t121.test`, PASSWORD)
  await registerAndLogin(sellerA, 'supplier', `qa121-supa-a-${STAMP}@t121.test`, PASSWORD, 'QA121 Alpha Works')
  await registerAndLogin(sellerB, 'supplier', `qa121-supa-b-${STAMP}@t121.test`, PASSWORD, 'QA121 Beta Works')
  await registerAndLogin(buyer, 'buyer', `qa121-buyer-${STAMP}@t121.test`, PASSWORD)
  // A supplier registered WITHOUT businessName still gets a profile row
  // (register normalizes companyName to ''); pin that their rail is their
  // own honest zeros — never another store's rows.
  await registerAndLogin(profileless, 'supplier', `qa121-noprofile-${STAMP}@t121.test`, PASSWORD)
  console.log('  accounts ready')

  const profA = await db.supplierProfiles.findFirst({ where: { companyName: 'QA121 Alpha Works' }, select: { id: true } })
  ok(Boolean(profA?.id), 'seller A profile resolved')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA121 Business Goods', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id

  const mkProduct = async (session, name, basePrice, stock = 1000) => {
    const p = await session('POST', '/api/supplier/products', {
      name, description: `${name} — QA121 fixture`, categoryId, unit: 'pcs', bundleSize: null,
      moq: 1, basePrice, stockQuantity: stock,
      priceTiers: [{ minQty: 1, pricePerUnit: basePrice }],
      images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    })
    const id = p.json?.data?.id ?? p.json?.id
    const ap = await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'QA121' })
    if (ap.status !== 200) throw new Error(`approve failed ${ap.status}`)
    return id
  }
  const prodA1 = await mkProduct(sellerA, 'QA121 Clamp Set', 1000)
  const prodA2 = await mkProduct(sellerA, 'QA121 Hose Reel', 500)
  const prodB1 = await mkProduct(sellerB, 'QA121 Beta Only Widget', 700)
  ok(Boolean(prodA1 && prodA2 && prodB1), 'three products created + approved')

  const addr = await buyer('POST', '/api/addresses', {
    label: 'Home', address_line1: 'House 121, Road 4',
    city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000121',
    postal_code: '1200',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  ok(Boolean(addressId), 'buyer address ready')

  // Buyer wallet: order 1 pays by wallet (→ recognized), order 2 stays UNPAID
  // (gross only) — the split that proves recognized ≠ gross honestly.
  const buyerUser = await db.users.findUnique({ where: { email: `qa121-buyer-${STAMP}@t121.test` } })
  await db.wallets.create({ data: { userId: buyerUser.id, balance: 999999 } })

  /* ── A. gates — all four business endpoints ── */
  console.log('— A. gates —')
  for (const ep of ['payouts', 'revenue', 'performance', 'rankings']) {
    ok((await anon('GET', `/api/supplier/${ep}`)).status === 401, `anon /api/supplier/${ep} → 401`)
    const b = await buyer('GET', `/api/supplier/${ep}`)
    ok(b.status === 401, `buyer /api/supplier/${ep} → 401 (buyer is not a supplier rail)`, JSON.stringify(b.json?.error))
    const np = await profileless('GET', `/api/supplier/${ep}`)
    ok(np.status === 200 && (np.json?.data?.summary?.gross ?? np.json?.data?.summary?.totalPaid ?? np.json?.data?.orders?.ordersReceived ?? np.json?.data?.products?.length) === 0, `name-less supplier /api/supplier/${ep} → 200 with OWN honest zeros (no 403, no leak)`, JSON.stringify(np.json))
  }

  /* ── B. revenue + performance BEFORE any orders (honest zeros) ── */
  console.log('— B. honest zeros before orders —')
  const rev0 = await sellerA('GET', '/api/supplier/revenue')
  ok(rev0.status === 200 && rev0.json?.data?.summary?.gross === 0 && rev0.json?.data?.ledger?.length === 0, 'revenue: honest zero ledger', JSON.stringify(rev0.json?.data?.summary))
  ok(rev0.json?.data?.summary?.commissionFees === null && rev0.json?.data?.summary?.netRevenue === null, 'revenue: commission/net are NULL (never invented)', JSON.stringify([rev0.json?.data?.summary?.commissionFees, rev0.json?.data?.summary?.netRevenue]))
  const perf0 = await sellerA('GET', '/api/supplier/performance')
  ok(perf0.status === 200 && perf0.json?.data?.orders?.ordersReceived === 0 && perf0.json?.data?.orders?.fulfillmentRate === 0, 'performance: honest zero orders', JSON.stringify(perf0.json?.data?.orders))
  const rank0 = await sellerA('GET', '/api/supplier/rankings')
  ok(rank0.status === 200 && rank0.json?.data?.products?.length === 2 && rank0.json?.data?.products?.every((p) => p.soldCount === 0), 'rankings: real products present at ZERO sales (honest 0-sold ranks, no fabricated sales)')

  /* ── C. two REAL orders — one wallet-paid, one left unpaid ── */
  console.log('— C. real orders (paid + unpaid) —')
  const ord1 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodA1, quantity: 2 }], shippingAddressId: addressId, payWithWallet: true,
  })
  ok(ord1.status === 201, 'order 1 (wallet-paid 2×1000) created', JSON.stringify(ord1.json?.error))
  const ord2 = await buyer('POST', '/api/orders', {
    items: [{ productId: prodA2, quantity: 3 }], shippingAddressId: addressId,
  })
  ok(ord2.status === 201, 'order 2 (no payment — stays unpaid 3×500) created', JSON.stringify(ord2.json?.error))
  const ord2db = await db.orders.findUnique({ where: { id: ord2.json?.data?.orderId } })
  ok(ord2db?.paymentStatus === 'unpaid', 'order 2 is honestly UNPAID', ord2db?.paymentStatus)

  // Advance order 1 to delivered (seller fulfillment PATCH — the real rail;
  // the [id] is the ORDER id, the route resolves the seller's own subOrder).
  const adv1 = await sellerA('PATCH', `/api/supplier/orders/${ord1.json?.data?.orderId}`, { status: 'delivered' })
  ok(adv1.status === 200, 'order 1 advanced to delivered', JSON.stringify(adv1.json?.error))

  /* ── D. revenue view — gross vs recognized split ── */
  console.log('— D. revenue view —')
  const rev = await sellerA('GET', '/api/supplier/revenue')
  ok(rev.status === 200 && rev.json?.success === true, 'revenue view 200')
  const rs = rev.json?.data?.summary
  ok(near(rs?.gross, 3500), 'gross = 3500 (2000 paid line + 1500 unpaid line, FULL line truth)', JSON.stringify(rs?.gross))
  ok(near(rs?.recognized, 2000), 'recognized = 2000 (wallet-paid order only)', JSON.stringify(rs?.recognized))
  ok(rs?.commissionFees === null && rs?.netRevenue === null && rs?.availableForPayout === null, 'fee-derived fields stay null with data present')
  const ds = rev.json?.data?.dailySeries ?? []
  ok(ds.length >= 1 && near(ds.reduce((s, d) => s + d.gross, 0), 3500), 'dailySeries sums back to gross', JSON.stringify(ds))
  const ledger = rev.json?.data?.ledger ?? []
  ok(ledger.length === 2, 'ledger holds both order lines')
  const paidRow = ledger.find((r) => r.paymentStatus === 'paid')
  const unpaidRow = ledger.find((r) => r.paymentStatus === 'unpaid')
  ok(paidRow && near(paidRow.gross, 2000) && paidRow.fulfillmentStatus === 'delivered', 'paid line carries delivered status + 2000', JSON.stringify(paidRow))
  ok(unpaidRow && near(unpaidRow.gross, 1500) && unpaidRow.fulfillmentStatus === 'pending', 'unpaid line carries pending status + 1500', JSON.stringify(unpaidRow))
  ok(ledger.every((r) => r.commission === null && r.net === null), 'every ledger row keeps commission/net null')

  /* ── E. performance view — real status counts ── */
  console.log('— E. performance view —')
  const perf = await sellerA('GET', '/api/supplier/performance')
  const po = perf.json?.data?.orders
  ok(perf.status === 200 && po?.ordersReceived === 2, 'ordersReceived = 2 (both subOrders)', JSON.stringify(po))
  ok(po?.ordersFulfilled === 1 && po?.pendingShipment === 1, 'fulfilled 1 (delivered) + pendingShipment 1 (unpaid order still pending)', JSON.stringify([po?.ordersFulfilled, po?.pendingShipment]))
  ok(po?.fulfillmentRate === 50, 'fulfillmentRate = 50% (1 of 2 delivered)', JSON.stringify(po?.fulfillmentRate))
  ok(po?.cancelled === 0 && po?.returned === 0 && po?.inTransit === 0, 'cancelled/returned/inTransit honest zeros')
  const pf = perf.json?.data?.funnel
  ok(pf?.orders === 2 && pf?.impressions === null && pf?.productClicks === null && pf?.inquiries === null, 'funnel: orders real, impression/click/inquiry stages honest nulls', JSON.stringify(pf))

  /* ── F. rankings view — real soldCount order ── */
  console.log('— F. rankings view —')
  const rank = await sellerA('GET', '/api/supplier/rankings')
  const rp = rank.json?.data?.products ?? []
  ok(rank.status === 200 && rank.json?.data?.platformRank === null && rank.json?.data?.tier === null, 'platformRank/tier honest nulls (no fabricated Gold tier)', JSON.stringify([rank.json?.data?.platformRank, rank.json?.data?.tier]))
  ok(rp.length === 2 && rp[0]?.rank === 1 && rp[1]?.rank === 2, 'ranks numbered 1..2')
  ok(rp[0]?.name === 'QA121 Hose Reel' && rp[0]?.soldCount === 3, 'rank 1 = Hose Reel soldCount 3 — soldCount orders the list, NOT revenue', JSON.stringify(rp[0]))
  ok(rp[1]?.name === 'QA121 Clamp Set' && rp[1]?.soldCount === 2, 'rank 2 = Clamp Set soldCount 2 (real order line)', JSON.stringify(rp[1]))
  ok(rp.every((p) => typeof p.stockQuantity === 'number' && typeof p.unit === 'string'), 'every ranked product carries stock + unit')

  /* ── G. payouts view — summary math over real rows ── */
  console.log('— G. payouts view —')
  const sellerAUser = await db.supplierProfiles.findUnique({
    where: { id: profA.id },
    select: { userId: true },
  })
  await db.wallets.create({ data: { userId: sellerAUser.userId, balance: 1000, currency: 'BDT' } })
  const w1 = await sellerA('POST', '/api/wallet/withdraw', { amount: 400, method: 'bKash', accountNumber: '017111000121', holderName: 'QA121 Alpha' })
  ok(w1.status === 201, 'payout request 400 pending', JSON.stringify(w1.json?.error))
  const w2 = await sellerA('POST', '/api/wallet/withdraw', { amount: 200, method: 'bank', accountNumber: '1210001210001', holderName: 'QA121 Alpha', bankName: 'BRAC Bank PLC' })
  ok(w2.status === 201, 'payout request 200 pending')
  const pay1 = w1.json?.data?.payoutId, pay2 = w2.json?.data?.payoutId
  const set1 = await admin('PATCH', `/api/admin/payouts/${pay2}`, { action: 'complete', reference: 'TRX121SETTLE', note: 'BEFTN' })
  ok(set1.status === 200 && set1.json?.data?.status === 'completed', 'admin completes payout 2 with reference', JSON.stringify(set1.json?.error))

  const pv = await sellerA('GET', '/api/supplier/payouts')
  ok(pv.status === 200 && pv.json?.success === true, 'payouts view 200')
  const ps = pv.json?.data?.summary
  ok(near(ps?.totalPaid, 200) && ps?.completedCount === 1, 'summary totalPaid 200 / completed 1', JSON.stringify(ps))
  ok(near(ps?.pendingAmount, 400) && ps?.pendingCount === 1, 'summary pendingAmount 400 / pending 1 (hold still open)', JSON.stringify(ps))
  const prows = pv.json?.data?.payouts ?? []
  ok(prows.length === 2, 'both payout rows visible to their owner')
  const settledRow = prows.find((p) => p.id === pay2)
  ok(settledRow?.status === 'completed' && settledRow?.reference === 'TRX121SETTLE' && settledRow?.processedAt, 'settled row carries reference + processedAt verbatim', JSON.stringify(settledRow))
  const pendingRow = prows.find((p) => p.id === pay1)
  ok(pendingRow?.status === 'pending' && pendingRow?.reference === null && pendingRow?.processedAt === null, 'pending row carries no invented reference/processedAt')
  ok(String(pendingRow?.destination).includes('017111000121') && String(pendingRow?.destination).includes('QA121 Alpha'), 'destination carries account + holder verbatim (composite format)')

  /* ── H. isolation — seller B sees only their own store ── */
  console.log('— H. isolation —')
  const revB = await sellerB('GET', '/api/supplier/revenue')
  ok(revB.status === 200 && revB.json?.data?.summary?.gross === 0 && revB.json?.data?.ledger?.length === 0, "seller B revenue: honest zero (A's 3500 invisible)")
  const rankB = await sellerB('GET', '/api/supplier/rankings')
  ok(rankB.status === 200 && (rankB.json?.data?.products ?? []).every((p) => p.name !== 'QA121 Clamp Set'), "seller B rankings: no A products")
  const rankBb1 = (rankB.json?.data?.products ?? []).find((p) => p.name === 'QA121 Beta Only Widget')
  ok(rankBb1 && rankBb1.soldCount === 0, "seller B's own product present with real zero soldCount")
  const payB = await sellerB('GET', '/api/supplier/payouts')
  ok(payB.status === 200 && payB.json?.data?.summary?.totalPaid === 0 && (payB.json?.data?.payouts ?? []).length === 0, "seller B payouts: honest zero")
  const perfB = await sellerB('GET', '/api/supplier/performance')
  ok(perfB.status === 200 && perfB.json?.data?.orders?.ordersReceived === 0, "seller B performance: honest zero orders")

  console.log(`\n=== t121 RESULT: ${PASS} pass / ${FAIL} fail ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
}

main()
  .catch((e) => { console.error('DRILL CRASH:', e); process.exitCode = 1 })
  .finally(async () => { await db.$disconnect() })
