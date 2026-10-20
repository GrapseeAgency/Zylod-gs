/**
 * Task 90 browser-QA seed — real rows for the sample-rail QA pass:
 * admin/supplier/buyer accounts, one approved product, one buyer address,
 * one sample request already IN the supplier queue (requested).
 * Run AFTER scripts/qa/wipe.mjs. NOT a fixture system — wiped again after QA.
 *
 * Run: bun scripts/qa/t90-qa-setup.mjs
 */
const BASE = 'http://127.0.0.1:3000'

function makeSession() {
  let cookie = ''
  const ip = `10.91.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA90B ${userType}`,
    ...(userType === 'supplier' ? { businessName: 'QA90B Sample Depot' } : {}),
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
  const PASSWORD = 'T90-Qa-Br0wser1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa90b-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa90b-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa90b-buyer@qa.local', PASSWORD)
  console.log('users ready (qa90b-admin / qa90b-supa / qa90b-buyer@qa.local / ' + PASSWORD + ')')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA90B Meters', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA90B Digital Torque Wrench', description: 'Industrial torque wrench, bulk cartons of 20',
    categoryId, unit: 'pcs', moq: 20, basePrice: 3800, stockQuantity: 150,
    priceTiers: [{ minQty: 1, pricePerUnit: 3800 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA90B' })
  console.log('product approved:', productId)

  const addr = await buyer('POST', '/api/addresses', {
    label: 'QA90B Workshop', contactName: 'QA90B Buyer', contactPhone: '01700000090',
    addressLine1: '90B Torque Road', city: 'Dhaka', postalCode: '1213',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  const s1 = await buyer('POST', '/api/samples', { productId, quantity: 1, shippingAddressId: addressId })
  console.log('sample request (in supplier queue):', s1.status)

  const pub = await seller('GET', '/api/supplier/samples')
  console.log('supplier queue rows:', pub.json?.data?.stats?.total)
}

main().catch((e) => { console.error('FATAL:', e); process.exitCode = 1 })
