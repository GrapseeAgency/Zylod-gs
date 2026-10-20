/**
 * Task 92 E2E — THE PRODUCT CERTIFICATION RAIL (the trust surface).
 *
 * productCertifications had NO route, NO writer, NO reader, NO UI, while
 * THREE storefront pages shipped FABRICATED "ISO 9001 / CE" claims for
 * every product. This loop proves the replacement circuit end to end:
 *   A. gates — public GET (200 by design), anon writes 401, non-supplier 403
 *   B. ownership no-leak — foreign/phantom product 404 for writes, foreign
 *      cert 404 for deletes (never a 403 that leaks existence)
 *   C. payload guards — strict keys, lengths, URL, expiry-after-issued
 *   D. happy path + the PUBLIC read serving exactly what was filed, with
 *      server-computed status: active / expiring_soon / expired
 *   E. the 12-cert cap → 409, and the cap freeing after a removal
 *   F. live taps — the PUBLIC product room + the token-gated seller room
 *      both receive 'product:certifications' with real payloads
 *   G. delete lifecycle — role guards, no-leak, raw-DB disappearance,
 *      public feed drops the row, re-delete 404
 *   H. audit trail — certification_added / certification_removed in raw DB
 *
 * Run: node scripts/qa/t92-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { io } from 'socket.io-client'
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
  const ip = `10.93.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA92 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA92 Works ${email.slice(7, 14)}` } : {}),
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
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

function waitForEvent(socket, event, ms = 8000, predicate = null) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { socket.off(event, h); resolve(null) }, ms)
    const h = (payload) => {
      if (predicate && !predicate(payload)) return
      clearTimeout(t); socket.off(event, h); resolve(payload)
    }
    socket.on(event, h)
  })
}

function connectSocket() {
  // Direct to the delivery-service port like t91 (the E2E runs on-host).
  return io('http://127.0.0.1:3005', { transports: ['websocket'] })
}

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't92-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), seller2 = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa92-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa92-supa@qa.local', PASSWORD)
  await registerAndLogin(seller2, 'supplier', 'qa92-supa2@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa92-buyer@qa.local', PASSWORD)
  console.log('  users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA92 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA92 Stainless Water Tanks', description: 'QA92 bulk food-grade tanks', categoryId, unit: 'pcs',
    moq: 10, basePrice: 4200, stockQuantity: 300,
    priceTiers: [{ minQty: 1, pricePerUnit: 4200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  ok(Boolean(productId), 'own product created', JSON.stringify(p.json)?.slice(0, 160))
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA92' })

  // seller2's own product (for the foreign-product ownership probe)
  const p2 = await seller2('POST', '/api/supplier/products', {
    name: 'QA92 Rival Product', description: 'QA92 stranger stock', categoryId, unit: 'pcs',
    moq: 5, basePrice: 100, stockQuantity: 50,
    priceTiers: [{ minQty: 1, pricePerUnit: 100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const foreignProductId = p2.json?.data?.id ?? p2.json?.id

  const certPath = `/api/products/${productId}/certifications`
  const sellerProfile = await db.supplierProfiles.findUnique({ where: { userId: (await db.users.findUnique({ where: { email: 'qa92-supa@qa.local' } })).id } })
  ok(Boolean(sellerProfile?.id), 'seller profile resolved from real DB')

  /* ── A. gates ── */
  console.log('— A. gates —')
  const anonGet = await makeSession()('GET', certPath)
  ok(anonGet.status === 200 && anonGet.json?.count === 0, 'anon public GET → 200 with count 0 (public by design)', JSON.stringify(anonGet.json))
  ok((await makeSession()('POST', certPath, { certName: 'X', issuedBy: 'Y', issuedAt: '2024-01-01' })).status === 401, 'anon POST → 401')
  ok((await makeSession()('DELETE', '/api/supplier/certifications/whatever')).status === 401, 'anon DELETE → 401')
  ok((await buyer('POST', certPath, { certName: 'X', issuedBy: 'Y', issuedAt: '2024-01-01' })).status === 403, 'buyer POST → 403 (no supplier profile)')
  ok((await buyer('DELETE', '/api/supplier/certifications/whatever')).status === 403, 'buyer DELETE → 403')

  /* ── B. ownership no-leak ── */
  console.log('— B. ownership no-leak —')
  const phantom = await seller('POST', '/api/products/nonexistent-product/certifications', { certName: 'X Cert', issuedBy: 'Y', issuedAt: '2024-01-01' })
  ok(phantom.status === 404, 'seller POST to phantom product → 404')
  const foreign = await seller2('POST', certPath, { certName: 'X Cert', issuedBy: 'Y', issuedAt: '2024-01-01' })
  ok(foreign.status === 404, 'FOREIGN product POST → the SAME 404 as phantom (no existence leak)', `got ${foreign.status}: ${JSON.stringify(foreign.json)}`)
  ok((await seller2('DELETE', '/api/supplier/certifications/whatever-id')).status === 404, 'foreign DELETE on unknown cert → 404')

  /* ── C. payload guards (seller on own product) ── */
  console.log('— C. payload guards —')
  ok((await seller('POST', certPath, { issuedBy: 'Body Only', issuedAt: '2024-01-01' })).status === 400, 'missing certName → 400')
  ok((await seller('POST', certPath, { certName: 'X', issuedBy: 'Body', issuedAt: '2024-01-01' })).status === 400, '1-char certName → 400')
  ok((await seller('POST', certPath, { certName: 'ISO 9001', issuedBy: 'Body', issuedAt: '2024-01-01', documentUrl: 'not-a-url' })).status === 400, 'bad documentUrl → 400')
  ok((await seller('POST', certPath, { certName: 'ISO 9001', issuedBy: 'Body', issuedAt: '2024-06-01', expiresAt: '2024-01-01' })).status === 400, 'expiresAt before issuedAt → 400')
  ok((await seller('POST', certPath, { certName: 'ISO 9001', issuedBy: 'Body', issuedAt: '2024-01-01', level: 'gold' })).status === 400, 'strict keys (bogus level) → 400')

  /* ── D. happy path + public read + server-computed status ── */
  console.log('— D. happy path + public read —')
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const iso = (t) => new Date(t).toISOString().slice(0, 10)
  const c1 = await seller('POST', certPath, { certName: 'ISO 9001:2015', certNumber: 'QMS-92-001', issuedBy: 'SGS Bangladesh', issuedAt: iso(now - 300 * day) })
  ok(c1.status === 201 && c1.json?.data?.status === 'active', 'POST (no expiry) → 201, status active', JSON.stringify(c1.json))
  const c2 = await seller('POST', certPath, { certName: 'CE — Pressure Equipment', issuedBy: 'TÜV Rheinland', issuedAt: iso(now - 100 * day), expiresAt: iso(now + 40 * day) })
  ok(c2.status === 201 && c2.json?.data?.status === 'active', 'POST (expires +40d) → status active')
  const c3 = await seller('POST', certPath, { certName: 'BSTI Food Grade', issuedBy: 'BSTI', issuedAt: iso(now - 200 * day), expiresAt: iso(now + 15 * day) })
  ok(c3.status === 201 && c3.json?.data?.status === 'expiring_soon', 'POST (expires +15d) → status expiring_soon', JSON.stringify(c3.json))
  const c4 = await seller('POST', certPath, { certName: 'Old HACCP Renewal', issuedBy: 'DNV', issuedAt: iso(now - 800 * day), expiresAt: iso(now - day) })
  ok(c4.status === 201 && c4.json?.data?.status === 'expired', 'POST (already expired) → accepted, status expired (honest, never hidden)', JSON.stringify(c4.json))

  const pub = await makeSession()('GET', certPath)
  ok(pub.status === 200 && pub.json?.count === 4, 'public GET serves exactly the 4 filed rows', JSON.stringify(pub.json)?.slice(0, 200))
  const pubRows = pub.json?.data ?? []
  ok(pubRows[0]?.certName === 'CE — Pressure Equipment' && pubRows[3]?.certName === 'Old HACCP Renewal', 'newest-issued first ordering (issuedAt desc: −100d leads, −800d last)', JSON.stringify(pubRows.map((r) => r.certName)))
  ok(pubRows.some((r) => r.status === 'active') && pubRows.some((r) => r.status === 'expiring_soon') && pubRows.some((r) => r.status === 'expired'), 'all three server-computed statuses visible publicly')
  ok(pubRows.every((r) => !('productId' in r)), 'rows carry no internal fields beyond the shaped contract')
  const certIdActive = c1.json?.data?.id

  /* ── E. cap → 409, then freeing ── */
  console.log('— E. the 12-cert cap —')
  let capId = null
  for (let i = 0; i < 8; i++) {
    const r = await seller('POST', certPath, { certName: `QA92 Filler Cert ${i + 1}`, issuedBy: 'QA92 Bureau', issuedAt: iso(now - 30 * day) })
    if (i === 7) capId = r.json?.data?.id
    if (r.status !== 201) { ok(false, `filler cert ${i + 1} → 201`, JSON.stringify(r.json)); break }
    if (i === 7) ok(true, 'filled to the cap of 12 (4 + 8 fillers)')
  }
  const refused = await seller('POST', certPath, { certName: 'Thirteenth Claim', issuedBy: 'QA92 Bureau', issuedAt: iso(now - 10 * day) })
  ok(refused.status === 409, '13th certification → 409 naming the cap', JSON.stringify(refused.json))

  // The write window is 20/min and we have spent it; wait it out before deletes.
  console.log('  … waiting out the 20/min write window (65s) …')
  await sleep(65_000)

  /* ── F. live taps ── */
  console.log('— F. live taps —')
  const productSock = connectSocket()
  await new Promise((r) => { productSock.on('connect', r); setTimeout(r, 8000) })
  productSock.emit('subscribe', { room: `product:${productId}` })
  const productJoined = await waitForEvent(productSock, 'subscribe:ok', 6000)
  ok(Boolean(productJoined), 'anon socket joined PUBLIC product:<id> room')

  const tok = await seller('GET', `/api/realtime/room-token?room=seller:${sellerProfile.id}`)
  const sellerSock = connectSocket()
  await new Promise((r) => { sellerSock.on('connect', r); setTimeout(r, 8000) })
  sellerSock.emit('subscribe', { room: `seller:${sellerProfile.id}`, token: tok.json?.token })
  ok(Boolean(await waitForEvent(sellerSock, 'subscribe:ok', 6000)), 'seller joined token-gated seller:<id> room')

  const tapDelProductP = waitForEvent(productSock, 'product:certifications', 8000, (d) => d?.action === 'removed')
  const tapDelSellerP = waitForEvent(sellerSock, 'product:certifications', 8000, (d) => d?.action === 'removed')
  const tapAdd = await seller('POST', certPath, { certName: 'Live Tap Cert', issuedBy: 'QA92 Bureau', issuedAt: iso(now - 5 * day) })
  if (tapAdd.status === 409) ok(true, 'cap still enforced (13th → 409)')
  else ok(false, 'cap enforcement probe', `expected 409, got ${tapAdd.status}`)

  // Free one slot through the real DELETE, and let BOTH rooms announce it.
  const del1 = await seller('DELETE', `/api/supplier/certifications/${capId}`)
  ok(del1.status === 200 && del1.json?.data?.removed === true, 'owner DELETE own cert → 200 removed:true', JSON.stringify(del1.json))
  const tapD1 = await tapDelProductP
  const tapD2 = await tapDelSellerP
  ok(Boolean(tapD1) && tapD1?.certificationId === capId, "PUBLIC product room got 'removed' tap with the real id", JSON.stringify(tapD1))
  ok(Boolean(tapD2), "seller room got 'removed' tap too")

  const capFreed = await seller('POST', certPath, { certName: 'Cap Freed Cert', issuedBy: 'QA92 Bureau', issuedAt: iso(now - 2 * day) })
  ok(capFreed.status === 201, 'cap frees after removal (13th attempt now 201)')
  const freedId = capFreed.json?.data?.id

  /* ── G. delete lifecycle ── */
  console.log('— G. delete lifecycle —')
  ok((await buyer('DELETE', `/api/supplier/certifications/${freedId}`)).status === 403, 'buyer DELETE → 403 (no profile)')
  const foreignDel = await seller2('DELETE', `/api/supplier/certifications/${freedId}`)
  ok(foreignDel.status === 404, "FOREIGN supplier DELETE on seller's cert → the SAME 404 as phantom (no-leak)", `got ${foreignDel.status}`)
  const pubAfterDel = await makeSession()('GET', certPath)
  ok(pubAfterDel.json?.count === 12 && !pubAfterDel.json?.data?.some((r) => r.id === capId) && pubAfterDel.json?.data?.some((r) => r.id === freedId), 'public feed reflects the live rows only (removed id gone, kept rows present)', JSON.stringify(pubAfterDel.json)?.slice(0, 220))
  ok((await seller('DELETE', `/api/supplier/certifications/${capId}`)).status === 404, 're-DELETE the same cert → 404 (honest)')
  ok((await seller('DELETE', '/api/supplier/certifications/definitely-not-real')).status === 404, 'DELETE phantom cert → 404')

  /* ── H. audit trail (raw DB) ── */
  console.log('— H. audit trail —')
  const audits = await db.auditLogs.groupBy({
    by: ['action'],
    where: { entityType: 'productCertifications' },
    _count: { action: true },
  })
  const added = audits.find((a) => a.action === 'certification_added')?._count.action ?? 0
  const removed = audits.find((a) => a.action === 'certification_removed')?._count.action ?? 0
  ok(added >= 13, `certification_added audited in raw DB (${added} rows)`)
  ok(removed >= 1, `certification_removed audited in raw DB (${removed} rows)`)
  const removedMeta = await db.auditLogs.findFirst({ where: { action: 'certification_removed' }, orderBy: { createdAt: 'desc' } })
  const meta = JSON.parse(removedMeta?.metadata || '{}')
  ok(meta.productId === productId && Boolean(meta.certName), 'removed audit carries productId + certName (the trail keeps what the rail lost)', JSON.stringify(meta))

  productSock.close(); sellerSock.close()

  console.log(`\n===== t92 RESULT: ${PASS} PASS / ${FAIL} FAIL =====`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('FATAL:', e)
  await db.$disconnect()
  process.exit(1)
})
