/**
 * Task 98 E2E — THE WAREHOUSE RAIL ("where do these goods actually ship
 * from?"). supplierProfiles has carried warehouseLocations since day one and
 * GET /api/suppliers/[id] already projected them — but NOTHING could write
 * one and no storefront surface displayed one. Now:
 *   A. gates — 401-first, buyer (no profile) → honest 403
 *   B. create — Zod STRICT, bounded coordinates, cap 8 (the 9th is a 409)
 *   C. list — owner-scoped, active-first ordering
 *   D. patch — rename/deactivate; foreign id == phantom id → SAME 404
 *   E. storefront projection — a GUEST sees ONLY active rows; the owner's
 *      manage list still holds the deactivated one
 *   F. delete — owner-only; the storefront count drops for real
 *   G. audit + live tap — warehouse_added/updated/removed in raw DB, and an
 *      admin socket subscribed to its room receives warehouse:changed
 *
 * Run: bun scripts/qa/t98-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
import { io } from 'socket.io-client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
function ok(cond, label, extra = '') {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

function makeSession() {
  let cookie = ''
  const ip = `10.98.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA98 ${userType}` }
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
  const PASSWORD = 't98-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), seller2 = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa98-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa98-supa@qa.local', PASSWORD)
  await registerAndLogin(seller2, 'supplier', 'qa98-supb@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa98-buyer@qa.local', PASSWORD)
  console.log('  accounts ready')

  // Admin socket joins its room FIRST — the tap must arrive after subscribe.
  // Token protocol: mint via the gated room-token rail, then subscribe.
  const adminId = (await db.users.findFirst({ where: { userType: 'admin' }, select: { id: true } }))?.id
  const adminSocket = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  let joined = null
  const connected = await new Promise((resolve) => {
    adminSocket.on('connect', () => resolve(true))
    adminSocket.on('connect_error', () => resolve(false))
    setTimeout(() => resolve(false), 9000)
  })
  if (connected) {
    const tok = await admin('GET', `/api/realtime/room-token?room=admin:${adminId}`)
    adminSocket.emit('subscribe', { room: `admin:${adminId}`, token: tok.json?.token ?? '' })
    joined = await waitForEvent(adminSocket, 'subscribe:ok', 8000)
  }
  ok(joined !== null, 'admin socket subscribed to admin:<id> room (token-gated)', JSON.stringify(joined))

  /* ── A. gates ── */
  console.log('— A. gates —')
  ok((await makeSession()('GET', '/api/supplier/warehouses')).status === 401, 'anon list → 401')
  ok((await makeSession()('POST', '/api/supplier/warehouses', { name: 'X' })).status === 401, 'anon create → 401')
  const b403 = await buyer('GET', '/api/supplier/warehouses')
  ok(b403.status === 403, 'buyer (no supplier profile) → honest 403', JSON.stringify(b403.json))
  ok((await buyer('POST', '/api/supplier/warehouses', { name: 'Xx', addressLine1: 'Road 1', city: 'Dhaka', district: 'Dhaka' })).status === 403, 'buyer create → 403')

  /* ── B. create ── */
  console.log('— B. create —')
  ok((await seller('POST', '/api/supplier/warehouses', { name: 'X', addressLine1: 'Road 1', city: 'Dhaka', district: 'Dhaka' })).status === 400, '1-char name → 400')
  ok((await seller('POST', '/api/supplier/warehouses', { name: 'Main WH', addressLine1: 'Road 1', city: 'Dhaka', district: 'Dhaka', bogus: 1 })).status === 400, 'strict keys → 400')
  ok((await seller('POST', '/api/supplier/warehouses', { name: 'Main WH', addressLine1: 'Road 1', city: 'Dhaka', district: 'Dhaka', lat: 95 })).status === 400, 'lat 95 out of bounds → 400')
  const tapPromise = waitForEvent(adminSocket, 'warehouse:changed', 8000, (p) => p?.action === 'added' && p?.name === 'Tejgaon Main Warehouse')
  const w1 = await seller('POST', '/api/supplier/warehouses', {
    name: 'Tejgaon Main Warehouse', addressLine1: 'Plot 7, Segment B', city: 'Dhaka', district: 'Dhaka',
    lat: 23.7509, lng: 90.3932,
  })
  ok(w1.status === 201 && w1.json?.data?.isActive === true, 'warehouse created → 201 active', JSON.stringify(w1.json?.data))
  ok(w1.json?.data?.lat === 23.7509 && w1.json?.data?.lng === 90.3932, 'coordinates persisted')
  const tap = await tapPromise
  ok(Boolean(tap), 'admin room received warehouse:changed (added) LIVE', JSON.stringify(tap))

  /* ── C. cap ── */
  console.log('— C. cap —')
  let capHit = null
  for (let i = 2; i <= 9; i++) {
    const r = await seller('POST', '/api/supplier/warehouses', {
      name: `Overflow Warehouse ${i}`, addressLine1: `Road ${i}`, city: 'Gazipur', district: 'Gazipur',
    })
    if (r.status === 409) { capHit = r; break }
  }
  ok(capHit?.status === 409 && /at most 8/.test(capHit.json?.error ?? ''), '9th warehouse → 409 naming the cap', JSON.stringify(capHit?.json))
  const list = await seller('GET', '/api/supplier/warehouses')
  ok(list.json?.count === 8, 'owner list holds exactly 8 rows', JSON.stringify(list.json?.count))

  /* ── D. patch ── */
  console.log('— D. patch —')
  const w2 = list.json?.data?.[1]
  ok((await seller2('PATCH', `/api/supplier/warehouses/${w2.id}`, { name: 'Stolen' })).status === 404, 'foreign supplier PATCH → SAME 404 as phantom')
  ok((await seller('PATCH', '/api/supplier/warehouses/phantom-id', { name: 'Phantom WH' })).status === 404, 'phantom PATCH → 404 (valid payload, ownership is what refuses)')
  const deact = await seller('PATCH', `/api/supplier/warehouses/${w2.id}`, { isActive: false, name: 'Overflow Warehouse 2 (paused)' })
  ok(deact.status === 200 && deact.json?.data?.isActive === false, 'deactivate + rename → 200')

  /* ── E. storefront projection ── */
  console.log('— E. storefront projection —')
  const prof = await db.supplierProfiles.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  const guest = await makeSession()('GET', `/api/supplier/storefront?supplierId=${prof.id}`)
  const pubs = guest.json?.data?.warehouses
  ok(Array.isArray(pubs) && pubs.length === 7, `guest storefront sees ONLY the 7 active rows (inactive excluded)`, JSON.stringify(pubs?.length))
  ok(pubs?.every((w) => !('createdAt' in w)), 'public warehouse shape carries no timestamps')
  const ownList = await seller('GET', '/api/supplier/warehouses')
  ok(ownList.json?.count === 8, 'owner manage list STILL holds the deactivated row (manage ≠ public)')

  /* ── F. delete ── */
  console.log('— F. delete —')
  ok((await seller2('DELETE', `/api/supplier/warehouses/${w2.id}`)).status === 404, 'foreign DELETE → 404')
  const rmTap = waitForEvent(adminSocket, 'warehouse:changed', 8000, (p) => p?.action === 'removed')
  ok((await seller('DELETE', `/api/supplier/warehouses/${w2.id}`)).status === 200, 'owner DELETE → 200')
  ok((await seller('DELETE', `/api/supplier/warehouses/${w2.id}`)).status === 404, 're-DELETE → 404')
  ok(Boolean(await rmTap), 'admin room received warehouse:changed (removed)')
  const guest2 = await makeSession()('GET', `/api/supplier/storefront?supplierId=${prof.id}`)
  ok(guest2.json?.data?.warehouses?.length === 7, 'storefront count unchanged (the removed row was inactive already)')
  const after = await seller('GET', '/api/supplier/warehouses')
  ok(after.json?.count === 7, 'manage list drops to 7 — a freed slot lets the cap breathe')

  /* ── G. audit ── */
  console.log('— G. audit —')
  const audit = await db.auditLogs.groupBy({ by: ['action'], where: { action: { startsWith: 'warehouse' } }, _count: { action: true } })
  const counts = Object.fromEntries(audit.map((a) => [a.action, a._count.action]))
  ok(counts.warehouse_added === 8 && counts.warehouse_updated === 1 && counts.warehouse_removed === 1, 'audit trail exact (8 added / 1 updated / 1 removed)', JSON.stringify(counts))

  adminSocket.disconnect()
  console.log(`\n=== t98 RESULT: ${PASS} PASS / ${FAIL} FAIL ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
  await db.$disconnect()
}
main().catch(async (e) => { console.error('DRILL ERROR:', e.message); process.exitCode = 1; await db.$disconnect() })
