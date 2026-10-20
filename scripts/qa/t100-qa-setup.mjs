/**
 * Task 100 QA setup — admin + supplier + buyer, one APPROVED product, one
 * LIVE 12% campaign pinned to it, buyer address. Leaves the platform in the
 * exact state the browser QA needs.
 *
 * Run: bun scripts/qa/t100-qa-setup.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'

function makeSession() {
  let cookie = ''
  const ip = `10.97.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
      if (res.status !== 429) return { status: res.status, json: await res.json().catch(() => null) }
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
    }
    throw new Error('rate limited: ' + path)
  }
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA100 ${userType}`,
    ...(userType === 'supplier' ? { businessName: 'Brolly sanitary Works' } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}`)
    await new Promise((r) => setTimeout(r, 3000))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error(`login ${email} exhausted`)
}

const main = async () => {
  const PASSWORD = 't100-Qa-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa100-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa100-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa100-buyer@qa.local', PASSWORD)
  console.log('accounts ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA100 QA Fittings', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id

  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA100 Brass Pipe Fitting (browser QA)',
    description: 'Brass pipe fitting for the Task-100 browser QA pass.',
    categoryId, unit: 'pcs', bundleSize: null, moq: 1, basePrice: 1000, stockQuantity: 500,
    priceTiers: [{ minQty: 1, pricePerUnit: 1000 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA100' })

  const addr = await buyer('POST', '/api/addresses', {
    label: 'Home', address_line1: 'House 100, Road 10',
    city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000100', postal_code: '1200',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id

  const now = Date.now()
  const camp = await admin('POST', '/api/admin/promotions', {
    name: 'Fittings Fest', type: 'percentage', value: 12, isActive: true,
    validFrom: new Date(now - 3600_000).toISOString(), validUntil: new Date(now + 7 * 86_400_000).toISOString(),
    productIds: [productId], description: '12% off every brass fitting this week.',
  })
  if (camp.status !== 201) throw new Error('campaign create failed: ' + JSON.stringify(camp.json))

  console.log(JSON.stringify({
    ok: true, productId, addressId, campaignId: camp.json?.data?.id,
    adminEmail: 'qa100-admin@qa.local', sellerEmail: 'qa100-supa@qa.local', buyerEmail: 'qa100-buyer@qa.local',
    password: PASSWORD,
  }))
}
main().catch((e) => { console.error('SETUP CRASH:', e); process.exit(1) })
