// Task 152 E2E — the final rate-limit coverage tier: EVERY mutating handler in
// the API is now throttled (275/275 per the sweep). This drill pins the wires
// that matter most and the two properties the coverage sweep cannot see:
//   (1) the gate sits AFTER the auth guard (a single unauthenticated request
//       must still see 401, never 429 — 401-first doctrine), and
//   (2) the GET/list endpoints the consoles depend on stay OPEN after a hammer
//       (the t151 mis-wire class must not reappear).
// Covered here: the second reviews path (reviews-product-create — the hole this
// task found), tickets, cart, price-alert item writes, the public gate mode
// (cookie-consent, careers-apply, payments-webhook), and the 401-first order.
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't152-Qa-Str0ng1!'
const IPP = `10.152.${STAMP % 200}.`

async function makeBuyerSession(local, ipLast) {
  let cookie = ''
  const ip = IPP + ipLast
  const call = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
    return { status: res.status, json: await res.json().catch(() => null) }
  }
  const payload = { userType: 'buyer', authProvider: 'email', email: `${local}-${STAMP}@t152.test`, password: PW, fullName: 'T152 buyer' }
  for (let a = 0; a < 4; a++) {
    const r = await call('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) break
    await sleep(3000)
  }
  return call
}

// hammer a path with a session cookie until 429 (or max); returns index of the
// request that tripped (0-based) or null.
async function hammer(method, path, body, cookie, ip, max) {
  for (let i = 0; i < max; i++) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
    const s = res.status
    await res.json().catch(() => null)
    if (s === 429) return i
  }
  return null
}

async function main() {
  // ── 401-FIRST ORDER: one unauthenticated request must see 401, not 429 ──
  {
    const ip = IPP + '1'
    const r1 = await fetch(`${BASE}/api/cart`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: '{}' })
    ok(r1.status === 401, `single unauth POST /api/cart → 401 (gate after guard) [got ${r1.status}]`)
    const r2 = await fetch(`${BASE}/api/wishlist`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: '{}' })
    ok(r2.status === 401, `single unauth POST /api/wishlist → 401 [got ${r2.status}]`)
    const r3 = await fetch(`${BASE}/api/products/phantom/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: '{}' })
    ok(r3.status === 401, `single unauth POST reviews (2nd path) → 401 [got ${r3.status}]`)
  }

  // ── buyer session for the auth'd rails ──
  const buyer = await makeBuyerSession('t152-b1', 2)
  ok(buyer !== null, 'buyer registered')
  const loginRes = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': IPP + '2' }, body: JSON.stringify({ email: `t152-b1-${STAMP}@t152.test`, password: PW }) })
  const cookie = (loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  ok(!!cookie, 'session cookie for the hammers')

  // ── the hole this task found: /api/products/[id]/reviews (2nd write path) ──
  {
    const ip = IPP + '3'
    let blocked = await hammer('POST', '/api/products/phantom/reviews', { rating: 5, comment: 'x' }, cookie, ip, 8)
    ok(blocked === 5, `reviews-product-create: 6th POST → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)
    // the product GET (the PDP's read) stays open after the hammer
    const g = await fetch(`${BASE}/api/products/phantom`, { headers: { 'X-Forwarded-For': ip } })
    ok(g.status !== 429, `GET /api/products/[id] stays open after the hammer [got ${g.status}]`)
  }

  // ── support-tickets-create 5/min ──
  {
    const ip = IPP + '4'
    const blocked = await hammer('POST', '/api/support/tickets', { category: 'general', subject: 't152 drill ticket', description: 'rate limit drill' }, cookie, ip, 8)
    ok(blocked === 5, `support-tickets-create: 6th POST → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)
  }

  // ── cart-add 60/min + GET cart stays open ──
  {
    const ip = IPP + '5'
    const blocked = await hammer('POST', '/api/cart', { productId: 'phantom', quantity: 1 }, cookie, ip, 63)
    ok(blocked === 60, `cart-add: 61st POST → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)
    const g = await fetch(`${BASE}/api/cart`, { headers: { Cookie: cookie, 'X-Forwarded-For': ip } })
    ok(g.status === 200, `GET /api/cart stays open after the hammer (the cart console UX) [got ${g.status}]`)
  }

  // ── price-alerts-item-write (PATCH) 20/min — the t151 straggler ──
  {
    const ip = IPP + '6'
    const blocked = await hammer('PATCH', '/api/price-alerts/phantom', { targetPrice: 100 }, cookie, ip, 23)
    ok(blocked === 20, `price-alerts-item-write PATCH: 21st → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)
    const g = await fetch(`${BASE}/api/price-alerts`, { headers: { Cookie: cookie, 'X-Forwarded-For': ip } })
    ok(g.status === 200, `GET /api/price-alerts stays open after the hammer [got ${g.status}]`)
  }

  // ── PUBLIC gate mode: cookie-consent 30/min (gate as first statement) ──
  {
    const ip = IPP + '7'
    const blocked = await hammer('POST', '/api/legal/cookie-consent', { sessionId: 't152', analyticsAllowed: false, marketingAllowed: false }, null, ip, 33)
    ok(blocked === 30, `cookie-consent: 31st POST → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)
  }

  // ── PUBLIC gate mode: careers-apply 5/min ──
  {
    const ip = IPP + '8'
    const blocked = await hammer('POST', '/api/careers/apply', { jobId: 'phantom', applicantName: 'x', applicantEmail: 'x@x.test' }, null, ip, 8)
    ok(blocked === 5, `careers-apply: 6th POST → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)
  }

  // ── PUBLIC gate mode: payments-webhook 120/min (gate BEFORE the secret check) ──
  {
    const ip = IPP + '9'
    const blocked = await hammer('POST', '/api/payments/webhook', { garbage: true }, null, ip, 123)
    ok(blocked === 120, `payments-webhook: 121st POST → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)
  }

  console.log(`\nT152 RESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('DRILL CRASH:', e); await db.$disconnect().catch(() => null); process.exit(1) })
