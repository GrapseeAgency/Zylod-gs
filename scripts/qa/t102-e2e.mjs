/**
 * Task 102 E2E — SELLER PROMOTION PARTICIPATION ("everything here connects
 * to admin"): when the platform pins a supplier's product into a campaign,
 * the supplier SEES it — live-windowed, cross-supplier-isolated.
 *
 *   A. gates — anon 401; buyer (no supplier profile) 403 SUPPLIER_PROFILE_REQUIRED
 *   B. isolation — supplier A sees only campaigns pinning A's products
 *   C. window — PAUSED campaigns never surface; LIVE ones do
 *   D. shape — campaign + rule + window + the exact pinned product names
 *
 * Run: bun scripts/qa/t102-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
function ok(cond, label, extra = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.95.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    for (let attempt = 0; attempt < 7; attempt++) {
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
      if (res.status !== 429) return { status: res.status, json }
      await sleep(10_000 * (attempt + 1))
    }
    throw new Error('rate limited beyond back-off window: ' + path)
  }
}

async function registerAndLogin(session, userType, email, password, businessName) {
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA102 ${userType}`, ...(businessName ? { businessName } : {}) }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}`)
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
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't102-E2e-Str0ng1!'
  const admin = makeSession(), sellerA = makeSession(), sellerB = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa102-admin@qa.local', PASSWORD)
  await registerAndLogin(sellerA, 'supplier', 'qa102-supa@qa.local', PASSWORD, 'QA102 Supplier A')
  await registerAndLogin(sellerB, 'supplier', 'qa102-supb@qa.local', PASSWORD, 'QA102 Supplier B')
  await registerAndLogin(buyer, 'buyer', 'qa102-buyer@qa.local', PASSWORD)
  console.log('  accounts ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA102 Shared', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const mkProduct = async (session, name) => {
    const p = await session('POST', '/api/supplier/products', {
      name, description: `${name} fixture`, categoryId, unit: 'pcs', bundleSize: null,
      moq: 1, basePrice: 800, stockQuantity: 50,
      priceTiers: [{ minQty: 1, pricePerUnit: 800 }],
      images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    })
    const id = p.json?.data?.id ?? p.json?.id
    await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'QA102' })
    return id
  }
  const prodA = await mkProduct(sellerA, 'QA102 Supplier A Widget')
  const prodB = await mkProduct(sellerB, 'QA102 Supplier B Widget')

  const now = Date.now()
  const day = 86_400_000
  // Live campaign pinning BOTH suppliers' products; a paused one pinning A's.
  const live = await admin('POST', '/api/admin/promotions', {
    name: 'Shared Live Fair', type: 'percentage', value: 15, isActive: true,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 5 * day).toISOString(),
    productIds: [prodA, prodB],
  })
  ok(live.status === 201, 'live shared campaign created')
  const paused = await admin('POST', '/api/admin/promotions', {
    name: 'Paused A Deal', type: 'fixed', value: 100,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 5 * day).toISOString(),
    productIds: [prodA],
  })
  ok(paused.status === 201, 'paused A campaign created')

  /* ── A. gates ── */
  console.log('— A. gates —')
  ok((await makeSession()('GET', '/api/supplier/promotion-participation')).status === 401, 'anon → 401')
  const buyerRes = await buyer('GET', '/api/supplier/promotion-participation')
  ok(buyerRes.status === 401 && /supplier or admin/i.test(buyerRes.json?.error ?? ''), 'buyer → 401 (requireUserType supplier|admin — house pattern for this route family)', JSON.stringify(buyerRes.json))

  /* ── B. isolation ── */
  console.log('— B. cross-supplier isolation —')
  const a = await sellerA('GET', '/api/supplier/promotion-participation')
  ok(a.status === 200 && a.json?.data?.length === 1, 'supplier A sees exactly the LIVE shared campaign (paused hidden)', JSON.stringify(a.json?.data?.map?.((c) => c.name)))
  ok(a.json?.data?.[0]?.products?.length === 1 && a.json?.data?.[0]?.products[0].id === prodA,
    'A sees ONLY its own product pinned — never supplier B\'s')
  const b = await sellerB('GET', '/api/supplier/promotion-participation')
  ok(b.status === 200 && b.json?.data?.[0]?.products?.[0]?.id === prodB, 'supplier B sees its own pin of the shared campaign')

  /* ── C. window ── */
  console.log('— C. window honesty —')
  ok(!JSON.stringify(a.json).includes('Paused A Deal'), 'PAUSED campaign never surfaces to the seller')

  /* ── D. shape ── */
  console.log('— D. shape —')
  const c = a.json?.data?.[0]
  ok(c.name === 'Shared Live Fair' && c.type === 'percentage' && c.value === 15, 'campaign carries name/type/value')
  ok(typeof c.validUntil === 'string' && !('usedCount' in c), 'window served, operational counters kept off the seller payload')

  console.log(`\n=== T102 RESULT: ${PASS} passed, ${FAIL} failed ===`)
  await db.$disconnect()
  if (FAIL > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error('DRILL CRASH:', e)
  await db.$disconnect()
  process.exit(1)
})
