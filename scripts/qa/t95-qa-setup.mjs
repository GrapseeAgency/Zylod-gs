/**
 * Task 95 BROWSER-QA SETUP — seeds the checkout shipping surface for
 * agent-browser: admin + supplier + buyer accounts, one APPROVED product
 * with a filed weight (5 kg per carton, bundleSize 4), a Dhaka price book
 * (Sundarban [0,10) ৳140 / [10,∞) ৳900, Zylod Swift [0,50) ৳250 free above
 * ৳5000), and a buyer address in Dhaka. The browser QA then buys through
 * the REAL checkout UI and watches the live per-shipment quotes.
 *
 * Run: node scripts/qa/t95-qa-setup.mjs   (DB must be EMPTY — first-admin window)
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
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA95 ${userType}`,
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
  const PASSWORD = 't95-Qa-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa95-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa95-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa95-buyer@qa.local', PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA95 Packaging', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA95 Corrugated Export Carton (bundle of 4)',
    description: 'Double-wall export cartons, wholesale bundle of 4. 5 kg per bundle on the courier scale.',
    categoryId, unit: 'carton', bundleSize: 4, moq: 1, basePrice: 1000, stockQuantity: 500,
    weightKg: 5,
    priceTiers: [{ minQty: 1, pricePerUnit: 1000 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA95' })

  // The Dhaka price book (same shape the admin console writes through).
  const zone = await admin('POST', '/api/admin/shipping/zones', { name: 'Dhaka Metro', districts: ['Dhaka', 'Gazipur', 'Narayanganj'] })
  const zoneId = zone.json?.data?.id
  const m1 = await admin('POST', '/api/admin/shipping/methods', { name: 'Sundarban Courier', description: 'Doorstep, tracked', estimatedDays: '2-4 days' })
  const sundarbanId = m1.json?.data?.id
  const m2 = await admin('POST', '/api/admin/shipping/methods', { name: 'Zylod Swift', description: 'Next-day inside metro', estimatedDays: '1-2 days' })
  const swiftId = m2.json?.data?.id
  await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId: sundarbanId, weightMin: 0, weightMax: 10, price: 140 })
  await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId: sundarbanId, weightMin: 10, weightMax: null, price: 900 })
  await admin('POST', '/api/admin/shipping/rates', { zoneId, methodId: swiftId, weightMin: 0, weightMax: 50, price: 250, freeAbove: 5000 })

  const addr = await buyer('POST', '/api/addresses', {
    label: 'Home', address_line1: 'House 42, Road 11, Dhanmondi',
    city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801711000095',
    postal_code: '1209',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id

  // Sanity: the exact quote the checkout page will ask for.
  const quote = await makeSession()('GET', `/api/shipping/quote?district=Dhaka&weightKg=5&subtotal=1000`)
  console.log(JSON.stringify({
    ok: quote.status === 200 && quote.json?.count === 2,
    productId, addressId,
    email: 'qa95-buyer@qa.local', buyerEmail: 'qa95-buyer@qa.local', sellerEmail: 'qa95-supa@qa.local', adminEmail: 'qa95-admin@qa.local',
    password: PASSWORD,
    quoteCount: quote.json?.count,
    quoteOptions: quote.json?.data?.map((o) => `${o.methodName}:৳${o.price}`),
  }))
}
main()
