/**
 * Task 86 E2E — THE DISPUTE SURFACE, drilled end to end for the first time,
 * plus the cohesion rails this task added (complaints previously lived in
 * silence: admins never heard about a filing, buyers never heard about a
 * decision, sellers never heard their shipment was complained about).
 *
 * Proven here, on a wiped DB, with real sockets + real HTTP + real DB rows:
 *   A. auth gates on every complaints rail (buyer + admin sides)
 *   B. create guards (category/title/description, subOrder-without-order,
 *      unknown order 404, FOREIGN order 403)
 *   C. a real filing fans out — admin notification + live 'complaint:new'
 *      tap on admin:<id>, seller notification (profile-id → userId join)
 *   D. evidence lifecycle (magic-byte sniff, 2 MB cap, 5-photo cap, owner-
 *      only bytes, delete while open, evidence locks at in_review)
 *   E. admin review lifecycle (open → in_review → resolved/rejected,
 *      terminal states, resolution note REQUIRED, buyer notified EVERY step
 *      — durable row + live 'notification:new' on user:<buyerId>)
 *   F. withdraw path (owner-only, open-only, audited; admins cannot
 *      withdraw on a buyer's behalf)
 *   G. auditLogs carry the real decisions
 *
 * Run: bun scripts/qa/t86-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.86.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        'X-Forwarded-For': ip,
      },
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
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
    fullName: `QA86 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA86 Shop ${email.slice(5, 12)}` } : {}),
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

// A real 1×1 transparent PNG (passes the magic-byte sniff).
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't86-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession(), stranger = makeSession()
  await registerAndLogin(admin, 'admin', 'qa86-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa86-supa@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa86-buyer@qa.local', PASSWORD)
  await registerAndLogin(stranger, 'buyer', 'qa86-stranger@qa.local', PASSWORD)
  console.log('  users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA86 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await seller('POST', '/api/supplier/products', {
    name: 'QA86 Tiles 60cm', description: 'QA t86 dispute-surface product', categoryId, unit: 'pcs',
    moq: 1, basePrice: 60, stockQuantity: 50, stockAlertThreshold: 5,
    priceTiers: [{ minQty: 1, pricePerUnit: 60 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'product created')
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA86' })

  const order = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }] })
  const orderId = order.json?.data?.orderId
  ok(Boolean(orderId), 'buyer ordered 2 × 60 (total 120)')
  const od = await buyer('GET', `/api/orders/${orderId}`)
  const subOrderId = od.json?.data?.subOrders?.[0]?.id
  ok(Boolean(subOrderId), 'order detail exposes the sub-order for complaint linkage')
  const strangerOrder = await stranger('POST', '/api/orders', { items: [{ productId, quantity: 1 }] })
  const strangerOrderId = strangerOrder.json?.data?.orderId
  ok(Boolean(strangerOrderId), 'stranger ordered (for the foreign-order guard)')

  // ── A. auth gates ──
  console.log('— A. auth gates (401 before any query work) —')
  ok((await makeSession()('POST', '/api/complaints', { category: 'other', title: 'x'.repeat(5), description: 'y'.repeat(12) })).status === 401, 'anon create → 401')
  ok((await makeSession()('GET', '/api/complaints')).status === 401, 'anon list → 401')
  ok((await makeSession()('GET', '/api/complaints/unknown-id')).status === 401, 'anon detail → 401 (auth first)')
  ok((await makeSession()('POST', '/api/complaints/unknown-id/withdraw')).status === 401, 'anon withdraw → 401')
  ok((await buyer('GET', '/api/admin/complaints')).status === 401, 'buyer on admin queue → 401')
  ok((await buyer('PATCH', '/api/admin/complaints/whatever', { action: 'resolve', resolutionNote: 'nope' })).status === 401, 'buyer on admin PATCH → 401')
  ok((await buyer('GET', '/api/realtime/room-token?room=user:notmine')).status === 403, 'room-token for ANOTHER user id → 403')

  // ── B. create guards ──
  console.log('— B. create guards —')
  ok((await buyer('POST', '/api/complaints', { category: 'nonsense', title: 'Valid title here', description: 'Long enough description here' })).status === 400, 'bad category → 400')
  ok((await buyer('POST', '/api/complaints', { category: 'other', title: 'ab', description: 'Long enough description here' })).status === 400, 'title < 3 chars → 400')
  ok((await buyer('POST', '/api/complaints', { category: 'other', title: 'Valid title here', description: 'short' })).status === 400, 'description < 10 chars → 400')
  ok((await buyer('POST', '/api/complaints', { category: 'other', title: 'Valid title here', description: 'Long enough description here', subOrderId })).status === 400, 'subOrder without orderId → 400')
  ok((await buyer('POST', '/api/complaints', { category: 'other', title: 'Valid title here', description: 'Long enough description here', orderId: 'no-such-order' })).status === 404, 'unknown order → 404')
  ok((await buyer('POST', '/api/complaints', { category: 'other', title: 'Valid title here', description: 'Long enough description here', orderId: strangerOrderId })).status === 403, 'FOREIGN order → 403')

  // ── C. real filing + the new cohesion rails (sockets armed first) ──
  console.log('— C. filing fans out (admin tap + seller notice) —')
  const adminId = (await db.users.findFirst({ where: { userType: 'admin' }, select: { id: true } }))?.id
  const buyerId = (await db.users.findFirst({ where: { email: 'qa86-buyer@qa.local' }, select: { id: true } }))?.id
  ok(Boolean(adminId && buyerId), 'session user ids resolved (real DB rows)')

  const tokAdminRoom = await admin('GET', `/api/realtime/room-token?room=admin:${adminId}`)
  const tokBuyerUser = await buyer('GET', `/api/realtime/room-token?room=user:${buyerId}`)
  ok(Boolean(tokAdminRoom.json?.token), 'admin minted admin:<id> room token')
  ok(Boolean(tokBuyerUser.json?.token), 'buyer minted own user:<id> room token')

  const sockAdmin = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  const sockBuyer = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  sockAdmin.emit('subscribe', { room: `admin:${adminId}`, token: tokAdminRoom.json.token })
  ok(Boolean(await waitForEvent(sockAdmin, 'subscribe:ok')), 'admin joined admin:<id> room')
  sockBuyer.emit('subscribe', { room: `user:${buyerId}`, token: tokBuyerUser.json.token })
  ok(Boolean(await waitForEvent(sockBuyer, 'subscribe:ok')), 'buyer joined user:<id> room')

  const complaintNewPromise = waitForEvent(sockAdmin, 'complaint:new')
  const c1 = await buyer('POST', '/api/complaints', {
    category: 'delivery', title: 'Carton arrived crushed', description:
      'Two of the cartons arrived crushed and the contents are damaged. Asking the team to intervene.',
    orderId, subOrderId,
  })
  ok(c1.status === 201, 'complaint #1 filed (order-linked, open)', `got ${c1.status} ${JSON.stringify(c1.json)?.slice(0, 160)}`)
  const c1Id = c1.json?.data?.id
  ok(Boolean(c1Id) && c1.json?.data?.status === 'open', 'complaint #1 is open with a real reference id')

  const tap = await complaintNewPromise
  ok(Boolean(tap?.complaintId === c1Id), "LIVE: admin room got 'complaint:new' with the real complaint id")

  const adminNotifs = await admin('GET', '/api/notifications?limit=20')
  const adminNotice = (adminNotifs.json?.data ?? []).find((n) => n.relatedId === c1Id && /New complaint filed/i.test(n.title))
  ok(Boolean(adminNotice), 'admin has a DURABLE "New complaint filed" notification for #1')

  const sellerNotifs = await seller('GET', '/api/notifications?limit=20')
  const sellerNotice = (sellerNotifs.json?.data ?? []).find((n) => n.relatedId === c1Id && /Complaint filed on your order/i.test(n.title))
  ok(Boolean(sellerNotice), 'SELLER notified through the profile-id → userId join')

  // ── D. evidence lifecycle ──
  console.log('— D. evidence (magic bytes, caps, owner-only bytes) —')
  ok((await makeSession()('POST', `/api/complaints/${c1Id}/evidence`)).status === 401, 'anon evidence upload → 401 auth first')
  const foreign = new FormData()
  foreign.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'x.png')
  ok((await stranger(`POST`, `/api/complaints/${c1Id}/evidence`, foreign)).status === 403, 'FOREIGN buyer evidence → 403')
  const textForm = new FormData()
  textForm.append('file', new Blob([Buffer.from('definitely not an image at all')], { type: 'image/png' }), 'fake.png')
  ok((await buyer('POST', `/api/complaints/${c1Id}/evidence`, textForm)).status === 400, 'text bytes declared as image → 400 (magic-byte sniff)')

  const longNote = new FormData()
  longNote.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'a.png')
  longNote.append('note', 'n'.repeat(201))
  ok((await buyer('POST', `/api/complaints/${c1Id}/evidence`, longNote)).status === 400, 'caption > 200 chars → 400')

  const bigBuf = Buffer.concat([PNG_1PX.subarray(0, 8), Buffer.alloc(2 * 1024 * 1024, 0)])
  const bigForm = new FormData()
  bigForm.append('file', new Blob([bigBuf], { type: 'image/png' }), 'big.png')
  const bigRes = await buyer('POST', `/api/complaints/${c1Id}/evidence`, bigForm)
  ok(bigRes.status === 413, 'PNG magic + 2 MB+1 body → 413 (real size cap)', `got ${bigRes.status}`)

  const photoIds = []
  for (let i = 0; i < 5; i++) {
    const f = new FormData()
    f.append('file', new Blob([PNG_1PX], { type: 'image/png' }), `p${i}.png`)
    f.append('note', `Carton ${i + 1} damage close-up`)
    const up = await buyer('POST', `/api/complaints/${c1Id}/evidence`, f)
    if (up.status === 201) photoIds.push(up.json?.data?.id)
    else { ok(false, `evidence upload ${i + 1} → 201`, `got ${up.status} ${JSON.stringify(up.json)?.slice(0, 120)}`) }
  }
  ok(photoIds.length === 5, '5 real evidence photos uploaded (cap reached)')
  const sixth = new FormData()
  sixth.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'p6.png')
  const sixthRes = await buyer('POST', `/api/complaints/${c1Id}/evidence`, sixth)
  ok(sixthRes.status === 409 && /5 evidence photos/.test(sixthRes.json?.error ?? ''), '6th photo → 409 naming the REAL count')

  const bytesOwner = await buyer('GET', `/api/attachments/${photoIds[0]}`)
  const bytesStranger = await stranger('GET', `/api/attachments/${photoIds[0]}`)
  ok(bytesOwner.status === 200 && (bytesOwner.json === null), 'owner fetches evidence bytes → 200 image')
  ok(bytesStranger.status === 404, 'stranger fetches evidence bytes → 404 (no existence leak, same as unknown id)', `got ${bytesStranger.status}`)

  ok((await stranger('DELETE', `/api/complaints/${c1Id}/evidence/${photoIds[0]}`)).status === 403, 'stranger evidence DELETE → 403')
  ok((await buyer('DELETE', `/api/complaints/${c1Id}/evidence/${photoIds[0]}`)).status === 200, 'owner deletes own evidence while open → 200')
  const reUp = new FormData()
  reUp.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'p6.png')
  ok((await buyer('POST', `/api/complaints/${c1Id}/evidence`, reUp)).status === 201, 'slot freed after delete → upload succeeds again')

  // ── E. review lifecycle (with live buyer pushes) ──
  console.log('— E. admin review lifecycle + live buyer pushes —')
  ok((await admin('PATCH', `/api/admin/complaints/${c1Id}`, { action: 'resolve', resolutionNote: 'Refund of 120 tk will be arranged' })).status === 409, 'resolve while open → 409 (start review first)')

  const liveReview = waitForEvent(sockBuyer, 'notification:new')
  const sr = await admin('PATCH', `/api/admin/complaints/${c1Id}`, { action: 'start_review' })
  ok(sr.status === 200 && sr.json?.data?.status === 'in_review', 'start_review → in_review')
  const reviewPush = await liveReview
  ok(reviewPush?.title === 'Your complaint is being reviewed', "LIVE: buyer's user room got 'notification:new' (review started)")

  const lockedForm = new FormData()
  lockedForm.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'late.png')
  ok((await buyer('POST', `/api/complaints/${c1Id}/evidence`, lockedForm)).status === 409, 'evidence upload after in_review → 409 (sealed)')
  ok((await buyer('DELETE', `/api/complaints/${c1Id}/evidence/${photoIds[1]}`)).status === 409, 'evidence delete after in_review → 409')
  ok((await buyer('POST', `/api/complaints/${c1Id}/withdraw`)).status === 409, 'withdraw after in_review → 409')
  ok((await admin('PATCH', `/api/admin/complaints/${c1Id}`, { action: 'resolve', resolutionNote: 'ab' })).status === 422, 'resolve with 2-char note → 422')
  ok((await admin('PATCH', `/api/admin/complaints/${c1Id}`, { action: 'resolve' })).status === 422, 'resolve without note → 422')

  const liveResolved = waitForEvent(sockBuyer, 'notification:new')
  const rs = await admin('PATCH', `/api/admin/complaints/${c1Id}`, { action: 'resolve', resolutionNote: 'Refund of the full 120 tk was sent via bKash — see your order page.' })
  ok(rs.status === 200 && rs.json?.data?.status === 'resolved' && rs.json?.data?.resolvedAt, 'resolve with real note → resolved + resolvedAt stamped')
  const resolvedPush = await liveResolved
  ok(resolvedPush?.title === 'Complaint resolved', "LIVE: buyer got the resolution push")

  ok((await admin('PATCH', `/api/admin/complaints/${c1Id}`, { action: 'start_review' })).status === 409, 'terminal: start_review again → 409')
  ok((await admin('PATCH', `/api/admin/complaints/${c1Id}`, { action: 'reject', resolutionNote: 'trying again' })).status === 409, 'terminal: reject again → 409')
  ok((await buyer('POST', `/api/complaints/${c1Id}/withdraw`)).status === 409, 'terminal: withdraw → 409')

  const c1Detail = await buyer('GET', `/api/complaints/${c1Id}`)
  ok(c1Detail.json?.data?.resolutionNote?.includes('120 tk'), 'buyer detail carries the real resolution note')
  ok((c1Detail.json?.data?.evidencePhotos ?? []).length === 5, 'detail carries the 5 evidence rows')

  // ── F. rejected path (no order → no seller notice) ──
  console.log('— F. rejected path —')
  const c2 = await buyer('POST', '/api/complaints', {
    category: 'other', title: 'Changed my mind', description: 'I want to cancel this whole concern, filed by mistake yesterday.',
  })
  ok(c2.status === 201, 'complaint #2 filed (no order)')
  const c2Id = c2.json?.data?.id
  await admin('PATCH', `/api/admin/complaints/${c2Id}`, { action: 'start_review' })
  const rj = await admin('PATCH', `/api/admin/complaints/${c2Id}`, { action: 'reject', resolutionNote: 'No policy violation found — closing as rejected.' })
  ok(rj.status === 200 && rj.json?.data?.status === 'rejected', 'reject with note → rejected')
  const buyerNotifs = await buyer('GET', '/api/notifications?limit=30')
  ok((buyerNotifs.json?.data ?? []).some((n) => n.relatedId === c2Id && /rejected/i.test(n.title)), 'buyer notified of the rejection')

  // ── G. withdraw path ──
  console.log('— G. withdraw path (owner-only, open-only) —')
  const c3 = await buyer('POST', '/api/complaints', {
    category: 'payment', title: 'Double charged worry', description: 'I feared a double charge but it was fine, withdrawing this.',
  })
  const c3Id = c3.json?.data?.id
  ok(Boolean(c3Id), 'complaint #3 filed')
  ok((await stranger('POST', `/api/complaints/${c3Id}/withdraw`)).status === 403, 'stranger withdraw → 403')
  ok((await admin('POST', `/api/complaints/${c3Id}/withdraw`)).status === 403, 'ADMIN withdraw → 403 (the buyer owns this decision)')
  ok((await buyer('POST', `/api/complaints/${c3Id}/withdraw`)).status === 200, 'owner withdraw → 200 withdrawn')
  ok((await buyer('POST', `/api/complaints/${c3Id}/withdraw`)).status === 409, 'withdraw again → 409')
  ok((await admin('PATCH', `/api/admin/complaints/${c3Id}`, { action: 'start_review' })).status === 409, 'admin start_review on withdrawn → 409')

  // ── H. scoping + admin queue shape ──
  console.log('— H. scoping + admin queue —')
  ok((await stranger('GET', `/api/complaints/${c1Id}`)).status === 403, 'stranger detail → 403')
  const strangerList = await stranger('GET', '/api/complaints?take=100')
  ok((strangerList.json?.data ?? []).length === 0, "stranger's list is empty (buyer-scoped for real)")
  const openList = await buyer('GET', '/api/complaints?status=open')
  ok((openList.json?.data ?? []).every((c) => c.status === 'open'), 'status filter serves only open rows')
  const queue = await admin('GET', '/api/admin/complaints')
  const counts = queue.json?.data?.counts ?? {}
  ok(counts.total === 3 && counts.resolved === 1 && counts.rejected === 1 && counts.withdrawn === 1, 'admin counts are the real groupBy: resolved 1, rejected 1, withdrawn 1, total 3', JSON.stringify(counts))
  const qRow = (queue.json?.data?.complaints ?? []).find((c) => c.id === c1Id)
  ok(Boolean(qRow?.buyerName) && qRow?.categoryLabel === 'Delivery' && (qRow?.evidence ?? []).length === 5, 'queue row carries buyerName + categoryLabel + evidence[]')

  // ── I. audit trail (direct DB) ──
  console.log('— I. audit trail (raw DB) —')
  const reviewed = await db.auditLogs.count({ where: { action: 'complaint_reviewed', entityId: { in: [c1Id, c2Id, c3Id] } } })
  ok(reviewed >= 4, `complaint_reviewed audits ≥ 4 (start/resolve/reject)`, `got ${reviewed}`)
  ok((await db.auditLogs.count({ where: { action: 'complaint_withdrawn', entityId: c3Id } })) === 1, 'complaint_withdrawn audit present')
  ok((await db.auditLogs.count({ where: { action: 'evidence_uploaded', entityType: 'evidencePhotos' } })) >= 6, 'evidence_uploaded audits present')
  ok((await db.auditLogs.count({ where: { action: 'evidence_deleted' } })) === 1, 'evidence_deleted audit present')

  sockAdmin.close(); sockBuyer.close()
  console.log(`\n=== t86: ${PASS} pass / ${FAIL} fail ===`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('DRILL CRASH:', e); await db.$disconnect(); process.exit(1) })
