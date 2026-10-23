// Task 164 E2E — the add-payment-method page wired to the REAL rails (audit
// unit 22). The old page faked the save with setTimeout; nothing was ever
// persisted. This drill pins all three rails the page now uses:
//   - POST /api/payment-methods/mobile-banking (wallet, BD phone validation)
//   - POST /api/payment-methods (card TOKENIZATION — full PAN refused)
//   - POST /api/bank-accounts (bank, financial-audited)
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't164-Qa-Str0ng1!'

function makeSession() {
  let cookie = ''
  const ip = `10.164.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

async function reg(session, userType, local) {
  const payload = { userType, authProvider: 'email', email: `${local}-${STAMP}@t164.test`, password: PW, fullName: 'T164 ' + userType }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email: payload.email, password: PW }); return l.status === 200 || l.status === 201 }
    await sleep(3000)
  }
  return false
}

async function main() {
  const buyer = makeSession(), anon = makeSession()
  ok(await reg(buyer, 'buyer', 't164-buy'), 'buyer registered')

  // ── gates ──
  const anonMfs = await anon('POST', '/api/payment-methods/mobile-banking', { provider: 'bkash', accountNumber: '01712345678' })
  ok(anonMfs.status === 401, 'anonymous wallet link → 401', `got ${anonMfs.status}`)
  const anonCard = await anon('POST', '/api/payment-methods', { type: 'credit', label: 'x', accountNumber: '9010', holderName: 'X' })
  ok(anonCard.status === 401, 'anonymous card link → 401', `got ${anonCard.status}`)
  const anonBank = await anon('POST', '/api/bank-accounts', { bankName: 'X', accountNumber: '1', accountHolderName: 'X' })
  ok(anonBank.status === 401, 'anonymous bank link → 401', `got ${anonBank.status}`)

  // ── wallet rail ──
  const badPhone = await buyer('POST', '/api/payment-methods/mobile-banking', { provider: 'bkash', accountNumber: '12345' })
  ok(badPhone.status === 400, 'invalid BD number refused with the real reason', JSON.stringify(badPhone.json)?.slice(0, 120))
  const mfs = await buyer('POST', '/api/payment-methods/mobile-banking', { provider: 'bkash', accountNumber: '01712345678' })
  ok(mfs.status === 201 || mfs.status === 200, `valid wallet linked (${mfs.status})`, JSON.stringify(mfs.json)?.slice(0, 120))

  // ── card rail (tokenization) ──
  const fullPan = await buyer('POST', '/api/payment-methods', { type: 'credit', label: 'HACK', accountNumber: '4000123456789010', holderName: 'T164 Buyer', cardNetwork: 'visa' })
  ok(fullPan.status === 400, 'FULL PAN refused — tokenization enforced', JSON.stringify(fullPan.json)?.slice(0, 120))
  const panRows = await db.paymentMethods.count({ where: { accountNumber: '4000123456789010' } })
  ok(panRows === 0, 'no full-PAN row exists anywhere')
  const card = await buyer('POST', '/api/payment-methods', { type: 'credit', label: 'Visa ••9010', accountNumber: '9010', holderName: 'T164 Buyer', expiry: '09/28', cardNetwork: 'visa' })
  ok(card.status === 201 || card.status === 200, `tokenized card linked (${card.status})`, JSON.stringify(card.json)?.slice(0, 120))
  const badExpiry = await buyer('POST', '/api/payment-methods', { type: 'debit', label: 'x', accountNumber: '9011', holderName: 'T164 Buyer', expiry: '13/28' })
  ok(badExpiry.status === 400, 'invalid MM/YY refused', JSON.stringify(badExpiry.json)?.slice(0, 120))

  // ── bank rail ──
  const noBank = await buyer('POST', '/api/bank-accounts', { accountNumber: '10019990022', accountHolderName: 'T164 Buyer' })
  ok(noBank.status === 400, 'missing bankName refused', JSON.stringify(noBank.json)?.slice(0, 120))
  const bank = await buyer('POST', '/api/bank-accounts', { bankName: 'Eastern Bank Ltd.', accountNumber: '10019990022', accountHolderName: 'T164 Buyer', branchName: 'Gulshan Corporate', routingNumber: '090270000' })
  ok(bank.status === 201 || bank.status === 200, `bank account linked (${bank.status})`, JSON.stringify(bank.json)?.slice(0, 120))

  // ── the page's data sources agree ──
  const list = await buyer('GET', '/api/payment-methods')
  const types = (list.json?.data ?? list.json?.methods ?? []).map((m) => m.type)
  ok(list.status === 200 && types.some((t) => String(t).toLowerCase() === 'bkash'), 'payment-methods list serves the wallet', JSON.stringify(types))
  ok(types.includes('credit'), 'payment-methods list serves the card')
  const banks = await buyer('GET', '/api/bank-accounts')
  ok(banks.status === 200 && (banks.json?.data ?? []).some((b) => b.bankName === 'Eastern Bank Ltd.'), 'bank-accounts list serves the bank row', JSON.stringify(banks.json?.data)?.slice(0, 140))

  // financial audit trail for the money-method changes
  const audits = await db.auditLogs.count({ where: { action: 'financial_method_added', actorId: (await db.users.findFirst({ where: { email: { contains: 't164-buy-' } } })).id } })
  ok(audits >= 2, `financial-audit rows exist for the card+bank links (got ${audits})`)

  console.log(`\nT164 RESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('DRILL CRASH:', e); await db.$disconnect().catch(() => null); process.exit(1) })
