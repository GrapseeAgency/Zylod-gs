// Task 151 E2E — the abuse-valuable mutation rails get their throttles:
// reviews-create 5/min (fake social proof), coupons-claim 10/min (stock
// sniping), price-alerts-create + stock-alerts-create 10/min (notification
// floods). Each hammer must trip on the POST — and the GET list endpoints
// must stay unthrottled (a prior mis-wire put two gates inside the GETs; the
// drill pins the correct side). Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't151-Qa-Str0ng1!'

async function makeBuyerSession(emailLocal, ipLast) {
  let cookie = ''
  const ip = `10.151.${STAMP % 200}.${ipLast}`
  const call = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
    return { status: res.status, json: await res.json().catch(() => null) }
  }
  const payload = { userType: 'buyer', authProvider: 'email', email: `${emailLocal}-${STAMP}@t151.test`, password: PW, fullName: 'T151 buyer' }
  for (let a = 0; a < 4; a++) {
    const r = await call('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) break
    await sleep(3000)
  }
  return call
}

function hammer(sessionCookie, ip, path, body, limit) {
  return (async () => {
    let blocked = null
    for (let i = 0; i < limit + 3; i++) {
      const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: sessionCookie, 'X-Forwarded-For': ip }, body: JSON.stringify(body) })
      if (res.status === 429) { blocked = i; await res.json().catch(() => null); break }
      await res.json().catch(() => null)
    }
    return blocked
  })()
}

async function main() {
  const buyer = await makeBuyerSession(`t151-b1`, 11)
  ok(buyer !== null, 'buyer registered')

  // login cookies for the raw hammers (each rail its own IP bucket)
  async function loginCookie(emailLocal, ipLast) {
    const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.151.${STAMP % 200}.${ipLast}` }, body: JSON.stringify({ email: `${emailLocal}-${STAMP}@t151.test`, password: PW }) })
    return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  }
  const cookie = await loginCookie('t151-b1', 11)
  ok(!!cookie, 'session cookie for the raw hammers')

  // ── reviews: 5/min, the 6th → 429 ──
  let blocked = await hammer(cookie, `10.151.${STAMP % 200}.11`, '/api/reviews', { productId: 'phantom', rating: 6 }, 5)
  ok(blocked === 5, `reviews: the 6th POST in a minute → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)

  // ── coupons/claim: 10/min, the 11th → 429 ──
  blocked = await hammer(cookie, `10.151.${STAMP % 200}.12`, '/api/coupons/claim', { code: 'NOPE151' }, 10)
  ok(blocked === 10, `coupons/claim: the 11th POST in a minute → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)

  // ── price-alerts: 10/min on the POST, GET unthrottled ──
  blocked = await hammer(cookie, `10.151.${STAMP % 200}.13`, '/api/price-alerts', { productId: 'phantom', targetPrice: -5 }, 10)
  ok(blocked === 10, `price-alerts: the 11th POST in a minute → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)
  const g1 = await fetch(`${BASE}/api/price-alerts`, { headers: { Cookie: cookie, 'X-Forwarded-For': `10.151.${STAMP % 200}.13` } })
  ok(g1.status === 200, 'price-alerts GET stays open after the POST hammer (the mis-wire class, pinned)')

  // ── stock-alerts: 10/min on the POST, GET unthrottled ──
  blocked = await hammer(cookie, `10.151.${STAMP % 200}.14`, '/api/stock-alerts', { productId: 'phantom' }, 10)
  ok(blocked === 10, `stock-alerts: the 11th POST in a minute → 429 (blocked at #${blocked === null ? 'none' : blocked + 1})`)
  const g2 = await fetch(`${BASE}/api/stock-alerts`, { headers: { Cookie: cookie, 'X-Forwarded-For': `10.151.${STAMP % 200}.14` } })
  ok(g2.status === 200, 'stock-alerts GET stays open after the POST hammer')

  console.log(`\nT151 RESULT: ${PASS} pass / ${FAIL} fail`)
  await db.$disconnect()
  process.exitCode = FAIL === 0 ? 0 : 1
}
main().catch((e) => { console.error(e.message); process.exit(1) })
