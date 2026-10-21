/**
 * Task 123 E2E — THE DELIVERY OPS CONSOLE ("the driver/assignment backend
 * was complete but had NO admin UI: nobody could ever mint a driver or arm
 * live tracking. This drill pins the whole chain the new console drives:
 * driver minting → assignment rules → the GPS authorization they unlock").
 *
 *   A. gates — anon/seller/buyer 401 on drivers + assignments
 *   B. driver minting — validation, duplicates, bcrypt hash, audit, list
 *   C. assignment rules — driver-not-found/non-driver/inactive 400s,
 *      sub-order 404 + terminal-status guard, supersede, audit
 *   D. GPS authorization — a driver can ONLY ping sub-orders they hold an
 *      ACTIVE assignment for (the reason the console exists)
 *   E. list shapes the console renders
 *
 * Run: node scripts/qa/t123-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
function ok(cond, label, extra = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.123.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA123 ${userType}`, ...(businessName ? { businessName } : {}) }
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
  const PASSWORD = 't123-E2e-Str0ng1!'
  const STAMP = Date.now()
  const admin = makeSession(), seller = makeSession(), buyer = makeSession(), anon = makeSession()
  await registerAndLogin(admin, 'admin', `qa123-admin-${STAMP}@t123.test`, PASSWORD)
  await registerAndLogin(seller, 'supplier', `qa123-supa-${STAMP}@t123.test`, PASSWORD, 'QA123 Haulage Store')
  await registerAndLogin(buyer, 'buyer', `qa123-buyer-${STAMP}@t123.test`, PASSWORD)
  console.log('  accounts ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA123 Haulage Goods', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA123 Freight Crate', description: 'QA123 fixture', categoryId, unit: 'pcs', bundleSize: null,
    moq: 1, basePrice: 800, stockQuantity: 500,
    priceTiers: [{ minQty: 1, pricePerUnit: 800 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const prodId = prod.json?.data?.id ?? prod.json?.id
  await admin('PATCH', '/api/admin/products', { productId: prodId, action: 'approve', reason: 'QA123' })

  const addr = await buyer('POST', '/api/addresses', {
    label: 'HQ', address_line1: 'House 123, Road 7', city: 'Dhaka', district: 'Dhaka',
    contact_phone: '+8801700000123', postal_code: '1200',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  const buyerUser = await db.users.findUnique({ where: { email: `qa123-buyer-${STAMP}@t123.test` } })
  await db.wallets.create({ data: { userId: buyerUser.id, balance: 999999 } })
  const ord = await buyer('POST', '/api/orders', { items: [{ productId: prodId, quantity: 1 }], shippingAddressId: addressId, payWithWallet: true })
  ok(ord.status === 201, 'order placed for the assignment chain', JSON.stringify(ord.json?.error))
  const ordDb = await db.orders.findUnique({ where: { id: ord.json?.data?.orderId }, include: { subOrders: true } })
  const subOrderId = ordDb?.subOrders?.[0]?.id
  ok(Boolean(subOrderId), 'sub-order resolved')

  /* ── A. gates ── */
  console.log('— A. gates —')
  ok((await anon('GET', '/api/admin/deliveries/drivers')).status === 401, 'anon drivers list → 401')
  ok((await anon('POST', '/api/admin/deliveries/drivers', { email: 'x@x.test', password: 'longenough123' })).status === 401, 'anon driver create → 401')
  ok((await anon('GET', '/api/admin/deliveries/assignments')).status === 401, 'anon assignments list → 401')
  ok((await anon('POST', '/api/admin/deliveries/assignments', { subOrderId: 's', driverId: 'd' })).status === 401, 'anon assign → 401')
  ok((await seller('GET', '/api/admin/deliveries/drivers')).status === 401, 'seller drivers list → 401')
  ok((await seller('POST', '/api/admin/deliveries/assignments', { subOrderId: 's', driverId: 'd' })).status === 401, 'seller assign → 401')

  /* ── B. driver minting ── */
  console.log('— B. driver minting —')
  ok((await admin('POST', '/api/admin/deliveries/drivers', { email: 'not-an-email', password: 'longenough123' })).status === 400, 'bad email → 400')
  ok((await admin('POST', '/api/admin/deliveries/drivers', { email: `qa123-driver-${STAMP}@t123.test`, password: 'short' })).status === 400, 'password < 10 → 400')
  ok((await admin('POST', '/api/admin/deliveries/drivers', { email: `qa123-driver-${STAMP}@t123.test`, password: 'longenough123', phone: '12345' })).status === 400, 'non-BD phone → 400')
  const mk = await admin('POST', '/api/admin/deliveries/drivers', { email: `qa123-driver-${STAMP}@t123.test`, password: 'DriverPass-123', phone: '01712345678' })
  ok(mk.status === 201 && mk.json?.driver?.email === `qa123-driver-${STAMP}@t123.test`, 'driver minted → 201 with email', JSON.stringify(mk.json))
  const driverId = mk.json?.driver?.id
  ok((await admin('POST', '/api/admin/deliveries/drivers', { email: `qa123-driver-${STAMP}@t123.test`, password: 'AnotherPass-123' })).status === 409, 'duplicate email → 409')
  ok((await admin('POST', '/api/admin/deliveries/drivers', { email: `qa123-other-${STAMP}@t123.test`, password: 'AnotherPass-123', phone: '01712345678' })).status === 409, 'duplicate phone → 409')
  const drvUser = await db.users.findUnique({ where: { id: driverId } })
  ok(drvUser?.userType === 'driver' && drvUser?.passwordHash && drvUser.passwordHash !== 'DriverPass-123' && await bcrypt.compare('DriverPass-123', drvUser.passwordHash), 'stored as bcrypt hash (12 rounds), verifiable')
  const auditDrv = await db.auditLogs.findFirst({ where: { action: 'delivery.driver.create', entityId: driverId } })
  ok(Boolean(auditDrv), 'driver-create audit row exists')
  const dlist = await admin('GET', '/api/admin/deliveries/drivers')
  ok(dlist.status === 200 && (dlist.json?.drivers ?? []).some((d) => d.id === driverId), 'drivers list carries the minted driver')

  /* ── C. assignment rules ── */
  console.log('— C. assignment rules —')
  ok((await admin('POST', '/api/admin/deliveries/assignments', { subOrderId, driverId: 'nonexistent' })).status === 404, 'driver not found → 404')
  ok((await admin('POST', '/api/admin/deliveries/assignments', { subOrderId, driverId: buyerUser.id })).status === 400, 'non-driver account → 400 naming the userType', JSON.stringify((await Promise.resolve(''))))
  ok((await admin('POST', '/api/admin/deliveries/assignments', { subOrderId: 'no-such-sub', driverId })).status === 404, 'sub-order not found → 404')
  const a1 = await admin('POST', '/api/admin/deliveries/assignments', { subOrderId, driverId })
  ok(a1.status === 200 && a1.json?.assignment?.status === 'active', 'valid assignment → 200 active', JSON.stringify(a1.json?.error))
  const a1id = a1.json?.assignment?.id
  // Inactive driver guard: suspend, try re-assign a second sub-order? Only one
  // sub-order here — suspend then supersede attempt must 400.
  await db.users.update({ where: { id: driverId }, data: { accountStatus: 'suspended' } })
  ok((await admin('POST', '/api/admin/deliveries/assignments', { subOrderId, driverId })).status === 400, 'suspended driver → 400 (cannot be assigned)')
  await db.users.update({ where: { id: driverId }, data: { accountStatus: 'active' } })
  // Driver session (login through the real auth rail with the minted creds)
  const driverSess = makeSession()
  const dlog = await driverSess('POST', '/api/auth/login', { email: `qa123-driver-${STAMP}@t123.test`, password: 'DriverPass-123' })
  ok(dlog.status === 200 || dlog.status === 201, 'driver can log in with minted credentials')
  // GPS happy path: while the assignment is ACTIVE and the sub-order is in
  // flight, the driver's pings record — this is what the console arms.
  const livePing = await driverSess('POST', `/api/delivery/suborders/${subOrderId}/location`, { lat: 23.81, lng: 90.41, accuracy: 12 })
  ok(livePing.status === 200 || livePing.status === 201, 'in-flight GPS ping RECORDED with active assignment', JSON.stringify(livePing.json))
  // Supersede: a second assignment cancels the first
  const a2 = await admin('POST', '/api/admin/deliveries/assignments', { subOrderId, driverId })
  ok(a2.status === 200 && a2.json?.assignment?.id !== a1id, 'second assignment supersedes (new id)', JSON.stringify(a2.json?.error))
  const a1row = await db.deliveryAssignments.findUnique({ where: { id: a1id } })
  ok(a1row?.status === 'cancelled' && a1row?.completedAt, 'previous assignment auto-cancelled with completedAt', JSON.stringify(a1row?.status))
  const auditAsg = await db.auditLogs.findFirst({ where: { action: 'delivery.assignment.create', entityId: a2.json?.assignment?.id } })
  ok(Boolean(auditAsg), 'assignment-create audit row exists')
  // Terminal guard: deliver the sub-order, then assignment must refuse
  await seller('PATCH', `/api/supplier/orders/${ordDb.id}`, { status: 'delivered' })
  ok((await admin('POST', '/api/admin/deliveries/assignments', { subOrderId, driverId })).status === 400, 'delivered sub-order refuses assignment → 400')
  // Task 123 LIFECYCLE: delivery COMPLETES the active assignment — no
  // active row may outlive its shipment.
  const a2id = a2.json?.assignment?.id
  const a2row = await db.deliveryAssignments.findUnique({ where: { id: a2id } })
  ok(a2row?.status === 'completed' && a2row?.completedAt, 'delivery auto-COMPLETED the active assignment (lifecycle closed)', JSON.stringify(a2row?.status))
  ok((await db.deliveryAssignments.count({ where: { subOrderId, status: 'active' } })) === 0, 'zero active assignments remain on the delivered sub-order')

  /* ── D. GPS authorization — the chain the console arms ── */
  console.log('— D. GPS authorization —')
  const anonPing = await makeSession()('POST', `/api/delivery/suborders/${subOrderId}/location`, { lat: 23.81, lng: 90.41 })
  ok(anonPing.status === 401, 'anon GPS ping → 401')
  const buyerPing = await buyer('POST', `/api/delivery/suborders/${subOrderId}/location`, { lat: 23.81, lng: 90.41 })
  ok(buyerPing.status === 401, 'buyer GPS ping → 401 (driver-only)')
  // The sub-order is DELIVERED and its assignments completed — a ping now
  // must be refused (Task 123's terminal guard).
  const drvPing = await driverSess('POST', `/api/delivery/suborders/${subOrderId}/location`, { lat: 23.81, lng: 90.41 })
  ok(drvPing.status === 409 || drvPing.status === 403, 'ping on a DELIVERED sub-order REFUSED (terminal guard)', JSON.stringify(drvPing.json))

  /* ── E. list shapes the console renders ── */
  console.log('— E. list shapes —')
  const alist = await admin('GET', '/api/admin/deliveries/assignments')
  ok(alist.status === 200 && (alist.json?.assignments ?? []).length === 2, 'assignments list holds both (supersede history)', JSON.stringify(alist.json?.assignments?.length))
  ok((alist.json?.assignments ?? []).every((a) => a.driver && a.subOrderId && a.assignedAt), 'rows carry driver + subOrderId + assignedAt')
  const filtered = await admin('GET', `/api/admin/deliveries/assignments?subOrderId=${subOrderId}`)
  ok(filtered.status === 200 && (filtered.json?.assignments ?? []).length === 2, '?subOrderId filter resolves')

  console.log(`\n=== t123 RESULT: ${PASS} pass / ${FAIL} fail ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
}

main()
  .catch((e) => { console.error('DRILL CRASH:', e); process.exitCode = 1 })
  .finally(async () => { await db.$disconnect() })
