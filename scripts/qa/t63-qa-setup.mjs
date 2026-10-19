/**
 * Task 63 browser-QA setup — product at ZERO stock with ONE active watcher.
 * State after run: buyer1 watches QA63 Rod 12mm; seller edits stock via the
 * edit page → the watcher gets a live bell badge + notification.
 *
 * Run: bun scripts/qa/t63-qa-setup.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.79.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA63 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA63 Shop ${email.slice(5, 12)}` } : {}),
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
  const PASSWORD = 't63-Brws-Qa1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa63-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa63-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa63-buyer@qa.local', PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA63 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA63 Rod 12mm', description: 'QA t63 live-bell product', categoryId, unit: 'kg',
    moq: 1, basePrice: 95, stockQuantity: 10, stockAlertThreshold: 3,
    priceTiers: [{ minQty: 1, pricePerUnit: 95 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA63' })

  const addr = await buyer('POST', '/api/addresses', {
    label: 'QA63 HQ', address_line1: '12 QA Street', city: 'Dhaka', district: 'Dhaka',
    postal_code: '1213', contact_phone: '01700000000',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  const ord = await buyer('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId, quantity: 10 }],
  })
  if (ord.status !== 201) throw new Error(`order failed ${ord.status}`)
  const sub = await buyer('POST', '/api/stock-alerts', { productId })
  if (sub.status !== 201) throw new Error(`subscribe failed ${sub.status}`)

  console.log(JSON.stringify({
    productId, logins: { admin: 'qa63-admin@qa.local', seller: 'qa63-supa@qa.local', buyer: 'qa63-buyer@qa.local' },
    password: PASSWORD, state: 'product at 0 stock, buyer watching — ready for browser QA',
  }, null, 2))
}

main().catch((e) => { console.error('SETUP CRASH:', e); process.exit(1) })
