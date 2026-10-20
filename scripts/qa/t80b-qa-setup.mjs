/**
 * Task 80-b browser-QA seed — product with ONE attached broken video URL
 * (https://example.com/definitely-not-a-video.mp4) so the PDP fallback player
 * can be verified live, plus approved+in-stock so the PDP renders fully.
 * Run: bun scripts/qa/t80b-qa-setup.mjs   (DB EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.95.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA80b ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA80b Shop ${email.slice(5, 12)}` } : {}),
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
  const PASSWORD = 't80b-Brws-Qa1!'
  const admin = makeSession(), seller = makeSession()
  await registerAndLogin(admin, 'admin', 'qa80b-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa80b-supa@qa.local', PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA80b Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA80b Video Product', description: 'QA t80b honest video player', categoryId, unit: 'pcs',
    moq: 1, basePrice: 150, stockQuantity: 30,
    priceTiers: [{ minQty: 1, pricePerUnit: 150 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], variants: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  const attach = await seller('POST', `/api/supplier/products/${productId}/videos`, {
    videoUrl: 'https://example.com/definitely-not-a-video.mp4',
    title: 'QA broken stream', sortOrder: 0,
  })
  console.log('attach status:', attach.status)
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA80b' })
  const detail = await seller('GET', `/api/supplier/products/${productId}`)
  const slug = detail.json?.data?.slug ?? null
  console.log(JSON.stringify({
    productId, slug,
    logins: { admin: 'qa80b-admin@qa.local', seller: 'qa80b-supa@qa.local' },
    password: PASSWORD,
    state: 'approved product with one broken video — PDP fallback QA ready',
  }, null, 2))
}

main().catch((e) => { console.error('SETUP CRASH:', e); process.exit(1) })
