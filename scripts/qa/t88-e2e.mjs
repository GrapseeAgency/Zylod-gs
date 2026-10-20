/**
 * Task 88 E2E — THE BUYER↔SUPPLIER CHAT RAIL.
 *
 * The chat surface worked but leaked and stayed SILENT: POST conversations
 * accepted any fantasy supplierId (and any product for it), and a sent
 * message notified NOBODY — the recipient discovered it only if they happened
 * to open the chat. Fixed here and proven end to end:
 *   A. auth gates on every chat rail
 *   B. conversation-create guards (phantom supplier, buyer-as-supplier,
 *      phantom product, ANOTHER seller's product)
 *   C. idempotent create (same pair reuses the same conversation)
 *   D. messages: participant-only access, reply-target scoping, unread
 *      counts + read-marking
 *   E. THE COHESION RAIL — every message lands the recipient a durable
 *      'chat' notification AND a live 'notification:new' push on their
 *      user:<id> room, with the sender's REAL profile name
 *
 * Run: bun scripts/qa/t88-e2e.mjs   (DB must be EMPTY — first-admin window)
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
    fullName: `QA88 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA88 Shop ${email.slice(7, 14)}` } : {}),
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
  const PASSWORD = 't88-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), seller2 = makeSession(), buyer = makeSession(), stranger = makeSession()
  await registerAndLogin(admin, 'admin', 'qa88-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa88-supa1@qa.local', PASSWORD)
  await registerAndLogin(seller2, 'supplier', 'qa88-supa2@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa88-buyer@qa.local', PASSWORD)
  await registerAndLogin(stranger, 'buyer', 'qa88-stranger@qa.local', PASSWORD)
  console.log('  users ready')

  const sellerUserId = (await db.users.findFirst({ where: { email: 'qa88-supa1@qa.local' }, select: { id: true } }))?.id
  const seller2UserId = (await db.users.findFirst({ where: { email: 'qa88-supa2@qa.local' }, select: { id: true } }))?.id
  const buyerUserId = (await db.users.findFirst({ where: { email: 'qa88-buyer@qa.local' }, select: { id: true } }))?.id
  ok(Boolean(sellerUserId && seller2UserId && buyerUserId), 'user ids resolved (real DB rows)')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA88 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const mk = async (session, name) => {
    const p = await session('POST', '/api/supplier/products', {
      name, description: `QA88 ${name}`, categoryId, unit: 'pcs',
      moq: 10, basePrice: 200, stockQuantity: 100,
      priceTiers: [{ minQty: 1, pricePerUnit: 200 }],
      images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    })
    const pid = p.json?.data?.id ?? p.json?.id
    await admin('PATCH', '/api/admin/products', { productId: pid, action: 'approve', reason: 'QA88' })
    return pid
  }
  const prod1 = await mk(seller, 'QA88LED Bulbs 9W')
  const prod2 = await mk(seller2, 'QA88Cables 2m')
  ok(Boolean(prod1 && prod2), 'two products created + approved (one per seller)')

  // ── A. auth gates ──
  console.log('— A. auth gates —')
  const anon = makeSession()
  ok((await anon('GET', '/api/chat/conversations')).status === 401, 'anon conversations list → 401')
  ok((await anon('POST', '/api/chat/conversations', { supplierId: sellerUserId })).status === 401, 'anon conversation create → 401')
  ok((await anon('GET', '/api/chat/conversations/x/messages')).status === 401, 'anon messages list → 401')
  ok((await anon('POST', '/api/chat/conversations/x/messages', { messageText: 'hi' })).status === 401, 'anon message send → 401')

  // ── B. conversation-create guards ──
  console.log('— B. conversation-create guards —')
  ok((await buyer('POST', '/api/chat/conversations', {})).status === 400, 'missing supplierId → 400')
  ok((await buyer('POST', '/api/chat/conversations', { supplierId: 'phantom-cuid' })).status === 400, 'phantom supplierId → 400 (was: conversation created with a ghost)')
  ok((await buyer('POST', '/api/chat/conversations', { supplierId: buyerUserId })).status === 400, 'buyer id as supplierId → 400 (not a supplier account)')
  ok((await buyer('POST', '/api/chat/conversations', { supplierId: sellerUserId, productId: 'phantom-product' })).status === 400, 'phantom productId → 400')
  ok((await buyer('POST', '/api/chat/conversations', { supplierId: sellerUserId, productId: prod2 })).status === 400, "ANOTHER seller's product for this supplier → 400")

  // ── C. real create + idempotence ──
  console.log('— C. real conversation create —')
  const c1 = await buyer('POST', '/api/chat/conversations', { supplierId: sellerUserId, productId: prod1 })
  ok(c1.status === 201 && c1.json?.data?.id, 'conversation created (buyer ↔ seller, product-linked)')
  const convId = c1.json?.data?.id
  const c2 = await buyer('POST', '/api/chat/conversations', { supplierId: sellerUserId, productId: prod1 })
  ok(c2.status === 200 && c2.json?.data?.id === convId, 'same pair reuses the SAME conversation (no duplicates)')

  // ── D. messages: access, reply scoping, read-marking ──
  console.log('— D. message access + read state —')
  ok((await stranger('GET', `/api/chat/conversations/${convId}/messages`)).status === 403, 'stranger message list → 403')
  ok((await stranger('POST', `/api/chat/conversations/${convId}/messages`, { messageText: 'let me in' })).status === 403, 'stranger message send → 403')
  ok((await buyer('POST', `/api/chat/conversations/${convId}/messages`, {})).status === 400, 'empty body (no text, no attachment) → 400')
  ok((await buyer('POST', `/api/chat/conversations/${convId}/messages`, { messageText: 'x'.repeat(5001) })).status === 400, 'messageText > 5000 → 400')
  ok((await buyer('POST', `/api/chat/conversations/${convId}/messages`, { messageText: 'reply bait', replyToId: 'phantom-msg' })).status === 400, 'foreign replyToId → 400')

  // supplier socket armed BEFORE the buyer's first message (live push proof)
  const tokS = await seller('GET', `/api/realtime/room-token?room=user:${sellerUserId}`)
  const sockS = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  sockS.emit('subscribe', { room: `user:${sellerUserId}`, token: tokS.json.token })
  ok(Boolean(await waitForEvent(sockS, 'subscribe:ok')), 'seller joined user:<id> room')

  const liveSupplier = waitForEvent(sockS, 'notification:new')
  const m1 = await buyer('POST', `/api/chat/conversations/${convId}/messages`, { messageText: 'Do you do 500 pcs per carton at a better rate?' })
  ok(m1.status === 201, 'buyer sent the first message')
  const pushS = await liveSupplier
  ok(pushS?.type === 'chat' && /sent you a message/.test(pushS?.title ?? ''), "LIVE: seller's user room got 'notification:new' (type chat)")
  ok(String(pushS?.message ?? '').includes('500 pcs'), 'push carries the real message preview (payload field: message)')

  const sList = await seller('GET', '/api/chat/conversations?role=supplier')
  const sConv = (sList.json?.data ?? []).find((c) => c.id === convId)
  ok(Boolean(sConv) && sConv?.otherPartyName === 'QA88 buyer', "seller list shows the buyer's REAL profile name")
  ok(sConv?.unreadCount === 1, 'seller list shows unreadCount 1')
  ok(sConv?.product?.id === prod1 && sConv?.product?.moq === 10, 'list embeds the real product payload')

  const sMsgs1 = await seller('GET', `/api/chat/conversations/${convId}/messages`)
  ok((sMsgs1.json?.data ?? []).length === 1, 'seller reads the thread')
  const sList2 = await seller('GET', '/api/chat/conversations?role=supplier')
  ok((sList2.json?.data ?? []).find((c) => c.id === convId)?.unreadCount === 0, 'reading the thread marks messages read (unread 0)')

  // buyer socket armed BEFORE the seller's reply
  const tokB = await buyer('GET', `/api/realtime/room-token?room=user:${buyerUserId}`)
  const sockB = io('http://127.0.0.1:3005', { transports: ['websocket'] })
  sockB.emit('subscribe', { room: `user:${buyerUserId}`, token: tokB.json.token })
  ok(Boolean(await waitForEvent(sockB, 'subscribe:ok')), 'buyer joined user:<id> room')

  const liveBuyer = waitForEvent(sockB, 'notification:new')
  const m2 = await seller('POST', `/api/chat/conversations/${convId}/messages`, { messageText: 'Yes — 480 per carton for 500 pcs.', replyToId: m1.json?.data?.id })
  ok(m2.status === 201, 'supplier replied with a real replyTo')
  const pushB = await liveBuyer
  ok(pushB?.type === 'chat' && /480 per carton/.test(pushB?.message ?? ''), "LIVE: buyer's user room got the reply push with the preview")

  // list BEFORE reading the thread: the unread badge must still be live
  const bList = await buyer('GET', '/api/chat/conversations')
  const bConv = (bList.json?.data ?? []).find((c) => c.id === convId)
  ok(bConv?.otherPartyName?.startsWith('QA88 Shop'), "buyer list shows the seller's REAL company name")
  ok(bConv?.unreadCount === 1 && bConv?.messageCount === 2, 'buyer sees unread 1 of 2 total messages')

  const bMsgs = await buyer('GET', `/api/chat/conversations/${convId}/messages`)
  const lastMsg = (bMsgs.json?.data ?? []).at(-1)
  ok(lastMsg?.replyTo?.id === m1.json?.data?.id && Boolean(lastMsg?.replyTo?.senderName), 'reply resolution carries the quoted message + sender name')
  ok((bMsgs.json?.data ?? []).every((m) => m.senderName && m.senderName !== 'Unknown'), 'every message carries a resolved sender name')
  const bList2 = await buyer('GET', '/api/chat/conversations')
  ok((bList2.json?.data ?? []).find((c) => c.id === convId)?.unreadCount === 0, 'after reading the thread the buyer badge drops to 0')

  sockS.close(); sockB.close()
  console.log(`\n=== t88: ${PASS} pass / ${FAIL} fail ===`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('DRILL CRASH:', e); await db.$disconnect(); process.exit(1) })
