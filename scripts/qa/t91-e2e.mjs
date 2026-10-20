/**
 * Task 91 E2E — THE INSPECTION RAIL ("check it before you accept it").
 *
 * inspectionRequests had NO route, NO writer, NO reader, NO UI. Now:
 *   A. auth gates (buyer rail 401s; the PATCH rail is admin-only)
 *   B. create guards (phantom order 404, FOREIGN order 404 no-leak, bad
 *      inspectorType 400, strict keys)
 *   C. THE COHESION RAILS — every admin gets a durable notification AND a
 *      live 'inspection:new' tap on their admin room; duplicate-active 409
 *   D. admin oversight list (real groupBy stats, ?status filter with verbatim
 *      Zod 400, buyer display name embedded)
 *   E. THE STATE MACHINE, admin-only: pending→scheduled (slot required),
 *      scheduled→completed (reportUrl REQUIRED — a completed inspection
 *      without its report is refused), scheduled→failed (finding note
 *      REQUIRED, delivered to the buyer verbatim); every illegal move a 409
 *      naming the state; the buyer is notified at EVERY step
 *   F. completed/failed inspections free a fresh request; full audit trail
 *
 * Run: bun scripts/qa/t91-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.92.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA91 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA91 Shop ${email.slice(7, 14)}` } : {}),
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

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't91-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession(), stranger = makeSession()
  await registerAndLogin(admin, 'admin', 'qa91-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa91-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa91-buyer@qa.local', PASSWORD)
  await registerAndLogin(stranger, 'buyer', 'qa91-stranger@qa.local', PASSWORD)
  console.log('  users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA91 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA91 Ceramic Tiles', description: 'QA91 floor tiles, bulk cartons', categoryId, unit: 'carton',
    moq: 50, basePrice: 900, stockQuantity: 800,
    priceTiers: [{ minQty: 1, pricePerUnit: 900 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA91' })

  // A REAL buyer order to inspect (create-direct, 60 cartons > MOQ 50)
  const ord = await buyer('POST', '/api/orders/create-direct', { productId, quantity: 60 })
  const orderId = ord.json?.data?.orderId ?? ord.json?.data?.order?.id ?? ord.json?.data?.id
  ok(Boolean(orderId), 'real order created (create-direct, 60 cartons)', JSON.stringify(ord.json)?.slice(0, 200))
  const foreignOrder = await stranger('POST', '/api/orders/create-direct', { productId, quantity: 50 })
  const foreignOrderId = foreignOrder.json?.data?.orderId ?? foreignOrder.json?.data?.order?.id ?? foreignOrder.json?.data?.id

  /* ── A. auth gates ── */
  console.log('— A. auth gates —')
  ok((await makeSession()('POST', '/api/inspections', { orderId, inspectorType: 'self' })).status === 401, 'anon create → 401')
  ok((await makeSession()('GET', '/api/inspections')).status === 401, 'anon list → 401')
  ok((await makeSession()('PATCH', '/api/inspections/whatever', { action: 'schedule', scheduledAt: '2026-01-01T10:00:00Z' })).status === 401, 'anon PATCH → 401')
  ok((await buyer('PATCH', `/api/inspections/whatever`, { action: 'schedule', scheduledAt: '2026-01-01T10:00:00Z' })).status === 401, 'buyer on admin PATCH → 401')
  ok((await buyer('GET', '/api/admin/inspections')).status === 401, 'buyer on admin list → 401')

  /* ── B. create guards ── */
  console.log('— B. create guards —')
  ok((await buyer('POST', '/api/inspections', { orderId: 'phantom-order', inspectorType: 'self' })).status === 404, 'phantom order → 404')
  ok((await buyer('POST', '/api/inspections', { orderId: foreignOrderId, inspectorType: 'self' })).status === 404, 'FOREIGN order → 404 (no-leak, same as missing)')
  ok((await buyer('POST', '/api/inspections', { orderId, inspectorType: 'agency' })).status === 400, 'bad inspectorType → 400')
  ok((await buyer('POST', '/api/inspections', { orderId, inspectorType: 'self', hack: true })).status === 400, 'unknown key (strict) → 400')

  /* ── C. create + the cohesion rails (admin socket armed FIRST) ── */
  console.log('— C. request fans out to every admin —')
  const adminId = (await db.users.findFirst({ where: { userType: 'admin' }, select: { id: true } }))?.id
  const tok = await admin('GET', `/api/realtime/room-token?room=admin:${adminId}`)
  ok(Boolean(tok.json?.token), 'admin minted admin:<id> room token')
  const sock = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  sock.emit('subscribe', { room: `admin:${adminId}`, token: tok.json.token })
  ok(Boolean(await waitForEvent(sock, 'subscribe:ok')), 'admin joined admin:<id> room')
  const newTap = waitForEvent(sock, 'inspection:new')

  const i1 = await buyer('POST', '/api/inspections', { orderId, inspectorType: 'third_party', note: 'Check the glazing on cartons 1-20' })
  ok(i1.status === 201 && i1.json?.data?.inspectionId && i1.json?.data?.status === 'pending', 'inspection created → 201 pending', JSON.stringify(i1.json)?.slice(0, 160))
  const insp1 = i1.json?.data?.inspectionId

  const row = await db.inspectionRequests.findUnique({ where: { id: insp1 }, select: { buyerId: true, inspectorType: true, status: true, orderId: true } })
  ok(row?.buyerId && row?.status === 'pending' && row?.inspectorType === 'third_party' && row?.orderId === orderId, 'raw row honest (buyer, pending, third_party, order-linked)')

  const adminNotifs = await db.notifications.count({ where: { userId: adminId, relatedEntityId: insp1 } })
  ok(adminNotifs === 1, 'admin durable notification (real row)', String(adminNotifs))
  const gotTap = await newTap
  ok(Boolean(gotTap) && gotTap?.inspectionId === insp1 && gotTap?.orderNumber, "live 'inspection:new' tap with real order number", JSON.stringify(gotTap)?.slice(0, 140))

  const dup = await buyer('POST', '/api/inspections', { orderId, inspectorType: 'self' })
  ok(dup.status === 409 && dup.json?.inspectionId === insp1, 'duplicate ACTIVE inspection → 409 with the real id')

  /* ── D. admin list ── */
  console.log('— D. admin oversight list —')
  const list = await admin('GET', '/api/admin/inspections')
  ok(list.status === 200 && list.json?.data?.stats?.total === 1 && list.json?.data?.stats?.pending === 1,
    'admin list: stats honest (total 1, pending 1)', JSON.stringify(list.json?.data?.stats))
  const listRow = list.json?.data?.inspections?.[0]
  ok(listRow?.buyerName === 'QA91 buyer' && listRow?.orderNumber && listRow?.inspectorType === 'third_party',
    'list embeds buyer display name + order number')
  ok((await admin('GET', '/api/admin/inspections?status=pending')).json?.data?.inspections?.length === 1, '?status=pending filters')
  ok((await admin('GET', '/api/admin/inspections?status=bogus')).status === 400, '?status=bogus → 400')

  /* ── E. the state machine ── */
  console.log('— E. state machine (admin-only) —')
  ok((await admin('PATCH', `/api/inspections/${insp1}`, { action: 'complete', reportUrl: 'https://reports.example.com/r.pdf' })).status === 409, 'complete while pending → 409')
  ok((await admin('PATCH', `/api/inspections/${insp1}`, { action: 'fail', note: 'x' })).status === 409, 'fail while pending → 409')
  ok((await admin('PATCH', `/api/inspections/${insp1}`, { action: 'schedule' })).status === 400, 'schedule without scheduledAt → 400 (Zod refine)')

  const sched = await admin('PATCH', `/api/inspections/${insp1}`, { action: 'schedule', scheduledAt: '2026-03-15T09:00:00Z' })
  ok(sched.status === 200 && sched.json?.data?.inspection?.status === 'scheduled', 'schedule → 200 scheduled', JSON.stringify(sched.json)?.slice(0, 140))
  const buyerUserId = (await db.users.findFirst({ where: { email: 'qa91-buyer@qa.local' }, select: { id: true } }))?.id
  const schedNotif = await db.notifications.findFirst({ where: { userId: buyerUserId, relatedEntityId: insp1, title: { contains: 'scheduled' } } })
  ok(Boolean(schedNotif) && schedNotif.body.includes('15 Mar'), 'buyer durable scheduled notification with the slot')
  ok((await admin('PATCH', `/api/inspections/${insp1}`, { action: 'schedule', scheduledAt: '2026-03-16T09:00:00Z' })).status === 409, 'schedule again → 409')

  ok((await admin('PATCH', `/api/inspections/${insp1}`, { action: 'complete' })).status === 400, 'complete without reportUrl → 400 (refused)')
  const complete = await admin('PATCH', `/api/inspections/${insp1}`, { action: 'complete', reportUrl: 'https://reports.example.com/INS-1.pdf' })
  ok(complete.status === 200 && complete.json?.data?.inspection?.reportUrl === 'https://reports.example.com/INS-1.pdf' && Boolean(complete.json?.data?.inspection?.completedAt),
    'complete with report → 200 completed + reportUrl + completedAt')
  const passNotif = await db.notifications.findFirst({ where: { userId: buyerUserId, relatedEntityId: insp1, title: { contains: 'passed' } } })
  ok(Boolean(passNotif), 'buyer durable passed notification')
  ok((await admin('PATCH', `/api/inspections/${insp1}`, { action: 'complete', reportUrl: 'https://x.test/r2.pdf' })).status === 409, 'complete again → 409')

  // buyer list shows the report; completed frees a fresh request
  const buyerList = await buyer('GET', '/api/inspections')
  const bRow = buyerList.json?.data?.inspections?.[0]
  ok(bRow?.status === 'completed' && bRow?.reportUrl === 'https://reports.example.com/INS-1.pdf', 'buyer list carries the real report link')
  ok((await stranger('GET', '/api/inspections')).json?.data?.inspections?.length === 0, 'stranger list honestly empty (scoped)')

  const i2 = await buyer('POST', '/api/inspections', { orderId, inspectorType: 'self' })
  ok(i2.status === 201, 'completed inspection frees a fresh request → 201')
  const insp2 = i2.json?.data?.inspectionId
  await admin('PATCH', `/api/inspections/${insp2}`, { action: 'schedule', scheduledAt: '2026-03-20T09:00:00Z' })
  ok((await admin('PATCH', `/api/inspections/${insp2}`, { action: 'fail' })).status === 400, 'fail without note → 400 (finding REQUIRED)')
  const fail = await admin('PATCH', `/api/inspections/${insp2}`, { action: 'fail', note: 'Two cartons crushed; glazing cracked on 14 tiles' })
  ok(fail.status === 200 && fail.json?.data?.inspection?.status === 'failed', 'fail with finding → 200 failed')
  const failNotif = await db.notifications.findFirst({ where: { userId: buyerUserId, relatedEntityId: insp2, title: { contains: 'failed' } } })
  ok(Boolean(failNotif) && failNotif.body.includes('glazing cracked on 14 tiles'), 'buyer notification carries the finding VERBATIM')

  ok((await admin('PATCH', '/api/inspections/no-such-id', { action: 'schedule', scheduledAt: '2026-01-01T10:00:00Z' })).status === 404, 'unknown id → 404')

  const audits = await db.auditLogs.groupBy({ by: ['action'], where: { entityType: 'inspectionRequests' }, _count: { _all: true } })
  const auditMap = Object.fromEntries(audits.map((a) => [a.action, a._count._all]))
  ok(auditMap.inspection_requested === 2 && auditMap.inspection_scheduled === 2 && auditMap.inspection_completed === 1 && auditMap.inspection_failed === 1,
    'audit trail complete in raw DB', JSON.stringify(auditMap))

  sock.close()
  console.log(`\n=== T91 RESULT: ${PASS} pass / ${FAIL} fail ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error('FATAL:', e)
  process.exitCode = 1
  await db.$disconnect()
})
