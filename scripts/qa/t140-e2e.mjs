// Task 140 E2E — the money-printer is dead + refunds are real + money/trust
// events leave evidence. Kills /api/wallet/refund POST (any user could credit
// their own wallet with ANY amount instantly), rebuilds GET as the buyer's
// REAL refund ledger (admin-documented transfers), audits the trust-report
// verdict (whose response claimed 'logged' while writing nothing) and the
// gateway webhook (money state with no evidence row). Run on a FRESH wipe.
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
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T140 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't140-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), buyer = makeSession()
ok(await reg(admin, 'admin', `t140-admin-${STAMP}@t140.test`, PW), 'admin registered')
ok(await reg(seller, 'supplier', `t140-seller-${STAMP}@t140.test`, PW, 'T140 Depot'), 'seller registered')
ok(await reg(buyer, 'buyer', `t140-buyer-${STAMP}@t140.test`, PW), 'buyer registered')

let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
ok(Boolean(categoryId), 'category ready')

const p = await seller('POST', '/api/supplier/products', {
  name: 'T140 Refund Hoodie', description: 'drill', categoryId, unit: 'pcs', moq: 1,
  basePrice: 500, currency: 'BDT', stockQuantity: 100,
  priceTiers: [{ minQty: 1, pricePerUnit: 500 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
})
const productId = p.json?.data?.id ?? p.json?.id
ok(Boolean(productId), 'product created')
await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T140' })

// ── order → paid → delivered → return → admin refund ──
let r = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 3 }] })
ok(r.status === 201 || r.status === 200, 'order placed')
const orderId = r.json?.data?.orderId
r = await buyer('POST', `/api/orders/${orderId}/payment-submit`, { method: 'mobile_banking', transactionId: `T140TX${STAMP}` })
ok(r.status === 201 || r.status === 200, 'payment submitted (pending)')
const paymentId = r.json?.data?.paymentId
ok((await seller('POST', `/api/seller/payments/${paymentId}/verify`, { action: 'verify' })).status === 200, 'seller verified the payment')
const subRow = await db.subOrders.findFirst({ where: { orderId } })
ok((await seller('PATCH', `/api/supplier/orders/${orderId}`, { status: 'delivered', subOrderId: subRow.id })).status === 200, 'shipment delivered')

const itemRow = await db.orderItems.findFirst({ where: { subOrderId: subRow.id } })
r = await buyer('POST', `/api/orders/${orderId}/return`, { items: [{ itemId: itemRow.id, reason: 'damaged', quantity: 1, comments: 'T140 return' }] })
ok(r.status === 201 || r.status === 200, 'return requested', JSON.stringify(r.json)?.slice(0, 200))
const returnId = r.json?.data?.returnId ?? r.json?.data?.id ?? (await db.returnRequests.findFirst({ where: { orderId } }))?.id
ok((await admin('PATCH', '/api/admin/returns/' + returnId, { action: 'approve', note: 'T140 approved' })).status === 200, 'return approved')
const REF = `UTR-T140-${STAMP}`
r = await admin('POST', `/api/admin/returns/${returnId}/refund`, { amount: 500, method: 'mobile_banking', reference: REF, note: 'bKash sent' })
ok(r.status === 201 || r.status === 200, 'admin documented the REAL refund', JSON.stringify(r.json)?.slice(0, 200))
await sleep(300)

// ── the printer is dead; the ledger is real ──
ok((await makeSession()('GET', '/api/wallet/refund')).status === 401, 'refunds GET: anon → 401')
const postAttempt = await buyer('POST', '/api/wallet/refund', { orderId, amount: 99999, reason: 'self credit attempt' })
ok(postAttempt.status === 405, 'THE MONEY PRINTER IS DEAD: POST → 405 (no self-credit channel)', `status ${postAttempt.status}`)
const walletRows = await db.walletTransactions.count({ where: { type: 'refund' } })
ok(walletRows === 0, 'zero self-credit ledger rows exist (the fake writer is gone)')
const buyerWallet = await db.wallets.findFirst({ where: { userId: (await db.users.findUnique({ where: { email: `t140-buyer-${STAMP}@t140.test` } })).id } })
ok(!buyerWallet || buyerWallet.balance === 0, `buyer wallet balance honest (no self-credit; ${buyerWallet ? 'balance ' + buyerWallet.balance : 'no wallet row'})`)
r = await buyer('GET', '/api/wallet/refund')
ok(r.status === 200 && r.json?.data?.length === 1, 'buyer sees exactly ONE refund — the REAL one')
const row = r.json?.data?.[0]
ok(row?.amount === 500 && row?.method === 'mobile_banking' && row?.reference === REF && row?.status === 'processed', 'refund row carries the REAL amount/method/UTR/status')
ok(row?.orderId === orderId, 'refund row links the real order')

// ── trust verdict audited (was claimed 'logged', wrote nothing) ──
const sellerUser = await db.users.findUnique({ where: { email: `t140-seller-${STAMP}@t140.test` } })
r = await buyer('POST', '/api/support/report-user', { reportedUserId: sellerUser.id, reason: 'fraud', description: 'T140 report for verdict audit' })
ok(r.status === 201 || r.status === 200, 'report filed', JSON.stringify(r.json)?.slice(0, 150))
const reportId = r.json?.data?.id ?? r.json?.id ?? (await db.reportedUsers.findFirst({ where: { reporterId: (await db.users.findUnique({ where: { email: `t140-buyer-${STAMP}@t140.test` } })).id } }))?.id
r = await admin('PATCH', `/api/admin/reports/${reportId}`, { status: 'action_taken', actionType: 'suspend_store', adminNotes: 'T140 verdict' })
ok(r.status === 200, 'admin executed the verdict')
await sleep(300)
const verdictAudit = await db.auditLogs.findFirst({ where: { action: 'trust_report_verdict', entityId: reportId } })
ok(Boolean(verdictAudit), 'verdict now leaves a REAL audit row (the old route claimed "logged" and wrote nothing)')
const vaMeta = verdictAudit ? JSON.parse(verdictAudit.metadata) : {}
ok(vaMeta?.sideEffects?.storeSuspended === true, 'audit row records the real side-effect (store suspended)')
const prof = await db.supplierProfiles.findFirst({ where: { userId: sellerUser.id } })
ok(prof?.verificationStatus === 'rejected', 'side-effect actually happened (verificationStatus rejected)')

// ── freeze_escrow no longer fakes a refund ──
r = await buyer('POST', '/api/support/report-user', { reportedUserId: sellerUser.id, reason: 'abuse', description: 'T140 freeze case', relatedOrderId: orderId })
const report2 = r.json?.data?.id ?? r.json?.id ?? (await db.reportedUsers.findFirst({ where: { relatedOrderId: orderId } }))?.id
const statusBefore = (await db.orders.findUnique({ where: { id: orderId } })).paymentStatus
await admin('PATCH', `/api/admin/reports/${report2}`, { status: 'action_taken', actionType: 'freeze_escrow', adminNotes: 'T140 hold' })
await sleep(300)
const statusAfter = (await db.orders.findUnique({ where: { id: orderId } })).paymentStatus
ok(statusAfter === statusBefore, `freeze_escrow no longer flips paymentStatus to 'refunded' (${statusBefore} → ${statusAfter})`)
const freezeAudit = await db.auditLogs.findFirst({ where: { action: 'trust_report_verdict', entityId: report2 } })
ok(freezeAudit && JSON.parse(freezeAudit.metadata).sideEffects.escrowHoldRecorded === true, 'the hold is recorded in evidence, not faked in money state')

// ── gateway webhook audited ──
const order2 = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }] })
const orderId2 = order2.json?.data?.orderId
const order2row = await db.orders.findUnique({ where: { id: orderId2 } })
const { createHmac } = await import('crypto')
// The secret lives in the gitignored .env (environment resets have wiped it
// before) — the drill reads it straight from there when the shell env lacks it.
if (!process.env.PAYMENT_WEBHOOK_SECRET) {
  try {
    const line = (await import('node:fs')).readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('PAYMENT_WEBHOOK_SECRET='))
    if (line) process.env.PAYMENT_WEBHOOK_SECRET = line.split('=').slice(1).join('=').trim()
  } catch { /* drill will fail loudly against an unconfigured server */ }
}
const rawBody = JSON.stringify({ orderId: orderId2, transactionId: `T140GW${STAMP}`, amount: order2row.totalAmount, status: 'success', gateway: 'qa-gateway' })
const sig = 'sha256=' + createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET ?? '').update(rawBody).digest('hex')
r = await fetch(`${BASE}/api/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-zylod-signature': sig }, body: rawBody })
ok(r.status === 200, 'HMAC webhook accepted', JSON.stringify(await r.json().catch(() => null)))
await sleep(300)
const gwAudit = await db.auditLogs.findFirst({ where: { action: 'gateway_payment_recorded' } })
ok(Boolean(gwAudit), 'gateway money event now leaves a REAL audit row')
const gwMeta = gwAudit ? JSON.parse(gwAudit.metadata) : {}
ok(gwMeta?.before?.paymentStatus === 'unpaid' && gwMeta?.after?.paymentStatus === 'paid' && gwMeta?.escrowHold === true, 'audit row carries the real before/after money state')
ok((await db.orders.findUnique({ where: { id: orderId2 } })).paymentStatus === 'paid', 'order paid as before (behavior unchanged)')

// ── the audit trail reader sees it all ──
r = await admin('GET', '/api/admin/audit-logs?action=gateway_payment_recorded')
ok(r.status === 200 && r.json.data.length >= 1, 'admin console serves the gateway evidence')
r = await admin('GET', '/api/admin/audit-logs?action=trust_report_verdict')
ok(r.status === 200 && r.json.data.length >= 2, 'admin console serves both verdicts')

console.log(`\nT140 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
