/**
 * Task 89 E2E — THE CONTENT RAILS (banners + flash/daily deals).
 *
 * Both halves of two rails that never existed:
 *   - `banners`: a schema table with NO route and NO reader. Now admins CRUD
 *     it and the public storefront carousel serves it.
 *   - flashDeals/dailyDeals: /api/deals has READ them since the start but
 *     NOTHING could write them. Now admins create/manage them and the
 *     existing public read rail serves real admin-authored data.
 *
 *   A. public GET /api/banners — empty honesty, position filter, schedule
 *   B. admin banners — 401 gates, Zod guards (strict keys, URL, schedule
 *      sanity), CRUD, status computation (live|scheduled|expired|inactive),
 *      no-op PATCHes don't audit, public visibility follows the truth
 *   C. admin deals — 401 gates, kind guards (daily vs flash fields), 404
 *      product, honest server-computed discountPercent, overlap conflicts
 *      (window flash, same-day daily), PATCH recompute, DELETE, and THE
 *      COHESION PROOF: POST /api/deals (the pre-existing public read rail)
 *      now returns admin-authored rows
 *   D. live — 'banner:changed' / 'deal:changed' taps on the admin room
 *
 * Run: bun scripts/qa/t89-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.88.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA89 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA89 Shop ${email.slice(7, 14)}` } : {}),
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

function waitForEvent(socket, event, ms = 8000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { socket.off(event, h); resolve(null) }, ms)
    const h = (payload) => { clearTimeout(t); socket.off(event, h); resolve(payload) }
    socket.on(event, h)
  })
}

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't89-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa89-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa89-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa89-buyer@qa.local', PASSWORD)
  console.log('  users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA89 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA89 Storage Bins', description: 'QA89 stackable bins', categoryId, unit: 'pcs',
    moq: 10, basePrice: 200, stockQuantity: 500,
    priceTiers: [{ minQty: 1, pricePerUnit: 200 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA89' })
  ok(Boolean(categoryId && productId), 'category + product created & approved', JSON.stringify(p.json)?.slice(0, 120))

  /* ── A. public banners rail ── */
  console.log('— A. public GET /api/banners —')
  const emptyPublic = await buyer('GET', '/api/banners')
  ok(emptyPublic.status === 200 && Array.isArray(emptyPublic.json?.data?.banners) && emptyPublic.json.data.banners.length === 0,
    'empty table → 200 with honestly-empty banners[]', JSON.stringify(emptyPublic.json)?.slice(0, 120))
  ok((await buyer('GET', '/api/banners?position=bogus')).status === 400, 'bogus position → 400')
  ok((await makeSession()('GET', '/api/banners')).status === 200, 'anonymous public read → 200 (no auth by design)')

  /* ── B. admin banners ── */
  console.log('— B. admin banners —')
  const anon = makeSession()
  ok((await anon('GET', '/api/admin/banners')).status === 401, 'anon list → 401')
  ok((await buyer('GET', '/api/admin/banners')).status === 401, 'buyer list → 401')
  ok((await anon('POST', '/api/admin/banners', { title: 'x', imageUrl: 'https://x.test/a.jpg' })).status === 401, 'anon create → 401')

  ok((await admin('POST', '/api/admin/banners', { title: '', imageUrl: 'https://x.test/a.jpg' })).status === 400, 'empty title → 400')
  ok((await admin('POST', '/api/admin/banners', { title: 'T', imageUrl: 'not-a-url' })).status === 400, 'bad imageUrl → 400')
  ok((await admin('POST', '/api/admin/banners', { title: 'T', imageUrl: 'https://x.test/a.jpg', position: 'footer' })).status === 400, 'bad position → 400')
  ok((await admin('POST', '/api/admin/banners', { title: 'T', imageUrl: 'https://x.test/a.jpg', mysteryKey: 1 })).status === 400, 'unknown key (strict) → 400')
  ok((await admin('POST', '/api/admin/banners', {
    title: 'T', imageUrl: 'https://x.test/a.jpg',
    startAt: '2026-01-01T00:00:00Z', endAt: '2025-01-01T00:00:00Z',
  })).status === 400, 'endAt before startAt → 400')

  const now = Date.now()
  const b1 = await admin('POST', '/api/admin/banners', {
    title: 'QA89 Eid Mega Sale', subtitle: 'Bulk cartons 30% off',
    imageUrl: 'https://picsum.photos/seed/qa89/800/300',
    position: 'home_top', sortOrder: 0, isActive: true,
  })
  ok(b1.status === 201 && Boolean(b1.json?.data?.banner?.id), 'valid create → 201 with id', JSON.stringify(b1.json)?.slice(0, 160))
  const bannerId = b1.json?.data?.banner?.id

  const auditAfterCreate = await db.auditLogs.count({ where: { action: 'banner_created', entityType: 'banners', entityId: bannerId } })
  ok(auditAfterCreate === 1, 'banner_created audit row in raw DB', String(auditAfterCreate))

  const adminList = await admin('GET', '/api/admin/banners')
  ok(adminList.status === 200 && adminList.json?.data?.stats?.total === 1 && adminList.json.data.banners[0]?.status === 'live',
    'admin list: total 1, status live (active + no schedule)', JSON.stringify(adminList.json?.data?.stats))

  const pubNow = await buyer('GET', '/api/banners?position=home_top')
  ok(pubNow.json?.data?.banners?.length === 1 && pubNow.json.data.banners[0].title === 'QA89 Eid Mega Sale',
    'public home_top read returns the real slide', JSON.stringify(pubNow.json)?.slice(0, 160))
  ok(pubNow.json?.data?.banners?.[0]?.imageUrl?.includes('qa89'), 'public payload carries the real imageUrl')

  ok((await buyer('GET', '/api/banners?position=sidebar')).json?.data?.banners?.length === 0, 'position filter honestly empty')

  const toggleOff = await admin('PATCH', `/api/admin/banners/${bannerId}`, { isActive: false })
  ok(toggleOff.status === 200 && toggleOff.json?.data?.banner?.isActive === false, 'PATCH isActive:false → 200')
  ok((await buyer('GET', '/api/banners?position=home_top')).json?.data?.banners?.length === 0, 'deactivated slide vanishes from public read')

  const auditsBefore = await db.auditLogs.count({ where: { entityType: 'banners' } })
  const noop = await admin('PATCH', `/api/admin/banners/${bannerId}`, { isActive: false })
  ok(noop.status === 200 && noop.json?.data?.noop === true, 'no-op PATCH → 200 noop:true')
  ok((await db.auditLogs.count({ where: { entityType: 'banners' } })) === auditsBefore, 'no-op PATCH writes NO audit row')

  ok((await admin('PATCH', `/api/admin/banners/${bannerId}`, {
    startAt: '2026-01-01T00:00:00Z', endAt: '2025-01-01T00:00:00Z',
  })).status === 400, 'PATCH inverted window → 400')

  const sched = await admin('PATCH', `/api/admin/banners/${bannerId}`, {
    isActive: true, startAt: new Date(now + 3_600_000).toISOString(), endAt: new Date(now + 7_200_000).toISOString(),
  })
  ok(sched.status === 200 && sched.json?.data?.banner?.isActive === true, 'PATCH future schedule → 200')
  const schedList = await admin('GET', '/api/admin/banners')
  ok(schedList.json?.data?.banners?.[0]?.status === 'scheduled', 'admin status computes scheduled (future window)')
  ok((await buyer('GET', '/api/banners?position=home_top')).json?.data?.banners?.length === 0, 'future-scheduled slide hidden from public')

  const expired = await admin('PATCH', `/api/admin/banners/${bannerId}`, {
    startAt: new Date(now - 7_200_000).toISOString(), endAt: new Date(now - 3_600_000).toISOString(),
  })
  ok(expired.status === 200 && (await admin('GET', '/api/admin/banners')).json?.data?.banners?.[0]?.status === 'expired',
    'admin status computes expired (past window)')
  ok((await buyer('GET', '/api/banners?position=home_top')).json?.data?.banners?.length === 0, 'expired slide hidden from public')

  const liveAgain = await admin('PATCH', `/api/admin/banners/${bannerId}`, {
    startAt: new Date(now - 1_000).toISOString(), endAt: new Date(now + 3_600_000).toISOString(),
  })
  ok(liveAgain.status === 200 && (await buyer('GET', '/api/banners?position=home_top')).json?.data?.banners?.length === 1,
    'window covering now → public sees it again')

  ok((await admin('PATCH', '/api/admin/banners/no-such-id', { isActive: false })).status === 404, 'PATCH unknown id → 404')
  ok((await admin('DELETE', '/api/admin/banners/no-such-id')).status === 404, 'DELETE unknown id → 404')
  const del = await admin('DELETE', `/api/admin/banners/${bannerId}`)
  ok(del.status === 200, 'DELETE banner → 200')
  ok((await db.auditLogs.count({ where: { action: 'banner_deleted', entityId: bannerId } })) === 1, 'banner_deleted audit row in raw DB')
  ok((await buyer('GET', '/api/banners?position=home_top')).json?.data?.banners?.length === 0, 'public read honestly empty after delete')

  /* ── C. admin deals (the write half /api/deals never had) ── */
  console.log('— C. admin deals —')
  ok((await anon('GET', '/api/admin/deals')).status === 401, 'anon deals list → 401')
  ok((await buyer('GET', '/api/admin/deals')).status === 401, 'buyer deals list → 401')
  ok((await anon('POST', '/api/admin/deals', { type: 'flash', productId, dealPrice: 1, startAt: 'x', endAt: 'y' })).status === 401, 'anon deal create → 401')

  ok((await admin('POST', '/api/admin/deals', { type: 'weekly', productId, dealPrice: 100 })).status === 400, 'bad type → 400')
  ok((await admin('POST', '/api/admin/deals', { type: 'flash', productId: 'phantom', dealPrice: 100, startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-02T00:00:00Z' })).status === 404, 'phantom product → 404')
  ok((await admin('POST', '/api/admin/deals', { type: 'flash', productId, dealPrice: -5, startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-02T00:00:00Z' })).status === 400, 'negative price → 400')
  ok((await admin('POST', '/api/admin/deals', { type: 'flash', productId, dealPrice: 100 })).status === 400, 'flash without window → 400')
  ok((await admin('POST', '/api/admin/deals', { type: 'flash', productId, dealPrice: 100, startAt: '2026-01-02T00:00:00Z', endAt: '2026-01-01T00:00:00Z' })).status === 400, 'flash inverted window → 400')
  ok((await admin('POST', '/api/admin/deals', { type: 'daily', productId, dealPrice: 100 })).status === 400, 'daily without dayDate → 400')
  ok((await admin('POST', '/api/admin/deals', { type: 'daily', productId, dealPrice: 100, dayDate: '2026-03-01', startAt: '2026-01-01T00:00:00Z' })).status === 400, 'daily smuggling startAt → 400')
  ok((await admin('POST', '/api/admin/deals', { type: 'flash', productId, dealPrice: 100, startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-02T00:00:00Z', dayDate: '2026-03-01' })).status === 400, 'flash smuggling dayDate → 400')

  // Flash deal: price 100 vs base 200 → the SERVER computes 50%.
  const f1 = await admin('POST', '/api/admin/deals', {
    type: 'flash', productId, dealPrice: 100,
    startAt: new Date(now - 60_000).toISOString(),
    endAt: new Date(now + 6 * 3_600_000).toISOString(),
    totalStock: 50, maxPerBuyer: 2,
  })
  ok(f1.status === 201 && f1.json?.data?.deal?.discountPercent === 50,
    'flash created → 201, discountPercent computed server-side (50)', JSON.stringify(f1.json)?.slice(0, 200))
  const flashId = f1.json?.data?.deal?.id

  const d1 = await admin('POST', '/api/admin/deals', { type: 'daily', productId, dealPrice: 150, dayDate: '2026-03-01' })
  ok(d1.status === 201 && d1.json?.data?.deal?.discountPercent === 25, 'daily created → 201, discount 25%', JSON.stringify(d1.json)?.slice(0, 160))
  const dailyId = d1.json?.data?.deal?.id

  const overlap = await admin('POST', '/api/admin/deals', {
    type: 'flash', productId, dealPrice: 120,
    startAt: new Date(now + 60_000).toISOString(),
    endAt: new Date(now + 2 * 3_600_000).toISOString(),
  })
  ok(overlap.status === 409 && overlap.json?.conflictId === flashId, 'overlapping active flash window → 409 with conflictId', JSON.stringify(overlap.json)?.slice(0, 160))
  const dupDaily = await admin('POST', '/api/admin/deals', { type: 'daily', productId, dealPrice: 120, dayDate: '2026-03-01' })
  ok(dupDaily.status === 409, 'duplicate same-day daily → 409')

  const dlist = await admin('GET', '/api/admin/deals')
  ok(dlist.status === 200 && dlist.json?.data?.stats?.total === 2 && dlist.json.data.stats.live === 1,
    'admin deals list: total 2, live 1', JSON.stringify(dlist.json?.data?.stats))
  const flashRow = dlist.json?.data?.deals?.find((d) => d.type === 'flash')
  ok(flashRow?.status === 'live' && flashRow?.product?.name === 'QA89 Storage Bins' && Boolean(flashRow?.product?.supplierName),
    'deal row embeds real product + supplier name')

  // THE COHESION PROOF: the PRE-EXISTING public read rail (/api/deals) now
  // serves admin-authored rows — before this task it could never have any.
  const publicDeals = await buyer('GET', '/api/deals?type=flash')
  ok(publicDeals.status === 200 && (publicDeals.json?.data?.flashDeals ?? publicDeals.json?.data?.deals ?? []).some(
    (d) => d.id === flashId || d.productId === productId
  ), 'public /api/deals?type=flash now returns the admin-authored deal', JSON.stringify(publicDeals.json)?.slice(0, 200))

  const reprice = await admin('PATCH', `/api/admin/deals/${flashId}`, { dealPrice: 150 })
  ok(reprice.status === 200 && reprice.json?.data?.deal?.discountPercent === 25, 'PATCH dealPrice 150 → discount recomputed 25%')
  ok((await admin('PATCH', `/api/admin/deals/${dailyId}`, { endAt: '2026-01-02T00:00:00Z' })).status === 400, 'PATCH daily with flash-only endAt → 400')
  ok((await admin('PATCH', `/api/admin/deals/${flashId}`, { dayDate: '2026-03-02' })).status === 400, 'PATCH flash with daily-only dayDate → 400')
  ok((await admin('PATCH', '/api/admin/deals/no-such-id', { isActive: false })).status === 404, 'PATCH unknown deal → 404')

  const deact = await admin('PATCH', `/api/admin/deals/${flashId}`, { isActive: false })
  ok(deact.status === 200 && deact.json?.data?.deal?.isActive === false, 'PATCH isActive:false → 200')
  const publicAfterDeact = await buyer('GET', '/api/deals?type=flash')
  const afterRows = publicAfterDeact.json?.data?.flashDeals ?? publicAfterDeact.json?.data?.deals ?? []
  ok(!afterRows.some((d) => d.id === flashId), 'deactivated deal leaves the public read rail')

  const auditDeals = await db.auditLogs.count({ where: { action: { in: ['deal_created', 'deal_updated'] } } })
  ok(auditDeals >= 4, 'deal create/update audits in raw DB', String(auditDeals))

  const delF = await admin('DELETE', `/api/admin/deals/${flashId}`)
  const delD = await admin('DELETE', `/api/admin/deals/${dailyId}`)
  ok(delF.status === 200 && delD.status === 200, 'DELETE both deals → 200')
  ok((await admin('GET', '/api/admin/deals')).json?.data?.stats?.total === 0, 'deals list honestly empty after deletes')

  /* ── D. live taps on the admin room ── */
  console.log('— D. live admin-room taps —')
  const adminId = (await db.users.findFirst({ where: { userType: 'admin' }, select: { id: true } }))?.id
  const tok = await admin('GET', `/api/realtime/room-token?room=admin:${adminId}`)
  ok(Boolean(tok.json?.token), 'admin minted admin:<id> room token')
  const sock = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  sock.emit('subscribe', { room: `admin:${adminId}`, token: tok.json.token })
  ok(Boolean(await waitForEvent(sock, 'subscribe:ok')), 'admin joined admin:<id> room')

  const bannerTap = waitForEvent(sock, 'banner:changed')
  const dealTap = waitForEvent(sock, 'deal:changed')
  await admin('POST', '/api/admin/banners', { title: 'QA89 Live Tap', imageUrl: 'https://picsum.photos/seed/qa89b/800/300', position: 'home_top' })
  const gotBanner = await bannerTap
  ok(Boolean(gotBanner) && gotBanner?.action === 'created', "live 'banner:changed' tap with real action", JSON.stringify(gotBanner)?.slice(0, 120))
  const b2Id = (await db.banners.findFirst({ where: { title: 'QA89 Live Tap' } }))?.id
  await admin('POST', '/api/admin/deals', { type: 'daily', productId, dealPrice: 180, dayDate: '2026-03-05' })
  const gotDeal = await dealTap
  ok(Boolean(gotDeal) && gotDeal?.type === 'daily' && gotDeal?.action === 'created', "live 'deal:changed' tap with real type+action", JSON.stringify(gotDeal)?.slice(0, 120))

  // cleanup the two live-tap rows so the wipe-clean doctrine holds for QA too
  await admin('DELETE', `/api/admin/banners/${b2Id}`)
  const b2DealId = (await db.dailyDeals.findFirst({ where: { dayDate: new Date('2026-03-05T00:00:00.000Z') } }))?.id
  if (b2DealId) await admin('DELETE', `/api/admin/deals/${b2DealId}`)
  sock.close()

  console.log(`\n=== T89 RESULT: ${PASS} pass / ${FAIL} fail ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error('FATAL:', e)
  process.exitCode = 1
  await db.$disconnect()
})
