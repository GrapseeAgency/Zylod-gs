/**
 * Task 104 E2E — THE RECENTLY-VIEWED RAIL on the REAL browsingHistory table.
 * The old route queried (db as any).recentlyViewed — a model the schema never
 * had — so the page was a guaranteed 500 behind an `as any` cast. This drill
 * proves the whole circuit:
 *   gates → record (upsert + re-visit bump) → newest-first shape →
 *   per-buyer isolation → hidden/pending product no-leak 404 →
 *   delete-one (honest counts) → delete-all → cursor pagination →
 *   the 100-row cap prune with real products.
 *
 * Run: node scripts/qa/wipe.mjs && bun scripts/qa/t104-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.104.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA104 ${userType}`, ...(businessName ? { businessName } : {}) }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json).slice(0, 200)}`)
    await sleep(4000 * (attempt + 1))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await sleep(4000 * (attempt + 1))
  }
}

console.log('── A. GATES ─────────────────────────────────────────────')
{
  const guest = makeSession()
  const g1 = await guest('GET', '/api/products/recently-viewed')
  ok(g1.status === 401, 'guest GET → 401 (rail is buyer-scoped by design)', `got ${g1.status}`)
  const g2 = await guest('POST', '/api/products/recently-viewed', { productId: 'whatever' })
  ok(g2.status === 401, 'guest POST → 401', `got ${g2.status}`)
  const g3 = await guest('DELETE', '/api/products/recently-viewed')
  ok(g3.status === 401, 'guest DELETE → 401', `got ${g3.status}`)
}

console.log('── B. SETUP (admin window + supplier + buyer + products) ─')
const admin = makeSession()
const seller = makeSession()
const buyer = makeSession()
const buyer2 = makeSession()

await registerAndLogin(admin, 'admin', `qa104-admin-${Date.now()}@t104.test`, 'Passw0rd!104')
await registerAndLogin(seller, 'supplier', `qa104-seller-${Date.now()}@t104.test`, 'Passw0rd!104', 'QA104 Works Ltd')
await registerAndLogin(buyer, 'buyer', `qa104-buyer-${Date.now()}@t104.test`, 'Passw0rd!104')
await registerAndLogin(buyer2, 'buyer', `qa104-buyer2-${Date.now()}@t104.test`, 'Passw0rd!104')

const cat = await admin('POST', '/api/admin/categories', { name: 'QA104 Viewing', isActive: true })
const categoryId = cat.json?.data?.id ?? cat.json?.id
ok(!!categoryId, 'admin category created')

async function createApprovedProduct(name, extra = {}) {
  const p = await seller('POST', '/api/supplier/products', {
    name, description: `QA104 ${name}`, categoryId, unit: 'pcs', bundleSize: null,
    moq: 2, basePrice: 1000, stockQuantity: 100, weightKg: 1,
    priceTiers: [{ minQty: 1, maxQty: 9, pricePerUnit: 1000 }, { minQty: 10, pricePerUnit: 900 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    ...extra,
  })
  const id = p.json?.data?.id ?? p.json?.id
  if (!id) throw new Error('product create failed: ' + JSON.stringify(p.json).slice(0, 200))
  await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'QA104' })
  return id
}

const p1 = await createApprovedProduct('QA104 Widget One')
const pBundle = await createApprovedProduct('QA104 Bundle Crate', { unit: 'pcs', bundleSize: 10, basePrice: 3000 })
ok(!!p1 && !!pBundle, 'two approved products live')

// A PENDING product must be un-viewable (visible-product doctrine).
{
  const pend = await seller('POST', '/api/supplier/products', {
    name: 'QA104 Pending Widget', description: 'never approved', categoryId, unit: 'pcs',
    moq: 1, basePrice: 500, stockQuantity: 10,
    priceTiers: [{ minQty: 1, pricePerUnit: 500 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const pendingId = pend.json?.data?.id ?? pend.json?.id
  const r = await buyer('POST', '/api/products/recently-viewed', { productId: pendingId })
  ok(r.status === 404, 'PENDING product POST → same 404 as phantom (no-leak)', `got ${r.status}`)
}

console.log('── C. RECORD — upsert, re-visit bump, hidden refusal ────')
{
  const r1 = await buyer('POST', '/api/products/recently-viewed', { productId: p1 })
  ok(r1.status === 201, 'view recorded → 201', `got ${r1.status}`)
  ok(typeof r1.json?.data?.viewedAt === 'string' && !Number.isNaN(Date.parse(r1.json.data.viewedAt)), 'viewedAt is a real ISO timestamp')

  const before = await db.browsingHistory.findFirst({ where: { productId: p1 } })
  await sleep(1100)
  const r2 = await buyer('POST', '/api/products/recently-viewed', { productId: p1 })
  ok(r2.status === 201, 're-visit accepted (upsert)')
  const after = await db.browsingHistory.findFirst({ where: { productId: p1 } })
  ok(before && after && after.viewedAt > before.viewedAt, 're-visit BUMPED viewedAt (no duplicate row)')
  const cnt = await db.browsingHistory.count()
  ok(cnt === 1, 'exactly ONE row after double-view (unique constraint live)', `got ${cnt}`)

  const r3 = await buyer('POST', '/api/products/recently-viewed', { productId: pBundle })
  ok(r3.status === 201, 'second product view recorded')
  await buyer('POST', '/api/products/recently-viewed', {}) // missing productId
  const rBad = await buyer('POST', '/api/products/recently-viewed', {})
  ok(rBad.status === 400, 'POST without productId → 400', `got ${rBad.status}`)
  const rGhost = await buyer('POST', '/api/products/recently-viewed', { productId: 'qa104-phantom' })
  ok(rGhost.status === 404, 'phantom productId → 404', `got ${rGhost.status}`)
}

console.log('── D. GET — newest-first, shape, tiers, bundle fields ───')
{
  const r = await buyer('GET', '/api/products/recently-viewed')
  ok(r.status === 200, 'owner GET → 200')
  const rows = r.json?.data ?? []
  ok(rows.length === 2, 'two history rows', `got ${rows.length}`)
  ok(rows[0]?.product?.id === pBundle, 'newest first (bundle view is row 0)', `got ${rows[0]?.product?.id}`)
  const b = rows[0]?.product
  ok(b?.bundleSize === 10 && b?.basePrice === 3000, 'bundle fields survive the shape (bundleSize 10, basePrice 3000)')
  ok(Array.isArray(b?.priceTiers) && b.priceTiers[0]?.pricePerUnit === 1000 && 'maxQty' in b.priceTiers[0], 'priceTiers shape {minQty, maxQty, pricePerUnit}')
  ok(b?.supplier?.companyName === 'QA104 Works Ltd' && typeof b?.supplier?.isVerified === 'boolean', 'supplier public fields only (companyName + isVerified boolean)')
  ok(typeof rows[0]?.viewedAt === 'string', 'viewedAt ISO on the row')
  ok(!('buyerId' in rows[0] && rows[0].buyerId), 'no internal buyerId leak beyond the scoping already proven')
}

console.log('── E. ISOLATION — buyer2 sees only their own ────────────')
{
  await buyer2('POST', '/api/products/recently-viewed', { productId: p1 })
  const r2 = await buyer2('GET', '/api/products/recently-viewed')
  ok((r2.json?.data ?? []).length === 1, 'buyer2 has exactly their 1 row', `got ${r2.json?.data?.length}`)
  const r1 = await buyer('GET', '/api/products/recently-viewed')
  ok((r1.json?.data ?? []).length === 2, 'buyer1 unaffected by buyer2', `got ${r1.json?.data?.length}`)
}

console.log('── F. DELETE one — honest counts both ways ──────────────')
{
  const d1 = await buyer('DELETE', `/api/products/recently-viewed?productId=${encodeURIComponent(p1)}`)
  ok(d1.status === 200 && d1.json?.deletedCount === 1, 'delete own view → deletedCount 1', JSON.stringify(d1.json))
  const d2 = await buyer('DELETE', `/api/products/recently-viewed?productId=${encodeURIComponent(p1)}`)
  ok(d2.status === 200 && d2.json?.deletedCount === 0, 're-delete → honest deletedCount 0', JSON.stringify(d2.json))
  const r2 = await buyer2('GET', '/api/products/recently-viewed')
  ok((r2.json?.data ?? []).length === 1, 'buyer2 row untouched by buyer1 delete', `got ${r2.json?.data?.length}`)
}

console.log('── G. DELETE all ────────────────────────────────────────')
{
  const r = await buyer('GET', '/api/products/recently-viewed')
  ok((r.json?.data ?? []).length === 1, 'buyer1 has 1 row left (bundle)')
  const d = await buyer('DELETE', '/api/products/recently-viewed')
  ok(d.status === 200 && d.json?.deletedCount === 1, 'clear-all → deletedCount 1', JSON.stringify(d.json))
  const r2 = await buyer('GET', '/api/products/recently-viewed')
  ok((r2.json?.data ?? []).length === 0, 'GET after clear → empty (honest zero)')
  ok(r2.json?.meta?.hasMore === false && r2.json?.meta?.nextCursor === null, 'meta honest on empty page')
}

console.log('── H. CURSOR PAGINATION ─────────────────────────────────')
{
  const p3 = await createApprovedProduct('QA104 Widget Three')
  const p4 = await createApprovedProduct('QA104 Widget Four')
  for (const pid of [p1, pBundle, p3, p4]) {
    await buyer('POST', '/api/products/recently-viewed', { productId: pid })
  }
  const page1 = await buyer('GET', '/api/products/recently-viewed?limit=2')
  ok((page1.json?.data ?? []).length === 2 && page1.json?.meta?.hasMore === true, 'page 1: 2 rows, hasMore')
  const cur = page1.json?.meta?.nextCursor
  ok(!!cur, 'nextCursor present')
  const page2 = await buyer('GET', `/api/products/recently-viewed?limit=2&cursor=${encodeURIComponent(cur)}`)
  ok((page2.json?.data ?? []).length === 2 && page2.json?.meta?.hasMore === false, 'page 2: remaining 2, no more')
  const ids = new Set([...(page1.json?.data ?? []), ...(page2.json?.data ?? [])].map((x) => x.product.id))
  ok(ids.size === 4, 'no overlap/duplication across pages', JSON.stringify([...ids]))
}

console.log('── I. THE 100-ROW CAP — real prune with real products ───')
{
  // buyer2 currently has 1 row (p1). Fill to 99 synthetic-but-real approved
  // products via createMany (setup-only direct DB, the drill convention),
  // then POST the 100th — the cap prune must keep exactly 100 with the
  // newest present and the oldest gone.
  const supplier = await db.supplierProfiles.findFirst({ where: { companyName: 'QA104 Works Ltd' } })
  const stamp = Date.now()
  const rows = Array.from({ length: 99 }, (_, i) => ({
    supplierId: supplier.id, categoryId, name: `QA104 CapFill ${i + 1}`,
    slug: `qa104-capfill-${stamp}-${i + 1}`, description: 'cap drill filler',
    unit: 'pcs', moq: 1, basePrice: 10, stockQuantity: 5, isActive: true, isApproved: true,
  }))
  await db.products.createMany({ data: rows })
  const fillers = await db.products.findMany({ where: { slug: { startsWith: `qa104-capfill-${stamp}` } }, select: { id: true }, orderBy: { slug: 'asc' } })
  ok(fillers.length === 99, '99 filler products created', `got ${fillers.length}`)
  // buyer2's identity: their p1 row is unique (buyer1 deleted theirs in F).
  const b2row = await db.browsingHistory.findFirst({ where: { productId: p1 } })
  ok(!!b2row, 'buyer2 identified via their p1 row')
  // distinct viewedAt values so the prune has a deterministic oldest
  let t = Date.now() - 90_000
  for (const f of fillers) {
    await db.browsingHistory.create({ data: { buyerId: b2row.buyerId, productId: f.id, viewedAt: new Date(t) } })
    t += 100
  }
  const preCount = await db.browsingHistory.count({ where: { buyerId: b2row.buyerId } })
  ok(preCount === 100, 'buyer2 at exactly 100 rows pre-POST', `got ${preCount}`)
  await sleep(1100)
  await buyer2('POST', '/api/products/recently-viewed', { productId: pBundle })
  const post = await db.browsingHistory.count({ where: { buyerId: b2row.buyerId } })
  ok(post === 100, 'cap enforced: still exactly 100 rows after the 101st view', `got ${post}`)
  const newestIn = await db.browsingHistory.findFirst({ where: { productId: pBundle, buyerId: b2row.buyerId } })
  ok(!!newestIn, 'the NEWEST view survived the prune')
  const oldestFillerId = fillers[0].id
  const oldestGone = await db.browsingHistory.count({ where: { productId: oldestFillerId } })
  ok(oldestGone === 0, 'the OLDEST row was pruned, not the newest', `oldest filler rows: ${oldestGone}`)
}

console.log('════════════════════════════════════════════════════════')
console.log(`PASS ${PASS}  FAIL ${FAIL}`)
process.exit(FAIL === 0 ? 0 : 1)
