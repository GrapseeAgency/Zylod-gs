// Task 134 E2E — the buyer↔supplier chat circuit: conversation create-or-get
// (Task 88 gates), messages GET/POST (participant-gated), the inbox list, and
// the mark-read ordering fix. The REAL UI defect fixed: the mobile PDP's
// "Message Supplier" navigated with a supplierProfile id as conversationId.
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function makeSession() {
  let cookie = ''
  const ip = `10.131.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    for (let a = 0; a < 7; a++) {
      const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
      for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
      const json = await res.json().catch(() => null)
      if (res.status !== 429) return { status: res.status, json }
      await sleep(10_000 * (a + 1))
    }
    throw new Error('429 exhausted: ' + path)
  }
}
async function reg(session, userType, email, pw, company) {
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T134 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't134-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), buyer = makeSession(), outsider = makeSession(), buyer2 = makeSession()
ok(await reg(admin, 'admin', `t134-admin-${STAMP}@t134.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t134-seller-${STAMP}@t134.test`, PW, 'T134 Chat Depot'), 'seller registered')
ok(await reg(buyer, 'buyer', `t134-buyer-${STAMP}@t134.test`, PW), 'buyer registered')
ok(await reg(buyer2, 'buyer', `t134-buyer2-${STAMP}@t134.test`, PW), 'buyer2 registered')
ok(await reg(outsider, 'buyer', `t134-outsider-${STAMP}@t134.test`, PW), 'outsider buyer registered')

let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
ok(Boolean(categoryId), 'category ready (Prisma-authoritative)')
const p = await seller('POST', '/api/supplier/products', { name: 'T134 Raincoat', description: 'drill', categoryId, unit: 'pcs', moq: 10, basePrice: 450, stockQuantity: 600, priceTiers: [{ minQty: 10, pricePerUnit: 450 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
const productId = p.json?.data?.id ?? p.json?.id
ok(Boolean(productId), 'product created')
await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T134' })

const sellerUser = await db.users.findUnique({ where: { email: `t134-seller-${STAMP}@t134.test` }, select: { id: true } })

// ── conversation create-or-get ──
ok((await makeSession()('POST', '/api/chat/conversations', { supplierId: sellerUser.id, productId })).status === 401, 'create: anon → 401')
ok((await buyer('POST', '/api/chat/conversations', {})).status === 400, 'create: no supplierId → 400')
ok((await buyer('POST', '/api/chat/conversations', { supplierId: 'nonexistent999' })).status === 400, 'create: phantom supplier → 400')
ok((await buyer('POST', '/api/chat/conversations', { supplierId: sellerUser.id, productId: 'nonexistent999' })).status === 400, 'create: phantom product → 400')
let r = await buyer('POST', '/api/chat/conversations', { supplierId: sellerUser.id, productId })
const convId = r.json?.data?.id
ok(r.status === 201 && Boolean(convId), 'create: real buyer+supplier+product → conversation', JSON.stringify(r.json)?.slice(0, 160))
r = await buyer('POST', '/api/chat/conversations', { supplierId: sellerUser.id, productId })
ok((r.status === 200 || r.status === 201) && r.json?.data?.id === convId, 'create-or-get: repeat returns the SAME conversation (never stacks)')
r = await buyer2('POST', '/api/chat/conversations', { supplierId: sellerUser.id, productId })
ok(r.status === 201 && r.json?.data?.id !== convId, 'create: a DIFFERENT buyer gets a different conversation')

// ── messages ──
ok((await makeSession()('POST', `/api/chat/conversations/${convId}/messages`, { messageText: 'hi' })).status === 401, 'messages POST: anon → 401')
r = await outsider('POST', `/api/chat/conversations/${convId}/messages`, { messageText: 'let me in' })
ok(r.status === 403, 'messages POST: non-participant → 403')
ok((await buyer('POST', `/api/chat/conversations/${convId}/messages`, {})).status === 400, 'messages POST: empty body → 400')
ok((await buyer('POST', `/api/chat/conversations/${convId}/messages`, { messageText: 'x'.repeat(5001) })).status === 400, 'messages POST: 5001 chars → 400')
r = await buyer('POST', `/api/chat/conversations/${convId}/messages`, { messageText: 'Do you deliver to Chattogram for a 500-unit order?' })
ok(r.status === 201, 'messages POST: buyer message lands')
const msgId = r.json?.data?.id
r = await seller('POST', `/api/chat/conversations/${convId}/messages`, { messageText: 'Yes — nationwide courier, 3-5 days for 500 units.' })
ok(r.status === 201, 'messages POST: supplier reply lands')
// Task 136: the dashboard unread stat must see the unread reply BEFORE the buyer reads.
r = await seller('GET', '/api/supplier/dashboard')
ok(r.json?.data?.storeStats?.messages === 1, 'dashboard: unread stat = 1 while the supplier reply is unread', JSON.stringify(r.json?.data?.storeStats))
// The buyer's UNREAD badge is checked BEFORE the buyer reads the thread
// (reading marks read — the drill order must respect its own assertion).
r = await buyer('GET', '/api/chat/conversations?role=buyer')
const unreadRow = (r.json?.data ?? []).find((c) => c.id === convId)
ok(unreadRow?.unreadCount === 1, 'inbox: buyer has 1 unread (the supplier reply, pre-read)')
r = await seller('GET', `/api/chat/conversations/${convId}/messages`)
ok(r.status === 200 && r.json?.data?.length === 2 && r.json?.data?.[0]?.messageText?.includes('Chattogram'), 'messages GET: both messages, ascending order')
ok(r.json?.data?.[0]?.senderName?.includes('T134 buyer'), 'messages GET: sender names resolved')
r = await buyer('GET', `/api/chat/conversations/${convId}/messages`)
ok(r.json?.data?.every((m) => m.isRead), 'messages GET: reading marks the thread read for the reader')
r = await buyer('GET', '/api/chat/conversations?role=buyer')
const readRow = (r.json?.data ?? []).find((c) => c.id === convId)
ok(readRow?.unreadCount === 0, 'inbox: unread badge clears after reading')

// ── inbox list (chat-list page data) ──
r = await seller('GET', '/api/chat/conversations?role=supplier')
ok(r.status === 200 && r.json?.data?.length === 2, 'inbox: supplier sees 2 conversations (from both buyers)')
const mine = (r.json?.data ?? []).find((c) => c.id === convId)
ok(mine?.otherPartyName?.includes('T134 buyer') && mine?.messageCount === 2 && mine?.unreadCount === 0, 'inbox: row carries other party, messageCount, unread=0 (read)', JSON.stringify(mine)?.slice(0, 200))
r = await buyer('GET', '/api/chat/conversations?role=buyer')
const mineB = (r.json?.data ?? []).find((c) => c.id === convId)
ok(mineB?.unreadCount === 0, 'inbox: buyer unread is 0 after reading')

// Task 136: the seller dashboard's "Unread Messages" stat must count UNREAD
// (was: all messages ever — a lifetime number under an unread label).
r = await seller('GET', '/api/supplier/dashboard')
ok(r.status === 200, 'dashboard: seller dashboard loads')
ok(r.json?.data?.storeStats?.messages === 0, 'dashboard: unread stat is 0 after the buyer read the thread', JSON.stringify(r.json?.data?.storeStats))

console.log(`\nT134 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
