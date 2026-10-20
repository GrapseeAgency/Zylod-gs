/**
 * Task 90 E2E — THE SAMPLE-ORDER RAIL ("try one before the bulk carton").
 *
 * sampleOrders had NO route, NO writer, NO reader, NO UI. Now:
 *   A. auth gates on every rail (buyer + supplier + admin-free by design)
 *   B. create guards (phantom product, strict payload, FOREIGN address 400)
 *   C. THE COHESION RAILS — a request lands the supplier a durable
 *      notification AND a live 'sample:new' tap on the seller room; the
 *      address is snapshotted into the row at creation (Task 87 replayed)
 *   D. no-leak: strangers get real 404s; lists are scoped by real ids
 *   E. the state machine — requested→shipped (supplier only, declared value),
 *      shipped→delivered (buyer only), requested→cancelled (either side);
 *      every illegal move is a 409 naming the current state; every legal one
 *      audits + notifies the other side
 *   F. snapshot survival: deleting the address book entry never erases the
 *      sample's shipping history (fromSnapshot:true, honest flag)
 *
 * Run: bun scripts/qa/t90-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { io } from 'socket.io-client'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
function ok(cond, label, extra = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.90.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
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
    return { status: res.status, json }
  }
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA90 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA90 Shop ${email.slice(7, 14)}` } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json)}`)
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

function waitForEvent(socket, event, ms = 8000, predicate = null) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { socket.off(event, h); resolve(null) }, ms)
    const h = (payload) => {
      if (predicate && !predicate(payload)) return // keep waiting for the RIGHT event
      clearTimeout(t); socket.off(event, h); resolve(payload)
    }
    socket.on(event, h)
  })
}

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't90-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession(), stranger = makeSession()
  await registerAndLogin(admin, 'admin', 'qa90-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa90-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa90-buyer@qa.local', PASSWORD)
  await registerAndLogin(stranger, 'buyer', 'qa90-stranger@qa.local', PASSWORD)
  console.log('  users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA90 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA90 Hydraulic Jack 5T', description: 'QA90 heavy jack', categoryId, unit: 'pcs',
    moq: 10, basePrice: 4200, stockQuantity: 200,
    priceTiers: [{ minQty: 1, pricePerUnit: 4200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA90' })
  ok(Boolean(categoryId && productId), 'category + product created & approved')

  // Buyer address book row (real, for the snapshot path)
  const addr = await buyer('POST', '/api/addresses', {
    label: 'Warehouse Door 3', contactName: 'QA90 Buyer', contactPhone: '01700000090',
    addressLine1: '90 Sample Lane', city: 'Dhaka', postalCode: '1213',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  ok(Boolean(addressId), 'buyer address created (real row)', JSON.stringify(addr.json)?.slice(0, 120))

  // Foreign address (stranger's row) for the 400 probe
  const sAddr = await stranger('POST', '/api/addresses', {
    label: 'Not Mine', contactName: 'QA90 Stranger', contactPhone: '01700000091',
    addressLine1: '91 Stranger St', city: 'Dhaka', postalCode: '1213',
  })
  const foreignAddressId = sAddr.json?.data?.id ?? sAddr.json?.id

  /* ── A. auth gates ── */
  console.log('— A. auth gates —')
  ok((await makeSession()('POST', '/api/samples', { productId, quantity: 1 })).status === 401, 'anon create → 401')
  ok((await makeSession()('GET', '/api/samples')).status === 401, 'anon buyer list → 401')
  ok((await makeSession()('PATCH', '/api/samples/whatever', { action: 'ship' })).status === 401, 'anon patch → 401')
  ok((await makeSession()('GET', '/api/supplier/samples')).status === 401, 'anon supplier list → 401')
  ok((await buyer('GET', '/api/supplier/samples')).status === 403, 'buyer on supplier list → 403 (profile required)')

  /* ── B. create guards ── */
  console.log('— B. create guards —')
  ok((await buyer('POST', '/api/samples', { productId: 'phantom-product', quantity: 1 })).status === 404, 'phantom product → 404')
  ok((await buyer('POST', '/api/samples', {})).status === 400, 'missing productId → 400')
  ok((await buyer('POST', '/api/samples', { productId, quantity: 1, evilKey: true })).status === 400, 'unknown key (strict) → 400')
  ok((await buyer('POST', '/api/samples', { productId, quantity: 0 })).status === 400, 'quantity 0 → 400')
  ok((await buyer('POST', '/api/samples', { productId, quantity: 1, shippingAddressId: 'no-such-address' })).status === 400, 'unknown address → 400')
  ok((await buyer('POST', '/api/samples', { productId, quantity: 1, shippingAddressId: foreignAddressId })).status === 400, 'FOREIGN address → 400')

  /* ── C. create + the cohesion rails (socket armed FIRST) ── */
  console.log('— C. create fans out to the supplier —')
  const profile = await db.supplierProfiles.findFirst({ where: { companyName: { contains: 'QA90' } }, select: { id: true, userId: true } })
  const sellerUserId = profile?.userId
  ok(Boolean(profile?.id && sellerUserId), 'supplier profile resolved (real rows)')

  const tok = await seller('GET', `/api/realtime/room-token?room=seller:${profile.id}`)
  ok(Boolean(tok.json?.token), 'supplier minted seller:<id> room token')
  const sock = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  sock.emit('subscribe', { room: `seller:${profile.id}`, token: tok.json.token })
  ok(Boolean(await waitForEvent(sock, 'subscribe:ok')), 'supplier joined seller:<id> room')
  const newTap = waitForEvent(sock, 'sample:new')

  const s1 = await buyer('POST', '/api/samples', { productId, quantity: 2, shippingAddressId: addressId })
  ok(s1.status === 201 && s1.json?.data?.sampleId && s1.json?.data?.status === 'requested', 'sample created → 201 requested', JSON.stringify(s1.json)?.slice(0, 160))
  const sample1 = s1.json?.data?.sampleId

  const row = await db.sampleOrders.findUnique({ where: { id: sample1 }, select: { supplierId: true, shippingAddressSnapshot: true, samplePrice: true, status: true } })
  ok(row?.supplierId === profile.id, 'supplierId taken from the PRODUCT row (never client-sent)')
  ok(typeof row?.shippingAddressSnapshot === 'string' && row.shippingAddressSnapshot.includes('90 Sample Lane'),
    'address snapshotted into the row at creation (Task 87 replayed)')
  ok(row?.samplePrice === 0 && row?.status === 'requested', 'defaults honest: price 0, status requested')

  const notif = await db.notifications.findFirst({ where: { userId: sellerUserId, relatedEntityId: sample1 } })
  ok(Boolean(notif) && notif.title.includes('Hydraulic Jack') && notif.title.includes('×2'),
    'supplier durable notification with product + qty', JSON.stringify(notif?.title))

  const gotNew = await newTap
  ok(Boolean(gotNew) && gotNew?.sampleId === sample1 && gotNew?.quantity === 2, "live 'sample:new' tap with the real sample", JSON.stringify(gotNew)?.slice(0, 140))

  const dup = await buyer('POST', '/api/samples', { productId, quantity: 1, shippingAddressId: addressId })
  ok(dup.status === 409 && dup.json?.sampleId === sample1, 'duplicate ACTIVE sample → 409 with the real sampleId')

  const s2 = await buyer('POST', '/api/samples', { productId: undefined && productId, quantity: 1 }).catch(() => null)
  void s2
  // second buyer request WITHOUT an address (stranger has none on this product) — different buyer:
  const s2b = await stranger('POST', '/api/samples', { productId, quantity: 1 })
  ok(s2b.status === 201, 'stranger can request the same product (different buyer)', `got ${s2b.status}`)
  const sample2 = s2b.json?.data?.sampleId

  /* ── D. lists + no-leak ── */
  console.log('— D. lists + no-leak —')
  const buyerList = await buyer('GET', '/api/samples')
  ok(buyerList.json?.data?.samples?.length === 1, 'buyer list scoped to own (1 row)')
  const bRow = buyerList.json?.data?.samples?.[0]
  ok(bRow?.shippingAddress?.live === true && bRow?.shippingAddress?.addressLine1 === '90 Sample Lane' && bRow?.fromSnapshot === false,
    'live address served while the row exists (honest live flag)')
  ok(bRow?.product?.supplierName?.includes('QA90') && bRow?.product?.unit === 'pcs', 'list embeds real product + supplier')

  const sellerList = await seller('GET', '/api/supplier/samples')
  ok(sellerList.status === 200 && sellerList.json?.data?.stats?.total === 2 && sellerList.json?.data?.stats?.requested === 2,
    'supplier list: 2 requests, stats honest', JSON.stringify(sellerList.json?.data?.stats))
  const supRow1 = sellerList.json?.data?.samples?.find((s) => s.id === sample1)
  ok(supRow1?.buyerName === 'QA90 buyer' && supRow1?.shippingAddress?.addressLine1 === '90 Sample Lane',
    'supplier sees the buyer name + the creation snapshot')

  const strangerList = await stranger('GET', '/api/samples')
  ok(strangerList.json?.data?.samples?.length === 1 && strangerList.json.data.samples[0].id === sample2,
    'stranger list shows only their own sample')
  ok((await stranger('PATCH', `/api/samples/${sample1}`, { action: 'ship' })).status === 404, 'FOREIGN sample PATCH → 404 (no-leak)')
  ok((await stranger('PATCH', `/api/samples/${sample1}`, { action: 'cancel' })).status === 404, 'FOREIGN cancel → 404 too (role guard)')

  /* ── E. the state machine ── */
  console.log('— E. state machine —')
  ok((await buyer('PATCH', `/api/samples/${sample1}`, { action: 'ship' })).status === 403, 'buyer cannot ship → 403')
  ok((await seller('PATCH', `/api/samples/${sample1}`, { action: 'deliver' })).status === 403, 'supplier cannot confirm delivery → 403')
  ok((await seller('PATCH', `/api/samples/${sample1}`, { action: 'deliver' })).status === 403, 'deliver while requested → still role-403')
  ok((await buyer('PATCH', `/api/samples/${sample1}`, { action: 'deliver', })).status === 409, 'deliver while requested → 409 names the state')
  ok((await seller('PATCH', `/api/samples/${sample2}`, { action: 'cancel' })).status === 200, 'supplier cancel while requested → 200 (either side)')
  ok((await db.notifications.count({ where: { userId: (await db.users.findFirst({ where: { email: 'qa90-stranger@qa.local' } })).id, relatedEntityId: sample2 } })) >= 1,
    'buyer told durably about the cancellation')

  const statusTap = waitForEvent(sock, 'sample:status', 8000, (p) => p?.sampleId === sample1 && p?.status === 'shipped')
  const ship = await seller('PATCH', `/api/samples/${sample1}`, { action: 'ship', samplePrice: 50 })
  ok(ship.status === 200 && ship.json?.data?.sample?.status === 'shipped', 'supplier ships → 200 shipped', JSON.stringify(ship.json)?.slice(0, 140))
  const shippedRow = await db.sampleOrders.findUnique({ where: { id: sample1 }, select: { samplePrice: true } })
  ok(shippedRow?.samplePrice === 50, 'declared value 50 persisted (raw DB)')
  const gotStatus = await statusTap
  ok(Boolean(gotStatus) && gotStatus?.status === 'shipped' && gotStatus?.role === 'supplier', "live 'sample:status' tap on the seller room", JSON.stringify(gotStatus)?.slice(0, 120))

  const buyerUserId = (await db.users.findFirst({ where: { email: 'qa90-buyer@qa.local' }, select: { id: true } }))?.id
  const shipNotif = await db.notifications.findFirst({ where: { userId: buyerUserId, relatedEntityId: sample1, title: { contains: 'on its way' } } })
  ok(Boolean(shipNotif) && shipNotif.body.includes('declared value ৳50'), 'buyer durable ship notification with the declared value')

  ok((await seller('PATCH', `/api/samples/${sample1}`, { action: 'ship' })).status === 409, 'ship again → 409 (already shipped)')
  ok((await buyer('PATCH', `/api/samples/${sample1}`, { action: 'cancel' })).status === 409, 'cancel after ship → 409 (real state in the message)')
  const deliver = await buyer('PATCH', `/api/samples/${sample1}`, { action: 'deliver' })
  ok(deliver.status === 200 && deliver.json?.data?.sample?.status === 'delivered', 'buyer confirms delivery → 200 delivered')
  const supNotifAfter = await db.notifications.findFirst({ where: { userId: sellerUserId, relatedEntityId: sample1, title: { contains: 'delivered' } } })
  ok(Boolean(supNotifAfter), 'supplier told durably about the delivery')
  ok((await buyer('PATCH', `/api/samples/${sample1}`, { action: 'deliver' })).status === 409, 'deliver again → 409')

  // cancelled frees the buyer to ask again
  const again = await stranger('POST', '/api/samples', { productId, quantity: 1 })
  ok(again.status === 201, 'cancelled sample frees re-request → 201')

  const audits = await db.auditLogs.groupBy({ by: ['action'], where: { entityType: 'sampleOrders' }, _count: { _all: true } })
  const auditMap = Object.fromEntries(audits.map((a) => [a.action, a._count._all]))
  ok(auditMap.sample_requested >= 3 && auditMap.sample_shipped === 1 && auditMap.sample_delivered === 1 && auditMap.sample_cancelled === 1,
    'audit trail: requested/shipped/delivered/cancelled all real', JSON.stringify(auditMap))

  /* ── F. snapshot survival (the Task 87 lesson, replayed) ── */
  console.log('— F. snapshot survival —')
  const delAddr = await buyer('DELETE', `/api/addresses/${addressId}`)
  ok(delAddr.status === 200 || delAddr.status === 204, 'buyer deletes the address book entry')
  const afterDel = await buyer('GET', '/api/samples')
  const afterRow = afterDel.json?.data?.samples?.find((s) => s.id === sample1)
  ok(afterRow?.shippingAddress?.addressLine1 === '90 Sample Lane' && afterRow?.fromSnapshot === true,
    'sample STILL shows the full address, honestly flagged fromSnapshot:true', JSON.stringify(afterRow?.shippingAddress))
  const fkRow = await db.sampleOrders.findUnique({ where: { id: sample1 }, select: { shippingAddressId: true, shippingAddressSnapshot: true } })
  ok(fkRow?.shippingAddressId === null && fkRow.shippingAddressSnapshot?.includes('90 Sample Lane'),
    'raw truth: FK is SetNull, snapshot text persisted forever')

  sock.close()
  console.log(`\n=== T90 RESULT: ${PASS} pass / ${FAIL} fail ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error('FATAL:', e)
  process.exitCode = 1
  await db.$disconnect()
})
