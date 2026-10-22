// Task 159 E2E — the durable seller-side order signal. The order:create
// socket push (Task 51-a) is transient; a seller who wasn't online never saw
// the order arrive. Now every order slice persists a notifications row for
// the seller (one per supplier, never per subOrder), visible in their list
// with the honest UNPAID doctrine body. Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't159-Qa-Str0ng1!'

function makeSession(taskNo) {
  let cookie = ''
  const ip = `10.159.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

async function reg(session, userType, local, company) {
  const payload = { userType, authProvider: 'email', email: `${local}-${STAMP}@t159.test`, password: PW, fullName: 'T159 ' + userType, ...(company ? { businessName: company, businessType: 'manufacturer' } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email: payload.email, password: PW }); return l.status === 200 || l.status === 201 }
    await sleep(3000)
  }
  return false
}

async function main() {
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  ok(await reg(admin, 'admin', 't159-adm'), 'admin registered')
  ok(await reg(seller, 'supplier', 't159-sel', 'T159 Depot'), 'seller registered')
  ok(await reg(buyer, 'buyer', 't159-buy'), 'buyer registered')

  const cat = await admin('POST', '/api/admin/categories', { name: 'T159Cat', isActive: true })
  let categoryId = cat.json?.data?.id ?? cat.json?.id
  if (!categoryId) categoryId = (await db.categories.findFirst({ where: { name: 'T159Cat' } }))?.id

  const prod = await seller('POST', '/api/supplier/products', { name: 'T159 Notify Widget', description: 'drill', categoryId, unit: 'pcs', moq: 1, basePrice: 40, currency: 'BDT', stockQuantity: 50, priceTiers: [{ minQty: 1, pricePerUnit: 40 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'product created (real API)')
  if (!productId) { console.log(`\nT159 RESULT: ${PASS} passed, ${FAIL} failed`); await db.$disconnect(); process.exit(1) }

  let appr = null
  for (let a = 0; a < 4; a++) { appr = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T159' }); if (appr.status === 200) break; await sleep(3000) }
  ok(appr?.status === 200, 'product approved')

  const ord = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }] })
  const orderNumber = ord.json?.data?.orderNumber
  ok(ord.status === 201 && Boolean(orderNumber), `order placed → ${orderNumber}`, JSON.stringify(ord.json)?.slice(0, 140))

  // the durable circuit: the SELLER USER has a notifications row for this order
  const sellerUser = await db.users.findFirst({ where: { email: { contains: `t159-sel-` } } })
  const sellerProfile = await db.supplierProfiles.findFirst({ where: { userId: sellerUser.id } })
  const subOrders = await db.subOrders.findMany({ where: { order: { orderNumber } } })
  ok(subOrders.length === 1 && subOrders[0].supplierId === sellerProfile.id, 'order slice bound to the seller')

  const notif = await db.notifications.findFirst({ where: { userId: sellerUser.id, type: 'order', title: { contains: orderNumber } }, orderBy: { createdAt: 'desc' } })
  ok(!!notif, 'DURABLE: seller notifications row exists for the new order', JSON.stringify(notif)?.slice(0, 160))
  ok(!!notif && notif.body.includes('UNPAID') && notif.body.includes('৳'), 'the row carries the honest UNPAID doctrine body', notif?.body?.slice(0, 120))
  ok(!!notif && notif.relatedEntityId === ord.json?.data?.orderId, 'the row is bound to the real order id')

  // exactly ONE row per supplier (not per subOrder / duplicate)
  const count = await db.notifications.count({ where: { userId: sellerUser.id, title: { contains: orderNumber } } })
  ok(count === 1, `exactly one durable row for the seller (got ${count})`)

  // Buyer-side doctrine (unchanged by this task): a plain UNPAID order's
  // buyer signal is the checkout confirmation + payment-event notifications
  // (notifyPaymentVerified fires on wallet-paid orders) — there is NO buyer
  // row on plain order-create, so assert the seller row is the ONLY new row
  // for this order (no accidental buyer spam).
  const buyerUser = await db.users.findFirst({ where: { email: { contains: 't159-buy-' } } })
  const buyerRows = await db.notifications.count({ where: { userId: buyerUser.id, relatedEntityId: ord.json?.data?.orderId } })
  ok(buyerRows === 0, 'buyer gets NO notification row on a plain UNPAID order (doctrine unchanged)', `rows ${buyerRows}`)

  // seller sees it through the authenticated notifications API
  const list = await seller('GET', '/api/notifications')
  const listed = (list.json?.data?.notifications ?? list.json?.data ?? []).find?.((n) => n.title?.includes?.(orderNumber))
  ok(!!listed || (list.json?.data?.notifications ?? []).some?.((n) => n.title?.includes?.(orderNumber)), 'seller notifications API serves the durable row', JSON.stringify(list.json)?.slice(0, 140))

  console.log(`\nT159 RESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('DRILL CRASH:', e); await db.$disconnect().catch(() => null); process.exit(1) })
