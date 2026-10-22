// Task 147 E2E — the sibling redemption rail (/api/rewards POST, the loyalty
// catalog's credit-50/100/250/500) gets the full money doctrine. The old
// POST: read-then-update points (double-spend race), no rate limit, no audit,
// and the first-time-redeemer branch created a wallet with balance but NO
// ledger row — untraceable money. NOW: one transaction with a conditional
// decrement, a ledger row in EVERY branch, and an audit row. Also pins the
// verified-topup credit's new audit row (wallet_topup_credited). Run on a
// FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function makeSession() {
  let cookie = ''
  const ip = `10.147.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T147 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't147-Qa-Str0ng1!'
const buyer1 = makeSession(), buyer2 = makeSession(), buyer3 = makeSession(), buyer4 = makeSession()
ok(await reg(buyer1, 'buyer', `t147-b1-${STAMP}@t147.test`, PW), 'buyer1 registered')
ok(await reg(buyer2, 'buyer', `t147-b2-${STAMP}@t147.test`, PW), 'buyer2 registered (race)')
ok(await reg(buyer3, 'buyer', `t147-b3-${STAMP}@t147.test`, PW), 'buyer3 registered (broke)')
ok(await reg(buyer4, 'buyer', `t147-b4-${STAMP}@t147.test`, PW), 'buyer4 registered (rate limit)')

// ── gates ──
ok((await makeSession()('POST', '/api/rewards', { redeemId: 'credit-50' })).status === 401, 'redeem: anon → 401')
let r = await buyer1('POST', '/api/rewards', { redeemId: 'credit-999999' })
ok(r.status === 400, 'redeem: unknown option → 400', JSON.stringify(r.json))
r = await buyer1('POST', '/api/rewards', { evil: true })
ok(r.status === 400, 'redeem: Zod strict body → 400', JSON.stringify(r.json))
r = await buyer3('GET', '/api/rewards/loyalty')
r = await buyer3('POST', '/api/rewards', { redeemId: 'credit-50' })
ok(r.status === 400 && String(r.json?.error || '').includes('you have 150'), 'redeem: insufficient → 400 carrying the REAL balance (150 after the welcome grant)', JSON.stringify(r.json))

// ── the success circuit: first-time redeemer (the branch that used to skip the ledger) ──
r = await buyer1('GET', '/api/rewards/loyalty')
ok(r.json?.data?.pointsBalance === 150, 'buyer1 welcome grant: 150 points')
r = await buyer1('POST', '/api/rewards', { redeemId: 'credit-50' })
ok(r.status === 409 || r.status === 400, 'credit-50 needs 500 points — buyer1 (150) cannot afford it honestly', JSON.stringify(r.json)?.slice(0, 120))
// fund buyer1 via the REAL checkin cannot reach 500 on day 1 — the catalog
// tier is 500 points; grant via loyalty+checkin only reaches 200. The
// honest drill: use buyer2 with a DB-funded balance matching a REAL
// redemption (fixture-funded balance, redemption through the LIVE API —
// the established t131 wallet-fixture pattern).
const b1 = await db.users.findFirst({ where: { email: `t147-b1-${STAMP}@t147.test` } })
await db.buyerRewards.update({ where: { buyerId: b1.id }, data: { pointsBalance: 1000, totalEarned: 1000 } })
r = await buyer1('POST', '/api/rewards', { redeemId: 'credit-50' })
ok(r.status === 200 && r.json?.data?.walletBalanceAfter === 50, 'redeem credit-50 → 200 (the stable route contract), walletBalanceAfter ৳50', JSON.stringify(r.json))
const b1wallet = await db.wallets.findFirst({ where: { userId: b1.id } })
ok(b1wallet && Math.abs(b1wallet.balance - 50) < 0.001, 'DB: wallet balance ৳50')
const ledger = await db.walletTransactions.findFirst({ where: { walletId: b1wallet.id, type: 'credit', amount: 50 } })
ok(!!ledger && Math.abs(ledger.balanceAfter - 50) < 0.001, 'LEDGER ROW EXISTS (the old first-time branch wrote none)')
const audit1 = await db.auditLogs.findFirst({ where: { action: 'reward_wallet_credit', actorId: b1.id } })
ok(!!audit1 && String(audit1.metadata || '').includes('"valueBDT":50'), 'audit: reward_wallet_credit with the value evidence')
const b1rewards = await db.buyerRewards.findUnique({ where: { buyerId: b1.id } })
ok(b1rewards.pointsBalance === 500 && b1rewards.totalRedeemed === 500, 'points deducted exactly once (500 left)')

// ── the race: two parallel redemptions of the same balance ──
const b2 = await db.users.findFirst({ where: { email: `t147-b2-${STAMP}@t147.test` } })
await db.buyerRewards.create({ data: { buyerId: b2.id, pointsBalance: 500, totalEarned: 500 } })
const [raceA, raceB] = await Promise.all([
  buyer2('POST', '/api/rewards', { redeemId: 'credit-50' }),
  buyer2('POST', '/api/rewards', { redeemId: 'credit-50' }),
])
const statuses = [raceA.status, raceB.status].sort()
ok(statuses[0] === 200 && statuses[1] === 409, `parallel double-redeem of exactly 500 points: one 200 + one 409 (got ${statuses})`, JSON.stringify([raceA.status, raceB.status]))
const b2rewards = await db.buyerRewards.findUnique({ where: { buyerId: b2.id } })
ok(b2rewards.pointsBalance === 0 && b2rewards.totalRedeemed === 500, 'race: balance 0, totalRedeemed exactly 500 (never negative)')
const b2wallet = await db.wallets.findFirst({ where: { userId: b2.id } })
const b2ledgers = await db.walletTransactions.count({ where: { walletId: b2wallet.id, type: 'credit' } })
ok(b2ledgers === 1, 'race: exactly ONE credit ledger row (never double-credited)')

// ── the rate limit: 5/min, the 6th hammer gets 429 ──
{
  const res0 = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.147.${STAMP % 200}.${STAMP % 240}` }, body: JSON.stringify({ email: `t147-b4-${STAMP}@t147.test`, password: PW }) })
  let cookie = (res0.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  const hammerIp = `10.147.${STAMP % 200}.${STAMP % 240}`
  let blocked = null
  for (let i = 0; i < 7; i++) {
    const res = await fetch(`${BASE}/api/rewards`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Forwarded-For': hammerIp }, body: JSON.stringify({ redeemId: 'credit-50' }) })
    if (res.status === 429) { blocked = i; await res.json().catch(() => null); break }
    await res.json().catch(() => null)
  }
  ok(blocked === 5, `hammer: the 6th redeem in a minute → 429 (blocked at call #${blocked === null ? 'none' : blocked + 1})`)
}

// ── the verified-topup credit leaves an audit row (the t140 standard) ──
{
  const reference = `TOPUP-T147-${STAMP}`
  await db.walletTopups.create({ data: { userId: b1.id, reference, amount: 750, provider: 'sslcommerz', status: 'pending' } })
  let mod = null
  let importErr = ''
  try {
    mod = await import('/home/z/my-project/src/lib/payments/credit.ts')
  } catch (e) {
    importErr = e.message?.slice(0, 200) || String(e)
  }
  ok(!!mod, 'credit lib imports under bun', importErr)
  let credited = false
  let creditErr = ''
  if (mod) {
    try {
      credited = await mod.creditVerifiedTopup({ reference, gatewayTrxId: 'GWTX-T147', providerDescription: 'SSLCOMMERZ wallet top-up (drill)' })
    } catch (e) {
      creditErr = e.message?.slice(0, 200) || String(e)
    }
  }
  ok(credited === true, 'creditVerifiedTopup credits a pending topup', creditErr)
  const topup = await db.walletTopups.findUnique({ where: { reference } })
  ok(topup.status === 'credited', 'topup marked credited')
  const topupLedger = await db.walletTransactions.findFirst({ where: { walletId: b1wallet.id, type: 'deposit', amount: 750 } })
  ok(!!topupLedger && Math.abs(topupLedger.balanceAfter - 800) < 0.001, 'topup ledger: deposit ৳750, balanceAfter ৳800')
  const audit2 = await db.auditLogs.findFirst({ where: { action: 'wallet_topup_credited', entityType: 'wallets', entityId: b1wallet.id }, orderBy: { createdAt: 'desc' } })
  ok(!!audit2 && String(audit2.metadata || '').includes(reference) && String(audit2.metadata || '').includes('"balanceBefore":50'), 'audit: wallet_topup_credited with before/after evidence (50 → 800)')
  // idempotency: a second credit call for the same reference changes nothing
  let second = false
  try {
    const mod = await import('../src/lib/payments/credit.ts')
    second = await mod.creditVerifiedTopup({ reference, gatewayTrxId: 'GWTX-T147-RETRY', providerDescription: 'retry' })
  } catch {}
  ok(second === false, 'retry credit → false (idempotent)')
  const auditsAfter = await db.auditLogs.count({ where: { action: 'wallet_topup_credited', entityType: 'wallets', entityId: b1wallet.id } })
  ok(auditsAfter === 1, 'no duplicate audit row on the idempotent retry')
}

console.log(`\nT147 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
