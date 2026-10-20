/**
 * Task 96 E2E — THE STOREFRONT TRUST ROLLUP ("the platform no longer
 * manufactures trust claims — and now the store page tells the whole truth").
 *
 * Task 92 gave every PRODUCT a guarded certification rail. Task 96
 * aggregates it onto the store: GET /api/supplier/storefront now serves a
 * server-computed certificationRollup across the supplier's PUBLIC products
 * (isActive + isApproved — the storefront's own visibility contract).
 *   A. gates + KYC no-leak regression (the public projection must keep
 *      holding with the new payload)
 *   B. rollup truth: 3 certs across 2 public products → counts by the
 *      server vocabulary (active / expiring_soon / expired), distinct
 *      issuer set sorted, recent rows carrying REAL product attribution
 *   C. visibility contract: a cert on an UNAPPROVED product never
 *      advertises trust (total stays 3)
 *   D. live contract: deactivating a product drops its certs from the
 *      rollup (reactivating restores them)
 *   E. honest zero: a second supplier with no certs serves an all-zero
 *      rollup, never a fabricated claim
 *   F. public access: a GUEST storefront read (?supplierId=) serves the
 *      same rollup — trust claims are exactly what an anonymous buyer
 *      evaluates pre-bulk-order
 *
 * Run: bun scripts/qa/t96-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.96.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA96 ${userType}`,
    ...(userType === 'supplier' ? { businessName: email.includes('b') ? 'Brolly sanitary Works' : 'Dhaka Steel Mills' } : {}),
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
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't96-E2e-Str0ng1!'
  const admin = makeSession()
  const supA = makeSession()
  const supB = makeSession()
  await registerAndLogin(admin, 'admin', 'qa96-admin@qa.local', PASSWORD)
  await registerAndLogin(supA, 'supplier', 'qa96-supa@qa.local', PASSWORD)
  await registerAndLogin(supB, 'supplier', 'qa96-supb@qa.local', PASSWORD)
  console.log('  accounts ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA96 Trust', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const mkProduct = async (session, name) => {
    const p = await session('POST', '/api/supplier/products', {
      name, description: 'Trust-rollup drill product.',
      categoryId, unit: 'pcs', moq: 1, basePrice: 500, stockQuantity: 50,
      priceTiers: [{ minQty: 1, pricePerUnit: 500 }],
      images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    })
    return p.json?.data?.id ?? p.json?.id
  }
  const approve = (id) => admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'QA96' })

  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const iso = (t) => new Date(t).toISOString().slice(0, 10)
  const fileCert = (session, productId, body) =>
    session('POST', `/api/products/${productId}/certifications`, body)

  /* ── A. gates + no-leak ── */
  console.log('— A. gates + KYC no-leak —')
  const anonNone = await makeSession()('GET', '/api/supplier/storefront')
  ok(anonNone.status === 404, 'anon storefront GET without supplierId → honest 404 (never an arbitrary store)', JSON.stringify(anonNone.json))
  const p1 = await mkProduct(supA, 'QA96 Water Tank 500L')
  const p2 = await mkProduct(supA, 'QA96 Water Tank 1000L')
  const pHidden = await mkProduct(supA, 'QA96 Unapproved Tank')
  await approve(p1); await approve(p2)
  // pHidden is NEVER approved — its cert must never advertise trust.

  /* ── B. the rollup truth ── */
  console.log('— B. rollup truth —')
  await fileCert(supA, p1, { certName: 'ISO 9001:2015', issuedBy: 'SGS Bangladesh', issuedAt: iso(now - 400 * day), expiresAt: iso(now + 330 * day) })
  await fileCert(supA, p2, { certName: 'BSTI Food-Grade', issuedBy: 'BSTI', issuedAt: iso(now - 350 * day), expiresAt: iso(now + 12 * day) })
  await fileCert(supA, p1, { certName: 'CE Marking', issuedBy: 'TÜV Rheinland', issuedAt: iso(now - 800 * day), expiresAt: iso(now - 10 * day) })
  await fileCert(supA, pHidden, { certName: 'Ghost Cert', issuedBy: 'Nobody LLC', issuedAt: iso(now - 10 * day) })

  const own = await supA('GET', '/api/supplier/storefront')
  const roll = own.json?.data?.certificationRollup
  ok(own.status === 200 && Boolean(roll), 'storefront GET (own session) serves certificationRollup', JSON.stringify(own.json?.data?.keys ?? own.json))
  ok(roll.total === 3, `total 3 (the unapproved product's Ghost Cert excluded)`, JSON.stringify(roll))
  ok(roll.active === 1 && roll.expiringSoon === 1 && roll.expired === 1, 'server vocabulary: 1 valid / 1 expiring soon / 1 expired (expired COUNTED, never hidden)', JSON.stringify(roll))
  ok(JSON.stringify(roll.issuers) === JSON.stringify(['BSTI', 'SGS Bangladesh', 'TÜV Rheinland']), 'distinct issuers sorted', JSON.stringify(roll.issuers))
  ok(roll.recent.length === 3, 'recent carries every filed row (3 ≤ 6 cap)')
  const ce = roll.recent.find((r) => r.certName === 'CE Marking')
  ok(ce && ce.status === 'expired' && ce.productName === 'QA96 Water Tank 500L', 'expired row keeps its badge and REAL product attribution', JSON.stringify(ce))
  const newest = roll.recent[0]
  ok(newest.certName === 'BSTI Food-Grade', 'recent ordered newest-first (BSTI −350d beats ISO −400d and CE −800d)', JSON.stringify(newest))
  const raw = JSON.stringify(own.json)
  ok(!raw.includes('nidNumber') && !raw.includes('tradeLicense') && !raw.includes('tinNumber') && !raw.includes('bankAccount'), 'KYC projection still holds with the rollup (no NID/license/TIN/bank fields)')

  /* ── C+D. live visibility contract ── */
  console.log('— C/D. live visibility —')
  const deact = await supA('PATCH', `/api/supplier/products/${p2}`, { isActive: false })
  ok(deact.status === 200, 'supplier hides an approved product (isActive toggle)')
  const afterDeact = await supA('GET', '/api/supplier/storefront')
  const rollDeact = afterDeact.json?.data?.certificationRollup
  ok(rollDeact.total === 2 && rollDeact.expiringSoon === 0 && rollDeact.issuers.length === 2, 'hidden product: its BSTI cert drops out of the rollup (live, not cached)', JSON.stringify(rollDeact))
  const react = await supA('PATCH', `/api/supplier/products/${p2}`, { isActive: true })
  ok(react.status === 200, 'product re-shown')
  const afterRe = await supA('GET', '/api/supplier/storefront')
  ok(afterRe.json?.data?.certificationRollup?.total === 3, 'reactivating restores the cert to the rollup')

  /* ── E. honest zero ── */
  console.log('— E. honest zero —')
  const q0 = await mkProduct(supB, 'QA96 Bare Product')
  await approve(q0)
  const ownB = await supB('GET', '/api/supplier/storefront')
  const rollB = ownB.json?.data?.certificationRollup
  ok(ownB.status === 200 && rollB && rollB.total === 0 && rollB.active === 0 && rollB.expired === 0 && rollB.issuers.length === 0 && rollB.recent.length === 0, 'cert-free store serves an all-zero rollup (the UI renders the honest empty state, never a claim)', JSON.stringify(rollB))

  /* ── F. guest access ── */
  console.log('— F. guest access —')
  const profA = await db.supplierProfiles.findFirst({ where: { companyName: 'Dhaka Steel Mills' }, select: { id: true } })
  ok(Boolean(profA), 'drill sanity: cert-filing supplier profile found by its real company name')
  const guest = await makeSession()('GET', `/api/supplier/storefront?supplierId=${profA.id}`)
  const groll = guest.json?.data?.certificationRollup
  ok(guest.status === 200 && groll && groll.total === 3, 'guest with ?supplierId= sees the same rollup (pre-bulk-order trust evaluation needs no account)', JSON.stringify(groll && { total: groll.total, issuers: groll.issuers.length }))
  const guestB = await makeSession()('GET', `/api/supplier/storefront?supplierId=nobody-here`)
  ok(guestB.status === 404, 'guest phantom supplierId → 404')

  console.log(`\n=== t96 RESULT: ${PASS} PASS / ${FAIL} FAIL ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
  await db.$disconnect()
}
main().catch(async (e) => { console.error('DRILL ERROR:', e.message); process.exitCode = 1; await db.$disconnect() })
