/**
 * Task 68 E2E — write-side cache invalidation + buyer payment notifications.
 *
 * Doctrine under test:
 *   • 68-a CACHE COHERENCY: every cached public read (categories:tree 5-min
 *     TTL, products:list:* / brands:list:* / suppliers:list:* 60s) is
 *     INVALIDATED the moment a write commits that changes what it serves.
 *     Before this, an admin category edit left the public tree serving the
 *     old name/counts for up to 5 minutes (the diagnosed bug).
 *   • Honest boundary: a NEW product is created isApproved=false, so no
 *     public surface changes and NO invalidation is needed — proven by the
 *     list NOT showing it before approval.
 *   • 68-c BUYER PAYMENT NOTIFICATIONS: the manual payment leg now persists
 *     REAL notification rows for the buyer on submit / seller verify /
 *     seller reject / admin verify — previously ZERO rows (bell + list only
 *     worked if the buyer had the order page open at that exact moment).
 *     Each row carries relatedEntityId=orderId + relatedPaymentId=paymentId
 *     (the deep-link contract the order-detail highlight consumes).
 *   • Honest partial math rides the notification body ('Payment Partially
 *     Verified') exactly as the order transitions to 'partial'.
 *
 * Run: bun scripts/qa/t68-e2e.mjs   (DB must be EMPTY — first-admin window;
 *      PAYMENT_WEBHOOK_SECRET is intentionally NOT set in dev, so the
 *      webhook path (same helper calls) is code-verified, not E2E-verified.)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

let PASS = 0, FAIL = 0
const failures = []
function ok(cond, label, extra) {
  if (cond) { PASS++; console.log(`  ✅ ${label}`) }
  else { FAIL++; failures.push(label + (extra ? ` — ${extra}` : '')); console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`) }
}
function section(name) { console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeSession() {
  let cookie = ''
  const ip = `10.80.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  const call = async function call(method, path_, body) {
    const res = await fetch(`${BASE}${path_}`, {
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
    call.cookie = cookie
    const json = await res.json().catch(() => null)
    return { status: res.status, json }
  }
  call.cookie = ''
  return call
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA68 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA68 Shop ${email.slice(5, 12)}` } : {}),
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
    if (login.status !== 429) throw new Error(`login ${email} -> ${login.status}`)
    await sleep(4000 * (attempt + 1))
  }
  throw new Error(`login ${email} exhausted`)
}

async function buyerNotifications(session) {
  const res = await session('GET', '/api/notifications?limit=50')
  return res.json?.data ?? []
}

const main = async () => {
  const PASSWORD = 't68-Cache-Qa1!'
  const admin = makeSession(), seller = makeSession(), buyer = makeSession()
  const anon = makeSession()
  const ts = Date.now().toString().slice(-6)

  section('setup — admin, supplier, buyer (fresh DB, first-admin window)')
  await registerAndLogin(admin, 'admin', `qa68-admin@qa.local`, PASSWORD)
  await registerAndLogin(seller, 'supplier', `qa68-supa@qa.local`, PASSWORD)
  await registerAndLogin(buyer, 'buyer', `qa68-buyer@qa.local`, PASSWORD)
  ok(true, 'admin + supplier + buyer registered and logged in')

  // ════════════════════════ SECTION A: categories:tree ════════════════════════
  section('A) categories:tree invalidation (the diagnosed 5-min staleness bug)')

  const tree0 = await anon('GET', '/api/categories')
  ok(tree0.status === 200 && Array.isArray(tree0.json?.data), 'public tree primed (cache now holds it)')
  const beforeCount = tree0.json.data.length

  const cat = await admin('POST', '/api/admin/categories', { name: `QA68 Alpha ${ts}`, isActive: true })
  ok([200, 201].includes(cat.status), 'admin creates category', `got ${cat.status}`)
  const categoryId = cat.json?.data?.id

  const tree1 = await anon('GET', '/api/categories')
  const found1 = (tree1.json?.data ?? []).find((c) => c.id === categoryId)
  ok(Boolean(found1), 'new category visible on the PUBLIC tree INSTANTLY (no 5-min staleness)')
  ok(tree1.json.data.length === beforeCount + 1, 'tree root count +1')

  const renamed = await admin('PATCH', `/api/admin/categories/${categoryId}`, { name: `QA68 Alpha Renamed ${ts}` })
  ok([200, 201].includes(renamed.status), 'admin renames category')
  const tree2 = await anon('GET', '/api/categories')
  const found2 = (tree2.json?.data ?? []).find((c) => c.id === categoryId)
  ok(found2?.name === `QA68 Alpha Renamed ${ts}`, 'public tree serves the NEW name INSTANTLY', found2?.name)

  // ════════════════════════ SECTION B: product writes ════════════════════════
  section('B) products:list / brands:list / tree-counts invalidation')

  const prod = await seller('POST', '/api/supplier/products', {
    name: `QA68 Rod ${ts}`, description: 'QA t68 cache + payments', categoryId, unit: 'pcs',
    brand: `QA68Brand${ts}`,
    moq: 1, basePrice: 100, stockQuantity: 50, priceTiers: [{ minQty: 1, pricePerUnit: 100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    variants: [],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'product created (isApproved=false by schema default)')

  // Honest boundary: an unapproved product must NOT appear anywhere public —
  // and the list cache is NOT invalidated (nothing public changed).
  const listUnapproved = await anon('GET', `/api/products?search=${encodeURIComponent(`QA68 Rod ${ts}`)}`)
  ok((listUnapproved.json?.data ?? []).length === 0, 'unapproved product honestly absent from the public list (no fake appearance)')

  const approved = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA68' })
  ok([200, 201].includes(approved.status), 'admin approves the product')
  const listApproved = await anon('GET', `/api/products?search=${encodeURIComponent(`QA68 Rod ${ts}`)}`)
  const inList = (listApproved.json?.data ?? []).some((p) => p.id === productId)
  ok(inList, 'approved product on the public list INSTANTLY (invalidated on approve)')

  const brands1 = await anon('GET', `/api/brands?search=${encodeURIComponent(`QA68Brand${ts}`)}`)
  ok((brands1.json?.data ?? []).length > 0, 'brand facet appears INSTANTLY after approval')

  const tree3 = await anon('GET', '/api/categories')
  const cat3 = (tree3.json?.data ?? []).find((c) => c.id === categoryId)
  ok(cat3?.productCount === 1, 'tree productCount updated INSTANTLY (category tree carries counts)', `count=${cat3?.productCount}`)

  const renamed1 = await seller('PATCH', `/api/supplier/products/${productId}`, {
    name: `QA68 Rod Renamed ${ts}`, description: 'QA t68 cache + payments', categoryId, unit: 'pcs',
    brand: `QA68Brand${ts}`,
    moq: 1, basePrice: 100, stockQuantity: 50, priceTiers: [{ minQty: 1, pricePerUnit: 100 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    variants: [],
  })
  ok([200, 201].includes(renamed1.status), 'seller renames product (full-replace PATCH)')
  const listRenamed = await anon('GET', `/api/products?search=${encodeURIComponent(`QA68 Rod Renamed ${ts}`)}`)
  ok((listRenamed.json?.data ?? []).some((p) => p.id === productId), 'public list serves the NEW product name INSTANTLY')

  const hidden = await seller('PATCH', `/api/supplier/products/${productId}`, { isActive: false })
  ok([200, 201].includes(hidden.status), 'seller hides product (isActive toggle)')
  const listHidden = await anon('GET', `/api/products?search=${encodeURIComponent(`QA68 Rod Renamed ${ts}`)}`)
  ok((listHidden.json?.data ?? []).length === 0, 'hidden product leaves the public list INSTANTLY')

  const shown = await seller('PATCH', `/api/supplier/products/${productId}`, { isActive: true })
  ok([200, 201].includes(shown.status), 'seller re-shows product')
  const listShown = await anon('GET', `/api/products?search=${encodeURIComponent(`QA68 Rod Renamed ${ts}`)}`)
  ok((listShown.json?.data ?? []).length === 1, 're-shown product back on the public list INSTANTLY')

  // ════════════════════════ SECTION C: suppliers:list ════════════════════════
  section('C) suppliers:list invalidation on KYC decisions')

  const sup0 = await anon('GET', '/api/suppliers')
  ok(sup0.status === 200, 'public suppliers list primed')
  const supId = (sup0.json?.data ?? []).find((s) => s.companyName?.startsWith('QA68 Shop'))?.id
  ok(Boolean(supId), 'supplier visible on the public list', `id=${supId}`)
  const statusBefore = (sup0.json.data).find((s) => s.id === supId)?.verificationStatus

  const kyc = await admin('PATCH', '/api/admin/suppliers', { supplierId: supId, action: 'approve' })
  ok([200, 201].includes(kyc.status), 'admin approves supplier KYC')
  const sup1 = await anon('GET', '/api/suppliers')
  const statusAfter = (sup1.json?.data ?? []).find((s) => s.id === supId)?.verificationStatus
  ok(statusAfter === 'approved' && statusBefore !== 'approved', 'public suppliers list serves the NEW status INSTANTLY', `${statusBefore} -> ${statusAfter}`)

  // ════════════════════════ SECTION D: buyer payment notifications ════════════════════════
  section('D) 68-c — buyer notification rows on the manual payment leg')

  const order1 = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 2 }] })
  ok(order1.status === 201 && Boolean(order1.json?.data?.orderId), 'buyer creates order', JSON.stringify(order1.json?.error))
  const orderId1 = order1.json.data.orderId
  const total1 = order1.json.data.totalAmount

  const notifBefore = await buyerNotifications(buyer)
  const baseCount = notifBefore.filter((n) => n.type === 'payment').length

  const sub1 = await buyer('POST', `/api/orders/${orderId1}/payment-submit`, {
    method: 'mobile_banking', transactionId: `QA68TX${ts}A`, brand: 'bKash',
  })
  ok(sub1.status === 201 && Boolean(sub1.json?.data?.paymentId), 'buyer submits payment credentials', `got ${sub1.status}`)
  const paymentId1 = sub1.json.data.paymentId

  await sleep(300) // notification is fire-and-forget after commit
  const notif1 = await buyerNotifications(buyer)
  const submittedRow = notif1.find((n) => n.type === 'payment' && n.relatedPaymentId === paymentId1)
  ok(Boolean(submittedRow), 'payment-submitted notification row EXISTS for the buyer (was: none)')
  ok(submittedRow?.title === `Payment Submitted: ${order1.json.data.orderNumber}`, 'submitted title carries the order number', submittedRow?.title)
  ok(submittedRow?.relatedId === orderId1, 'row carries relatedId = orderId (deep-link contract)')

  const verify1 = await seller('POST', `/api/seller/payments/${paymentId1}/verify`, { action: 'verify' })
  ok(verify1.status === 200, 'seller verifies the payment')
  await sleep(300)
  const notif2 = await buyerNotifications(buyer)
  const verifiedRow = notif2.find((n) => n.type === 'payment' && n.relatedPaymentId === paymentId1 && /Verified/.test(n.title ?? ''))
  ok(Boolean(verifiedRow), 'payment-VERIFIED notification row for the buyer')
  ok(/PAID and the supplier can start processing/.test(verifiedRow?.message ?? ''), 'full-amount verify body says PAID (honest math)')
  const orderAfter1 = await buyer('GET', `/api/orders/${orderId1}`)
  ok(orderAfter1.json?.data?.paymentStatus === 'paid', 'order paymentStatus = paid after full verify')

  // Partial path — a genuinely smaller payment leaves the order PARTIAL and
  // the notification says so.
  const order2 = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 1 }] })
  const orderId2 = order2.json.data.orderId
  const total2 = order2.json.data.totalAmount
  const sub2 = await buyer('POST', `/api/orders/${orderId2}/payment-submit`, {
    method: 'mobile_banking', transactionId: `QA68TX${ts}B`, amount: Math.max(1, Math.floor(total2 / 2)),
  })
  ok(sub2.status === 201, 'buyer submits a PARTIAL amount')
  const paymentId2 = sub2.json.data.paymentId
  const verify2 = await seller('POST', `/api/seller/payments/${paymentId2}/verify`, { action: 'verify' })
  ok(verify2.status === 200 && verify2.json?.data?.orderPaymentStatus === 'partial', 'seller verifies partial → order PARTIAL')
  await sleep(300)
  const notif3 = await buyerNotifications(buyer)
  const partialRow = notif3.find((n) => n.type === 'payment' && n.relatedPaymentId === paymentId2)
  ok(/Partially Verified/.test(partialRow?.title ?? ''), 'PARTIAL verify produces the honest "Partially Verified" title', partialRow?.title)
  ok(/PARTIALLY PAID/.test(partialRow?.message ?? ''), 'partial body spells the remaining-balance truth')

  // Reject path.
  const order3 = await buyer('POST', '/api/orders', { items: [{ productId, quantity: 1 }] })
  const orderId3 = order3.json.data.orderId
  const sub3 = await buyer('POST', `/api/orders/${orderId3}/payment-submit`, {
    method: 'bank_transfer', transactionId: `QA68TX${ts}C`,
  })
  const paymentId3 = sub3.json.data.paymentId
  const rej = await seller('POST', `/api/seller/payments/${paymentId3}/verify`, { action: 'reject', note: 'QA68 no money arrived' })
  ok(rej.status === 200, 'seller rejects the payment')
  await sleep(300)
  const notif4 = await buyerNotifications(buyer)
  const rejectedRow = notif4.find((n) => n.type === 'payment' && n.relatedPaymentId === paymentId3)
  ok(/Rejected/.test(rejectedRow?.title ?? ''), 'REJECTED notification row for the buyer')
  ok((rejectedRow?.message ?? "").includes('QA68 no money arrived'), 'reject body carries the seller note verbatim')

  // Admin override path (a SECOND payment on order 3 — order 3 is unpaid again
  // after the reject, so it accepts a new submission).
  const sub4 = await buyer('POST', `/api/orders/${orderId3}/payment-submit`, {
    method: 'mobile_banking', transactionId: `QA68TX${ts}D`,
  })
  ok(sub4.status === 201, 'buyer re-submits after the reject (order still unpaid)')
  const paymentId4 = sub4.json.data.paymentId
  const adminVerify = await admin('POST', `/api/admin/payments/${paymentId4}/verify`, { action: 'verify' })
  ok(adminVerify.status === 200, 'admin override-verifies the payment')
  await sleep(300)
  const notif5 = await buyerNotifications(buyer)
  const adminRow = notif5.find((n) => n.type === 'payment' && n.relatedPaymentId === paymentId4)
  ok(/Verified/.test(adminRow?.title ?? ''), 'admin override reaches the buyer as a REAL row too')

  // Payment family counts + deep-link integrity.
  const notifFinal = await buyerNotifications(buyer)
  const paymentRows = notifFinal.filter((n) => n.type === 'payment')
  ok(paymentRows.length === baseCount + 8, 'exactly 8 payment rows added (4 submits + 3 verifies + 1 reject)', `${paymentRows.length} vs base ${baseCount}`)
  ok(paymentRows.every((n) => n.relatedId && n.relatedPaymentId), 'EVERY payment row carries BOTH deep-link ids (order + payment)')

  section('E) DB audit — the rows are REAL, the ids match the payments table')
  const payRows = await db.payments.findMany({ where: { id: { in: [paymentId1, paymentId2, paymentId3, paymentId4] } } })
  ok(payRows.length === 4, 'all 4 payments rows exist')
  const notifRows = await db.notifications.findMany({ where: { type: 'payment', relatedPaymentId: { not: null } } })
  ok(notifRows.length === paymentRows.length, 'notifications table: one real row per payment event', `${notifRows.length}`)
  const auditRows = await db.auditLogs.findMany({
    where: { action: { in: ['payment_submitted', 'payment_verified', 'payment_rejected'] }, entityType: 'payments' },
  })
  ok(auditRows.length === 8, '8 audit rows (4 submits + 3 verifies + 1 reject)', `${auditRows.length}`)

  console.log(`\n════════════════════════════════════════`)
  console.log(`PASS ${PASS}  FAIL ${FAIL}`)
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log(`  - ${f}`)
  }
  process.exitCode = FAIL ? 1 : 0
  await db.$disconnect()
}

main().catch(async (err) => {
  console.error('HARNESS CRASH:', err)
  process.exitCode = 1
  await db.$disconnect()
})
