/**
 * Task 101 E2E — THE FULL LIFECYCLE DRILL: one fresh DB, one buyer, ONE
 * continuous chain through every money and fulfillment rail the platform
 * ships. No slice is trusted because a sibling drill passed it — the whole
 * circuit is proven in one session:
 *
 *   register → approve product → campaign + coupon + shipping book →
 *   cart order (promotion + coupon + quoted shipping stack) → socket
 *   order:new on the seller room → manual payment submit (mobile_banking
 *   TRXID) → seller payments queue → seller verify → order PAID + socket
 *   payment:verified → seller ship (waybill) → tracking timeline →
 *   seller deliver → buyer review with verifiedPurchase TRUE →
 *   admin payments list sees the leg → audit trail.
 *
 * Run: bun scripts/qa/t101-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.96.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA101 ${userType}`,
    ...(userType === 'supplier' ? { businessName: 'QA101 Lifecycle Works' } : {}),
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
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't101-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa101-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa101-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa101-buyer@qa.local', PASSWORD)
  console.log('  accounts ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA101 Lifecycle', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA101 End-to-End Widget', description: 'The product the whole lifecycle rides on.',
    categoryId, unit: 'pcs', bundleSize: null, moq: 1, basePrice: 1000, stockQuantity: 100,
    weightKg: 2,
    priceTiers: [{ minQty: 1, pricePerUnit: 1000 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA101' })

  // Shipping book (Task 95): Dhaka metro, 140 flat ≤10kg.
  const zone = await admin('POST', '/api/admin/shipping/zones', { name: 'Dhaka Metro 101', districts: ['Dhaka'] })
  const zoneId = zone.json?.data?.id
  const m = await admin('POST', '/api/admin/shipping/methods', { name: 'Sundarban 101', description: 'Tracked', estimatedDays: '2-4 days' })
  const methodId = m.json?.data?.id
  await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId, weightMin: 0, weightMax: 10, price: 140 })

  // Money rails: platform campaign (Task 100) + coupon (Task 74, seeded
  // directly — the coupon rails were drill-proven there; the STACK is what
  // this drill proves).
  const now = Date.now()
  const day = 86_400_000
  const camp = await admin('POST', '/api/admin/promotions', {
    name: 'Lifecycle Fest', type: 'percentage', value: 12, isActive: true,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 7 * day).toISOString(),
    productIds: [productId],
  })
  ok(camp.status === 201, 'campaign live')
  await db.coupons.create({
    data: {
      code: 'QA101TEN', discountType: 'percentage', discountPercent: 10,
      validFrom: new Date(now - day), validUntil: new Date(now + 30 * day), isActive: true,
    },
  })

  const addr = await buyer('POST', '/api/addresses', {
    label: 'Home', address_line1: 'House 101, Road 1',
    city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000101', postal_code: '1200',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id

  // The supplier's identity for rooms/choices.
  const sup = await db.supplierProfiles.findFirst({ where: { userId: (await db.users.findUnique({ where: { email: 'qa101-supa@qa.local' } })).id } })
  const supplierId = sup.id

  /* ── A. socket listener on the seller room (token-gated) ── */
  console.log('— A. seller room socket —')
  const tokenRes = await seller('GET', `/api/realtime/room-token?room=seller:${supplierId}`)
  ok(tokenRes.status === 200 && Boolean(tokenRes.json?.token), 'room token minted for the seller', JSON.stringify(tokenRes.json))
  const { io } = await import('socket.io-client')
  const events = []
  const socket = io('http://127.0.0.1:3005', { transports: ['websocket'], reconnectionAttempts: 3, timeout: 5000 })
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('socket connect timeout')), 8000)
    socket.on('connect', () => {
      socket.emit('subscribe', { room: `seller:${supplierId}`, token: tokenRes.json?.token })
      socket.on('subscribe:ok', () => { clearTimeout(t); resolve() })
      socket.on('subscribe:denied', (e) => { clearTimeout(t); reject(new Error('denied: ' + JSON.stringify(e))) })
    })
    socket.on('connect_error', (e) => { clearTimeout(t); reject(e) })
  })
  ;['order:new', 'payment:verified'].forEach((ev) => socket.on(ev, (payload) => events.push({ ev, payload })))
  ok(true, 'listening on seller room')

  /* ── B. cart order with the FULL stack ── */
  console.log('— B. order (promotion + coupon + shipping) —')
  const ord = await buyer('POST', '/api/orders', {
    items: [{ productId, quantity: 1 }], shippingAddressId: addressId, couponCode: 'QA101TEN',
    shippingChoices: [{ supplierId, methodId }],
  })
  ok(ord.status === 201, 'order created', JSON.stringify(ord.json?.error))
  ok(Math.abs(ord.json?.data?.promotionApplied?.discount - 120) < 0.001, 'promotion −৳120')
  ok(Math.abs(ord.json?.data?.couponApplied?.discount - 88) < 0.001, 'coupon −৳88 (on the PROMOTED total)')
  ok(Math.abs(ord.json?.data?.shippingFee - 140) < 0.001, 'shipping quoted ৳140', JSON.stringify(ord.json?.data?.shippingFee))
  ok(Math.abs(ord.json?.data?.totalAmount - 932) < 0.001, 'totalAmount 932 (1000−120−88+140)', JSON.stringify(ord.json?.data?.totalAmount))
  const orderId = ord.json?.data?.orderId
  const orderRow = await db.orders.findUnique({ where: { id: orderId }, include: { subOrders: true } })
  ok(orderRow?.paymentStatus === 'unpaid', 'order lands UNPAID (manual leg pending)')
  const subOrderId = orderRow?.subOrders[0]?.id

  await sleep(800)
  const orderNew = events.find((e) => e.ev === 'order:new')
  ok(Boolean(orderNew) && orderNew.payload?.orderId === orderId, 'socket order:new reached the seller room')

  /* ── C. manual payment submit → seller verify ── */
  console.log('— C. payment submit + verify —')
  const ps = await buyer('POST', `/api/orders/${orderId}/payment-submit`, {
    method: 'mobile_banking', brand: 'bKash', transactionId: 'TRX101AAAA01',
    senderNumber: '+8801711000101', note: 'Sent from the QA wallet.',
  })
  ok(ps.status === 201 && ps.json?.data?.status === 'pending', 'payment row PENDING (buyer can never self-confirm)', JSON.stringify(ps.json))
  const payRow = await db.payments.findFirst({ where: { orderId } })
  ok(payRow?.status === 'pending' && payRow?.method === 'mobile_banking', 'payments row honest (pending/mobile_banking)')

  const plist = await seller('GET', '/api/seller/payments')
  ok(plist.status === 200 && plist.json?.data?.some?.((x) => x.id === payRow.id), 'seller queue lists the pending payment')
  const pv = await seller('POST', `/api/seller/payments/${payRow.id}/verify`, { action: 'verify', note: 'Money received in the merchant bKash.' })
  ok(pv.status === 200, 'seller verify ok', JSON.stringify(pv.json))
  const afterPay = await db.orders.findUnique({ where: { id: orderId } })
  ok(afterPay?.paymentStatus === 'paid', 'order PAID only after seller verification')
  await sleep(800)
  const payVerified = events.find((e) => e.ev === 'payment:verified')
  ok(Boolean(payVerified) && payVerified.payload?.orderId === orderId, 'socket payment:verified reached the seller room')

  /* ── D. fulfillment: ship → deliver ── */
  console.log('— D. ship → deliver —')
  const ship = await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'shipped', trackingNumber: 'WB101QA', subOrderId })
  ok(ship.status === 200, 'seller ships with waybill WB101QA', JSON.stringify(ship.json?.error))
  const track1 = await db.orderTracking.findFirst({ where: { subOrderId, status: 'shipped' }, orderBy: { trackedAt: "desc" } })
  ok(Boolean(track1) && track1?.location === 'Handed to courier', 'tracking timeline: Handed to courier')
  const subAfterShip = await db.subOrders.findUnique({ where: { id: subOrderId } })
  ok(subAfterShip?.trackingNumber === 'WB101QA', 'waybill persisted on the subOrder')

  const deliver = await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId })
  ok(deliver.status === 200, 'seller marks delivered')
  const subAfterDeliver = await db.subOrders.findUnique({ where: { id: subOrderId } })
  ok(subAfterDeliver?.status === 'delivered', 'subOrder status delivered')

  /* ── E. buyer review (verified purchase) ── */
  console.log('— E. verified-purchase review —')
  const rv = await buyer('POST', '/api/reviews', { productId, rating: 5, title: 'Exactly as described', comment: 'Bulk order arrived packed and on time.' })
  ok(rv.status === 201 && rv.json?.data?.verifiedPurchase === true, 'review VERIFIED against the real order history', JSON.stringify(rv.json?.data))
  const prod = await db.products.findUnique({ where: { id: productId }, select: { ratingAvg: true, reviewCount: true } })
  ok(prod?.reviewCount === 1 && prod?.ratingAvg === 5, 'product aggregates recomputed from real rows')
  const dup = await buyer('POST', '/api/reviews', { productId, rating: 1, comment: 'spam' })
  ok(dup.status === 409, 'one review per buyer per product (409)')

  /* ── F. admin sees the leg; audit trail closes the loop ── */
  console.log('— F. admin view + audits —')
  const alist = await admin('GET', '/api/admin/payments')
  ok(alist.status === 200 && JSON.stringify(alist.json?.data ?? alist.json)?.includes('TRX101AAAA01'), 'admin payments list shows the verified leg')
  const audits = await db.auditLogs.groupBy({ by: ['action'], _count: { action: true } })
  const amap = Object.fromEntries(audits.map((a) => [a.action, a._count.action]))
  ok(amap.promotion_applied >= 1, 'promotion audit')
  ok((amap.payment_submitted ?? 0) >= 1, 'payment_submitted audit')
  const esc = await db.escrowAccounts.findFirst({ where: { orderId } })
  ok(Boolean(esc) && Math.abs(esc.amount - 1000) < 0.001 && esc.status === 'released',
    'verified manual money held escrow at the FULL subOrder subtotal (1000) and released on delivery', JSON.stringify(esc))

  socket.disconnect()
  console.log(`\n=== T101 RESULT: ${PASS} passed, ${FAIL} failed ===`)
  await db.$disconnect()
  if (FAIL > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error('DRILL CRASH:', e)
  try { socket?.disconnect() } catch {}
  await db.$disconnect()
  process.exit(1)
})
