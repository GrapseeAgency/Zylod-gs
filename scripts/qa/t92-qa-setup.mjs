/**
 * Task 92 BROWSER-QA SETUP — seeds the certification surface for agent-browser:
 *   admin + supplier + buyer accounts, one approved product, two REAL
 *   certifications (one active, one expiring soon). The browser QA then
 *   files a THIRD cert through the REAL seller UI form and verifies the
 *   PDP tab serves exactly the real rows.
 *
 * Run: node scripts/qa/t92-qa-setup.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'

function makeSession() {
  let cookie = ''
  const ip = `10.94.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA92B ${userType}`,
    ...(userType === 'supplier' ? { businessName: 'Brolly sanitary Works' } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}`)
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
  }
  throw new Error(`login ${email} exhausted`)
}

const main = async () => {
  const PASSWORD = 't92-Qa-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa92b-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa92b-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa92b-buyer@qa.local', PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA92B Sanitary', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA92B Stainless Steel Water Tank 1000L', description: 'Food-grade SS water tank for bulk institutional supply.',
    categoryId, unit: 'pcs', moq: 5, basePrice: 18500, stockQuantity: 120,
    priceTiers: [{ minQty: 1, pricePerUnit: 18500 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA92B' })

  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const iso = (t) => new Date(t).toISOString().slice(0, 10)
  await seller('POST', `/api/products/${productId}/certifications`, {
    certName: 'ISO 9001:2015', certNumber: 'QMS-92B-771', issuedBy: 'SGS Bangladesh',
    issuedAt: iso(now - 400 * day), expiresAt: iso(now + 330 * day),
  })
  await seller('POST', `/api/products/${productId}/certifications`, {
    certName: 'BSTI Food-Grade Certification', issuedBy: 'BSTI',
    issuedAt: iso(now - 350 * day), expiresAt: iso(now + 12 * day),
  })

  const pub = await makeSession()('GET', `/api/products/${productId}/certifications`)
  console.log(JSON.stringify({
    ok: pub.status === 200 && pub.json?.count === 2,
    productId,
    email: 'qa92b-supa@qa.local',
    password: PASSWORD,
    buyerEmail: 'qa92b-buyer@qa.local',
    publicCount: pub.json?.count,
    statuses: pub.json?.data?.map((c) => `${c.certName}:${c.status}`),
  }))
}
main()
