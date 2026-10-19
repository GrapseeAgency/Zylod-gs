/**
 * Task 66 E2E — (a) seller analytics restock-demand block, (b) per-shipment
 * notification ids.
 *
 * Doctrine under test:
 *   • GET /api/supplier/analytics carries restockDemand built from REAL
 *     active stockAlerts rows, scoped to the caller's own products only;
 *     variant watches count toward their product with their pinned labels.
 *   • A PER-SHIPMENT status change (seller PATCH shipped/delivered with a
 *     tracking number) persists order + delivery notifications carrying
 *     relatedShipmentId = the exact subOrder id — the deep-link target.
 *
 * Run: bun scripts/qa/t66-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.79.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA66 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA66 Shop ${email.slice(5, 12)}` } : {}),
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

const notifications = async (session) => {
  const r = await session('GET', '/api/notifications?limit=50')
  return r.json?.data?.notifications ?? r.json?.data ?? []
}

const main = async () => {
  const PASSWORD = 't66-Ship-Qa1!'
  const admin = makeSession(), sellerA = makeSession(), sellerB = makeSession(), buyer = makeSession(), buyer2 = makeSession()
  const anon = makeSession()
  const ts = Date.now().toString().slice(-6)

  section('setup — two suppliers, one product each')
  await registerAndLogin(admin, 'admin', `qa66-admin@qa.local`, PASSWORD)
  await registerAndLogin(sellerA, 'supplier', `qa66-supa-a@qa.local`, PASSWORD)
  await registerAndLogin(sellerB, 'supplier', `qa66-supa-b@qa.local`, PASSWORD)
  await registerAndLogin(buyer, 'buyer', `qa66-buyer@qa.local`, PASSWORD)
  await registerAndLogin(buyer2, 'buyer', `qa66-buyer2@qa.local`, PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: `QA66 Cat ${ts}`, isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prodA = await sellerA('POST', '/api/supplier/products', {
    name: 'QA66 safety-helmets', description: 'QA t66 analytics + shipment notifications', categoryId, unit: 'pcs',
    moq: 1, basePrice: 90, stockQuantity: 10, priceTiers: [{ minQty: 1, pricePerUnit: 90 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productIdA = prodA.json?.data?.id ?? prodA.json?.id
  await admin('PATCH', '/api/admin/products', { productId: productIdA, action: 'approve', reason: 'QA66' })
  const prodB = await sellerB('POST', '/api/supplier/products', {
    name: 'QA66 other-shop goods', description: 'QA t66 scoping control', categoryId, unit: 'pcs',
    moq: 1, basePrice: 70, stockQuantity: 5, priceTiers: [{ minQty: 1, pricePerUnit: 70 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productIdB = prodB.json?.data?.id ?? prodB.json?.id
  await admin('PATCH', '/api/admin/products', { productId: productIdB, action: 'approve', reason: 'QA66' })
  // a SECOND product for seller A WITH an OOS variant — proves the demand row
  // names the exact variant being waited on
  const prodA2 = await sellerA('POST', '/api/supplier/products', {
    name: 'QA66 insulated panels', description: 'QA t66 variant demand labels', categoryId, unit: 'pcs',
    moq: 1, basePrice: 150, stockQuantity: 5, priceTiers: [{ minQty: 1, pricePerUnit: 150 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    variants: [
      { variantName: 'Finish', variantValue: 'Matte', stockQuantity: 5 },
      { variantName: 'Finish', variantValue: 'Gloss', stockQuantity: 0 },
    ],
  })
  const productIdA2 = prodA2.json?.data?.id ?? prodA2.json?.id
  await admin('PATCH', '/api/admin/products', { productId: productIdA2, action: 'approve', reason: 'QA66' })
  const detailA2 = await sellerA('GET', `/api/supplier/products/${productIdA2}`)
  const gloss = (detailA2.json?.data?.variants ?? []).find((v) => v.variantValue === 'Gloss')
  ok(Boolean(gloss?.id), 'product A2 Gloss variant (OOS) resolved')

  const addr = await buyer('POST', '/api/addresses', {
    label: 'QA66 HQ', address_line1: '66 QA Street', city: 'Dhaka', district: 'Dhaka',
    postal_code: '1213', contact_phone: '01700000000',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id

  section('A) per-shipment notifications carry the shipment id')
  const ord = await buyer('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId: productIdA, quantity: 10 }],
  })
  ok(ord.status === 201, 'buyer orders all 10 helmets')
  const orderId = ord.json?.data?.orderId ?? ord.json?.data?.id
  const detail = await buyer('GET', `/api/orders/${orderId}`)
  const sub = (detail.json?.data?.subOrders ?? [])[0]
  ok(Boolean(sub?.id), 'subOrder (shipment) resolved')
  const pay = await buyer('POST', `/api/orders/${orderId}/payment-submit`, {
    method: 'mobile_banking', brand: 'bKash', transactionId: `T66PAY${ts}`.toUpperCase(), senderNumber: '01700000000',
  })
  ok(pay.status === 201, 'payment reference submitted')
  const payRow = ((await sellerA('GET', '/api/seller/payments?status=pending')).json?.data ?? []).find((p) => p.orderId === orderId)
  ok((await sellerA('POST', `/api/seller/payments/${payRow.id}/verify`, { action: 'verify' })).status === 200, 'seller verifies → paid')

  const ship = await sellerA('PATCH', `/api/supplier/orders/${orderId}`, { status: 'shipped', subOrderId: sub.id, trackingNumber: `QA66TRK${ts}` })
  ok(ship.status === 200, 'seller ships the shipment (with tracking number)')
  await sleep(700)

  const buyNotifs = await notifications(buyer)
  const milestone = buyNotifs.find((n) => (n.title ?? '').includes('Dispatched') && n.type === 'order')
  const dispatch = buyNotifs.find((n) => n.type === 'delivery' && (n.title ?? '').startsWith('Courier In Transit'))
  ok(Boolean(milestone), 'buyer got the shipped milestone notification', JSON.stringify(buyNotifs.map((n) => n.title)))
  ok(milestone?.relatedShipmentId === sub.id, `milestone carries relatedShipmentId = ${sub.id}`, String(milestone?.relatedShipmentId))
  ok(Boolean(dispatch), 'buyer got the courier-dispatch (delivery) notification')
  ok(dispatch?.relatedShipmentId === sub.id, 'delivery notification carries relatedShipmentId = the shipment')
  ok(dispatch?.relatedId === orderId, 'delivery notification still carries the parent orderId for the deep-link')

  const del = await sellerA('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: sub.id })
  ok(del.status === 200, 'seller marks the shipment delivered')
  await sleep(700)
  const deliveredRow = (await notifications(buyer)).find((n) => n.type === 'order' && (n.title ?? '').includes('Delivered'))
  ok(deliveredRow?.relatedShipmentId === sub.id, 'delivered milestone also carries the shipment id')

  section('B) analytics restock-demand — real rows, own products only')
  // product A is now at stock 0 (all 10 bought) → watchable
  const w1 = await buyer('POST', '/api/stock-alerts', { productId: productIdA })
  const w2 = await buyer2('POST', '/api/stock-alerts', { productId: productIdA })
  ok(w1.status === 201 && w2.status === 201, 'two buyers watch the sold-out product A')
  const ana = await sellerA('GET', '/api/supplier/analytics')
  ok(ana.status === 200, 'seller A analytics 200')
  const demand = ana.json?.data?.restockDemand
  ok(demand?.totalWatchers === 2, 'restockDemand.totalWatchers = 2 (REAL active watches)', JSON.stringify(demand))
  const rowA = (demand?.products ?? []).find((p) => p.productId === productIdA)
  ok(rowA?.watchers === 2 && rowA?.stockQuantity === 0 && rowA?.productName.includes('helmets'), 'demand row: product A, 2 watching, stock 0', JSON.stringify(rowA))

  // seller B has zero watches — their analytics must show an honest zero
  const anaB = await sellerB('GET', '/api/supplier/analytics')
  ok(anaB.json?.data?.restockDemand?.totalWatchers === 0 && (anaB.json?.data?.restockDemand?.products ?? []).length === 0, 'seller B demand queue honestly empty (no cross-supplier leakage)')

  // variant watch on A2's OOS Gloss variant → the demand row NAMES the variant
  const wv = await buyer('POST', '/api/stock-alerts', { productId: productIdA2, variantId: gloss.id })
  ok(wv.status === 201, 'buyer watches A2 Gloss (OOS variant) → 201')
  const anaV = await sellerA('GET', '/api/supplier/analytics')
  const rowA2 = (anaV.json?.data?.restockDemand?.products ?? []).find((p) => p.productId === productIdA2)
  ok(rowA2?.watchers === 1 && JSON.stringify(rowA2?.variantLabels) === JSON.stringify(['Finish: Gloss']), 'A2 demand row: 1 watching, waiting on Finish: Gloss', JSON.stringify(rowA2))
  ok(anaV.json?.data?.restockDemand?.totalWatchers === 3, 'totalWatchers spans product + variant watches (3)')

  // restocking product A drains ITS watches — the demand queue empties for A
  // but A2's variant watch stays (Gloss still at 0)
  await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ productId: productIdA, newQuantity: 6 }] })
  await sleep(800)
  const ana2 = await sellerA('GET', '/api/supplier/analytics')
  const demand2 = ana2.json?.data?.restockDemand
  ok(!(demand2?.products ?? []).some((p) => p.productId === productIdA), 'completed watches left the demand queue (product A gone)')
  const rowA2b = (demand2?.products ?? []).find((p) => p.productId === productIdA2)
  ok(Boolean(rowA2b) && rowA2b.watchers === 1, 'A2 demand row persists (Gloss still awaited)')
  ok(demand2?.totalWatchers === 1, 'totalWatchers drained to 1', JSON.stringify(demand2))

  section('C) DB audit — shipment ids persisted on the real rows')
  const shipRows = await db.notifications.findMany({ where: { relatedShipmentId: sub.id } })
  ok(shipRows.length === 3, `3 notification rows carry the shipment id (shipped milestone + PATCH dispatch + delivered milestone)`, String(shipRows.length))
  ok(shipRows.every((r) => r.relatedEntityId === orderId), 'every shipment-id row also carries the parent orderId')
  ok(shipRows.some((r) => r.type === 'delivery'), 'at least one is a delivery-type dispatch row')

  console.log(`\n${'═'.repeat(66)}`)
  console.log(`RESULT: ${PASS} passed, ${FAIL} failed`)
  if (failures.length) { console.log('FAILURES:'); for (const f of failures) console.log(`  - ${f}`) }
  console.log('═'.repeat(66))
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('HARNESS CRASH:', e)
  await db.$disconnect()
  process.exit(1)
})
