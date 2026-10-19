/**
 * Task 65 browser-QA setup — product with Red(15) / Blue(0) variants, product
 * row in stock. State after run: buyer1 has NO watch yet — the QA flow is:
 * buyer opens PDP, selects the OOS "Color: Blue" variant, sees the per-variant
 * CTA, subscribes; seller restocks Blue via the REAL inventory API; the CTA
 * disappears live and the buyer's bell gets the real notification.
 *
 * Run: bun scripts/qa/t65-qa-setup.mjs   (DB must be EMPTY — first-admin window)
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
    fullName: `QA65 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA65 Shop ${email.slice(5, 12)}` } : {}),
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
  const PASSWORD = 't65-Brws-Qa1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa65-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa65-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa65-buyer@qa.local', PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA65 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA65 Tile Sealant', description: 'QA t65 per-variant restock watch', categoryId, unit: 'pcs',
    moq: 1, basePrice: 120, stockQuantity: 15, stockAlertThreshold: 3,
    priceTiers: [{ minQty: 1, pricePerUnit: 120 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    variants: [
      { variantName: 'Color', variantValue: 'Red', stockQuantity: 15 },
      { variantName: 'Color', variantValue: 'Blue', stockQuantity: 0 },
    ],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA65' })
  const detail = await seller('GET', `/api/supplier/products/${productId}`)
  const variants = detail.json?.data?.variants ?? []
  const blue = variants.find((v) => v.variantValue === 'Blue')

  console.log(JSON.stringify({
    productId, variantIdBlue: blue?.id ?? null,
    logins: { admin: 'qa65-admin@qa.local', seller: 'qa65-supa@qa.local', buyer: 'qa65-buyer@qa.local' },
    password: PASSWORD,
    state: 'product in stock (15); Color: Blue variant at 0 — ready for per-variant CTA QA',
  }, null, 2))
}

main().catch((e) => { console.error('SETUP CRASH:', e); process.exit(1) })
