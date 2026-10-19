/**
 * Task 60 browser-QA setup — FIXED credentials, stops right after the admin
 * approval (NO receipts confirmed) so the UI flows can be exercised live:
 *   - sellerA confirms receipt through the real button
 *   - admin sees 1/2 receipts
 *   - buyer sees the "Goods received" card + "waiting on 1 more seller"
 *
 * Run: bun scripts/qa/t60-qa-setup.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'

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

const PASSWORD = 't60-Brws-Qa1!'
const USERS = {
  admin: 'qa60-admin@qa.local',
  a: 'qa60-supa@qa.local',
  b: 'qa60-supb@qa.local',
  buyer: 'qa60-buyer@qa.local',
}

async function registerAndLogin(session, userType, email) {
  const payload = {
    userType, authProvider: 'email', email, password: PASSWORD,
    fullName: `QA60 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA60 Shop ${email.slice(5, 12)}` } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) return true
    if (reg.status !== 429) break
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password: PASSWORD })
    if (login.status === 200 || login.status === 201) return true
    if (login.status !== 429) return false
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
  }
  return false
}

const main = async () => {
  const admin = makeSession()
  const sellerA = makeSession()
  const sellerB = makeSession()
  const buyer = makeSession()

  for (const [k, email] of Object.entries(USERS)) {
    const s = { admin, a: sellerA, b: sellerB, buyer }[k]
    const okd = await registerAndLogin(s, k === 'a' || k === 'b' ? 'supplier' : k, email)
    if (!okd) throw new Error(`setup failed for ${email}`)
  }
  console.log('users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA60 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id

  const prodA = await sellerA('POST', '/api/supplier/products', {
    name: 'QA60 Rice 25kg', description: 'QA t60 browser product A', categoryId, unit: 'kg', moq: 1, basePrice: 100,
    stockQuantity: 50, stockAlertThreshold: 5, priceTiers: [{ minQty: 1, pricePerUnit: 100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productIdA = prodA.json?.data?.id ?? prodA.json?.id
  const prodB = await sellerB('POST', '/api/supplier/products', {
    name: 'QA60 Oil 5L', description: 'QA t60 browser product B', categoryId, unit: 'pcs', moq: 1, basePrice: 200,
    stockQuantity: 20, stockAlertThreshold: 5, priceTiers: [{ minQty: 1, pricePerUnit: 200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productIdB = prodB.json?.data?.id ?? prodB.json?.id
  await admin('PATCH', '/api/admin/products', { productId: productIdA, action: 'approve', reason: 'QA60' })
  await admin('PATCH', '/api/admin/products', { productId: productIdB, action: 'approve', reason: 'QA60' })

  const addr = await buyer('POST', '/api/addresses', {
    label: 'QA60 HQ', address_line1: '12 QA Street', city: 'Dhaka', district: 'Dhaka',
    postal_code: '1213', contact_phone: '01700000000',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id

  const ord = await buyer('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId: productIdA, quantity: 10 }, { productId: productIdB, quantity: 2 }],
  })
  const orderId = ord.json?.data?.orderId
  const detail = await buyer('GET', `/api/orders/${orderId}`)
  const subs = detail.json?.data?.subOrders ?? []
  const itemA = (subs.find((s) => s.items?.some((i) => i.productId === productIdA))?.items ?? []).find((i) => i.productId === productIdA)
  const itemB = (subs.find((s) => s.items?.some((i) => i.productId === productIdB))?.items ?? []).find((i) => i.productId === productIdB)

  await buyer('POST', `/api/orders/${orderId}/payment-submit`, {
    method: 'mobile_banking', brand: 'bKash', transactionId: 'QA60PAY1', senderNumber: '01700000000',
  })
  const payList = await sellerA('GET', '/api/seller/payments?status=pending')
  const payRow = (payList.json?.data ?? []).find((p) => p.orderId === orderId)
  await sellerA('POST', `/api/seller/payments/${payRow.id}/verify`, { action: 'verify' })

  const subA = subs.find((s) => s.items?.some((i) => i.productId === productIdA))
  const subB = subs.find((s) => s.items?.some((i) => i.productId === productIdB))
  await sellerA('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: subA.id })
  await sellerB('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: subB.id })

  const ret = await buyer('POST', `/api/orders/${orderId}/return`, {
    shippingMethod: 'pickup',
    items: [
      { itemId: itemA.id, reason: 'damaged in transit', quantity: 4 },
      { itemId: itemB.id, reason: 'wrong size label', quantity: 2 },
    ],
  })
  const returnId = ret.json?.data?.id
  const appr = await admin('PATCH', `/api/admin/returns/${returnId}`, { action: 'approve', note: 'QA60 approved — send goods back' })
  if (appr.status !== 200) throw new Error('approve failed')

  console.log(JSON.stringify({
    orderId, returnId, productIdA, productIdB,
    logins: USERS, password: PASSWORD,
    state: 'return APPROVED, no receipts confirmed yet — ready for browser QA',
  }, null, 2))
}

main().catch((e) => { console.error('SETUP CRASH:', e); process.exit(1) })
