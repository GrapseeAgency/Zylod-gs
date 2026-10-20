/**
 * Task 80 E2E — TRACKING TIMELINE LOOP CLOSED: seller status transitions now
 * append REAL orderTracking rows (the same table the creation row and driver
 * GPS pings use), the cart-flow order POST writes its 'Order placed' row like
 * create-direct already did, and the buyer surfaces (order detail payload +
 * /track endpoint) carry the full story.
 *
 * Run: bun scripts/qa/t80-e2e.mjs   (DB EMPTY — first-admin window; dev FRESH)
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
  const ip = `10.93.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA80 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA80 Shop ${email.slice(5, 12)}` } : {}),
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
  const PASSWORD = 't80-Track-Qa1!'
  const anon = makeSession()
  const admin = makeSession()
  const seller = makeSession()
  const buyer = makeSession()
  const stranger = makeSession()

  section('A. auth gates on the track route')
  {
    const g = await anon('GET', '/api/orders/does-not-exist/track')
    ok([401, 404].includes(g.status), 'anon track read refused', `got ${g.status}`)
  }

  section('B. accounts + product + order')
  await registerAndLogin(admin, 'admin', 'qa80-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa80-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa80-buyer@qa.local', PASSWORD)
  await registerAndLogin(stranger, 'buyer', 'qa80-stranger@qa.local', PASSWORD)
  const cat = await admin('POST', '/api/admin/categories', { name: 'QA80 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA80 Timeline Product', description: 'QA t80 tracking timeline', categoryId, unit: 'pcs',
    moq: 1, basePrice: 90, stockQuantity: 40,
    priceTiers: [{ minQty: 1, pricePerUnit: 90 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], variants: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA80' })

  const order = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }] })
  const orderId = order.json?.data?.orderId
  ok(Boolean(orderId), 'buyer placed a real order (cart flow)', JSON.stringify(order.json?.data ?? {}).slice(0, 120))

  section('C. creation timeline row (cart flow parity with create-direct)')
  {
    const detail = await buyer('GET', `/api/orders/${orderId}`)
    ok(detail.status === 200, 'buyer order detail -> 200', `got ${detail.status}`)
    const so = detail.json?.data?.subOrders?.[0]
    ok(Array.isArray(so?.tracking) && so.tracking.length === 1, 'exactly ONE timeline row at creation', `got ${so?.tracking?.length}`)
    ok(so?.tracking?.[0]?.status === 'pending' && so?.tracking?.[0]?.location === 'Order placed', "the row is the honest 'Order placed' row", JSON.stringify(so?.tracking?.[0]))
  }

  section('D. seller transitions write the real timeline')
  const soId = (await buyer('GET', `/api/orders/${orderId}`)).json?.data?.subOrders?.[0]?.id
  {
    const r1 = await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'confirmed', subOrderId: soId, note: 'Preparing your items' })
    ok(r1.status === 200, 'seller confirms', `got ${r1.status}`)
    const r2 = await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'confirmed', subOrderId: soId })
    ok(r2.status === 200, 'same-status re-set accepted by the API')
    let detail = await buyer('GET', `/api/orders/${orderId}`)
    let rows = detail.json?.data?.subOrders?.[0]?.tracking ?? []
    ok(rows.length === 2, 'same-status re-set wrote NO extra row (2 rows after confirm + re-set)', `got ${rows.length}`)
    ok(rows[0]?.note?.includes('Seller note: Preparing your items'), 'the seller note rode along on the timeline row', rows[0]?.note)

    await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'packed', subOrderId: soId })
    const r4 = await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'shipped', subOrderId: soId, trackingNumber: 'WB80QA12345' })
    ok(r4.status === 200, 'seller ships with a waybill', `got ${r4.status}`)
    const r5 = await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: soId })
    ok(r5.status === 200, 'seller marks delivered', `got ${r5.status}`)

    detail = await buyer('GET', `/api/orders/${orderId}`)
    rows = detail.json?.data?.subOrders?.[0]?.tracking ?? []
    ok(rows.length === 5, 'timeline now holds 5 rows (placed, confirmed, packed, shipped, delivered)', `got ${rows.length}`)
    const shippedRow = rows.find((r) => r.status === 'shipped')
    ok(shippedRow?.note?.includes('Waybill WB80QA12345'), 'the shipped row names the waybill', shippedRow?.note)
    ok(shippedRow?.location === 'Handed to courier', 'shipped location phrase is real')
    const statuses = rows.map((r) => r.status)
    ok(statuses.includes('delivered') && statuses.includes('packed'), 'delivered + packed milestones present', statuses.join(','))
    // newest first (the payload orders desc — the UI re-sorts for display)
    ok(new Date(rows[0].trackedAt).getTime() >= new Date(rows[rows.length - 1].trackedAt).getTime(), 'rows arrive newest-first')

    // Idempotent re-delivery writes nothing (mirrors the t71 escrow guarantee).
    await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: soId }).catch(() => null)
    detail = await buyer('GET', `/api/orders/${orderId}`)
    rows = detail.json?.data?.subOrders?.[0]?.tracking ?? []
    ok(rows.length === 5, 're-delivered PATCH still 5 rows (no duplicate timeline spam)', `got ${rows.length}`)
  }

  section('E. the /track endpoint tells the same story')
  {
    const t = await buyer('GET', `/api/orders/${orderId}/track`)
    ok(t.status === 200, 'buyer track read -> 200', `got ${t.status}`)
    const so = t.json?.data?.subOrders?.[0]
    ok(so?.timeline?.length === 5, 'track timeline = 5 rows', `got ${so?.timeline?.length}`)
    ok(so?.latest?.status === 'delivered' && so?.latest?.location === 'Delivered', 'latest = delivered', JSON.stringify(so?.latest))
    ok(so?.trackingNumber === 'WB80QA12345', 'waybill surfaced on the track payload')
    const s = await stranger('GET', `/api/orders/${orderId}/track`)
    ok(s.status === 403, 'stranger track read -> 403 (no leak)', `got ${s.status}`)
  }

  section('F. audits + persistence truth')
  {
    const audits = await db.auditLogs.count({ where: { action: 'suborder_status_updated' } })
    ok(audits === 6, 'six audited status PATCHes (confirmed, re-set, packed, shipped, delivered, re-delivered)', `got ${audits}`)
    const rows = await db.orderTracking.findMany({ where: { subOrderId: soId }, orderBy: { trackedAt: 'asc' } })
    ok(rows.length === 5, 'DB holds exactly 5 orderTracking rows for the shipment', `got ${rows.length}`)
    ok(rows[0].location === 'Order placed' && rows[rows.length - 1].status === 'delivered', 'first row placed, last row delivered')
    const statuses = rows.map((r) => r.status)
    ok(!statuses.slice(1).includes('pending'), 'no duplicate creation rows')
  }

  console.log(`\n═══ t80 RESULT: ${PASS} PASS / ${FAIL} FAIL ═══`)
  if (FAIL > 0) { console.log('FAILURES:', failures.join(' | ')); process.exit(1) }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1) }).finally(async () => { await db.$disconnect() })
