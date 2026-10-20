/**
 * Task 107 E2E — THE PAYOUT RAIL ("withdrawals were fake money before:
 * the wallet debited the instant a request arrived with nothing anywhere
 * to complete or reject it; now money only leaves through verification").
 *
 *   A. gates — anon/buyer on the withdraw rail, anon/seller on the admin queue
 *   B. request validation — minimum, enum, STRICT keys, destination bounds
 *   C. request-time HOLD math — available = balance − open requests; the
 *      same ৳ can never be double-requested; the wallet is NEVER debited
 *      at request time (the old flow's fake-money bug, now proven dead)
 *   D. admin decisions — complete debits inside one tx with a mandatory
 *      reference + walletTransactions row; reject frees the hold without
 *      moving money; decisions are terminal (409); the defensive
 *      insufficient-balance guard is real (row planted past the hold)
 *   E. hold-aware earnings — availablePayout subtracts open requests
 *   F. stats + audits — real groupBy and exact audit counts
 *
 * Run: node scripts/qa/t107-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.107.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA107 ${userType}`, ...(businessName ? { businessName } : {}) }
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
  const PASSWORD = 't107-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  const STAMP = Date.now()
  await registerAndLogin(admin, 'admin', `qa107-admin-${STAMP}@t107.test`, PASSWORD)
  await registerAndLogin(seller, 'supplier', `qa107-seller-${STAMP}@t107.test`, PASSWORD, 'QA107 PayoutWorks')
  await registerAndLogin(buyer, 'buyer', `qa107-buyer-${STAMP}@t107.test`, PASSWORD)
  const profile = await db.supplierProfiles.findFirst({ where: { companyName: 'QA107 PayoutWorks' } })
  ok(!!profile, 'supplier profile resolved')
  const sellerUser = await db.users.findUnique({ where: { email: `qa107-seller-${STAMP}@t107.test` } })
  await db.wallets.create({ data: { userId: sellerUser.id, balance: 1000, currency: 'BDT' } })
  console.log('  seller wallet seeded at ৳1000')

  /* ── A. gates ── */
  console.log('— A. gates —')
  ok((await makeSession()('POST', '/api/wallet/withdraw', { amount: 100, method: 'bKash', accountNumber: '01712345678', holderName: 'X Y' })).status === 401, 'anon withdraw → 401')
  ok((await makeSession()('GET', '/api/wallet/withdraw')).status === 401, 'anon withdraw list → 401')
  ok((await buyer('POST', '/api/wallet/withdraw', { amount: 100, method: 'bKash', accountNumber: '01712345678', holderName: 'X Y' })).status === 403, 'buyer withdraw → 403 (no supplier profile)')
  ok((await buyer('GET', '/api/wallet/withdraw')).status === 403, 'buyer withdraw list → 403')
  ok((await makeSession()('GET', '/api/admin/payouts')).status === 401, 'anon admin queue → 401')
  ok((await seller('GET', '/api/admin/payouts')).status === 401, 'seller admin queue → 401')
  ok((await seller('PATCH', '/api/admin/payouts/whatever', { action: 'complete', reference: 'X' })).status === 401, 'seller decision → 401')

  /* ── B. request validation ── */
  console.log('— B. request validation —')
  ok((await seller('POST', '/api/wallet/withdraw', { amount: 30, method: 'bKash', accountNumber: '01712345678', holderName: 'QA107 Holder' })).status === 400, 'amount < 50 → 400')
  ok((await seller('POST', '/api/wallet/withdraw', { amount: 100, method: 'WesternUnion', accountNumber: '01712345678', holderName: 'QA107 Holder' })).status === 400, 'invented method → 400')
  ok((await seller('POST', '/api/wallet/withdraw', { amount: 100, method: 'bKash', accountNumber: '01712345678', holderName: 'QA107 Holder', bogus: 1 })).status === 400, 'strict keys → 400')
  ok((await seller('POST', '/api/wallet/withdraw', { amount: 100, method: 'bKash', accountNumber: '123', holderName: 'QA107 Holder' })).status === 400, 'account too short → 400')
  ok((await seller('POST', '/api/wallet/withdraw', { amount: 5000, method: 'bKash', accountNumber: '01712345678', holderName: 'QA107 Holder' })).status === 400, 'amount beyond balance → 400')

  /* ── C. request-time HOLD math ── */
  console.log('— C. request-time HOLD math —')
  const r1 = await seller('POST', '/api/wallet/withdraw', { amount: 400, method: 'bKash', accountNumber: '01712345678', holderName: 'QA107 Holder' })
  ok(r1.status === 201 && r1.json?.data?.status === 'pending', 'withdrawal request → 201 pending (NOT a debit)', JSON.stringify(r1.json?.data))
  const payout1 = r1.json?.data?.payoutId
  let list = await seller('GET', '/api/wallet/withdraw')
  ok(list.json?.data?.balance === 1000 && list.json?.data?.onHold === 400 && list.json?.data?.available === 600, 'hold math exact {1000 balance, 400 held, 600 available}', JSON.stringify(list.json?.data))
  ok(list.json?.data?.payouts?.[0]?.method === 'bkash' && String(list.json?.data?.payouts?.[0]?.destination).includes('01712345678'), 'method normalized + destination verbatim', JSON.stringify(list.json?.data?.payouts?.[0]?.destination))
  ok((await seller('POST', '/api/wallet/withdraw', { amount: 700, method: 'bank', accountNumber: '1234567890123', holderName: 'QA107 Holder', bankName: 'BRAC Bank PLC' })).status === 400, 'double-request past the hold → 400 (the same ৳ cannot be asked twice)', JSON.stringify((await Promise.resolve(''))))
  const r2 = await seller('POST', '/api/wallet/withdraw', { amount: 600, method: 'bank', accountNumber: '1234567890123', holderName: 'QA107 Holder', bankName: 'BRAC Bank PLC' })
  ok(r2.status === 201, 'request exactly at the available edge → 201')
  const payout2 = r2.json?.data?.payoutId
  list = await seller('GET', '/api/wallet/withdraw')
  ok(list.json?.data?.onHold === 1000 && list.json?.data?.available === 0, 'both requests hold in full {1000 held, 0 available}')
  const w = await db.wallets.findFirst({ where: { userId: sellerUser.id } })
  ok(w.balance === 1000, 'wallet STILL ৳1000 — request time never moves money', JSON.stringify(w.balance))
  const txCount = await db.walletTransactions.count({ where: { wallet: { userId: sellerUser.id } } })
  ok(txCount === 0, 'zero wallet transactions at request time (the old flow debited here)')

  /* ── D. admin decisions ── */
  console.log('— D. admin decisions —')
  const q = await admin('GET', '/api/admin/payouts?status=pending')
  ok(q.status === 200 && q.json?.data?.length === 2, 'admin pending queue holds both requests', JSON.stringify(q.json?.data?.length))
  ok(q.json?.data?.every((r) => r.companyName === 'QA107 PayoutWorks'), 'queue carries supplier names')
  ok((await admin('GET', '/api/admin/payouts?status=bogus')).status === 400, 'unknown status filter → 400')
  ok((await admin('PATCH', `/api/admin/payouts/${payout2}`, { action: 'complete' })).status === 400, 'complete without reference → 400 (no untraceable settlements)')
  const c1 = await admin('PATCH', `/api/admin/payouts/${payout2}`, { action: 'complete', reference: 'TRX107ABC', note: 'BEFTN batch' })
  ok(c1.status === 200 && c1.json?.data?.status === 'completed', 'complete → settled with reference', JSON.stringify(c1.json?.data?.status))
  const w2 = await db.wallets.findFirst({ where: { userId: sellerUser.id } })
  ok(w2.balance === 400, 'wallet debited exactly at completion {1000 − 600 = 400}', JSON.stringify(w2.balance))
  const txs = await db.walletTransactions.findMany({ where: { wallet: { userId: sellerUser.id }, type: 'withdrawal' } })
  ok(txs.length === 1 && txs[0].amount === -600 && txs[0].balanceAfter === 400 && String(txs[0].description).includes('TRX107ABC'), 'real withdrawal ledger row −600 with the reference in the description', JSON.stringify(txs[0]?.description))
  list = await seller('GET', '/api/wallet/withdraw')
  const settled = list.json?.data?.payouts?.find((p) => p.id === payout2)
  ok(settled?.status === 'completed' && settled?.reference === 'TRX107ABC' && !!settled?.processedAt, 'seller sees the settlement + reference + timestamp')
  ok(list.json?.data?.onHold === 400 && list.json?.data?.available === 0, 'hold math after settlement {400 held, 0 available}')
  ok((await admin('PATCH', `/api/admin/payouts/${payout2}`, { action: 'complete', reference: 'AGAIN123' })).status === 409, 're-complete → 409 (decisions are terminal)')
  ok((await admin('PATCH', `/api/admin/payouts/${payout2}`, { action: 'reject' })).status === 409, 're-reject a completed payout → 409')
  const rej = await admin('PATCH', `/api/admin/payouts/${payout1}`, { action: 'reject', note: 'destination unreachable' })
  ok(rej.status === 200 && rej.json?.data?.status === 'failed', 'reject → failed')
  list = await seller('GET', '/api/wallet/withdraw')
  ok(list.json?.data?.onHold === 0 && list.json?.data?.available === 400, 'rejected hold is FREED {0 held, 400 available} — no refund needed because nothing was ever debited')
  const w3 = await db.wallets.findFirst({ where: { userId: sellerUser.id } })
  ok(w3.balance === 400, 'wallet untouched by the rejection {400}')
  // Defensive guard: plant a payout past the hold (amount > balance) and try to settle it.
  const planted = await db.sellerPayouts.create({ data: { supplierId: profile.id, amount: 9999, method: 'bkash', status: 'pending', destination: 'planted by drill' } })
  const ins = await admin('PATCH', `/api/admin/payouts/${planted.id}`, { action: 'complete', reference: 'GUARD107' })
  ok(ins.status === 409, 'settle past the balance → 409 (the guard is real)', JSON.stringify(ins.json?.error))
  await db.sellerPayouts.delete({ where: { id: planted.id } })
  ok((await admin('PATCH', '/api/admin/payouts/phantom-id', { action: 'complete', reference: 'NOPE107' })).status === 404, 'phantom payout → 404')

  /* ── E. hold-aware earnings ── */
  console.log('— E. hold-aware earnings —')
  // One open request again to prove availablePayout subtracts holds.
  const r3 = await seller('POST', '/api/wallet/withdraw', { amount: 150, method: 'Nagad', accountNumber: '01812345678', holderName: 'QA107 Holder' })
  ok(r3.status === 201, 'third request lands')
  const earn = await seller('GET', '/api/finance/earnings')
  ok(earn.json?.data?.onHoldForPayouts === 150 && earn.json?.data?.availablePayout === 250, 'earnings: availablePayout = balance − holds {400 − 150 = 250}', JSON.stringify({ hold: earn.json?.data?.onHoldForPayouts, avail: earn.json?.data?.availablePayout }))
  const payout3 = r3.json?.data?.payoutId
  await admin('PATCH', `/api/admin/payouts/${payout3}`, { action: 'reject' })

  /* ── F. stats + audits ── */
  console.log('— F. stats + audits —')
  const all = await admin('GET', '/api/admin/payouts')
  ok(all.json?.stats?.total === 3 && all.json?.stats?.completed === 1 && all.json?.stats?.failed === 2 && all.json?.stats?.pending === 0, 'queue stats exact {3 total, 1 completed, 2 failed, 0 pending}', JSON.stringify(all.json?.stats))
  ok(all.json?.stats?.completedAmount === 600 && all.json?.stats?.pendingAmount === 0, 'money stats exact {600 settled, 0 held}')
  const audits = await db.auditLogs.groupBy({ by: ['action'], _count: { action: true } })
  const count = (a) => audits.find((x) => x.action === a)?._count.action ?? 0
  ok(count('payout_requested') === 3, 'audit payout_requested ×3', JSON.stringify(count('payout_requested')))
  ok(count('payout_completed') === 1 && count('payout_rejected') === 2, 'audit payout_completed ×1, payout_rejected ×2')
  const rejAudit = await db.auditLogs.findFirst({ where: { action: 'payout_rejected' }, orderBy: { createdAt: 'desc' } })
  ok(!!rejAudit?.metadata && JSON.parse(rejAudit.metadata).amount > 0, 'rejection audit carries the amount')

  console.log(`\nRESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('FATAL', e)
  await db.$disconnect()
  process.exit(1)
})
