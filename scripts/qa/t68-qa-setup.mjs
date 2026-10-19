/**
 * Task 68 QA seed — leaves the platform in the exact state browser QA needs:
 *   • admin / supplier / buyer accounts (fixed creds)
 *   • ONE approved product with 8 variants (Color: Red..Purple) → the mobile
 *     PDP renders the >6-variant horizontal snap strip (68-b)
 *   • ONE order with a SUBMITTED-then-VERIFIED payment → the buyer's
 *     notifications page has a payment row to click for the order-detail
 *     highlight deep-link (68-c)
 * Run on a WIPED DB (first-admin window).
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.81.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA68 ${userType}`,
    ...(userType === 'supplier' ? { businessName: 'QA68 Strip & Chip Shop' } : {}),
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
  const PASSWORD = 't68-QA-Browser1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa68-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa68-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa68-buyer@qa.local', PASSWORD)
  console.log('accounts ready (qa68-admin/qa68-supa/qa68-buyer@qa.local)')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA68 QA Category', isActive: true })
  const categoryId = cat.json?.data?.id
  console.log('category:', categoryId)

  const COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'Black', 'White', 'Orange', 'Purple']
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA68 Eight-Way Cable Set', description: '8 variants for the mobile snap strip QA',
    categoryId, unit: 'pcs', brand: 'QA68QA', moq: 1, basePrice: 200, stockQuantity: 400,
    priceTiers: [{ minQty: 1, pricePerUnit: 200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    variants: COLORS.map((c, i) => ({ variantName: 'Color', variantValue: c, stockQuantity: i === 7 ? 0 : 40 })),
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  console.log('product:', productId, '(8 variants, Purple OOS for the per-variant watch CTA)')

  const approved = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA68 browser' })
  console.log('approved:', approved.status)

  const order = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }] })
  console.log('order:', order.json?.data?.orderId, 'total', order.json?.data?.totalAmount)
  const orderId = order.json.data.orderId

  const sub = await buyer('POST', `/api/orders/${orderId}/payment-submit`, {
    method: 'mobile_banking', transactionId: 'QA68BRWSR001', brand: 'bKash',
  })
  console.log('payment submitted:', sub.status, sub.json?.data?.paymentId)
  const verify = await seller('POST', `/api/seller/payments/${sub.json.data.paymentId}/verify`, { action: 'verify' })
  console.log('seller verified:', verify.status, 'orderPaymentStatus:', verify.json?.data?.orderPaymentStatus)
  await sleep(400)

  const notifs = await buyer('GET', '/api/notifications?limit=50')
  console.log('buyer payment notifications:', (notifs.json?.data ?? []).filter((n) => n.type === 'payment').length)
  console.log('SEED DONE')
  await db.$disconnect()
}

main().catch(async (e) => { console.error('SEED CRASH:', e); process.exitCode = 1; await db.$disconnect() })
