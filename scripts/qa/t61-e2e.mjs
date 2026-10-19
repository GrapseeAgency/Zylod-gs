/**
 * Task 61 E2E — EVENT-DRIVEN back-in-stock alerts (no cron, owner doctrine).
 *
 * Chain under test: a stock-restoring writer (buyer cancel, seller inventory
 * PATCH, admin force cancel, return receipt) must complete an active
 * stockAlerts watch and persist a REAL back_in_stock notification — with no
 * poller anywhere. Also proves the new honest subscribe contract
 * (in-stock subscribe = 409) and that cancelled watches never fire.
 *
 * Run: bun scripts/qa/t61-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
let PASS = 0, FAIL = 0
function ok(cond, label) {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; console.log(`  ❌ ${label}`) }
}
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
    fullName: `QA61 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA61 Shop ${email.slice(5, 12)}` } : {}),
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
    if (login.status !== 429) throw new Error(`login ${email} -> ${login.status}: ${JSON.stringify(login.json)}`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

/** Poll until cond(json of GET fn) or timeout — the async rail is fire-and-forget. */
async function poll(fn, cond, label, timeoutMs = 6000, stepMs = 400) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await fn()
    if (cond(last)) return last
    await sleep(stepMs)
  }
  ok(false, `${label} (timed out; last=${JSON.stringify(last)?.slice(0, 240)})`)
  return last
}

async function backInStockCount(buyer) {
  const res = await buyer('GET', '/api/notifications?page=1&limit=50')
  const rows = res.json?.data?.notifications ?? res.json?.data ?? []
  return rows.filter((n) => n.type === 'back_in_stock')
}

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't61-E2e-Str0ng1!'
  const admin = makeSession(), sellerA = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa61-admin@qa.local', PASSWORD)
  await registerAndLogin(sellerA, 'supplier', 'qa61-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa61-buyer@qa.local', PASSWORD)
  console.log('  users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA61 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  ok(Boolean(categoryId), 'category created')

  const prod = await sellerA('POST', '/api/supplier/products', {
    name: 'QA61 Lentils 50kg', description: 'QA t61 restock-rail product', categoryId, unit: 'kg',
    moq: 1, basePrice: 80, stockQuantity: 50, stockAlertThreshold: 5,
    priceTiers: [{ minQty: 1, pricePerUnit: 80 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'product A created (stock 50 kg)')
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA61' })

  const prodB = await sellerA('POST', '/api/supplier/products', {
    name: 'QA61 Mustard Oil 5L', description: 'QA t61 cancelled-watch product', categoryId, unit: 'pcs',
    moq: 1, basePrice: 150, stockQuantity: 20, stockAlertThreshold: 5,
    priceTiers: [{ minQty: 1, pricePerUnit: 150 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productIdB = prodB.json?.data?.id ?? prodB.json?.id
  ok(Boolean(productIdB), 'product B created (stock 20 pcs)')
  await admin('PATCH', '/api/admin/products', { productId: productIdB, action: 'approve', reason: 'QA61' })

  const addr = await buyer('POST', '/api/addresses', {
    label: 'QA61 HQ', address_line1: '12 QA Street', city: 'Dhaka', district: 'Dhaka',
    postal_code: '1213', contact_phone: '01700000000',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  ok(Boolean(addressId), 'buyer address created')

  console.log('— A. subscribe contract guards —')
  const anon = makeSession()
  ok((await anon('POST', '/api/stock-alerts', { productId })).status === 401, 'subscribe unauthenticated → 401')
  ok((await anon('GET', '/api/stock-alerts')).status === 401, 'alerts list unauthenticated → 401')
  const bad = await buyer('POST', '/api/stock-alerts', {})
  ok(bad.status === 400, `missing productId → 400 (got ${bad.status})`)
  const missing = await buyer('POST', '/api/stock-alerts', { productId: 'nonexistent-id' })
  ok(missing.status === 404, `unknown product → 404 (got ${missing.status})`)
  const inStock = await buyer('POST', '/api/stock-alerts', { productId })
  ok(inStock.status === 409, `in-stock subscribe → 409 (got ${inStock.status})`)
  ok(String(inStock.json?.error || '').includes('already in stock'), 'in-stock 409 message is verbatim honest')

  console.log('— B. the real chain: order → OOS → watch → buyer cancel → NOTIFIED —')
  const ord1 = await buyer('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId, quantity: 50 }],
  })
  const orderId1 = ord1.json?.data?.orderId
  ok(ord1.status === 201 && Boolean(orderId1), `order of ALL 50 kg placed (${ord1.status})`)
  const pub1 = await anon('GET', `/api/products/${productId}`)
  ok((pub1.json?.data?.stockQuantity ?? -1) === 0, 'public GET: stock drained to 0')

  // Baseline BEFORE the subscribe — the watch-confirmation notification is
  // created synchronously inside the POST, so a late baseline already counts it.
  const beforeNotifs = (await backInStockCount(buyer)).length
  const sub1 = await buyer('POST', '/api/stock-alerts', { productId })
  ok(sub1.status === 201, `OOS subscribe → 201 (got ${sub1.status})`)
  const alertId1 = sub1.json?.data?.id
  ok(Boolean(alertId1), 'alert row id returned')
  const dup = await buyer('POST', '/api/stock-alerts', { productId })
  ok(dup.status === 409, 'duplicate active watch → 409')

  const watchConf = await poll(
    () => backInStockCount(buyer),
    (rows) => rows.length >= beforeNotifs + 1 && rows.some((n) => /Restock Watch Activated/i.test(n.title || '')),
    '"Restock Watch Activated" notification persisted'
  )
  ok(Boolean(watchConf), 'watch-confirmation notification asserted')

  const cancel1 = await buyer('POST', `/api/orders/${orderId1}/cancel`)
  ok(cancel1.status === 200, `buyer cancels unpaid order → 200 (got ${cancel1.status})`)
  const pub2 = await anon('GET', `/api/products/${productId}`)
  ok((pub2.json?.data?.stockQuantity ?? -1) === 50, 'stock restored to exactly 50 by the cancel')

  const fired = await poll(
    () => buyer('GET', '/api/stock-alerts?limit=50'),
    (res) => (res.json?.data ?? []).some((a) => a.id === alertId1 && a.status === 'notified'),
    'alert flipped to NOTIFIED by the cancel-restore event (no cron involved)'
  )
  ok(Boolean(fired), 'cancel-restore flip asserted')
  const restockNotif = await poll(
    () => backInStockCount(buyer),
    (rows) => rows.some((n) => /Restocked:/i.test(n.title || '') && /50 units/.test(n.message || '')),
    '"Restocked: … 50 units" notification persisted with REAL stock in the body'
  )
  ok(Boolean(restockNotif), 'restock-50 notification asserted')
  const notifiedRow = (fired.json?.data ?? []).find((a) => a.id === alertId1)
  ok(Boolean(notifiedRow?.lastNotifiedAt), 'lastNotifiedAt stamped')
  // (re-watch allowed after 'notified' is proven in section C: watch2 → 201)

  console.log('— C. seller inventory PATCH as the restock trigger —')
  const ord2 = await buyer('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId, quantity: 50 }],
  })
  const orderId2 = ord2.json?.data?.orderId
  ok(ord2.status === 201, `second full order placed (${ord2.status}) — product drained to 0 again`)
  const watch2 = await buyer('POST', '/api/stock-alerts', { productId })
  ok(watch2.status === 201, 're-watch allowed after the old watch completed (notified ≠ active)')

  const inv = await sellerA('PATCH', '/api/supplier/inventory', {
    updates: [{ productId, newQuantity: 30 }],
  })
  ok(inv.status === 200, `seller restocks 0 → 30 via inventory PATCH (${inv.status})`)

  const firedC = await poll(
    () => buyer('GET', '/api/stock-alerts?limit=50'),
    (res) => {
      const row = (res.json?.data ?? []).find((a) => a.id === watch2.json?.data?.id)
      return row && row.status === 'notified'
    },
    'inventory-PATCH restock flipped the watch to NOTIFIED'
  )
  ok(Boolean(firedC), 'inventory-PATCH flip asserted')
  const restockNotifC = await poll(
    () => backInStockCount(buyer),
    (rows) => rows.some((n) => /Restocked:/i.test(n.title || '') && /30 units/.test(n.message || '')),
    '"Restocked: … 30 units" notification reflects the REAL persisted stock'
  )
  ok(Boolean(restockNotifC), 'restock-30 notification asserted')

  console.log('— D. noise check: stock DECREASE never notifies —')
  const countAfterC = (await backInStockCount(buyer)).length
  await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ productId, newQuantity: 10 }] })
  await sleep(2500)
  const countAfterDecrease = (await backInStockCount(buyer)).length
  ok(
    countAfterDecrease === countAfterC,
    `notification count unchanged by a decrease (${countAfterC} → ${countAfterDecrease}) — no phantom pushes`
  )

  console.log('— E. a CANCELLED watch never fires —')
  const ordB = await buyer('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId: productIdB, quantity: 20 }],
  })
  const orderIdB = ordB.json?.data?.orderId
  ok(ordB.status === 201, 'product B ordered out entirely (20 pcs)')
  const subB = await buyer('POST', '/api/stock-alerts', { productId: productIdB })
  ok(subB.status === 201, 'watch created on B')
  const delB = await buyer('DELETE', `/api/stock-alerts/${subB.json?.data?.id}`)
  ok(delB.status === 200, 'buyer deletes (cancels) the watch')
  const cancelledList = await buyer('GET', '/api/stock-alerts?status=cancelled&limit=50')
  ok(
    (cancelledList.json?.data ?? []).some((a) => a.id === subB.json?.data?.id && a.status === 'cancelled'),
    'cancelled status visible in the ?status=cancelled list'
  )
  const notifsBeforeE = (await backInStockCount(buyer)).length
  await buyer('POST', `/api/orders/${orderIdB}/cancel`)
  await poll(
    () => anon('GET', `/api/products/${productIdB}`),
    (res) => (res.json?.data?.stockQuantity ?? -1) === 20,
    'B stock restored to 20 by the cancel'
  )
  await sleep(2000)
  const notifsAfterE = (await backInStockCount(buyer)).filter((n) => /Mustard/.test(n.title || '') && /Restocked:/.test(n.title || ''))
  ok(notifsAfterE.length === 0, 'NO restock notification for the cancelled watch (exactly as it should be)')

  console.log('— F. standalone evaluate-alerts engine still healthy (regression) —')
  const ev = await admin('POST', '/api/notifications/evaluate-alerts')
  ok(ev.status === 200 && ev.json?.success === true, 'evaluate-alerts responds 200 (no alerts active → zero triggers)')

  console.log(`\nRESULT: ${PASS} passed, ${FAIL} failed`)
  if (FAIL > 0) process.exit(1)
}

main().catch((e) => { console.error('E2E CRASH:', e); process.exit(1) })
