/**
 * Task 84 E2E — SUPPLIER VERIFICATION LIFECYCLE + THE DOC-PATCH HOLE.
 * The drill caught a real hole before anything else: PATCH
 * /api/supplier/verification/[docId] authenticated ANY user, checked NO
 * ownership, and accepted ANY status string — any buyer could flip any
 * seller's KYC document to 'verified' with no audit. Rebuilt this task as an
 * admin-only review rail (Zod strict, reviewedAt, audit, seller notified).
 *
 * The drill then walks the honest lifecycle: 4 required documents uploaded
 * (pending) → resubmission replaces → admin reviews each document
 * (under_review → rejected-with-reason → verified; seller notified every
 * step) → profile-level review → reject-with-reason → approve, all audited.
 *
 * Run: bun scripts/qa/t84-e2e.mjs   (DB EMPTY — first-admin window; dev FRESH)
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
  const ip = `10.103.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  const call = async function call(method, path_, body, rawBody) {
    const res = await fetch(`${BASE}${path_}`, {
      method,
      headers: {
        ...(body !== undefined && !rawBody ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        'X-Forwarded-For': ip,
      },
      body: rawBody !== undefined && rawBody !== null ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
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
    fullName: `QA84 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA84 Shop ${email.slice(5, 12)}` } : {}),
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

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
function multipartDoc(docType) {
  const fd = new FormData()
  fd.append('type', docType)
  fd.append('file', new File([PNG], `${docType}.png`, { type: 'image/png' }))
  return fd
}

const main = async () => {
  const PASSWORD = 't84-Kyc-Qa1!'
  const anon = makeSession()
  const admin = makeSession()
  const seller = makeSession()
  const buyer = makeSession()

  section('A. auth gates + THE HOLE PROOF')
  {
    const g1 = await anon('POST', '/api/supplier/verification', undefined, multipartDoc('nid_front'))
    ok(g1.status === 401, 'anon doc upload -> 401', `got ${g1.status}`)
    const g2 = await anon('PATCH', '/api/supplier/verification/some-id', { status: 'verified' })
    ok(g2.status === 401, 'anon doc review -> 401', `got ${g2.status}`)
    await registerAndLogin(buyer, 'buyer', 'qa84-buyer@qa.local', PASSWORD)
    const hole = await buyer('PATCH', '/api/supplier/verification/some-id', { status: 'verified' })
    ok(hole.status === 401, 'BUYER cannot flip a doc to verified -> 401 (THE HOLE, closed this task)', `got ${hole.status} ${JSON.stringify(hole.json).slice(0, 100)}`)
    const g3 = await anon('PATCH', '/api/admin/suppliers', { supplierId: 'x', action: 'approve' })
    ok(g3.status === 401, 'anon profile decision -> 401', `got ${g3.status}`)
  }

  section('B. seller registers (profile pending) + uploads the 4 required docs')
  await registerAndLogin(admin, 'admin', 'qa84-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa84-supa@qa.local', PASSWORD)
  const profile = await db.supplierProfiles.findFirst({
    where: { user: { email: 'qa84-supa@qa.local' } },
    select: { id: true, verificationStatus: true },
  })
  ok(profile?.verificationStatus === 'pending', 'new seller profile starts pending')
  for (const t of ['trade_license', 'tin_certificate', 'nid_front', 'bank_statement']) {
    const up = await seller('POST', '/api/supplier/verification', undefined, multipartDoc(t))
    if (![200, 201].includes(up.status)) { ok(false, `upload ${t}`, `got ${up.status}`); continue }
    ok(true, `uploaded ${t}`)
  }

  section('C. upload guards + honest progress + resubmission')
  {
    const badType = await seller('POST', '/api/supplier/verification', undefined, multipartDoc('passport'))
    ok(badType.status === 400, 'unknown document type -> 400', `got ${badType.status}`)
    const fd = new FormData()
    fd.append('type', 'nid_front')
    fd.append('file', new File([Buffer.from('not an image at all')], 'fake.png', { type: 'text/plain' }))
    const badMime = await seller('POST', '/api/supplier/verification', undefined, fd)
    ok(badMime.status === 400, 'non-image file -> 400', `got ${badMime.status}`)
    const docs = await seller('GET', '/api/supplier/verification')
    const rows = docs.json?.data?.documents ?? docs.json?.data ?? []
    ok(Array.isArray(rows) && rows.length === 4, 'exactly 4 real document rows', `got ${Array.isArray(rows) ? rows.length : '?'}`)
    ok(rows.every((r) => r.status === 'pending'), 'every upload starts pending')
    const progress = docs.json?.progress
    ok(progress?.verifiedRequired === 0 && progress?.percent === 0, 'progress honestly 0 of 4 (nothing verified yet)', JSON.stringify(progress))
    const re = await seller('POST', '/api/supplier/verification', undefined, multipartDoc('trade_license'))
    ok([200, 201].includes(re.status), 'resubmission accepted')
    const docs2 = await seller('GET', '/api/supplier/verification')
    const rows2 = docs2.json?.data?.documents ?? docs2.json?.data ?? []
    ok(rows2.length === 4, 'resubmission REPLACED the same type (still 4 rows, not 5)', `got ${rows2.length}`)
  }

  section('D. admin reviews the DOCUMENTS (the rebuilt rail)')
  {
    const docs = await seller('GET', '/api/supplier/verification')
    const rows = docs.json?.data?.documents ?? docs.json?.data ?? []
    const tl = rows.find((r) => r.documentType === 'trade_license')
    const nid = rows.find((r) => r.documentType === 'nid_front')
    ok(Boolean(tl && nid), 'doc ids resolved for review')

    const sellerFlip = await seller('PATCH', `/api/supplier/verification/${tl.id}`, { status: 'verified' })
    ok(sellerFlip.status === 401, 'the SELLER cannot review their own doc -> 401 (admin rail)', `got ${sellerFlip.status}`)

    const badBody = await admin('PATCH', `/api/supplier/verification/${tl.id}`, { status: 'whatever' })
    ok(badBody.status === 400, 'free-form status string -> 400 (the old route accepted any)', `got ${badBody.status}`)
    const ur = await admin('PATCH', `/api/supplier/verification/${tl.id}`, { status: 'under_review' })
    ok(ur.status === 200 && ur.json?.data?.reviewedAt, 'under_review with reviewedAt', `got ${ur.status}`)
    const rejNoReason = await admin('PATCH', `/api/supplier/verification/${nid.id}`, { status: 'rejected' })
    ok(rejNoReason.status === 400, 'rejection without a reason -> 400', `got ${rejNoReason.status}`)
    const rej = await admin('PATCH', `/api/supplier/verification/${nid.id}`, { status: 'rejected', rejectionReason: 'Photo is blurry — re-upload' })
    ok(rej.status === 200 && rej.json?.data?.rejectionReason === 'Photo is blurry — re-upload', 'rejected WITH the reason recorded', `got ${rej.status}`)

    // seller re-uploads the rejected doc and it passes this time
    const reup = await seller('POST', '/api/supplier/verification', undefined, multipartDoc('nid_front'))
    ok([200, 201].includes(reup.status), 'seller re-uploads the rejected doc')
    const docs2 = await seller('GET', '/api/supplier/verification')
    const rows2 = docs2.json?.data?.documents ?? docs2.json?.data ?? []
    const nid2 = rows2.find((r) => r.documentType === 'nid_front')
    const v1 = await admin('PATCH', `/api/supplier/verification/${nid2.id}`, { status: 'verified' })
    ok(v1.status === 200 && v1.json?.data?.status === 'verified', 'resubmitted doc verified')
    const v2 = await admin('PATCH', `/api/supplier/verification/${tl.id}`, { status: 'verified' })
    ok(v2.status === 200, 'trade_license verified')
    for (const t of ['tin_certificate', 'bank_statement']) {
      const rr = rows2.find((r) => r.documentType === t)
      await admin('PATCH', `/api/supplier/verification/${rr.id}`, { status: 'verified' })
    }
    const docs3 = await seller('GET', '/api/supplier/verification')
    const rows3 = docs3.json?.data?.documents ?? docs3.json?.data ?? []
    const verifiedCount = rows3.filter((r) => r.status === 'verified').length
    ok(verifiedCount === 4, 'all 4 required docs verified', `got ${verifiedCount}`)

    const notifs = await db.notifications.findMany({
      where: { userId: (await db.users.findFirst({ where: { email: 'qa84-supa@qa.local' }, select: { id: true } }))?.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
    })
    const titles = notifs.map((n) => n.title)
    ok(titles.some((t) => /rejected/i.test(t) && /NID/i.test(t)), 'the seller was NOTIFIED of the rejection with the doc label', titles.join(' | ').slice(0, 140))
  }

  section('E. profile-level review rail')
  {
    const noReason = await admin('PATCH', '/api/admin/suppliers', { supplierId: profile.id, action: 'reject' })
    ok(noReason.status === 400, 'profile rejection without reason -> 400', `got ${noReason.status}`)
    const review = await admin('PATCH', '/api/admin/suppliers', { supplierId: profile.id, action: 'review' })
    ok(review.status === 200, 'admin moves the profile to under_review', `got ${review.status}`)
    const rej = await admin('PATCH', '/api/admin/suppliers', { supplierId: profile.id, action: 'reject', reason: 'Warehouse address could not be confirmed' })
    ok(rej.status === 200, 'profile rejected with the real reason', `got ${rej.status}`)
    const row1 = await db.supplierProfiles.findUnique({ where: { id: profile.id }, select: { verificationStatus: true, rejectionReason: true } })
    ok(row1?.verificationStatus === 'rejected' && /Warehouse/.test(row1?.rejectionReason ?? ''), 'DB carries rejected + the reason', JSON.stringify(row1))
    const apr = await admin('PATCH', '/api/admin/suppliers', { supplierId: profile.id, action: 'approve' })
    ok(apr.status === 200, 'profile approved')
    const row2 = await db.supplierProfiles.findUnique({ where: { id: profile.id }, select: { verificationStatus: true, rejectionReason: true, verifiedAt: true } })
    ok(row2?.verificationStatus === 'approved' && row2?.rejectionReason === null && row2?.verifiedAt !== null, 'approved clears the reason and stamps verifiedAt', JSON.stringify(row2))

    const verifyRoute = await admin('POST', `/api/suppliers/${profile.id}/verify`, { action: 'approve' })
    ok([200, 201].includes(verifyRoute.status), 'the twin POST /api/suppliers/[id]/verify rail works too', `got ${verifyRoute.status}`)
  }

  section('F. audits')
  {
    const audits = await db.auditLogs.findMany({
      where: { action: { in: ['verification_document_reviewed', 'supplier_kyc_approve', 'supplier_kyc_reject', 'supplier_kyc_review'] } },
      select: { action: true },
    })
    const actions = audits.map((a) => a.action)
    ok(actions.includes('verification_document_reviewed'), 'doc reviews audited', `${actions.filter((a) => a === 'verification_document_reviewed').length} doc rows`)
    ok(actions.includes('supplier_kyc_approve') && actions.includes('supplier_kyc_reject') && actions.includes('supplier_kyc_review'), 'profile decisions audited (review/reject/approve)')
  }

  console.log(`\n═══ t84 RESULT: ${PASS} PASS / ${FAIL} FAIL ═══`)
  if (FAIL > 0) { console.log('FAILURES:', failures.join(' | ')); process.exit(1) }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1) }).finally(async () => { await db.$disconnect() })
