/**
 * Task 105 QA setup — seed via REAL APIs so agent-browser can drive the UI:
 * admin, supplier ("QA105 ReviewWorks") with an approved product, and a
 * buyer who has a REAL wallet-paid order (review eligibility).
 * Run AFTER wipe: node scripts/qa/wipe.mjs && bun scripts/qa/t105-qa-setup.mjs
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

function makeSession() {
  let cookie = ''
  const ip = `10.145.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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

async function registerAndLogin(session, userType, email, password, businessName) {
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA105 ${userType}`, ...(businessName ? { businessName } : {}) }
  const reg = await session('POST', '/api/auth/register', payload)
  if (reg.status !== 201 && reg.status !== 200) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json).slice(0, 200)}`)
  const login = await session('POST', '/api/auth/login', { email, password })
  if (login.status !== 200 && login.status !== 201) throw new Error(`login ${email} -> ${login.status}`)
}

const admin = makeSession()
const seller = makeSession()
const buyer = makeSession()
const BUYER_EMAIL = 'qa105-buyer@setup.test'
await registerAndLogin(admin, 'admin', 'qa105-admin@setup.test', 'Passw0rd!105')
await registerAndLogin(seller, 'supplier', 'qa105-seller@setup.test', 'Passw0rd!105', 'QA105 ReviewWorks')
await registerAndLogin(buyer, 'buyer', BUYER_EMAIL, 'Passw0rd!105')

const cat = await admin('POST', '/api/admin/categories', { name: 'QA105 Setup Reviews', isActive: true })
const categoryId = cat.json?.data?.id ?? cat.json?.id
const prod = await seller('POST', '/api/supplier/products', {
  name: 'QA105 Review Widget', description: 'the product the review rides on', categoryId,
  unit: 'pcs', bundleSize: null, moq: 1, basePrice: 500, stockQuantity: 100, weightKg: 1,
  priceTiers: [{ minQty: 1, pricePerUnit: 500 }],
  images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
})
const productId = prod.json?.data?.id ?? prod.json?.id
await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA105 setup' })

const addr = await buyer('POST', '/api/addresses', {
  label: 'Home', address_line1: 'House 100, Road 10',
  city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000100', postal_code: '1200',
})
const addressId = addr.json?.data?.id ?? addr.json?.id
const user = await db.users.findUnique({ where: { email: BUYER_EMAIL } })
await db.wallets.create({ data: { userId: user.id, balance: 999999 } })
const ord = await buyer('POST', '/api/orders', {
  items: [{ productId, quantity: 1 }], shippingAddressId: addressId, payWithWallet: true,
})
if (ord.status !== 201) throw new Error('order failed: ' + JSON.stringify(ord.json).slice(0, 200))

const supplierProfile = await db.supplierProfiles.findFirst({ where: { companyName: 'QA105 ReviewWorks' } })
console.log(JSON.stringify({ ok: true, supplierId: supplierProfile.id, productId }))
