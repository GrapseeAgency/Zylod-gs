/**
 * Task 118 E2E — THE WALLET DOCTRINE (manual top-up claims are PENDING
 * until an admin verifies them; a claim NEVER moves money by itself).
 *
 *   A. gates — claim + admin rails 401-first
 *   B. claim validation — strict keys, TRXID contract, amount bounds, method enum
 *   C. THE DOCTRINE — a valid claim creates ONLY a pending row: no wallet,
 *      no ledger row, no balance movement; audit + claimDetails prove it
 *   D. reference uniqueness — same user AND cross-user 409s
 *   E. admin list — stats/pendingAmount/claimDetails projection real; ?status honored
 *   F. reject path — decision discipline, 409s, nothing moves, notification lands
 *   G. verify path — wallet credited INSIDE the decision, deposit row with real
 *      balanceAfter, audit before/after, verification annex, double-decide 409
 *   H. credited balance is LIVE in the wallet the checkout reads
 *   I. non-pending rows immutable — gateway-credited row 409s under admin verify
 *
 * Run: bun scripts/qa/t118-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.118.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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

async function registerAndLogin(session, userType, email, password) {
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA118 ${userType}` }
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
  const PASSWORD = 't118-E2e-Str0ng1!'
  const admin = makeSession(), buyerA = makeSession(), buyerB = makeSession()
  await registerAndLogin(admin, 'admin', 'qa118-admin@qa.local', PASSWORD)
  await registerAndLogin(buyerA, 'buyer', 'qa118-buyer-a@qa.local', PASSWORD)
  await registerAndLogin(buyerB, 'buyer', 'qa118-buyer-b@qa.local', PASSWORD)
  console.log('  accounts ready')

  const userA = await db.users.findFirst({ where: { email: 'qa118-buyer-a@qa.local' }, select: { id: true } })
  const userB = await db.users.findFirst({ where: { email: 'qa118-buyer-b@qa.local' }, select: { id: true } })
  ok(Boolean(userA?.id && userB?.id), 'both buyer users resolved from real rows')

  console.log('— A. gates —')
  const anon = makeSession()
  const g1 = await anon('POST', '/api/wallet/topup', { amount: 5000, method: 'bKash', transactionReference: 'ANONGATE123' })
  ok(g1.status === 401, 'claim without session → 401', `got ${g1.status}`)
  const g2 = await anon('GET', '/api/wallet/topup')
  ok(g2.status === 401, 'claim ledger without session → 401', `got ${g2.status}`)
  const g3 = await buyerA('GET', '/api/admin/topups')
  ok(g3.status === 401, 'admin list as buyer → 401', `got ${g3.status}`)
  const g4 = await buyerA('POST', '/api/admin/topups/whatever/verify', { action: 'verify' })
  ok(g4.status === 401, 'admin verify as buyer → 401', `got ${g4.status}`)

  console.log('— B. claim validation (strict contract) —')
  const v1 = await buyerA('POST', '/api/wallet/topup', { amount: 5000, method: 'bKash' })
  ok(v1.status === 400, 'missing transactionReference → 400', `got ${v1.status} ${JSON.stringify(v1.json)}`)
  const v2 = await buyerA('POST', '/api/wallet/topup', { amount: 5000, method: 'bKash', transactionReference: 'AB1' })
  ok(v2.status === 400, 'TRXID shorter than 6 → 400', `got ${v2.status}`)
  const v3 = await buyerA('POST', '/api/wallet/topup', { amount: 5000, method: 'bKash', transactionReference: 'bad ref!' })
  ok(v3.status === 400, 'TRXID bad charset → 400', `got ${v3.status}`)
  const v4 = await buyerA('POST', '/api/wallet/topup', { amount: 5, method: 'bKash', transactionReference: 'TOOSMALL118' })
  ok(v4.status === 400, 'amount below ৳10 → 400', `got ${v4.status}`)
  const v5 = await buyerA('POST', '/api/wallet/topup', { amount: 200000, method: 'bKash', transactionReference: 'TOOBIG118' })
  ok(v5.status === 400, 'amount above ৳100,000 → 400', `got ${v5.status}`)
  const v6 = await buyerA('POST', '/api/wallet/topup', { amount: 5000, method: 'PayPal', transactionReference: 'PAYPALQ118' })
  ok(v6.status === 400, 'unsupported method → 400', `got ${v6.status}`)
  const v7 = await buyerA('POST', '/api/wallet/topup', { amount: 5000, method: 'bKash', transactionReference: 'EXTRAKEY118', hijack: true })
  ok(v7.status === 400, 'unknown key (strict) → 400', `got ${v7.status}`)
  const badRes = await fetch(`${BASE}/api/wallet/topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: '', 'X-Forwarded-For': '10.118.9.9' },
    body: 'not-json{',
  })
  ok(badRes.status === 401 || badRes.status === 400, 'garbage body handled honestly (401 first without cookie)', `got ${badRes.status}`)

  console.log('— C. THE DOCTRINE — a claim moves NOTHING —')
  const walletsBeforeA = await db.wallets.count({ where: { userId: userA.id } })
  const txBeforeA = await db.walletTransactions.count({})
  const c1 = await buyerA('POST', '/api/wallet/topup', {
    amount: 5000, method: 'bKash', transactionReference: 'BKQA118X1A',
    senderNumber: '01711223344', note: 'counter deposit, Mirpur branch',
  })
  ok(c1.status === 201, 'valid claim → 201', `got ${c1.status} ${JSON.stringify(c1.json)}`)
  ok(c1.json?.data?.status === 'pending', 'response status is pending (never credited)')
  ok(c1.json?.data?.reference === 'BKQA118X1A', 'response echoes the reference')
  const claimRow = await db.walletTopups.findUnique({ where: { reference: 'BKQA118X1A' } })
  ok(Boolean(claimRow?.id), 'walletTopups row exists with the real reference')
  ok(claimRow?.status === 'pending', 'row status pending')
  ok(claimRow?.provider === 'bkash' && claimRow?.amount === 5000, 'provider + amount recorded exactly')
  const details = claimRow?.claimDetails ?? null
  ok(details?.method === 'bKash' && details?.senderNumber === '01711223344' && details?.note === 'counter deposit, Mirpur branch' && typeof details?.submittedAt === 'string',
    'claimDetails carries method/senderNumber/note/submittedAt', JSON.stringify(details))
  const walletsAfterA = await db.wallets.count({ where: { userId: userA.id } })
  const txAfterA = await db.walletTransactions.count({})
  ok(walletsBeforeA === 0 && walletsAfterA === 0, 'NO wallet row was created by the claim')
  ok(txBeforeA === 0 && txAfterA === 0, 'NO walletTransactions row was written by the claim')
  const claimAudit = await db.auditLogs.findFirst({ where: { action: 'wallet_topup_claimed', entityId: claimRow.id } })
  ok(Boolean(claimAudit), 'auditLogs wallet_topup_claimed written')
  const claimAuditMeta = claimAudit ? JSON.parse(claimAudit.metadata) : {}
  ok(claimAuditMeta.amount === 5000 && claimAuditMeta.status === 'pending' && typeof claimAuditMeta.note === 'string',
    'claim audit says pending + carries the no-money note')
  const ledger1 = await buyerA('GET', '/api/wallet/topup')
  ok(ledger1.status === 200 && Array.isArray(ledger1.json?.data) && ledger1.json.data.length === 1 && ledger1.json.data[0].status === 'pending',
    'GET /api/wallet/topup shows the caller ONLY their own pending claim')
  ok(ledger1.json?.data?.[0]?.claimDetails?.method === 'bKash', 'claim ledger projects claimDetails')

  console.log('— D. reference uniqueness —')
  const d1 = await buyerA('POST', '/api/wallet/topup', { amount: 1000, method: 'Nagad', transactionReference: 'BKQA118X1A' })
  ok(d1.status === 409 && /already submitted by you/.test(d1.json?.error ?? ''), 'same user reusing their TRXID → 409 (you)', `got ${d1.status} ${d1.json?.error}`)
  const d2 = await buyerB('POST', '/api/wallet/topup', { amount: 1000, method: 'Nagad', transactionReference: 'BKQA118X1A' })
  ok(d2.status === 409 && /already used by another claim/.test(d2.json?.error ?? ''), 'another user using the same TRXID → 409 (another claim)', `got ${d2.status} ${d2.json?.error}`)

  console.log('— E. admin list —')
  const e0 = await admin('GET', '/api/admin/topups?status=bogus')
  ok(e0.status === 400, '?status=bogus → 400', `got ${e0.status}`)
  const e1 = await admin('GET', '/api/admin/topups?status=pending')
  ok(e1.status === 200, 'admin pending list → 200', `got ${e1.status}`)
  const pendingRows = e1.json?.data ?? []
  ok(pendingRows.length === 1 && pendingRows[0].reference === 'BKQA118X1A', 'pending list holds exactly the real claim')
  ok(pendingRows[0]?.source === 'manual' && pendingRows[0]?.method === 'bKash', 'row projection: source manual + method from claimDetails')
  ok(pendingRows[0]?.senderNumber === '01711223344' && pendingRows[0]?.note === 'counter deposit, Mirpur branch', 'sender + note surfaced to the finance team')
  ok(typeof pendingRows[0]?.claimant?.displayName === 'string', 'claimant displayName resolved')
  const eAll = await admin('GET', '/api/admin/topups')
  const stats = eAll.json?.stats
  ok(stats?.pending === 1 && stats?.total === 1 && stats?.credited === 0 && stats?.rejected === 0, 'stats are the real groupBy (pending 1 / total 1)')
  ok(stats?.pendingAmount === 5000, 'pendingAmount is the real _sum (5000)')
  const eCredited = await admin('GET', '/api/admin/topups?status=credited')
  ok((eCredited.json?.data ?? []).length === 0, 'credited tab honestly empty before any verification')

  console.log('— F. decision discipline (reject) —')
  const f0 = await admin('POST', `/api/admin/topups/${claimRow.id}/verify`, { action: 'maybe' })
  ok(f0.status === 400, 'invalid action → 400', `got ${f0.status}`)
  const f1 = await admin('POST', `/api/admin/topups/${claimRow.id}/verify`, { action: 'verify', hijack: 1 })
  ok(f1.status === 400, 'unknown key (strict) → 400', `got ${f1.status}`)
  const f2 = await admin('POST', '/api/admin/topups/nonexistent-id/verify', { action: 'verify' })
  ok(f2.status === 404, 'unknown topup → 404', `got ${f2.status}`)
  const f3 = await admin('POST', `/api/admin/topups/${claimRow.id}/verify`, { action: 'reject', note: 'no money received for this reference' })
  ok(f3.status === 200 && f3.json?.data?.status === 'rejected', 'reject → 200 rejected', `got ${f3.status} ${JSON.stringify(f3.json)}`)
  const rejectedRow = await db.walletTopups.findUnique({ where: { reference: 'BKQA118X1A' } })
  ok(rejectedRow?.status === 'rejected' && rejectedRow?.creditedAt === null, 'row honestly rejected, creditedAt null')
  const walletsAfterReject = await db.wallets.count({ where: { userId: userA.id } })
  const txAfterReject = await db.walletTransactions.count({})
  ok(walletsAfterReject === 0 && txAfterReject === 0, 'reject moved NOTHING (no wallet, no ledger row)')
  const rejectAudit = await db.auditLogs.findFirst({ where: { action: 'wallet_topup_rejected', entityId: rejectedRow.id } })
  ok(Boolean(rejectAudit), 'auditLogs wallet_topup_rejected written')
  const rejectMeta = rejectAudit ? JSON.parse(rejectAudit.metadata) : {}
  ok(rejectMeta.before?.topupStatus === 'pending' && rejectMeta.after?.topupStatus === 'rejected' &&
     rejectMeta.before?.walletBalance === 0 && rejectMeta.after?.walletBalance === 0 && rejectMeta.actorType === 'admin',
    'reject audit carries real before/after + actorType admin')
  const annexReject = rejectedRow?.claimDetails?.verification
  ok(annexReject?.action === 'reject' && annexReject?.actorType === 'admin' && annexReject?.note === 'no money received for this reference',
    'claimDetails gained the verification annex')
  const buyerNotifReject = await db.notifications.findFirst({ where: { userId: userA.id, relatedEntityId: rejectedRow.id } })
  ok(Boolean(buyerNotifReject) && /rejected/i.test(buyerNotifReject?.title ?? ''), 'claimant got a REAL rejected notification row')
  const f4 = await admin('POST', `/api/admin/topups/${claimRow.id}/verify`, { action: 'verify' })
  ok(f4.status === 409 && /already rejected/.test(f4.json?.error ?? ''), 'double-decide → 409 (verbatim status)', `got ${f4.status} ${f4.json?.error}`)

  console.log('— G. verify path credits INSIDE the decision —')
  const g5 = await buyerB('POST', '/api/wallet/topup', {
    amount: 1500, method: 'Nagad', transactionReference: 'NGQA118X2B', senderNumber: '01887766554',
  })
  ok(g5.status === 201, "buyer B's valid claim → 201", `got ${g5.status} ${JSON.stringify(g5.json)}`)
  const claimB = await db.walletTopups.findUnique({ where: { reference: 'NGQA118X2B' } })
  ok(claimB?.status === 'pending' && claimB?.provider === 'nagad', "B's row pending + provider mapped")
  const g6 = await admin('POST', `/api/admin/topups/${claimB.id}/verify`, { action: 'verify', note: 'matched against Nagad merchant statement' })
  ok(g6.status === 200 && g6.json?.data?.status === 'credited', 'verify → 200 credited', `got ${g6.status} ${JSON.stringify(g6.json)}`)
  ok(g6.json?.data?.newBalance === 1500, 'response spells the credited balance (1500)')
  const creditedRow = await db.walletTopups.findUnique({ where: { reference: 'NGQA118X2B' } })
  ok(creditedRow?.status === 'credited' && creditedRow?.creditedAt !== null, 'row credited with creditedAt set')
  ok(creditedRow?.gatewayTrxId === 'NGQA118X2B', 'gatewayTrxId stamped from the verified reference')
  const walletB = await db.wallets.findFirst({ where: { userId: userB.id } })
  ok(walletB?.balance === 1500, 'wallet balance IS 1500 after verification', `got ${walletB?.balance}`)
  const ledgerB = await db.walletTransactions.findFirst({ where: { walletId: walletB.id } })
  ok(ledgerB?.type === 'deposit' && ledgerB?.amount === 1500 && ledgerB?.balanceAfter === 1500 && ledgerB?.relatedEntityId === creditedRow.id,
    'deposit ledger row: amount 1500, balanceAfter 1500, tied to the topup')
  const verifyAudit = await db.auditLogs.findFirst({ where: { action: 'wallet_topup_verified', entityId: creditedRow.id } })
  const verifyMeta = verifyAudit ? JSON.parse(verifyAudit.metadata) : {}
  ok(verifyAudit && verifyMeta.before?.walletBalance === 0 && verifyMeta.after?.walletBalance === 1500 && verifyMeta.actorType === 'admin',
    'verify audit: before balance 0 → after balance 1500, actorType admin')
  const annexVerify = creditedRow?.claimDetails?.verification
  ok(annexVerify?.action === 'verify' && annexVerify?.actorType === 'admin', 'verified claim carries the verification annex')
  const buyerNotifVerify = await db.notifications.findFirst({ where: { userId: userB.id, relatedEntityId: creditedRow.id } })
  ok(Boolean(buyerNotifVerify) && /verified/i.test(buyerNotifVerify?.title ?? ''), 'claimant got a REAL verified notification row')
  const g7 = await admin('POST', `/api/admin/topups/${claimB.id}/verify`, { action: 'verify' })
  ok(g7.status === 409 && /already credited/.test(g7.json?.error ?? ''), 'double-verify → 409 (no double credit)', `got ${g7.status} ${g7.json?.error}`)
  const walletBAfter = await db.wallets.findFirst({ where: { userId: userB.id } })
  ok(walletBAfter?.balance === 1500, 'wallet still exactly 1500 after the 409 (no double-credit)')

  console.log('— H. the credited balance is LIVE in the wallet the checkout reads —')
  const h1 = await buyerB('GET', '/api/wallet')
  const hBalance = h1.json?.data?.balance
  ok(h1.status === 200 && hBalance === 1500, 'GET /api/wallet shows balance 1500', `got ${h1.status} ${JSON.stringify(hBalance)}`)

  console.log('— I. non-pending rows are immutable under admin verify —')
  // A gateway-credited row (sessionId set, status 'credited') simulates the
  // callback's product; no admin may re-credit or flip it.
  await db.walletTopups.create({
    data: {
      userId: userB.id, provider: 'sslcommerz', sessionId: 'sess_gw_118', reference: 'WBD-TU-GW118',
      amount: 800, currency: 'BDT', status: 'credited', gatewayTrxId: 'GWBK118TRX', creditedAt: new Date(),
    },
  })
  const gwRow = await db.walletTopups.findUnique({ where: { reference: 'WBD-TU-GW118' } })
  const i1 = await admin('POST', `/api/admin/topups/${gwRow.id}/verify`, { action: 'verify' })
  ok(i1.status === 409 && /already credited/.test(i1.json?.error ?? ''), 'gateway-credited row → 409 under admin verify', `got ${i1.status} ${i1.json?.error}`)

  console.log('— J. raw DB final audit —')
  const audits = await db.auditLogs.groupBy({ by: ['action'], where: { action: { in: ['wallet_topup_claimed', 'wallet_topup_verified', 'wallet_topup_rejected'] } }, _count: { _all: true } })
  const auditMap = Object.fromEntries(audits.map((a) => [a.action, a._count._all]))
  ok(auditMap.wallet_topup_claimed === 2, 'exactly 2 claimed audits', JSON.stringify(auditMap))
  ok(auditMap.wallet_topup_verified === 1 && auditMap.wallet_topup_rejected === 1, 'exactly 1 verified + 1 rejected audit')
  const finalStats = await db.walletTopups.groupBy({ by: ['status'], _count: { _all: true } })
  const statusMap = Object.fromEntries(finalStats.map((s) => [s.status, s._count._all]))
  ok((statusMap.pending ?? 0) === 0 && statusMap.rejected === 1 && statusMap.credited === 2, 'final topup statuses: 1 rejected + 2 credited, 0 pending', JSON.stringify(statusMap))

  console.log(`\n=== t118-wallet-doctrine: ${PASS} PASS / ${FAIL} FAIL ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error('FATAL:', e)
  process.exitCode = 1
  await db.$disconnect()
})
