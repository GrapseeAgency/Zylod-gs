/**
 * Task 111 browser-QA seed — wipes nothing; assumes a wiped DB.
 * Creates: admin, supplier + approved product, buyer with ONE real
 * wallet-paid order (first_order proof in hand), and two tasks:
 *   - first_order ৳50 target 1 (claimable in the browser)
 *   - bulk ৳30 target 5 (unmet — the honest refusal toast)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.115.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA111B ${userType}`, ...(businessName ? { businessName } : {}) }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json).slice(0, 200)}`)
    await sleep(4000 * (attempt + 1))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await sleep(4000 * (attempt + 1))
  }
}

const STAMP = Date.now()
const admin = makeSession()
const seller = makeSession()
const buyer = makeSession()
const EMAILS = {
  admin: `qa111b-admin-${STAMP}@t111.test`,
  seller: `qa111b-seller-${STAMP}@t111.test`,
  buyer: `qa111b-buyer-${STAMP}@t111.test`,
}

await registerAndLogin(admin, 'admin', EMAILS.admin, 'Passw0rd!111')
await registerAndLogin(seller, 'supplier', EMAILS.seller, 'Passw0rd!111', 'QA111B RewardWorks')
await registerAndLogin(buyer, 'buyer', EMAILS.buyer, 'Passw0rd!111')

const cat = await admin('POST', '/api/admin/categories', { name: 'QA111B Rewards', isActive: true })
const categoryId = cat.json?.data?.id ?? cat.json?.id
const prod = await seller('POST', '/api/supplier/products', {
  name: 'QA111B Reward Widget', description: 'browser-QA product', categoryId,
  unit: 'pcs', bundleSize: null, moq: 1, basePrice: 250, stockQuantity: 200, weightKg: 1,
  priceTiers: [{ minQty: 1, pricePerUnit: 250 }],
  images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
})
const productId = prod.json?.data?.id ?? prod.json?.id
await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA111B' })

const addr = await buyer('POST', '/api/addresses', {
  label: 'Home', address_line1: 'House 12, Road QA111B',
  city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000112', postal_code: '1200',
})
const addressId = addr.json?.data?.id ?? addr.json?.id
const buyerRow = await db.users.findUnique({ where: { email: EMAILS.buyer } })
await db.wallets.create({ data: { userId: buyerRow.id, balance: 999999 } })
const ord = await buyer('POST', '/api/orders', {
  items: [{ productId, quantity: 1 }], shippingAddressId: addressId, payWithWallet: true,
})
if (ord.status !== 201) throw new Error(`order -> ${ord.status}: ${JSON.stringify(ord.json).slice(0, 200)}`)

const t1 = await admin('POST', '/api/admin/reward-tasks', {
  type: 'first_order', title: 'Place your first wholesale order',
  description: 'Order anything from any seller to unlock your welcome reward.',
  rewardLabel: '৳50 OFF', rewardBDT: 50, targetCount: 1, isActive: true, sortOrder: 1,
})
if (t1.status !== 201) throw new Error(`task1 -> ${t1.status}`)
const t2 = await admin('POST', '/api/admin/reward-tasks', {
  type: 'bulk', title: 'Order in bulk',
  description: 'Any single order line with quantity 5 or more.',
  rewardLabel: '৳30 OFF', rewardBDT: 30, targetCount: 5, isActive: true, sortOrder: 2,
})
if (t2.status !== 201) throw new Error(`task2 -> ${t2.status}`)

console.log(JSON.stringify({ emails: EMAILS, password: 'Passw0rd!111', productId, firstTaskId: t1.json.data.id, bulkTaskId: t2.json.data.id }))
process.exit(0)
