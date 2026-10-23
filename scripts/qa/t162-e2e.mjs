// Task 162 E2E — the delivery-reschedule circuit (audit unit 20). The old
// reschedule page faked a confirmation with setTimeout and a hard-coded
// order number; nothing was persisted, no seller ever heard about it. This
// drill proves the REAL circuit: buyer-owned request rows + audit trail +
// durable seller notification, all gates honest. It also pins the PUBLIC
// shipping quote API the rebuilt freight calculator now runs on (zone book
// resolution, honest empty for unknown districts, freeAbove crossing).
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't162-Qa-Str0ng1!'

function makeSession() {
  let cookie = ''
  const ip = `10.162.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

async function reg(session, userType, local, company) {
  const payload = { userType, authProvider: 'email', email: `${local}-${STAMP}@t162.test`, password: PW, fullName: 'T162 ' + userType, ...(company ? { businessName: company, businessType: 'manufacturer' } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email: payload.email, password: PW }); return l.status === 200 || l.status === 201 }
    await sleep(3000)
  }
  return false
}

function futureDate(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
}

async function main() {
  const admin = makeSession(), seller = makeSession(), buyer = makeSession(), foreign = makeSession(), anon = makeSession()
  ok(await reg(admin, 'admin', 't162-adm'), 'admin registered')
  ok(await reg(seller, 'supplier', 't162-sel', 'T162 Depot'), 'seller registered')
  ok(await reg(buyer, 'buyer', 't162-buy'), 'buyer registered')
  ok(await reg(foreign, 'buyer', 't162-frn'), 'foreign buyer registered')

  const cat = await admin('POST', '/api/admin/categories', { name: 'T162Cat', isActive: true })
  let categoryId = cat.json?.data?.id ?? cat.json?.id
  if (!categoryId) categoryId = (await db.categories.findFirst({ where: { name: 'T162Cat' } }))?.id

  const prod = await seller('POST', '/api/supplier/products', { name: 'T162 Resched Widget', description: 'drill', categoryId, unit: 'pcs', moq: 1, basePrice: 40, currency: 'BDT', stockQuantity: 50, priceTiers: [{ minQty: 1, pricePerUnit: 40 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'product created')
  const appr = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T162' })
  ok(appr.status === 200, 'product approved')

  const ord = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }] })
  const orderId = ord.json?.data?.orderId ?? ord.json?.data?.id
  const orderNumber = ord.json?.data?.orderNumber
  ok(ord.status === 201 && Boolean(orderId), `order placed → ${orderNumber}`)

  // ── reschedule gates ──
  const anonR = await anon('POST', `/api/orders/${orderId}/reschedule`, { requestedDate: futureDate(3), window: 'morning' })
  ok(anonR.status === 401, 'anonymous reschedule → 401', `got ${anonR.status}`)
  const frnR = await foreign('POST', `/api/orders/${orderId}/reschedule`, { requestedDate: futureDate(3), window: 'morning' })
  ok(frnR.status === 404, 'FOREIGN buyer on my order → 404 (no existence leak)', `got ${frnR.status}`)
  const pastR = await buyer('POST', `/api/orders/${orderId}/reschedule`, { requestedDate: futureDate(-1), window: 'morning' })
  ok(pastR.status === 400, 'past date → 400', JSON.stringify(pastR.json)?.slice(0, 100))
  const todayR = await buyer('POST', `/api/orders/${orderId}/reschedule`, { requestedDate: futureDate(0), window: 'morning' })
  ok(todayR.status === 400, 'today is not a future date → 400')
  const badWin = await buyer('POST', `/api/orders/${orderId}/reschedule`, { requestedDate: futureDate(3), window: 'midnight' })
  ok(badWin.status === 400, 'unknown window → 400 (strict enum)')
  const extraKey = await buyer('POST', `/api/orders/${orderId}/reschedule`, { requestedDate: futureDate(3), window: 'morning', hackerField: 1 })
  ok(extraKey.status === 400, 'unknown body field → 400 (strict keys)')

  // ── the real request lands ──
  const good = await buyer('POST', `/api/orders/${orderId}/reschedule`, { requestedDate: futureDate(3), window: 'afternoon', instructions: 'Gate 4 closes at 3pm — arrive before.' })
  ok(good.status === 201, 'valid reschedule → 201', JSON.stringify(good.json)?.slice(0, 140))
  const row = await db.orderReschedules.findFirst({ where: { orderId } })
  ok(!!row && row.status === 'pending' && row.window === 'afternoon', 'DB: orderReschedules row pending/afternoon', JSON.stringify(row)?.slice(0, 140))
  const audit = await db.auditLogs.findFirst({ where: { action: 'delivery_reschedule_requested', entityId: row?.id } })
  ok(!!audit, 'DB: auditLogs row with the real action')

  // seller-side durable signal (cohesion) — match the RESCHEDULE row, not
  // the new-order row that shares the orderNumber in its title
  const sellerUser = await db.users.findFirst({ where: { email: { contains: 't162-sel-' } } })
  const sellerNotif = await db.notifications.findFirst({ where: { userId: sellerUser.id, title: { contains: 'Reschedule request' }, type: 'order' } })
  ok(!!sellerNotif && sellerNotif.title.includes(orderNumber), 'DURABLE: seller notification row for the reschedule', JSON.stringify(sellerNotif)?.slice(0, 140))
  ok(!!sellerNotif && sellerNotif.body.toLowerCase().includes('delivery') && sellerNotif.body.toLowerCase().includes('buyer'), 'the row carries the honest delivery body', sellerNotif?.body?.slice(0, 120))
  ok(!!sellerNotif && sellerNotif.relatedEntityId === orderId, 'the row binds to the real order id')
  const sellerList = await seller('GET', '/api/notifications')
  const listed = (sellerList.json?.data?.notifications ?? sellerList.json?.data ?? []).some?.((n) => n.title?.includes?.(orderNumber))
  ok(Boolean(listed), 'seller notifications API serves the reschedule row')

  // one pending per order — the buyer's rate bucket (5/min) is exhausted by
  // the gate probes above, so the SAME buyer signs in from a fresh IP; the
  // pending rule is per-ORDER, so the new bucket must still get the 409.
  const buyerAgain = makeSession()
  const relogin = await buyerAgain('POST', '/api/auth/login', { email: `t162-buy-${STAMP}@t162.test`, password: PW })
  ok(relogin.status === 200, 'the same buyer re-authenticated from a fresh bucket')
  const dup = await buyerAgain('POST', `/api/orders/${orderId}/reschedule`, { requestedDate: futureDate(5), window: 'morning' })
  ok(dup.status === 409, 'second request while one is pending → 409 (per-ORDER rule, not per-IP)', JSON.stringify(dup.json)?.slice(0, 120))
  // and the 6th call from the ORIGINAL bucket is honestly rate-limited
  const limited = await buyer('POST', `/api/orders/${orderId}/reschedule`, { requestedDate: futureDate(6), window: 'morning' })
  ok(limited.status === 429, 'the 6th request inside a minute → 429 (the limiter is real)', `got ${limited.status}`)

  // lists
  const myList = await buyer('GET', `/api/orders/${orderId}/reschedule`)
  ok(myList.status === 200 && (myList.json?.data ?? []).length === 1, 'owner list shows exactly the one request')
  const frnList = await foreign('GET', `/api/orders/${orderId}/reschedule`)
  ok(frnList.status === 404, 'foreign buyer list → 404')

  // ── the public shipping quote the calculator now runs on ──
  const zone = await admin('POST', '/api/admin/shipping/zones', { name: `T162 Dhaka Zone ${STAMP}`, districts: ['Dhaka', 'Gazipur'], isActive: true })
  ok(zone.status === 201, 'admin created a zone covering Dhaka', JSON.stringify(zone.json)?.slice(0, 120))
  const zoneId = zone.json?.data?.id
  const method = await admin('POST', '/api/admin/shipping/methods', { name: `T162 Road Freight ${STAMP}`, estimatedDays: '2-4 days', isActive: true })
  ok(method.status === 201, 'admin created a method', JSON.stringify(method.json)?.slice(0, 100))
  const methodId = method.json?.data?.id
  const rate = await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId, weightMin: 0, weightMax: 1000, price: 650, freeAbove: 50000 })
  ok(rate.status === 201, 'admin created a rate ৳650 (free above ৳50,000)', JSON.stringify(rate.json)?.slice(0, 120))

  const q1 = await anon('GET', '/api/shipping/quote?district=Dhaka&weightKg=12')
  ok(q1.status === 200 && q1.json?.count === 1, 'LIVE quote resolves Dhaka → exactly 1 option', JSON.stringify(q1.json?.data)?.slice(0, 160))
  ok(q1.json?.data?.[0]?.price === 650 && q1.json?.data?.[0]?.methodName?.includes('T162 Road Freight'), 'the option carries the REAL configured price + method', JSON.stringify(q1.json?.data?.[0])?.slice(0, 160))
  ok(q1.json?.data?.[0]?.estimatedDays === '2-4 days', 'the option carries the REAL estimatedDays (no invented 2-3 business days)')

  const q2 = await anon('GET', '/api/shipping/quote?district=Dhaka&weightKg=12&subtotal=60000')
  ok(q2.json?.count === 1 && q2.json?.data?.[0]?.price === 0 && q2.json?.data?.[0]?.freeShipping === true, 'freeAbove crossing honored: subtotal ৳60,000 → FREE with basePrice preserved', JSON.stringify(q2.json?.data?.[0])?.slice(0, 160))

  const q3 = await anon('GET', '/api/shipping/quote?district=Atlantis&weightKg=12')
  ok(q3.status === 200 && q3.json?.count === 0, 'unknown district → honest EMPTY list (never a fabricated rate)')

  console.log(`\nT162 RESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('DRILL CRASH:', e); await db.$disconnect().catch(() => null); process.exit(1) })
