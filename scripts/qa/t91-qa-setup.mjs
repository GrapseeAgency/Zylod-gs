/**
 * Task 91 browser-QA seed — admin/supplier/buyer accounts, one approved
 * product, one REAL order, one pending inspection request in the admin queue.
 * Run AFTER scripts/qa/wipe.mjs. NOT a fixture system — wiped again after QA.
 *
 * Run: bun scripts/qa/t91-qa-setup.mjs
 */
const BASE = 'http://127.0.0.1:3000'

function makeSession() {
  let cookie = ''
  const ip = `10.93.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA91B ${userType}`,
    ...(userType === 'supplier' ? { businessName: 'QA91B Tile Works' } : {}),
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
  const PASSWORD = 'T91-Qa-Br0wser1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa91b-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa91b-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa91b-buyer@qa.local', PASSWORD)
  console.log('users ready (qa91b-admin / qa91b-supa / qa91b-buyer@qa.local / ' + PASSWORD + ')')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA91B Tiles', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA91B Porcelain Floor Tiles', description: 'Grade-A porcelain tiles, 12 per carton',
    categoryId, unit: 'carton', moq: 30, basePrice: 1100, stockQuantity: 500,
    priceTiers: [{ minQty: 1, pricePerUnit: 1100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA91B' })

  const ord = await buyer('POST', '/api/orders/create-direct', { productId, quantity: 40 })
  const orderId = ord.json?.data?.orderId ?? ord.json?.data?.order?.id ?? ord.json?.data?.id
  console.log('order:', orderId)

  const insp = await buyer('POST', '/api/inspections', { orderId, inspectorType: 'third_party', note: 'Check the glazing batch consistency' })
  console.log('inspection request:', insp.status, insp.json?.data)

  const list = await admin('GET', '/api/admin/inspections')
  console.log('admin queue:', JSON.stringify(list.json?.data?.stats))
}

main().catch((e) => { console.error('FATAL:', e); process.exitCode = 1 })
