/**
 * Task 104 QA setup — seed minimal data via the REAL APIs so agent-browser
 * can drive the UI: one admin, one supplier, two approved products, one buyer.
 * Run AFTER wipe: node scripts/qa/wipe.mjs && bun scripts/qa/t104-qa-setup.mjs
 */
const BASE = 'http://127.0.0.1:3000'

function makeSession() {
  let cookie = ''
  const ip = `10.144.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA104 ${userType}`, ...(businessName ? { businessName } : {}) }
  const reg = await session('POST', '/api/auth/register', payload)
  if (reg.status !== 201 && reg.status !== 200) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json).slice(0, 200)}`)
  const login = await session('POST', '/api/auth/login', { email, password })
  if (login.status !== 200 && login.status !== 201) throw new Error(`login ${email} -> ${login.status}`)
}

const admin = makeSession()
const seller = makeSession()
await registerAndLogin(admin, 'admin', 'qa104-admin@setup.test', 'Passw0rd!104')
await registerAndLogin(seller, 'supplier', 'qa104-seller@setup.test', 'Passw0rd!104', 'QA104 Works Ltd')
await registerAndLogin(makeSession(), 'buyer', 'qa104-buyer@setup.test', 'Passw0rd!104')

const cat = await admin('POST', '/api/admin/categories', { name: 'QA104 Setup Tools', isActive: true })
const categoryId = cat.json?.data?.id ?? cat.json?.id

async function product(name, extra) {
  const p = await seller('POST', '/api/supplier/products', {
    name, description: `QA104 setup ${name}`, categoryId, unit: 'pcs', bundleSize: null,
    moq: 2, basePrice: 1000, stockQuantity: 100, weightKg: 1,
    priceTiers: [{ minQty: 1, maxQty: 9, pricePerUnit: 1000 }, { minQty: 10, pricePerUnit: 900 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    ...extra,
  })
  const id = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'QA104 setup' })
  return id
}

const p1 = await product('QA104 Bench Vise Pro')
const p2 = await product('QA104 Bundle Crate', { bundleSize: 10, basePrice: 3000 })
console.log(JSON.stringify({ ok: true, p1, p2 }))
