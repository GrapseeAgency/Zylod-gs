// Task 148 E2E — financial-profile changes leave REDACTED evidence. Adding,
// removing, or re-pointing a payout method (bank accounts, cards, mobile
// wallets) is the classic withdrawal-hijack vector — the withdrawal rail
// pays out to these rows — so every mutation now writes an auditLogs row
// whose metadata is masked by construction (never the full account number).
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function makeSession() {
  let cookie = ''
  const ip = `10.149.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
async function reg(session, userType, email, pw) {
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T148 ' + userType }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't148-Qa-Str0ng1!'
const buyer = makeSession()
ok(await reg(buyer, 'buyer', `t148-b1-${STAMP}@t148.test`, PW), 'buyer registered')
ok((await makeSession()('POST', '/api/bank-accounts', { bankName: 'X', accountNumber: '123', accountHolderName: 'Y' })).status === 401, 'bank add: anon → 401')

// ── bank account: the full number lives on the row, NEVER in the audit ──
const FULL = '17803452345678901'
let r = await buyer('POST', '/api/bank-accounts', { bankName: 'T148 Bank', accountNumber: FULL, accountHolderName: 'T148 Holder', branchName: 'Gulshan', routingNumber: '060261726', isDefault: true })
ok(r.status === 200, 'bank account added → 200 (stable route contract)', JSON.stringify(r.json)?.slice(0, 140))
const bankId = r.json?.data?.id
const rowBank = await db.paymentMethods.findUnique({ where: { id: bankId } })
ok(rowBank && rowBank.accountNumber === FULL, 'the row itself still carries what the withdrawal rail needs (full number on the ROW)')
const a1 = await db.auditLogs.findFirst({ where: { action: 'financial_method_added', entityId: bankId } })
ok(!!a1 && String(a1.metadata || '').includes('****8901'), 'audit: ADDED with the masked account (****8901)')
ok(a1 && !String(a1.metadata || '').includes(FULL), 'REDACTION PROOF: the full account number appears NOWHERE in the audit metadata')

// ── default switch: the re-pointing of where money lands ──
r = await buyer('POST', '/api/bank-accounts', { bankName: 'T148 Bank 2', accountNumber: '99000112233445566', accountHolderName: 'T148 Holder' })
ok(r.status === 200, 'second bank account added')
r = await buyer('PATCH', `/api/bank-accounts/${r.json?.data?.id}`, { isDefault: true })
ok(r.status === 200, 'default switched to the second account')
const a2 = await db.auditLogs.findFirst({ where: { action: 'financial_method_updated', entityType: 'paymentMethods' }, orderBy: { createdAt: 'desc' } })
ok(!!a2 && String(a2.metadata || '').includes('default payout account switched'), 'audit: the default-account switch is evidenced (where money lands)')

// ── removal ──
r = await buyer('DELETE', `/api/bank-accounts/${bankId}`)
ok(r.status === 200, 'bank account removed')
const a3 = await db.auditLogs.findFirst({ where: { action: 'financial_method_removed', entityId: bankId } })
ok(!!a3 && String(a3.metadata || '').includes('****8901') && !String(a3.metadata || '').includes(FULL), 'audit: REMOVED with the mask (evidence survives the row)')

// ── cards: stored last4-only, audit mirrors it ──
r = await buyer('POST', '/api/cards', { cardNumber: '4111 1111 1111 1111', holderName: 'T148 Holder', expiry: '12/29', brand: 'Visa', cardType: 'debit' })
ok(r.status === 200, 'card added (tokenized to last4 by the route)')
const cardId = r.json?.data?.id
const a4 = await db.auditLogs.findFirst({ where: { action: 'financial_method_added', entityId: cardId } })
ok(!!a4 && String(a4.metadata || '').includes('****1111'), 'audit: card ADDED with last4 mask')
ok(a4 && !String(a4.metadata || '').includes('4111111111111111'), 'REDACTION PROOF: the full PAN appears nowhere in the audit metadata')
r = await buyer('DELETE', `/api/cards/${cardId}`)
const a5 = await db.auditLogs.findFirst({ where: { action: 'financial_method_removed', entityId: cardId } })
ok(r.status === 200 && !!a5, 'card removed with evidence')

// ── mobile wallet (payment-methods rail) ──
r = await buyer('POST', '/api/payment-methods', { type: 'bKash', label: 'My bKash', accountNumber: '01712345678' })
ok(r.status === 201, 'bKash wallet added')
const pmId = r.json?.data?.id
const a6 = await db.auditLogs.findFirst({ where: { action: 'financial_method_added', entityId: pmId } })
ok(!!a6 && String(a6.metadata || '').includes('****5678'), 'audit: mobile wallet ADDED masked')
r = await buyer('DELETE', `/api/payment-methods/${pmId}`)
const a7 = await db.auditLogs.findFirst({ where: { action: 'financial_method_removed', entityId: pmId } })
ok(r.status === 200 && !!a7, 'mobile wallet removed with evidence')

// ── isolation: another buyer's methods never appear in my audit scope ──
const buyer2 = makeSession()
ok(await reg(buyer2, 'buyer', `t148-b2-${STAMP}@t148.test`, PW), 'buyer2 registered')
r = await buyer2('POST', '/api/payment-methods', { type: 'Nagad', label: 'N', accountNumber: '01811112222' })
const b2audit = await db.auditLogs.findFirst({ where: { action: 'financial_method_added', entityId: r.json?.data?.id } })
ok(b2audit && b2audit.actorId !== (await db.users.findFirst({ where: { email: `t148-b1-${STAMP}@t148.test` } })).id, 'buyer2 writes its own evidence (no cross-actor rows)')

console.log(`\nT148 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
