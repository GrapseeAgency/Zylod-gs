// Task 161 E2E — the coupon CLAIM rail hardened (audit unit 19). The old
// claim was check-then-create OUTSIDE any transaction (two concurrent claims
// minted duplicate active vouchers — no DB unique backstop on userCoupons),
// never enforced coupons.usageLimit at claim time, and ignored the Task 143
// personal-voucher binding (another buyer could collect your earned code).
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't161-Qa-Str0ng1!'

function makeSession() {
  let cookie = ''
  const ip = `10.161.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

async function reg(session, userType, local) {
  const payload = { userType, authProvider: 'email', email: `${local}-${STAMP}@t161.test`, password: PW, fullName: 'T161 ' + userType }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email: payload.email, password: PW }); return l.status === 200 || l.status === 201 }
    await sleep(3000)
  }
  return false
}

async function main() {
  const admin = makeSession(), buyerA = makeSession(), buyerB = makeSession(), anon = makeSession()
  ok(await reg(admin, 'admin', 't161-adm'), 'admin registered')
  ok(await reg(buyerA, 'buyer', 't161-a'), 'buyer A registered')
  ok(await reg(buyerB, 'buyer', 't161-b'), 'buyer B registered')

  const buyerAUser = await db.users.findFirst({ where: { email: { contains: 't161-a-' } } })
  const buyerBUser = await db.users.findFirst({ where: { email: { contains: 't161-b-' } } })

  // ── gates ──
  const anonClaim = await anon('POST', '/api/coupons/claim', { code: 'WHATEVER' })
  ok(anonClaim.status === 401, 'anonymous claim → 401', `got ${anonClaim.status}`)
  const junk = await buyerA('POST', '/api/coupons/claim', { code: 'X1', hackerField: true })
  ok(junk.status === 400, 'unknown body field → 400 (strict keys)', JSON.stringify(junk.json)?.slice(0, 100))

  // ── public coupon, no usage cap ──
  const c1 = await admin('POST', '/api/coupons', {
    code: `T161PUB${STAMP}`, discountType: 'percentage', discountPercent: 10,
    validUntil: new Date(Date.now() + 86400000).toISOString(),
  })
  ok(c1.status === 201, 'admin created public 10% coupon (no cap)', `got ${c1.status}`)

  const a1 = await buyerA('POST', '/api/coupons/claim', { code: `T161PUB${STAMP}` })
  ok(a1.status === 201, 'buyer A claimed by code → 201', JSON.stringify(a1.json)?.slice(0, 100))
  const a2 = await buyerA('POST', '/api/coupons/claim', { code: `T161PUB${STAMP}` })
  ok(a2.status === 409, 'buyer A second claim → 409 (no duplicate)')
  const aRows = await db.userCoupons.count({ where: { userId: buyerAUser.id, couponId: c1.json?.data?.id ?? c1.json?.id } })
  ok(aRows === 1, `buyer A vault has exactly 1 row (got ${aRows})`)

  // ── THE TOCTOU STORM: 6 concurrent claims by ONE buyer — one voucher only ──
  const storm = await Promise.all(Array.from({ length: 6 }, () =>
    buyerB('POST', '/api/coupons/claim', { code: `T161PUB${STAMP}` })
  ))
  const storm201 = storm.filter((r) => r.status === 201).length
  const storm409 = storm.filter((r) => r.status === 409).length
  ok(storm201 === 1, `exactly one claim won the storm (${storm201}×201, ${storm409}×409, ${6 - storm201 - storm409} other)`)
  ok(6 - storm201 - storm409 === 0, 'ZERO 5xx under the concurrent storm (no transaction-timeout errors)', JSON.stringify(storm.map((r) => r.status)))
  const bRows = await db.userCoupons.count({ where: { userId: buyerBUser.id, couponId: c1.json?.data?.id ?? c1.json?.id } })
  ok(bRows === 1, `NO duplicate voucher: buyer B vault has exactly 1 row after 6 concurrent claims (got ${bRows})`)
  const c1Fresh = await db.coupons.findUnique({ where: { code: `T161PUB${STAMP}` } })
  ok(c1Fresh?.usedCount === 2, `usedCount advanced exactly 2 (A + B), not 7 (got ${c1Fresh?.usedCount})`)

  // ── usageLimit enforced AT CLAIM ──
  const c2 = await admin('POST', '/api/coupons', {
    code: `T161CAP${STAMP}`, discountType: 'fixed', discountPercent: 50,
    usageLimit: 1, validUntil: new Date(Date.now() + 86400000).toISOString(),
  })
  ok(c2.status === 201, 'admin created capped coupon (usageLimit 1)')
  const capA = await buyerA('POST', '/api/coupons/claim', { code: `T161CAP${STAMP}` })
  ok(capA.status === 201, 'buyer A took the only slot → 201')
  const capB = await buyerB('POST', '/api/coupons/claim', { code: `T161CAP${STAMP}` })
  ok(capB.status === 409, 'buyer B refused at claim → 409 (limit reached)', JSON.stringify(capB.json)?.slice(0, 120))
  const capBRows = await db.userCoupons.count({ where: { userId: buyerBUser.id, couponId: c2.json?.data?.id ?? c2.json?.id } })
  ok(capBRows === 0, 'no vault row for the refused buyer')

  // ── Task 143 personal binding enforced at claim ──
  const c3 = await admin('POST', '/api/coupons', {
    code: `T161OWN${STAMP}`, discountType: 'percentage', discountPercent: 25,
    validUntil: new Date(Date.now() + 86400000).toISOString(),
  })
  const c3Id = c3.json?.data?.id ?? c3.json?.id
  await db.coupons.update({ where: { id: c3Id }, data: { userId: buyerAUser.id } })
  const steal = await buyerB('POST', '/api/coupons/claim', { code: `T161OWN${STAMP}` })
  ok(steal.status === 403, 'another buyer CANNOT collect a personal voucher code → 403', JSON.stringify(steal.json)?.slice(0, 120))
  const stealRows = await db.userCoupons.count({ where: { userId: buyerBUser.id, couponId: c3Id } })
  ok(stealRows === 0, 'no stolen vault row exists')
  const own = await buyerA('POST', '/api/coupons/claim', { code: `T161OWN${STAMP}` })
  ok(own.status === 201, 'the rightful owner still claims their voucher → 201')

  // ── GET /api/coupons scopes personal vouchers (Task 143 on the list rail) ──
  const anonList = await anon('GET', '/api/coupons?limit=50')
  const anonCodes = (anonList.json?.data ?? []).map((c) => c.code)
  ok(anonList.status === 200 && !anonCodes.includes(`T161OWN${STAMP}`), 'anonymous list EXCLUDES personal vouchers', JSON.stringify(anonCodes))
  const bList = await buyerB('GET', '/api/coupons?limit=50')
  const bCodes = (bList.json?.data ?? []).map((c) => c.code)
  ok(!bCodes.includes(`T161OWN${STAMP}`), 'another buyer’s list EXCLUDES foreign personal vouchers', JSON.stringify(bCodes))
  const aList = await buyerA('GET', '/api/coupons?limit=50')
  const aCodes = (aList.json?.data ?? []).map((c) => c.code)
  ok(aCodes.includes(`T161OWN${STAMP}`), 'the owner’s list INCLUDES their personal voucher', JSON.stringify(aCodes))

  console.log(`\nT161 RESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('DRILL CRASH:', e); await db.$disconnect().catch(() => null); process.exit(1) })
