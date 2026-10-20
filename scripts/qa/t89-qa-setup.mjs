/**
 * Task 89 browser-QA seed — real rows for the admin-content QA pass:
 * admin/supplier/buyer accounts, one approved product, TWO home_top banners
 * (a two-slide carousel so rotation/dots are visible), one live flash deal.
 * Run AFTER scripts/qa/wipe.mjs. NOT a fixture system — wiped again after QA.
 *
 * Run: bun scripts/qa/t89-qa-setup.mjs
 */
const BASE = 'http://127.0.0.1:3000'

function makeSession() {
  let cookie = ''
  const ip = `10.89.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA89B ${userType}`,
    ...(userType === 'supplier' ? { businessName: 'QA89B Wholesale Depot' } : {}),
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

const main = async () => {
  const PASSWORD = 'T89-Qa-Br0wser1!'
  const admin = makeSession(), seller = makeSession()
  await registerAndLogin(admin, 'admin', 'qa89b-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa89b-supa@qa.local', PASSWORD)
  console.log('users ready (qa89b-admin / qa89b-supa / qa89b-buyer@qa.local / ' + PASSWORD + ')')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA89B Racks', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA89B Steel Storage Racks', description: 'Heavy-duty 5-tier steel racks, bulk cartons',
    categoryId, unit: 'pcs', moq: 5, basePrice: 500, stockQuantity: 300,
    priceTiers: [{ minQty: 1, pricePerUnit: 500 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA89B' })
  console.log('product approved:', productId)

  const b1 = await admin('POST', '/api/admin/banners', {
    title: 'Eid Mega Sale — Bulk Cartons 30% Off',
    subtitle: 'Wholesale only. While stocks last.',
    imageUrl: 'https://picsum.photos/seed/qa89b1/1200/400',
    position: 'home_top', sortOrder: 0, isActive: true,
  })
  const b2 = await admin('POST', '/api/admin/banners', {
    title: 'Wholesale Friday — Extra 10% on Your Second Carton',
    subtitle: 'Every Friday, all categories.',
    imageUrl: 'https://picsum.photos/seed/qa89b2/1200/400',
    position: 'home_top', sortOrder: 1, isActive: true,
  })
  console.log('banners:', b1.status, b2.status)

  const now = Date.now()
  const d1 = await admin('POST', '/api/admin/deals', {
    type: 'flash', productId, dealPrice: 350,
    startAt: new Date(now - 60_000).toISOString(),
    endAt: new Date(now + 12 * 3_600_000).toISOString(),
    totalStock: 80, maxPerBuyer: 4,
  })
  console.log('flash deal:', d1.status)

  const pub = await fetch(`${BASE}/api/banners?position=home_top`).then((r) => r.json())
  console.log('public banners visible:', pub?.data?.banners?.length)
}

main().catch((e) => { console.error('FATAL:', e); process.exitCode = 1 })
