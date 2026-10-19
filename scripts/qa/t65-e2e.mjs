/**
 * Task 65 E2E — VARIANT-LEVEL restock watches (no cron, owner doctrine).
 *
 * Doctrine under test:
 *   • a watch may pin ONE variant (stockAlerts.variantId) — it completes ONLY
 *     when THAT variant restocks, never by another variant's restock;
 *   • product-level watches (variantId null) complete only when the products
 *     ROW restocks — a lone variant edit that leaves the row at 0 must NOT
 *     complete them (the PDP still shows out of stock — a push would lie);
 *   • in-stock refusals stay honest per kind (variant vs product);
 *   • EVERY variant-restoring writer completes variant watches: inventory
 *     PATCH, buyer cancel, return receipt (all five product paths keep their
 *     product-level behaviour).
 *
 * Run: bun scripts/qa/t65-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
const failures = []
function ok(cond, label, extra) {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; failures.push(label + (extra ? ` — ${extra}` : '')); console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
function section(name) { console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`) }
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
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json)}`)
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

const notifications = async (session) => {
  const r = await session('GET', '/api/notifications?limit=50')
  return r.json?.data?.notifications ?? r.json?.data ?? []
}
const restockedBlue = async (session) =>
  (await notifications(session)).filter((n) => (n.title ?? '').startsWith('Restocked:') && (n.title ?? '').includes('Color: Blue'))
const restockedProductOnly = async (session) =>
  (await notifications(session)).filter((n) => (n.title ?? '').startsWith('Restocked:') && !(n.title ?? '').includes('Color:'))

const main = async () => {
  const PASSWORD = 't65-Var-Qa1!'
  const admin = makeSession(), seller = makeSession(), buyer1 = makeSession(), buyer2 = makeSession()
  const anon = makeSession()
  const ts = Date.now().toString().slice(-6)

  section('setup — first-admin window, product with Red(10)/Blue(0) variants')
  await registerAndLogin(admin, 'admin', `qa65-admin@qa.local`, PASSWORD)
  await registerAndLogin(seller, 'supplier', `qa65-supa@qa.local`, PASSWORD)
  await registerAndLogin(buyer1, 'buyer', `qa65-buyer1@qa.local`, PASSWORD)
  await registerAndLogin(buyer2, 'buyer', `qa65-buyer2@qa.local`, PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: `QA65 Cat ${ts}`, isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA65 Tile Sealant', description: 'QA t65 variant-watch product', categoryId, unit: 'pcs',
    moq: 1, basePrice: 120, stockQuantity: 10, stockAlertThreshold: 3,
    priceTiers: [{ minQty: 1, pricePerUnit: 120 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    variants: [
      { variantName: 'Color', variantValue: 'Red', stockQuantity: 10 },
      { variantName: 'Color', variantValue: 'Blue', stockQuantity: 0 },
    ],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'product created with 2 variants')
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA65' })
  const pdp = await anon('GET', `/api/products/${productId}`)
  const variants = pdp.json?.data?.variants ?? []
  const vRed = variants.find((v) => v.variantValue === 'Red')
  const vBlue = variants.find((v) => v.variantValue === 'Blue')
  ok(Boolean(vRed?.id) && Boolean(vBlue?.id) && vBlue.stockQuantity === 0 && vRed.stockQuantity === 10, 'variant rows resolved (Red 10, Blue 0)', JSON.stringify(variants))

  const addr = await buyer2('POST', '/api/addresses', {
    label: 'QA65 HQ', address_line1: '65 QA Street', city: 'Dhaka', district: 'Dhaka',
    postal_code: '1213', contact_phone: '01700000000',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id

  section('A) subscribe guards — honest per kind')
  ok((await anon('POST', '/api/stock-alerts', { productId, variantId: vBlue.id })).status === 401, 'unauthenticated variant subscribe → 401')
  ok((await anon('GET', '/api/stock-alerts')).status === 401, 'unauthenticated list → 401')
  ok((await buyer1('POST', '/api/stock-alerts', { productId, variantId: vRed.id })).status === 409, 'in-stock variant subscribe → 409')
  const inStockErr = (await buyer1('POST', '/api/stock-alerts', { productId, variantId: vRed.id })).json?.error ?? ''
  ok(inStockErr.includes('already in stock'), '409 verbatim: variant already in stock', inStockErr)
  ok((await buyer1('POST', '/api/stock-alerts', { productId, variantId: 123 })).status === 400, 'non-string variantId → 400')
  ok((await buyer1('POST', '/api/stock-alerts', { productId, variantId: 'no-such-variant' })).status === 404, 'foreign/unknown variantId → 404')

  const sub = await buyer1('POST', '/api/stock-alerts', { productId, variantId: vBlue.id })
  ok(sub.status === 201, 'buyer1 watches Blue (OOS variant) → 201')
  ok(sub.json?.data?.variantId === vBlue.id && (sub.json?.data?.variantLabel ?? '').includes('Blue'), 'row snapshots variantId + variantLabel', JSON.stringify(sub.json?.data))
  ok((await buyer1('POST', '/api/stock-alerts', { productId, variantId: vBlue.id })).status === 409, 'duplicate active variant watch → 409')
  const prodWatchInStock = await buyer2('POST', '/api/stock-alerts', { productId })
  ok(prodWatchInStock.status === 409 && (prodWatchInStock.json?.error ?? '').includes('already in stock'), 'product-level watch still refused while products row > 0')

  section('B) drain everything, product-level watch, then VARIANT restock completes ONLY its own')
  ok((await seller('PATCH', '/api/supplier/inventory', { updates: [{ variantId: vRed.id, newQuantity: 0 }] })).status === 200, 'seller drains Red 10→0')
  ok((await seller('PATCH', '/api/supplier/inventory', { updates: [{ productId, newQuantity: 0 }] })).status === 200, 'seller drains product row 10→0')
  const sub2 = await buyer2('POST', '/api/stock-alerts', { productId })
  ok(sub2.status === 201, 'buyer2 watches the PRODUCT (row at 0) → 201')

  ok((await seller('PATCH', '/api/supplier/inventory', { updates: [{ variantId: vBlue.id, newQuantity: 8 }] })).status === 200, 'seller restocks Blue 0→8 (product row stays 0)')
  await sleep(900)

  const b1notified = await buyer1('GET', '/api/stock-alerts?status=notified')
  const b1row = (b1notified.json?.data ?? []).find((a) => a.id === sub.json?.data?.id)
  ok(Boolean(b1row), 'buyer1 Blue watch flipped → notified')
  ok(b1row?.variantId === vBlue.id && b1row?.inStock === true && b1row?.stockQuantity === 8, 'GET reports THE VARIANT stock (8, in stock, Blue)', JSON.stringify(b1row))
  const b1restocks = await restockedBlue(buyer1)
  ok(b1restocks.length === 1, 'buyer1 got exactly 1 "Restocked: … — Color: Blue" notification', String(b1restocks.length))
  ok(((b1restocks[0]?.title ?? '').includes('Color: Blue')), 'notification title names the variant', b1restocks[0]?.title)

  const b2active = await buyer2('GET', '/api/stock-alerts?status=active')
  ok((b2active.json?.data ?? []).some((a) => a.id === sub2.json?.data?.id), 'buyer2 PRODUCT watch still ACTIVE (variant restock alone did not complete it)')
  const b2restocks = await restockedProductOnly(buyer2)
  ok(b2restocks.length === 0, 'buyer2 got NO product restock push from a variant-only edit', String(b2restocks.length))

  section('C) decrease noise — no evaluator fires on 8→5')
  ok((await seller('PATCH', '/api/supplier/inventory', { updates: [{ variantId: vBlue.id, newQuantity: 5 }] })).status === 200, 'seller decreases Blue 8→5')
  await sleep(600)
  ok((await restockedBlue(buyer1)).length === 1, 'no new notifications on a decrease (buyer1 still 1)')
  ok((await buyer2('GET', '/api/stock-alerts?status=active')).json?.data?.some((a) => a.id === sub2.json?.data?.id), 'buyer2 product watch still active after decrease')

  section('D) product-row restock completes ONLY the product-level watch')
  ok((await seller('PATCH', '/api/supplier/inventory', { updates: [{ productId, newQuantity: 20 }] })).status === 200, 'seller restocks product row 0→20')
  await sleep(900)
  const b2post = await buyer2('GET', '/api/stock-alerts?status=notified')
  ok((b2post.json?.data ?? []).some((a) => a.id === sub2.json?.data?.id), 'buyer2 product watch flipped → notified')
  const b2restocks2 = await restockedProductOnly(buyer2)
  ok(b2restocks2.length === 1 && !(b2restocks2[0]?.title ?? '').includes('Color:'), 'buyer2 got exactly 1 product "Restocked: …" (no variant suffix)', b2restocks2[0]?.title)
  ok((await restockedBlue(buyer1)).length === 1, 'buyer1 got NO new push from the product-row restock (their Blue watch already completed)')

  section('E) buyer cancel path — variant goods restored complete THE VARIANT watch')
  const ord = await buyer2('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId, variantId: vBlue.id, quantity: 5 }],
  })
  ok(ord.status === 201, 'buyer2 orders ALL 5 of Blue', JSON.stringify(ord.json)?.slice(0, 120))
  const orderId = ord.json?.data?.orderId ?? ord.json?.data?.id
  const invAfterOrder = await seller('GET', '/api/supplier/inventory')
  const blueRow = (invAfterOrder.json?.data?.items ?? []).flatMap((i) => i.variants ?? []).find((v) => v.id === vBlue.id)
  ok(blueRow?.stockQuantity === 0, 'Blue drained to 0 by the order', JSON.stringify(blueRow))
  const subE = await buyer1('POST', '/api/stock-alerts', { productId, variantId: vBlue.id })
  ok(subE.status === 201, 'buyer1 re-watches Blue (previous watch completed, not active) → 201')
  const cxl = await buyer2('POST', `/api/orders/${orderId}/cancel`, {})
  ok(cxl.status === 200, 'buyer2 cancels the unpaid order → variant stock restored', JSON.stringify(cxl.json)?.slice(0, 120))
  await sleep(900)
  ok((await restockedBlue(buyer1)).length === 2, 'cancel-restock completed the variant watch (2nd "… — Color: Blue")')
  const b1activeAfterE = await buyer1('GET', '/api/stock-alerts?status=active')
  ok((b1activeAfterE.json?.data ?? []).length === 0, 'no active watches left for buyer1 (Blue completed)')

  section('F) return-receipt path — returned VARIANT goods complete the variant watch')
  const ordF = await buyer2('POST', '/api/orders', {
    shippingAddressId: addressId,
    items: [{ productId, variantId: vBlue.id, quantity: 5 }],
  })
  ok(ordF.status === 201, 'buyer2 orders 5 Blue again (full lifecycle)')
  const orderIdF = ordF.json?.data?.orderId ?? ordF.json?.data?.id
  // The order drained Blue to 0 — buyer1 can pin a fresh watch on it for the
  // receipt path (Section E's watch already completed; dup check only blocks
  // ACTIVE watches, so this is an honest new 201).
  const subF = await buyer1('POST', '/api/stock-alerts', { productId, variantId: vBlue.id })
  ok(subF.status === 201, 'buyer1 watches Blue again (drained by the order) → 201')
  const detailF = await buyer2('GET', `/api/orders/${orderIdF}`)
  const subF0 = (detailF.json?.data?.subOrders ?? [])[0]
  const itemF = (subF0?.items ?? [])[0] // single-line order; buyer detail does not expose variantId — match positionally (t60 pattern)
  ok(Boolean(itemF?.id), 'variant orderItem resolved')
  const payF = await buyer2('POST', `/api/orders/${orderIdF}/payment-submit`, {
    method: 'mobile_banking', brand: 'bKash', transactionId: `T65PAY${ts}`.toUpperCase(), senderNumber: '01700000000',
  })
  ok(payF.status === 201, 'payment reference submitted (pending)')
  const payListF = await seller('GET', '/api/seller/payments?status=pending')
  const payRowF = (payListF.json?.data ?? []).find((p) => p.orderId === orderIdF)
  ok((await seller('POST', `/api/seller/payments/${payRowF.id}/verify`, { action: 'verify' })).status === 200, 'seller verifies → paid')
  ok((await seller('PATCH', `/api/supplier/orders/${orderIdF}`, { status: 'delivered', subOrderId: subF0.id })).status === 200, 'seller marks the shipment delivered')

  const retF = await buyer2('POST', `/api/orders/${orderIdF}/return`, {
    shippingMethod: 'pickup',
    items: [{ itemId: itemF.id, reason: 'wrong variant shipped', quantity: 5 }],
  })
  ok(retF.status === 200 || retF.status === 201, 'buyer files full return of the Blue item', JSON.stringify(retF.json)?.slice(0, 140))
  const returnIdF = retF.json?.data?.id
  ok((await admin('PATCH', `/api/admin/returns/${returnIdF}`, { action: 'approve', note: 'QA65' })).status === 200, 'admin approves the return')
  const rcptF = await seller('POST', `/api/seller/returns/${returnIdF}/confirm-receipt`, { note: 'Blue units back on shelf' })
  ok(rcptF.status === 200, 'seller confirms receipt → variant stock restored', JSON.stringify(rcptF.json)?.slice(0, 140))
  await sleep(900)
  ok((await restockedBlue(buyer1)).length === 3, 'return-receipt completed the variant watch (3rd "… — Color: Blue")')

  const invF = await seller('GET', '/api/supplier/inventory')
  const blueF = (invF.json?.data?.items ?? []).flatMap((i) => i.variants ?? []).find((v) => v.id === vBlue.id)
  ok(blueF?.stockQuantity === 5, 'Blue ledger EXACT = 5 (5 −5 +5)', JSON.stringify(blueF))

  section('G) seller demand queue counts variant watches (product-grouped)')
  const subG = await buyer1('POST', '/api/stock-alerts', { productId, variantId: vRed.id })
  ok((await seller('PATCH', '/api/supplier/inventory', { updates: [{ variantId: vRed.id, newQuantity: 0 }] })).status === 200, 'seller drains Red 10→0 for the demand-row test')
  const subG2 = await buyer2('POST', '/api/stock-alerts', { productId, variantId: vRed.id })
  ok(subG.status === 201 && subG2.status === 201, 'both buyers watch Red (OOS variant) → 201 ×2')
  const demand = await seller('GET', '/api/seller/stock-watches')
  const demandRow = (demand.json?.data ?? []).find((d) => d.productId === productId)
  ok(demandRow?.watchers === 2, 'demand queue: 2 active watchers on the product (variant watches count)', JSON.stringify(demandRow))

  section('H) audit — the full watch ledger in the real DB')
  const alertsAll = await db.stockAlerts.findMany({ where: { productId } })
  const variantRows = alertsAll.filter((a) => a.variantId === vBlue.id)
  ok(alertsAll.every((a) => !a.variantId || [vBlue.id, vRed.id].includes(a.variantId)), 'every alert row carries a real variantId or null')
  ok(variantRows.filter((a) => a.status === 'notified').length === 3, 'exactly 3 Blue watches completed in DB', String(variantRows.filter((a) => a.status === 'notified').length))
  ok(variantRows.every((a) => (a.variantLabel ?? '').includes('Blue')), 'variantLabel snapshot persisted on every variant row')
  const blueNotifs = await db.notifications.findMany({
    where: { type: 'back_in_stock', title: { contains: 'Color: Blue' } },
  })
  ok(blueNotifs.length >= 6, `real notification rows: 3 activations + 3 restocks (got ${blueNotifs.length})`)

  console.log(`\n${'═'.repeat(66)}`)
  console.log(`RESULT: ${PASS} passed, ${FAIL} failed`)
  if (failures.length) { console.log('FAILURES:'); for (const f of failures) console.log(`  - ${f}`) }
  console.log('═'.repeat(66))
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('HARNESS CRASH:', e)
  await db.$disconnect()
  process.exit(1)
})
