/**
 * Task 103 E2E — ADMIN CAMPAIGN USAGE DRILL-DOWN: the analytics depth under
 * the promotion console reads the pricing engine's REAL promotion_applied
 * audit rows (entityType 'orders', entityId = orderNumber) — the same truth
 * the order receipts carry. Phantom id == no-leak 404.
 *
 * Run: bun scripts/qa/t103-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.94.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA103 ${userType}`, ...(businessName ? { businessName } : {}) }
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
  const PASSWORD = 't103-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa103-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa103-supa@qa.local', PASSWORD, 'QA103 Works')
  await registerAndLogin(buyer, 'buyer', 'qa103-buyer@qa.local', PASSWORD)
  console.log('  accounts ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA103 Usage', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA103 Usage Widget', description: 'Usage drill-down fixture.', categoryId,
    unit: 'pcs', bundleSize: null, moq: 1, basePrice: 1000, stockQuantity: 100,
    priceTiers: [{ minQty: 1, pricePerUnit: 1000 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA103' })

  const now = Date.now()
  const day = 86_400_000
  const camp = await admin('POST', '/api/admin/promotions', {
    name: 'Usage Fair', type: 'percentage', value: 10, isActive: true,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 5 * day).toISOString(),
    productIds: [productId],
  })
  const campId = camp.json?.data?.id
  ok(camp.status === 201, 'campaign live')

  // Two orders use the campaign (different quantities → different discounts).
  const o1 = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 1 }] })
  const o2 = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 3 }] })
  ok(o1.status === 201 && o2.status === 201, 'two orders placed')
  ok(Math.abs(o1.json?.data?.promotionApplied?.discount - 100) < 0.001, 'order 1: −৳100')
  ok(Math.abs(o2.json?.data?.promotionApplied?.discount - 300) < 0.001, 'order 2: −৳300 (10% of 3000)')

  /* ── gates ── */
  console.log('— gates —')
  ok((await makeSession()('GET', `/api/admin/promotions/${campId}/usages`)).status === 401, 'anon → 401')
  ok((await buyer('GET', `/api/admin/promotions/${campId}/usages`)).status === 401, 'buyer → 401')
  const phantom = await admin('GET', '/api/admin/promotions/nonexistent/usages')
  ok(phantom.status === 404, 'phantom campaign → no-leak 404')

  /* ── the drill-down ── */
  console.log('— usage drill-down —')
  const us = await admin('GET', `/api/admin/promotions/${campId}/usages`)
  ok(us.status === 200 && us.json?.success, 'usages fetched')
  ok(us.json?.totals?.count === 2, 'exactly 2 usage events', JSON.stringify(us.json?.totals))
  ok(Math.abs(us.json?.totals?.totalDiscount - 400) < 0.001, 'total funded ৳400 (100+300)', JSON.stringify(us.json?.totals))
  const byOrder = new Map((us.json?.data ?? []).map((u) => [u.orderNumber, u]))
  const u1 = byOrder.get(o1.json?.data?.orderNumber)
  const u2 = byOrder.get(o2.json?.data?.orderNumber)
  ok(Boolean(u1) && Math.abs(u1.discount - 100) < 0.001 && Math.abs(u1.promotedSubtotal - 1000) < 0.001 && u1.type === 'percentage' && u1.value === 10,
    'order 1 event carries the pricing numbers verbatim')
  ok(Boolean(u2) && Math.abs(u2.discount - 300) < 0.001 && Math.abs(u2.promotedSubtotal - 3000) < 0.001,
    'order 2 event carries the pricing numbers verbatim')
  ok(!JSON.stringify(us.json?.data).match(/buyerId|email/i), 'no buyer PII in the payload')

  /* ── isolation between campaigns ── */
  console.log('— campaign isolation —')
  const other = await admin('POST', '/api/admin/promotions', {
    name: 'Other Fair', type: 'fixed', value: 50,
    validFrom: new Date(now - day).toISOString(), validUntil: new Date(now + 5 * day).toISOString(),
    productIds: [productId],
  })
  const otherUs = await admin('GET', `/api/admin/promotions/${other.json?.data?.id}/usages`)
  ok(otherUs.json?.totals?.count === 0, 'the untouched campaign shows an honest zero (no cross-campaign bleed)')

  console.log(`\n=== T103 RESULT: ${PASS} passed, ${FAIL} failed ===`)
  await db.$disconnect()
  if (FAIL > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error('DRILL CRASH:', e)
  await db.$disconnect()
  process.exit(1)
})
