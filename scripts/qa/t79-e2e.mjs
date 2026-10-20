/**
 * Task 79 E2E — PER-PRODUCT LOW-STOCK ALERT LINES: the seller-tuned
 * products.stockAlertThreshold honored by the REAL inventory API (GET summary
 * math + PATCH writes) instead of the old hardcoded ≤20 everywhere.
 *
 * Covers: 401 gates · threshold round-trips from product create → GET ·
 * per-product summary math (not the global 20) · threshold-only PATCH with an
 * honest message · threshold+quantity in one transactional write · clearing
 * back to the platform default · variants-inherit rejection · negative /
 * non-numeric / both-quantity-fields / empty validation · cross-seller no-leak
 * 404 · admin override (audited, actorType 'admin') · real audit-log rows.
 *
 * Run: bun scripts/qa/t79-e2e.mjs   (DB EMPTY — first-admin window; dev FRESH)
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
  const ip = `10.91.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  const call = async function call(method, path_, body) {
    const res = await fetch(`${BASE}${path_}`, {
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
    call.cookie = cookie
    const json = await res.json().catch(() => null)
    return { status: res.status, json }
  }
  call.cookie = ''
  return call
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA79 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA79 Shop ${email.slice(5, 12)}` } : {}),
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
  const PASSWORD = 't79-Alert-Qa1!'
  const anon = makeSession()
  const admin = makeSession()
  const sellerA = makeSession()
  const sellerB = makeSession()

  section('A. auth gates')
  {
    const g = await anon('GET', '/api/supplier/inventory')
    ok(g.status === 401, 'anon GET inventory -> 401', `got ${g.status}`)
    const p = await anon('PATCH', '/api/supplier/inventory', { updates: [{ productId: 'x', stockAlertThreshold: 5 }] })
    ok(p.status === 401, 'anon PATCH inventory -> 401', `got ${p.status}`)
  }

  section('B. accounts + products')
  await registerAndLogin(admin, 'admin', 'qa79-admin@qa.local', PASSWORD)
  await registerAndLogin(sellerA, 'supplier', 'qa79-supa-a@qa.local', PASSWORD)
  await registerAndLogin(sellerB, 'supplier', 'qa79-supa-b@qa.local', PASSWORD)
  const cat = await admin('POST', '/api/admin/categories', { name: 'QA79 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  ok(Boolean(categoryId), 'admin created a category')

  // P1: stock 25, NO threshold (platform default 20 applies) -> NOT low.
  const p1 = await sellerA('POST', '/api/supplier/products', {
    name: 'QA79 Default-line Product', description: 'QA t79 default alert line', categoryId, unit: 'kg',
    moq: 1, basePrice: 100, stockQuantity: 25,
    priceTiers: [{ minQty: 1, pricePerUnit: 100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], variants: [],
  })
  const P1 = p1.json?.data?.id ?? p1.json?.id
  ok(Boolean(P1), 'seller A created product 1 (stock 25, no threshold)')

  // P2: stock 25 WITH threshold 30 at CREATE time -> LOW against its own line.
  const p2 = await sellerA('POST', '/api/supplier/products', {
    name: 'QA79 Tuned-line Product', description: 'QA t79 seller-tuned alert line', categoryId, unit: 'kg',
    moq: 1, basePrice: 100, stockQuantity: 25, stockAlertThreshold: 30,
    priceTiers: [{ minQty: 1, pricePerUnit: 100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [], variants: [],
  })
  const P2 = p2.json?.data?.id ?? p2.json?.id
  ok(Boolean(P2), 'seller A created product 2 (stock 25, threshold 30 at create)')

  for (const id of [P1, P2]) {
    await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'QA79' })
  }

  section('C. GET exposes the per-product line + honest summary')
  {
    const inv = await sellerA('GET', '/api/supplier/inventory')
    ok(inv.status === 200 && inv.json?.success, 'seller A GET inventory -> 200')
    const items = inv.json?.data?.items ?? []
    const i1 = items.find((x) => x.id === P1)
    const i2 = items.find((x) => x.id === P2)
    ok(items.length === 2, 'inventory returns exactly seller A products', `got ${items.length}`)
    ok(i1 && 'stockAlertThreshold' in i1 && i1.stockAlertThreshold === null, 'product 1 carries stockAlertThreshold null')
    ok(i2 && i2.stockAlertThreshold === 30, 'product 2 carries the create-time threshold 30')
    const s = inv.json?.data?.summary
    ok(s?.lowStockCount === 1, 'summary.lowStockCount === 1 (per-product lines, NOT the global 20)', `got ${s?.lowStockCount}`)
  }

  section('D. threshold-only PATCH (honest message, real before/after)')
  {
    const r = await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ productId: P1, stockAlertThreshold: 8 }] })
    ok(r.status === 200 && r.json?.success, 'PATCH threshold-only -> 200', `got ${r.status}`)
    const row = r.json?.data?.results?.[0]
    ok(row?.thresholdBefore === null && row?.thresholdAfter === 8, 'response carries thresholdBefore null -> thresholdAfter 8', JSON.stringify(row))
    ok(row?.before === 25 && row?.after === 25, 'stock untouched by a threshold-only update')
    ok(String(r.json?.message || '').startsWith('Low-stock alert updated'), 'message is honest (alert, not stock)', r.json?.message)
    const inv = await sellerA('GET', '/api/supplier/inventory')
    const i1 = (inv.json?.data?.items ?? []).find((x) => x.id === P1)
    ok(i1?.stockAlertThreshold === 8, 'GET reflects the new line (8)')
  }

  section('E. threshold + quantity in ONE transactional write')
  {
    const r = await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ productId: P1, newQuantity: 5, stockAlertThreshold: 8 }] })
    ok(r.status === 200, 'PATCH quantity+threshold -> 200', `got ${r.status}`)
    const row = r.json?.data?.results?.[0]
    ok(row?.after === 5 && row?.thresholdAfter === 8, 'both applied (after 5, thresholdAfter 8)', JSON.stringify(row))
    const inv = await sellerA('GET', '/api/supplier/inventory')
    const s = inv.json?.data?.summary
    ok(s?.lowStockCount === 2, 'summary now counts BOTH as low (5≤8 and 25≤30)', `got ${s?.lowStockCount}`)
  }

  section('F. clearing back to the platform default (null)')
  {
    const r = await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ productId: P2, stockAlertThreshold: null }] })
    ok(r.status === 200, 'PATCH null threshold -> 200', `got ${r.status}`)
    const row = r.json?.data?.results?.[0]
    ok(row?.thresholdBefore === 30 && row?.thresholdAfter === null, 'thresholdBefore 30 -> thresholdAfter null', JSON.stringify(row))
    const inv = await sellerA('GET', '/api/supplier/inventory')
    const s = inv.json?.data?.summary
    ok(s?.lowStockCount === 1, 'P2 back on the default line: 25>20 so lowStockCount drops to 1', `got ${s?.lowStockCount}`)
  }

  section('G. validation matrix')
  {
    const v = await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ productId: P1, stockAlertThreshold: -1 }] })
    ok(v.status === 400, 'negative threshold -> 400', `got ${v.status}`)
    const s = await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ productId: P1, stockAlertThreshold: 'abc' }] })
    ok(s.status === 400, 'non-numeric threshold -> 400', `got ${s.status}`)
    const both = await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ productId: P1, newQuantity: 1, delta: 1 }] })
    ok(both.status === 400, 'newQuantity+delta together still -> 400', `got ${both.status}`)
    const empty = await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ productId: P1 }] })
    ok(empty.status === 400, 'productId alone (no quantity, no threshold) -> 400', `got ${empty.status}`)
    const vr = await sellerA('PATCH', '/api/supplier/inventory', { updates: [{ variantId: 'nonexistent', stockAlertThreshold: 5 }] })
    ok(vr.status === 400 || vr.status === 404, 'variant-level threshold rejected (400 zod or 404 unknown variant)', `got ${vr.status}`)
  }

  section('H. cross-seller no-leak + admin override')
  {
    const leak = await sellerB('PATCH', '/api/supplier/inventory', { updates: [{ productId: P1, stockAlertThreshold: 99 }] })
    ok(leak.status === 404, 'seller B cannot touch A\'s threshold -> 404 (no-leak)', `got ${leak.status}`)
    const invB = await sellerB('GET', '/api/supplier/inventory')
    ok((invB.json?.data?.items ?? []).length === 0, 'seller B inventory honestly empty')
    const adm = await admin('PATCH', '/api/supplier/inventory', { updates: [{ productId: P1, stockAlertThreshold: 6 }] })
    ok(adm.status === 200 && adm.json?.data?.results?.[0]?.thresholdAfter === 6, 'admin override applies (thresholdAfter 6)', `got ${adm.status}`)
  }

  section('I. real audit rows')
  {
    const rows = await db.auditLogs.findMany({
      where: { action: 'inventory_updated' },
      orderBy: { createdAt: 'desc' },
      take: 6,
    })
    ok(rows.length >= 3, 'inventory_updated audit rows exist', `got ${rows.length}`)
    const last = rows[0]
    const meta = JSON.parse(last.metadata || '{}')
    ok(last.actorType === 'ADMIN' || meta.actorType === 'admin', 'latest row is the admin override', JSON.stringify(meta).slice(0, 120))
    ok(meta.updates?.[0]?.thresholdAfter === 6 && meta.updates?.[0]?.thresholdBefore === 8, 'audit carries thresholdBefore 8 -> thresholdAfter 6', JSON.stringify(meta.updates?.[0]))
    const thresholdRow = rows.find((r) => {
      try { return JSON.parse(r.metadata || '{}').updates?.some((u) => u.thresholdBefore === null && u.thresholdAfter === 8) } catch { return false }
    })
    ok(Boolean(thresholdRow), 'the seller threshold PATCH is audit-logged with its real before/after')
  }

  console.log(`\n═══ t79 RESULT: ${PASS} PASS / ${FAIL} FAIL ═══`)
  if (FAIL > 0) { console.log('FAILURES:', failures.join(' | ')); process.exit(1) }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1) }).finally(async () => { await db.$disconnect() })
