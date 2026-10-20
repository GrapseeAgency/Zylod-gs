/**
 * Task 87 E2E — THE ADDRESS BOOK → CHECKOUT HISTORY RAIL.
 *
 * Addresses are user-deletable and orders.shippingAddressId is a SetNull FK —
 * before Task 87, deleting an address book entry silently ERASED a real
 * order's shipping history (courier disputes, returns and invoices all read
 * it). Now every order-creation path (cart POST, create-direct, rfq
 * convert-order) captures an immutable order-time snapshot, and the order
 * detail read falls back to it when the live relation is gone.
 *
 * Proven here, on a wiped DB: address CRUD + default-swapping, ownership
 * (404 no-leak on foreign addresses), checkout linkage (foreign addressId
 * honestly 400), and THE CORE: order survives its address's deletion with
 * the full shipping history readable from the snapshot.
 *
 * Run: bun scripts/qa/t87-e2e.mjs   (DB must be EMPTY — first-admin window)
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

function makeSession() {
  let cookie = ''
  const ip = `10.87.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA87 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA87 Shop ${email.slice(5, 12)}` } : {}),
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

const addrBody = (over = {}) => ({
  label: 'Warehouse',
  address_line1: 'Plot 12, Sector 7, Uttara',
  city: 'Dhaka',
  postal_code: '1230',
  contact_name: 'QA87 Receiver',
  contact_phone: '+8801700000000',
  ...over,
})

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't87-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession(), stranger = makeSession()
  await registerAndLogin(admin, 'admin', 'qa87-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa87-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa87-buyer@qa.local', PASSWORD)
  await registerAndLogin(stranger, 'buyer', 'qa87-stranger@qa.local', PASSWORD)
  console.log('  users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA87 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA87 Rod 12mm', description: 'QA t87 address-rail product', categoryId, unit: 'kg',
    moq: 1, basePrice: 80, stockQuantity: 500, stockAlertThreshold: 10,
    priceTiers: [{ minQty: 1, pricePerUnit: 80 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA87' })
  ok(Boolean(productId), 'product created + approved')

  // ── A. auth gates ──
  console.log('— A. auth gates —')
  const anon = makeSession()
  ok((await anon('GET', '/api/addresses')).status === 401, 'anon list → 401')
  ok((await anon('POST', '/api/addresses', addrBody())).status === 401, 'anon create → 401')
  ok((await anon('PUT', '/api/addresses/whatever', addrBody())).status === 401, 'anon update → 401')
  ok((await anon('DELETE', '/api/addresses/whatever')).status === 401, 'anon delete → 401')

  // ── B. create guards ──
  console.log('— B. create guards —')
  const miss1 = await buyer('POST', '/api/addresses', addrBody({ label: '' }))
  ok(miss1.status === 400 && /label/.test(miss1.json?.error ?? ''), 'missing label → 400 naming the field')
  ok((await buyer('POST', '/api/addresses', addrBody({ address_line1: '' }))).status === 400, 'missing address_line1 → 400')
  ok((await buyer('POST', '/api/addresses', addrBody({ postal_code: '' }))).status === 400, 'missing postal_code → 400')
  ok((await buyer('POST', '/api/addresses', addrBody({ city: '' }))).status === 400, 'missing city → 400')

  // ── C. real CRUD + default swapping ──
  console.log('— C. CRUD + default semantics —')
  const a1 = await buyer('POST', '/api/addresses', addrBody())
  ok(a1.status === 201 && a1.json?.data?.id, 'address #1 created')
  ok(a1.json?.data?.isDefault === true, 'FIRST address is forced default (empty book)')
  ok(a1.json?.data?.address_line1 === 'Plot 12, Sector 7, Uttara' && a1.json?.data?.addressLine1 === 'Plot 12, Sector 7, Uttara', 'serializer serves BOTH camelCase and snake_case from real values')

  const a2 = await buyer('POST', '/api/addresses', addrBody({ label: 'Chattogram Depot', address_line1: 'GEC Circle', city: 'Chattogram', postal_code: '4000' }))
  ok(a2.status === 201 && a2.json?.data?.isDefault === false, 'second address without the flag is NOT default')
  const a2Id = a2.json?.data?.id, a1Id = a1.json?.data?.id

  const a3 = await buyer('POST', '/api/addresses', addrBody({ label: 'Sylhet Hub', address_line1: 'Zindabazar', city: 'Sylhet', postal_code: '3100', is_default: true }))
  ok(a3.status === 201 && a3.json?.data?.isDefault === true, 'third address WITH the flag takes default')
  const list1 = await buyer('GET', '/api/addresses')
  const flags = Object.fromEntries((list1.json?.data ?? []).map((a) => [a.id, a.isDefault]))
  ok(flags[a3.json.data.id] === true && flags[a1Id] === false && flags[a2Id] === false, 'exactly ONE default after the swap (server-side transaction)')

  const put = await buyer('PUT', `/api/addresses/${a1Id}`, addrBody({ label: 'Uttara Main', is_default: true }))
  ok(put.status === 200 && put.json?.data?.isDefault === true, 'PUT flips default back to #1')
  const list2 = await buyer('GET', '/api/addresses')
  const flags2 = Object.fromEntries((list2.json?.data ?? []).map((a) => [a.id, a.isDefault]))
  ok(flags2[a1Id] === true && flags2[a3.json.data.id] === false, 'old default demoted by the PUT')

  ok((await buyer('PUT', `/api/addresses/${a1Id}`, { city: 'Dhaka' })).status === 400, 'PUT without line1/postal → 400')
  ok((await buyer('PUT', '/api/addresses/no-such', addrBody())).status === 404, 'PUT unknown id → 404')

  // ── D. ownership (no-leak) ──
  console.log('— D. ownership —')
  ok((await stranger('PUT', `/api/addresses/${a1Id}`, addrBody())).status === 404, 'stranger PUT foreign address → 404 (same as unknown)')
  ok((await stranger('DELETE', `/api/addresses/${a1Id}`)).status === 404, 'stranger DELETE foreign address → 404')
  ok(((await stranger('GET', '/api/addresses')).json?.data ?? []).length === 0, "stranger's list is empty (user-scoped)")

  // ── E. checkout linkage + THE SNAPSHOT CORE ──
  console.log('— E. checkout: the address survives its own deletion —')
  ok((await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }], shippingAddressId: 'not-mine' })).status === 400, 'order with FOREIGN addressId → 400 Invalid shipping address')

  const ord = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }], shippingAddressId: a1Id })
  ok(ord.status === 201, 'order placed against address #1 (2 × 80 = 160)')
  const orderId = ord.json?.data?.orderId
  const det1 = await buyer('GET', `/api/orders/${orderId}`)
  ok(det1.json?.data?.shippingAddress?.id === a1Id && det1.json?.data?.shippingAddress?.city === 'Dhaka', 'detail serves the LIVE address row while it exists')
  ok(det1.json?.data?.shippingAddress?.fromSnapshot === undefined, 'live row is not flagged as snapshot')

  const del = await buyer('DELETE', `/api/addresses/${a1Id}`)
  ok(del.status === 200, 'buyer deletes address #1 (their right — history must survive)')
  const del2 = await buyer('DELETE', `/api/addresses/${a1Id}`)
  ok(del2.status === 404, 'delete again → 404')
  const det2 = await buyer('GET', `/api/orders/${orderId}`)
  const sa = det2.json?.data?.shippingAddress
  ok(Boolean(sa) && sa.addressLine1 === 'Plot 12, Sector 7, Uttara' && sa.city === 'Dhaka' && sa.postalCode === '1230' && sa.label === 'Uttara Main', 'AFTER deletion the order STILL carries the full shipping history (snapshot fallback)')
  ok(sa.fromSnapshot === true && sa.id === null, 'snapshot fallback honestly flagged (fromSnapshot, id null via SetNull)')

  const rawRow = await db.orders.findUnique({ where: { id: orderId }, select: { shippingAddressId: true, shippingAddressSnapshot: true } })
  ok(rawRow?.shippingAddressId === null && Boolean(rawRow?.shippingAddressSnapshot), 'raw DB: FK is null, snapshot text persisted')

  // default re-promotion after delete: remaining addresses still have one default
  const list3 = await buyer('GET', '/api/addresses')
  const defaultsLeft = (list3.json?.data ?? []).filter((a) => a.isDefault).length
  ok(defaultsLeft === 1, 'exactly one default remains in the book after delete')

  // ── F. RFQ convert path carries the snapshot too ──
  console.log('— F. rfq convert-order path —')
  const rfq = await buyer('POST', '/api/rfq', {
    title: 'QA87 rods bulk', description: 'Need 20kg rods, negotiated price welcome',
    quantity: 20, unit: 'kg', targetPrice: 70, productId,
  })
  const rfqId = rfq.json?.data?.id ?? rfq.json?.id
  ok(Boolean(rfqId), 'RFQ created (for the convert leg)')
  const quote = await seller('POST', `/api/supplier/rfqs/${rfqId}/quote`, { pricePerUnit: 70, deliveryDays: 5, message: 'QA87 quote' })
  ok(quote.status === 201, 'seller quoted', `got ${quote.status}`)
  const qId = quote.json?.data?.id
  const aw = await buyer('PATCH', `/api/rfq/${rfqId}/quotes/${qId}`, { action: 'accept' })
  ok(aw.status === 200, 'buyer accepted the quote (awarded)', `got ${aw.status}`)
  const conv = await buyer('POST', `/api/rfq/${rfqId}/convert-order`, { shippingAddressId: a2Id })
  ok(conv.status === 201 || conv.status === 200, 'converted to order with address #2', `got ${conv.status} ${JSON.stringify(conv.json)?.slice(0, 160)}`)
  const convOrderId = conv.json?.data?.convertedOrder?.id ?? conv.json?.data?.order?.id ?? conv.json?.data?.orderId ?? conv.json?.data?.id
  const det3 = await buyer('GET', `/api/orders/${convOrderId}`)
  ok(det3.json?.data?.shippingAddress?.id === a2Id && det3.json?.data?.shippingAddress?.city === 'Chattogram', 'converted order serves the live address')
  await buyer('DELETE', `/api/addresses/${a2Id}`)
  const det4 = await buyer('GET', `/api/orders/${convOrderId}`)
  ok(det4.json?.data?.shippingAddress?.city === 'Chattogram' && det4.json?.data?.shippingAddress?.fromSnapshot === true, 'converted order ALSO survives address deletion (all creation paths snapshot)')

  // create-direct path
  console.log('— G. create-direct path —')
  const a4 = await buyer('POST', '/api/addresses', addrBody({ label: 'Direct Path', address_line1: 'Banani', city: 'Dhaka', postal_code: '1213' }))
  const dir = await buyer('POST', '/api/orders/create-direct', { productId, quantity: 1, shippingAddressId: a4.json?.data?.id })
  ok(dir.status === 201, 'create-direct order with address #4')
  const dirOrderId = dir.json?.data?.order?.id ?? dir.json?.data?.orderId ?? dir.json?.data?.id
  await buyer('DELETE', `/api/addresses/${a4.json?.data?.id}`)
  const det5 = await buyer('GET', `/api/orders/${dirOrderId}`)
  ok(det5.json?.data?.shippingAddress?.label === 'Direct Path' && det5.json?.data?.shippingAddress?.fromSnapshot === true, 'create-direct order survives deletion too')

  console.log(`\n=== t87: ${PASS} pass / ${FAIL} fail ===`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('DRILL CRASH:', e); await db.$disconnect(); process.exit(1) })
