/**
 * Task 82 E2E — THE RFQ CHAIN, drilled for the first time: zero prior E2E
 * touched rfqRequests despite the full route family (create → seller quotes →
 * buyer award → convert-order). The drill also caught two real defects before
 * a buyer ever could:
 *   1) convert-order (an order-CREATION path) never wrote the 'Order placed'
 *      tracking timeline row the cart flow and create-direct write;
 *   2) GET /api/rfq?role=supplier filtered rfqQuotes.supplierId (a supplier
 *      PROFILES reference) by the auth USER id — two id spaces, always empty.
 * Both are fixed in this task and asserted here.
 *
 * Run: bun scripts/qa/t82-e2e.mjs   (DB EMPTY — first-admin window; dev FRESH)
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
  const ip = `10.99.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA82 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA82 Shop ${email.slice(5, 12)}` } : {}),
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
  const PASSWORD = 't82-Rfq-Qa1!'
  const anon = makeSession()
  const admin = makeSession()
  const sellerA = makeSession()
  const sellerB = makeSession()
  const buyer = makeSession()
  const stranger = makeSession()

  section('A. auth gates')
  {
    const g1 = await anon('POST', '/api/rfq', { title: 'x', description: 'y' })
    ok(g1.status === 401, 'anon RFQ create -> 401', `got ${g1.status}`)
    const g2 = await anon('POST', '/api/rfq/whatever/convert-order', {})
    ok(g2.status === 401, 'anon convert -> 401', `got ${g2.status}`)
  }

  section('B. accounts + product')
  await registerAndLogin(admin, 'admin', 'qa82-admin@qa.local', PASSWORD)
  await registerAndLogin(sellerA, 'supplier', 'qa82-supa-a@qa.local', PASSWORD)
  await registerAndLogin(sellerB, 'supplier', 'qa82-supa-b@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa82-buyer@qa.local', PASSWORD)
  await registerAndLogin(stranger, 'buyer', 'qa82-stranger@qa.local', PASSWORD)
  const cat = await admin('POST', '/api/admin/categories', { name: 'QA82 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await sellerA('POST', '/api/supplier/products', {
    name: 'QA82 RFQ Product', description: 'QA t82 negotiated deal', categoryId, unit: 'pcs',
    moq: 1, basePrice: 500, stockQuantity: 100,
    priceTiers: [{ minQty: 1, pricePerUnit: 500 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], variants: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA82' })
  ok(Boolean(productId), 'approved product (list 500, stock 100)')

  section('C. buyer opens the RFQ')
  const rfq = await buyer('POST', '/api/rfq', {
    title: 'Need 10 units, can you do better than 500?',
    description: 'QA82 negotiated purchase',
    quantity: 10, unit: 'pcs', targetPrice: 400, productId,
  })
  ok(rfq.status === 201 && Boolean(rfq.json?.data?.id), 'RFQ created -> 201', `got ${rfq.status}`)
  const rfqId = rfq.json?.data?.id
  const d1 = await buyer('GET', `/api/rfq/${rfqId}`)
  ok(d1.json?.data?.status === 'open', "RFQ starts 'open'")
  const mine = await buyer('GET', '/api/rfq?role=buyer&limit=10')
  ok((mine.json?.data?.rfqs ?? mine.json?.data ?? []).length >= 1, "buyer's RFQ list shows it")

  section('D. sellers quote (the profile-id linkage)')
  {
    const sList = await sellerA('GET', '/api/supplier/rfqs')
    const saw = (sList.json?.data?.items ?? sList.json?.data ?? []).some?.((r) => r.id === rfqId)
      ?? (Array.isArray(sList.json?.data) && sList.json.data.some((r) => r.id === rfqId))
    ok(saw === true, "seller A's supplier RFQ list sees the open RFQ")
    const q1 = await sellerA('POST', `/api/supplier/rfqs/${rfqId}/quote`, { pricePerUnit: 420, deliveryDays: 5, message: 'QA82 deal A' })
    ok(q1.status === 201, 'seller A quotes 420', `got ${q1.status}`)
    const q2 = await sellerB('POST', `/api/supplier/rfqs/${rfqId}/quote`, { pricePerUnit: 450, deliveryDays: 7 })
    ok(q2.status === 201, 'seller B quotes 450', `got ${q2.status}`)
    const d2 = await buyer('GET', `/api/rfq/${rfqId}`)
    ok(d2.json?.data?.status === 'quoted', "RFQ moves to 'quoted'")
    const quotes = d2.json?.data?.quotes ?? []
    ok(quotes.length === 2, 'buyer sees both quotes')
  }

  section('E. award rail')
  {
    const d = await buyer('GET', `/api/rfq/${rfqId}`)
    const quotes = d.json?.data?.quotes ?? []
    const qa = quotes.find((q) => q.pricePerUnit === 420)
    const qb = quotes.find((q) => q.pricePerUnit === 450)
    ok(Boolean(qa && qb), 'both quotes on the detail payload')
    const aw = await buyer('PATCH', `/api/rfq/${rfqId}/quotes/${qa.id}`, { action: 'accept' })
    ok(aw.status === 200, 'buyer accepts quote A -> 200', `got ${aw.status}`)
    const d2 = await buyer('GET', `/api/rfq/${rfqId}`)
    ok(d2.json?.data?.status === 'awarded', "RFQ 'awarded'")
    const after = d2.json?.data?.quotes ?? []
    ok(after.find((q) => q.id === qa.id)?.status === 'accepted', 'quote A accepted')
    ok(after.find((q) => q.id === qb.id)?.status === 'rejected', 'sibling quote B auto-rejected')
  }

  section('F. convert-order (negotiated price, stock, timeline)')
  {
    const conv = await buyer('POST', `/api/rfq/${rfqId}/convert-order`, {})
    ok(conv.status === 201, 'convert -> 201', `got ${conv.status} ${JSON.stringify(conv.json).slice(0, 140)}`)
    const orderId = conv.json?.data?.orderId ?? conv.json?.data?.order?.id
    ok(Boolean(orderId), 'real orderId returned')
    const detail = await buyer('GET', `/api/orders/${orderId}`)
    const so = detail.json?.data?.subOrders?.[0]
    const item = so?.items?.[0]
    ok(item?.unitPrice === 420, 'NEGOTIATED unitPrice 420 (list is 500 — the deal wins)', `got ${item?.unitPrice}`)
    ok(item?.quantity === 10, 'quantity 10 carried from the RFQ')
    ok(detail.json?.data?.totalAmount === 4200, 'total = 420 × 10 = 4200', `got ${detail.json?.data?.totalAmount}`)
    ok(detail.json?.data?.paymentStatus === 'unpaid', 'converted order honestly unpaid')
    const soRow = await db.subOrders.findFirst({ where: { orderId }, select: { supplierId: true } })
    const aProfile = await db.supplierProfiles.findFirst({ where: { userId: (await db.users.findFirst({ where: { email: 'qa82-supa-a@qa.local' }, select: { id: true } }))?.id }, select: { id: true } })
    ok(soRow?.supplierId === aProfile?.id, 'subOrder supplier = seller A PROFILE id (server truth)')
    const pr = await anon('GET', `/api/products/${productId}`)
    ok(pr.json?.data?.stockQuantity === 90, 'stock 100 → 90 by the conversion', `got ${pr.json?.data?.stockQuantity}`)
    const track = (so?.tracking ?? [])
    ok(track.length === 1 && track[0]?.location === 'Order placed', "timeline row 'Order placed' EXISTS on the RFQ path (fixed this task)", JSON.stringify(track))
    ok(track[0]?.note?.includes('accepted quote'), 'the note says it came from an accepted quote', track[0]?.note)
    const rfqAfter = await buyer('GET', `/api/rfq/${rfqId}`)
    ok(Boolean(rfqAfter.json?.data?.convertedOrder?.id), 'rfq.convertedOrder exposed to the buyer (id + orderNumber)', JSON.stringify(rfqAfter.json?.data?.convertedOrder))
    ok(rfqAfter.json?.data?.convertedOrder?.orderNumber === detail.json?.data?.orderNumber, 'convertedOrderNumber matches the real order')
    const again = await buyer('POST', `/api/rfq/${rfqId}/convert-order`, {})
    ok(again.status === 409, 'double convert -> 409 (one order per accepted quote)', `got ${again.status}`)
    const strangerConv = await stranger('POST', `/api/rfq/${rfqId}/convert-order`, {})
    ok(strangerConv.status === 404, 'stranger convert -> 404 (no-leak)', `got ${strangerConv.status}`)
  }

  section('G. post-award guards + audits')
  {
    const lateQuote = await sellerB('POST', `/api/supplier/rfqs/${rfqId}/quote`, { pricePerUnit: 410 })
    ok(lateQuote.status === 409, 'quoting an awarded RFQ -> 409', `got ${lateQuote.status}`)
    const audits = await db.auditLogs.findMany({
      where: { action: { in: ['rfq_quote_accepted', 'rfq_converted_to_order'] } },
      select: { action: true },
    })
    const actions = audits.map((a) => a.action)
    ok(actions.includes('rfq_quote_accepted') && actions.includes('rfq_converted_to_order'), 'both audits written', actions.join(','))
  }

  section('H. the role=supplier id-space fix')
  {
    const sellerList = await sellerA('GET', '/api/rfq?role=supplier&limit=10')
    const rows = sellerList.json?.data?.rfqs ?? sellerList.json?.data ?? []
    ok(Array.isArray(rows) && rows.some((r) => r.id === rfqId), 'GET /api/rfq?role=supplier now matches by PROFILE id (was always empty)', `got ${Array.isArray(rows) ? rows.length : 'non-list'}`)
  }

  console.log(`\n═══ t82 RESULT: ${PASS} PASS / ${FAIL} FAIL ═══`)
  if (FAIL > 0) { console.log('FAILURES:', failures.join(' | ')); process.exit(1) }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1) }).finally(async () => { await db.$disconnect() })
