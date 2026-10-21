/**
 * Task 119 E2E — THE BUYER WITHDRAWAL RAIL (the OUT half of the buyer
 * wallet, completing the money story Task 118 opened).
 *
 *   A. gates — buyer rail 401-first (anon, supplier, admin-list as buyer)
 *   B. request discipline — no-wallet 404, strict validation, THE HOLD
 *      (request moves nothing), honest over-request 400, holds math
 *   C. admin list — stats/pendingAmount/pending-first/claimant projection
 *   D. decisions — complete debits INSIDE the decision (withdrawal ledger
 *      row with real balanceAfter, reference REQUIRED), reject frees the
 *      hold moving nothing, terminal 409s, no-wallet + insufficient 409s,
 *      audits with real before/after, buyer notifications
 *   E. rail isolation — buyer cannot use the seller route; supplier cannot
 *      use the buyer route; sellerPayouts stays untouched
 *   F. raw DB final audit
 *
 * Run: bun scripts/qa/t119-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
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
  const ip = `10.119.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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

async function registerAndLogin(session, userType, email, password, businessName) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA119 ${userType}`,
    ...(userType === 'supplier' && businessName ? { businessName } : {}),
  }
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
  const PASSWORD = 't119-E2e-Str0ng1!'
  const admin = makeSession(), buyerA = makeSession(), buyerB = makeSession(), supplier = makeSession()
  await registerAndLogin(admin, 'admin', 'qa119-admin@qa.local', PASSWORD)
  await registerAndLogin(buyerA, 'buyer', 'qa119-buyer-a@qa.local', PASSWORD)
  await registerAndLogin(buyerB, 'buyer', 'qa119-buyer-b@qa.local', PASSWORD)
  await registerAndLogin(supplier, 'supplier', 'qa119-supa@qa.local', PASSWORD, 'QA119 Payout Traders')
  console.log('  accounts ready')

  const userA = await db.users.findFirst({ where: { email: 'qa119-buyer-a@qa.local' }, select: { id: true } })
  const userB = await db.users.findFirst({ where: { email: 'qa119-buyer-b@qa.local' }, select: { id: true } })
  ok(Boolean(userA?.id && userB?.id), 'buyer users resolved from real rows')

  console.log('— A. gates —')
  const anon = makeSession()
  const a1 = await anon('POST', '/api/buyer/withdrawals', { amount: 500, method: 'bKash', accountNumber: '01711122233', holderName: 'QA Anon' })
  ok(a1.status === 401, 'withdrawal request without session → 401', `got ${a1.status}`)
  const a2 = await anon('GET', '/api/buyer/withdrawals')
  ok(a2.status === 401, 'withdrawal list without session → 401', `got ${a2.status}`)
  const a3 = await supplier('POST', '/api/buyer/withdrawals', { amount: 500, method: 'bKash', accountNumber: '01711122233', holderName: 'QA Supa' })
  ok(a3.status === 401, 'supplier on the buyer rail → 401 (their rail is /api/wallet/withdraw)', `got ${a3.status}`)
  const a4 = await buyerA('GET', '/api/admin/buyer-payouts')
  ok(a4.status === 401, 'admin list as buyer → 401', `got ${a4.status}`)
  const a5 = await buyerA('PATCH', '/api/admin/buyer-payouts/whatever', { action: 'complete', reference: 'X' })
  ok(a5.status === 401, 'admin decision as buyer → 401', `got ${a5.status}`)

  console.log('— B. request discipline —')
  const b0 = await buyerA('POST', '/api/buyer/withdrawals', { amount: 500, method: 'bKash', accountNumber: '01711122233', holderName: 'QA A' })
  ok(b0.status === 404, 'request with NO wallet → 404 (no auto-create on a money-OUT path)', `got ${b0.status} ${JSON.stringify(b0.json)}`)
  // Fixture: a real wallet for buyer A with ৳3,000 (the t118 drill's own
  // doctrine would have credited this through a verified topup).
  await db.wallets.create({ data: { userId: userA.id, balance: 3000, currency: 'BDT' } })
  const b1 = await buyerA('POST', '/api/buyer/withdrawals', { amount: 10, method: 'bKash', accountNumber: '01711122233', holderName: 'QA A' })
  ok(b1.status === 400 && /Minimum withdrawal is ৳50/.test(b1.json?.error ?? ''), 'amount below ৳50 → 400', `got ${b1.status} ${b1.json?.error}`)
  const b2 = await buyerA('POST', '/api/buyer/withdrawals', { amount: 500, method: 'bKash', holderName: 'QA A' })
  ok(b2.status === 400, 'missing accountNumber → 400', `got ${b2.status}`)
  const b3 = await buyerA('POST', '/api/buyer/withdrawals', { amount: 500, method: 'PayPal', accountNumber: '01711122233', holderName: 'QA A' })
  ok(b3.status === 400, 'unsupported method → 400', `got ${b3.status}`)
  const b4 = await buyerA('POST', '/api/buyer/withdrawals', { amount: 500, method: 'bKash', accountNumber: '01711122233', holderName: 'QA A', hijack: 1 })
  ok(b4.status === 400, 'unknown key (strict) → 400', `got ${b4.status}`)
  const txBefore = await db.walletTransactions.count({})
  const walletsBalBefore = (await db.wallets.findFirst({ where: { userId: userA.id } })).balance
  const b5 = await buyerA('POST', '/api/buyer/withdrawals', { amount: 1200, method: 'bKash', accountNumber: '01711122233', holderName: 'QA A Trader' })
  ok(b5.status === 201 && b5.json?.data?.status === 'pending', 'valid request → 201 pending', `got ${b5.status} ${JSON.stringify(b5.json)}`)
  ok(b5.json?.data?.availableAfter === 1800 && b5.json?.data?.onHoldAfter === 1200, 'response spells the honest hold math (available 1800)')
  const walletsBalAfter = (await db.wallets.findFirst({ where: { userId: userA.id } })).balance
  const txAfter = await db.walletTransactions.count({})
  ok(walletsBalBefore === 3000 && walletsBalAfter === 3000, 'THE HOLD: wallet balance untouched by the request (3000 → 3000)')
  ok(txBefore === 0 && txAfter === 0, 'NO ledger row written by the request')
  const reqAudit = await db.auditLogs.findFirst({ where: { action: 'buyer_payout_requested', entityType: 'buyerPayouts' } })
  ok(Boolean(reqAudit), 'auditLogs buyer_payout_requested written')
  const payout1 = await db.buyerPayouts.findFirst({ where: { userId: userA.id, status: 'pending' } })
  ok(payout1?.destination === 'bKash · 01711122233 · QA A Trader', 'destination recorded verbatim', payout1?.destination)
  const l1 = await buyerA('GET', '/api/buyer/withdrawals')
  ok(l1.json?.data?.balance === 3000 && l1.json?.data?.onHold === 1200 && l1.json?.data?.available === 1800, 'rail view: balance 3000 / onHold 1200 / available 1800')
  const b6 = await buyerA('POST', '/api/buyer/withdrawals', { amount: 2000, method: 'bank', bankName: 'City Bank PLC', accountNumber: '15022334455', holderName: 'QA A Trader' })
  ok(b6.status === 400 && /exceeds the ৳1,800 available/.test(b6.json?.error ?? ''), 'over-request beyond the hold-honest available → 400 with real numbers', `got ${b6.status} ${b6.json?.error}`)
  const b7 = await buyerA('POST', '/api/buyer/withdrawals', { amount: 800, method: 'bank', bankName: 'City Bank PLC', accountNumber: '15022334455', holderName: 'QA A Trader' })
  ok(b7.status === 201, 'second request within available → 201', `got ${b7.status} ${JSON.stringify(b7.json?.data)}`)
  const payout2 = await db.buyerPayouts.findFirst({ where: { userId: userA.id, status: 'pending', method: 'bank_transfer' } })
  ok(Boolean(payout2?.id), 'second pending row exists (bank_transfer normalized)')
  const l2 = await buyerA('GET', '/api/buyer/withdrawals')
  ok(l2.json?.data?.onHold === 2000 && l2.json?.data?.available === 1000, 'holds accumulate honestly (onHold 2000 / available 1000)')

  console.log('— C. admin list —')
  const c0 = await admin('GET', '/api/admin/buyer-payouts?status=bogus')
  ok(c0.status === 400, '?status=bogus → 400', `got ${c0.status}`)
  const c1 = await admin('GET', '/api/admin/buyer-payouts?status=pending')
  ok(c1.status === 200 && (c1.json?.data ?? []).length === 2, 'pending list holds both real requests', `got ${c1.status}`)
  ok(c1.json?.data?.[0]?.claimant?.email === 'qa119-buyer-a@qa.local', 'claimant email resolved for finance')
  ok(typeof c1.json?.data?.[0]?.claimant?.displayName === 'string', 'claimant displayName resolved')
  const cAll = await admin('GET', '/api/admin/buyer-payouts')
  ok(cAll.json?.stats?.pending === 2 && cAll.json?.stats?.total === 2, 'stats are the real groupBy (pending 2 / total 2)')
  ok(cAll.json?.stats?.pendingAmount === 2000, 'pendingAmount is the real _sum (2000 on hold)')
  const c2 = await admin('GET', '/api/admin/buyer-payouts?status=completed')
  ok((c2.json?.data ?? []).length === 0, 'completed tab honestly empty before any decision')

  console.log('— D. decisions —')
  const d0 = await admin('PATCH', `/api/admin/buyer-payouts/${payout1.id}`, { action: 'complete' })
  ok(d0.status === 400 && /Transfer reference is required/.test(d0.json?.error ?? ''), 'complete WITHOUT reference → 400 (no untraceable money claims)', `got ${d0.status} ${d0.json?.error}`)
  const d0b = await admin('PATCH', `/api/admin/buyer-payouts/${payout1.id}`, { action: 'settle' })
  ok(d0b.status === 400, 'invalid action → 400', `got ${d0b.status}`)
  const d1 = await admin('PATCH', `/api/admin/buyer-payouts/${payout1.id}`, { action: 'complete', reference: 'BKQA119SETTLE1', note: 'merchant payout batch 118' })
  ok(d1.status === 200 && /debited/.test(d1.json?.message ?? ''), 'complete → 200 settled', `got ${d1.status} ${JSON.stringify(d1.json)}`)
  const settled = await db.buyerPayouts.findUnique({ where: { id: payout1.id } })
  ok(settled?.status === 'completed' && settled?.reference === 'BKQA119SETTLE1' && settled?.processedAt !== null, 'payout completed with the reference on record')
  const walletAfterSettle = await db.wallets.findFirst({ where: { userId: userA.id } })
  ok(walletAfterSettle.balance === 1800, 'wallet REALLY debited: 3000 → 1800', `got ${walletAfterSettle.balance}`)
  const settleTx = await db.walletTransactions.findFirst({ where: { walletId: walletAfterSettle.id, type: 'withdrawal' } })
  ok(settleTx?.amount === -1200 && settleTx?.balanceAfter === 1800, 'withdrawal ledger row: -1200, balanceAfter 1800')
  const settleAudit = await db.auditLogs.findFirst({ where: { action: 'buyer_payout_completed', entityId: payout1.id } })
  const settleMeta = settleAudit ? JSON.parse(settleAudit.metadata) : {}
  ok(settleMeta.before?.walletBalance === 3000 && settleMeta.after?.walletBalance === 1800 && settleMeta.actorType === 'admin',
    'settle audit: real before/after (3000 → 1800) + actorType admin')
  const settleNotif = await db.notifications.findFirst({ where: { userId: userA.id, relatedEntityId: payout1.id } })
  ok(Boolean(settleNotif) && /settled/i.test(settleNotif?.title ?? ''), 'buyer got a REAL settled notification row')
  const d2 = await admin('PATCH', `/api/admin/buyer-payouts/${payout1.id}`, { action: 'complete', reference: 'BKQA119AGAIN' })
  ok(d2.status === 409 && /decisions are terminal/.test(d2.json?.error ?? ''), 're-decide → 409 terminal', `got ${d2.status} ${d2.json?.error}`)
  const l3 = await buyerA('GET', '/api/buyer/withdrawals')
  ok(l3.json?.data?.balance === 1800 && l3.json?.data?.onHold === 800 && l3.json?.data?.available === 1000, 'rail view after settle: 1800 / 800 / 1000')
  const d3 = await admin('PATCH', `/api/admin/buyer-payouts/${payout2.id}`, { action: 'reject', note: 'bank name mismatch' })
  ok(d3.status === 200, 'reject → 200', `got ${d3.status} ${JSON.stringify(d3.json)}`)
  const rejected = await db.buyerPayouts.findUnique({ where: { id: payout2.id } })
  ok(rejected?.status === 'failed' && rejected?.processedAt !== null, 'payout honestly failed with processedAt')
  const walletAfterReject = await db.wallets.findFirst({ where: { userId: userA.id } })
  ok(walletAfterReject.balance === 1800, 'REJECT moved NOTHING (balance still 1800)')
  const rejectAudit = await db.auditLogs.findFirst({ where: { action: 'buyer_payout_rejected', entityId: payout2.id } })
  const rejectMeta = rejectAudit ? JSON.parse(rejectAudit.metadata) : {}
  ok(rejectMeta.after?.walletBalance === 1800 && rejectMeta.actorType === 'admin', 'reject audit: balance unchanged 1800, actorType admin')
  const rejectNotif = await db.notifications.findFirst({ where: { userId: userA.id, relatedEntityId: payout2.id } })
  ok(Boolean(rejectNotif) && /rejected/i.test(rejectNotif?.title ?? ''), 'buyer got a REAL rejected notification row')
  const l4 = await buyerA('GET', '/api/buyer/withdrawals')
  ok(l4.json?.data?.onHold === 0 && l4.json?.data?.available === 1800, 'hold freed on reject: onHold 0 / available 1800')
  const d4 = await admin('PATCH', '/api/admin/buyer-payouts/nonexistent', { action: 'reject' })
  ok(d4.status === 404, 'unknown payout → 404', `got ${d4.status}`)
  const d5 = await admin('PATCH', `/api/admin/buyer-payouts/${payout2.id}`, { action: 'reject' })
  ok(d5.status === 409 && /already decided/.test(d5.json?.error ?? ''), 're-reject → 409 terminal', `got ${d5.status} ${d5.json?.error}`)
  // Guard rails: complete against a wallet-less buyer and an oversized row
  // (both crafted straight in DB — the routes' own holds math prevents the
  // oversized case through the API; the guard must hold even for drift).
  await db.buyerPayouts.create({ data: { userId: userB.id, amount: 500, method: 'bkash', status: 'pending', destination: 'bKash · 016xxx · QA B' } })
  const payoutB = await db.buyerPayouts.findFirst({ where: { userId: userB.id } })
  const d6 = await admin('PATCH', `/api/admin/buyer-payouts/${payoutB.id}`, { action: 'complete', reference: 'BKQA119NOWALLET' })
  ok(d6.status === 409 && /no wallet to debit/.test(d6.json?.error ?? ''), 'complete against a wallet-less buyer → 409', `got ${d6.status} ${d6.json?.error}`)
  await db.buyerPayouts.create({ data: { userId: userA.id, amount: 999999, method: 'bkash', status: 'pending', destination: 'drift row' } })
  const payoutDrift = await db.buyerPayouts.findFirst({ where: { userId: userA.id, amount: 999999 } })
  const d7 = await admin('PATCH', `/api/admin/buyer-payouts/${payoutDrift.id}`, { action: 'complete', reference: 'BKQA119DRIFT' })
  ok(d7.status === 409 && /below the payout amount/.test(d7.json?.error ?? ''), 'oversized drift row → 409 insufficient (guard holds)', `got ${d7.status} ${d7.json?.error}`)
  const walletAfterDrift = await db.wallets.findFirst({ where: { userId: userA.id } })
  ok(walletAfterDrift.balance === 1800, 'drifted complete moved NOTHING (balance still 1800)')

  console.log('— E. rail isolation —')
  const e1 = await buyerA('POST', '/api/wallet/withdraw', { amount: 500, method: 'bKash', accountNumber: '01711122233', holderName: 'QA A' })
  ok(e1.status === 403 && /Supplier profile required/.test(e1.json?.error ?? ''), 'buyer on the SELLER route → 403 profile-required (rails do not bleed)', `got ${e1.status} ${JSON.stringify(e1.json)}`)
  const e2 = await supplier('GET', '/api/buyer/withdrawals')
  ok(e2.status === 401, 'supplier on the buyer list → 401', `got ${e2.status}`)
  const sellerRows = await db.sellerPayouts.count({})
  ok(sellerRows === 0, 'sellerPayouts untouched by the whole buyer exercise (0 rows)')

  console.log('— F. raw DB final audit —')
  const audits = await db.auditLogs.groupBy({ by: ['action'], where: { action: { in: ['buyer_payout_requested', 'buyer_payout_completed', 'buyer_payout_rejected'] } }, _count: { _all: true } })
  const auditMap = Object.fromEntries(audits.map((a) => [a.action, a._count._all]))
  ok(auditMap.buyer_payout_requested === 2, 'exactly 2 requested audits', JSON.stringify(auditMap))
  ok(auditMap.buyer_payout_completed === 1 && auditMap.buyer_payout_rejected === 1, 'exactly 1 completed + 1 rejected audit')
  const finalStats = await db.buyerPayouts.groupBy({ by: ['status'], _count: { _all: true } })
  const statusMap = Object.fromEntries(finalStats.map((s) => [s.status, s._count._all]))
  ok((statusMap.completed ?? 0) === 1 && (statusMap.failed ?? 0) === 1 && (statusMap.pending ?? 0) === 2,
    'final statuses: 1 completed + 1 failed + 2 pending (the crafted guards)', JSON.stringify(statusMap))

  console.log(`\n=== t119-buyer-withdrawals: ${PASS} PASS / ${FAIL} FAIL ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error('FATAL:', e)
  process.exitCode = 1
  await db.$disconnect()
})
