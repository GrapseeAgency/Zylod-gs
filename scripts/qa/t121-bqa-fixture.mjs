/** Task 121 browser-QA fixture — real API calls, no direct row fabrication
 * except wallets (the drill-convention funding step). */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.31.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    for (let attempt = 0; attempt < 6; attempt++) {
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
      await sleep(6000 * (attempt + 1))
    }
    throw new Error('rate limited: ' + path)
  }
}

async function registerAndLogin(session, userType, email, password, businessName) {
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA121B ${userType}`, ...(businessName ? { businessName } : {}) }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status} ${JSON.stringify(reg.json)}`)
    await sleep(4000 * (attempt + 1))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} exhausted: ${JSON.stringify(login.json)}`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

const main = async () => {
  const P = 't115-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  // admin already exists from the t115 run — login only (registration window closed)
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await admin('POST', '/api/auth/login', { email: 'qa115-admin@qa.local', password: P })
    if (login.status === 200 || login.status === 201) break
    await sleep(4000 * (attempt + 1))
    if (attempt === 2) throw new Error('admin login exhausted')
  }
  await registerAndLogin(seller, 'supplier', `qa121b-seller@t121.test`, P, 'QA121B Storefront Works')
  await registerAndLogin(buyer, 'buyer', `qa121b-buyer@t121.test`, P)
  console.log('accounts ready')

  const cat = await db.categories.findFirst({ select: { id: true } })
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA121B Industrial Clamp Pro', description: 'browser-QA fixture product', categoryId: cat.id,
    unit: 'pcs', bundleSize: null, moq: 1, basePrice: 1200, stockQuantity: 500,
    priceTiers: [{ minQty: 1, pricePerUnit: 1200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const prodId = prod.json?.data?.id ?? prod.json?.id
  await admin('PATCH', '/api/admin/products', { productId: prodId, action: 'approve', reason: 'QA121B' })
  console.log('product ready', prodId)

  const addr = await buyer('POST', '/api/addresses', {
    label: 'HQ', address_line1: 'House 9, Road 121', city: 'Dhaka', district: 'Dhaka',
    contact_phone: '+8801700000121', postal_code: '1200',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id

  const buyerUser = await db.users.findUnique({ where: { email: 'qa121b-buyer@t121.test' } })
  await db.wallets.create({ data: { userId: buyerUser.id, balance: 999999 } })

  const ord1 = await buyer('POST', '/api/orders', { items: [{ productId: prodId, quantity: 2 }], shippingAddressId: addressId, payWithWallet: true })
  console.log('order1 (paid):', ord1.status)
  const ord2 = await buyer('POST', '/api/orders', { items: [{ productId: prodId, quantity: 1 }], shippingAddressId: addressId })
  console.log('order2 (unpaid):', ord2.status)
  const adv = await seller('PATCH', `/api/supplier/orders/${ord1.json?.data?.orderId}`, { status: 'delivered' })
  console.log('advance delivered:', adv.status)

  const sellerUser = await db.users.findUnique({ where: { email: 'qa121b-seller@t121.test' } })
  await db.wallets.create({ data: { userId: sellerUser.id, balance: 1000, currency: 'BDT' } })
  const w1 = await seller('POST', '/api/wallet/withdraw', { amount: 300, method: 'bKash', accountNumber: '017111001212', holderName: 'QA121B Seller' })
  console.log('withdraw pending:', w1.status)
  const w2 = await seller('POST', '/api/wallet/withdraw', { amount: 200, method: 'bank', accountNumber: '1210001210001', holderName: 'QA121B Seller', bankName: 'BRAC Bank PLC' })
  console.log('withdraw 2:', w2.status)
  const done = await admin('PATCH', `/api/admin/payouts/${w2.json?.data?.payoutId}`, { action: 'complete', reference: 'QA121BSETTLE', note: 'browser QA settle' })
  console.log('settle:', done.status)

  // Read back what the four pages will show
  const s2 = seller
  for (const ep of ['payouts', 'revenue', 'performance', 'rankings']) {
    const r = await s2('GET', `/api/supplier/${ep}`)
    console.log(ep, r.status, JSON.stringify(r.json?.data?.summary ?? r.json?.data?.orders ?? r.json?.data?.products?.slice(0, 2) ?? r.json?.data).slice(0, 220))
  }
  console.log('SELLER EMAIL: qa121b-seller@t121.test / PASSWORD:', P)
}

main()
  .catch((e) => { console.error('FIXTURE CRASH:', e.message); process.exitCode = 1 })
  .finally(async () => { await db.$disconnect() })
