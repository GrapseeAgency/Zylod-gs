/**
 * Task 106 E2E — THE COMPANY CONTENT RAIL ("the legal pages and the About
 * timeline have been asking since day one; this round their writers exist").
 *
 *   A. public gates — the readers are honest empties before any write
 *   B. admin gates — requireUserType 401-first on both rails
 *   C. docType discipline — only the nine slugs the pages fetch; STRICT keys
 *   D. upsert — the SAME row id survives a re-edit; the public reader
 *      reflects the version verbatim; the TOC slots the doc
 *   E. parked — isActive:false makes the public detail the SAME 404 as a
 *      phantom while the admin list keeps the row
 *   F. delete — the slot honestly reverts; re-delete is a 404
 *   G. milestones — create → public timeline; validation bounds; draft
 *      invisibility; PATCH before/after audit; delete
 *   H. stats + audits — real groupBy and exact audit counts
 *
 * Run: node scripts/qa/t106-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.106.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA106 ${userType}` }
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

const TERMS = 'These terms govern every bulk transaction on Zylod. Sellers list real inventory; buyers fund orders through verified payment rails; escrow holds supplier value until delivery is confirmed. Nothing here invents a number the platform cannot prove.'
const TERMS_V11 = 'Revised: the escrow release window is now 72 hours after delivery confirmation, and the dispute window opens automatically when a sub-order sits unshipped past its promise date.'

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't106-E2e-Str0ng1!'
  const admin = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa106-admin@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa106-buyer@qa.local', PASSWORD)
  console.log('  accounts ready')

  /* ── A. public gates ── */
  console.log('— A. public gates —')
  const tocEmpty = await makeSession()('GET', '/api/legal')
  ok(tocEmpty.status === 200 && tocEmpty.json?.data?.all?.length === 0, 'TOC → 200, honest zero before any write', JSON.stringify(tocEmpty.json?.data?.all?.length))
  ok((await makeSession()('GET', '/api/legal/terms_of_service')).status === 404, 'phantom docType detail → 404')
  const mEmpty = await makeSession()('GET', '/api/about/milestones')
  ok(mEmpty.status === 200 && mEmpty.json?.data?.total === 0, 'milestone timeline → 200, honest zero', JSON.stringify(mEmpty.json?.data?.total))

  /* ── B. admin gates ── */
  console.log('— B. admin gates —')
  ok((await makeSession()('GET', '/api/admin/legal')).status === 401, 'anon legal list → 401')
  ok((await makeSession()('PUT', '/api/admin/legal/terms_of_service', { titleEn: 'T', contentEn: 'C', version: '1.0', isActive: true })).status === 401, 'anon legal write → 401')
  ok((await buyer('GET', '/api/admin/legal')).status === 401, 'buyer legal list → 401 (requireUserType)')
  ok((await buyer('DELETE', '/api/admin/legal/terms_of_service')).status === 401, 'buyer legal delete → 401')
  ok((await buyer('GET', '/api/admin/milestones')).status === 401, 'buyer milestones list → 401')
  ok((await buyer('POST', '/api/admin/milestones', { year: 2024, title: 'T', description: 'D' })).status === 401, 'buyer milestone create → 401')

  /* ── C. docType discipline ── */
  console.log('— C. docType discipline —')
  const badType = await admin('PUT', '/api/admin/legal/not_a_type', { titleEn: 'T', contentEn: 'C', version: '1.0', isActive: true })
  ok(badType.status === 400 && String(badType.json?.error).includes('wholesale_terms'), 'unknown docType → 400 naming the allowed set', JSON.stringify(badType.json?.error))
  ok((await admin('PUT', '/api/admin/legal/terms_of_service', { titleEn: 'T', contentEn: 'C', version: '1.0', isActive: true, bogus: 1 })).status === 400, 'strict keys → 400')
  ok((await admin('PUT', '/api/admin/legal/terms_of_service', { titleEn: 'T', contentEn: 'C', isActive: true })).status === 400, 'missing version → 400')
  ok((await admin('PUT', '/api/admin/legal/terms_of_service', { titleEn: 'T', version: '1.0', isActive: true })).status === 400, 'missing contentEn → 400')
  ok((await admin('PUT', '/api/admin/legal/terms_of_service', { contentEn: 'C', version: '1.0', isActive: true })).status === 400, 'missing titleEn → 400')

  /* ── D. upsert + public reflection ── */
  console.log('— D. upsert + public reflection —')
  const d1 = await admin('PUT', '/api/admin/legal/terms_of_service', {
    titleEn: 'Terms of Service', titleBn: 'শর্তাবলী', contentEn: TERMS, version: '1.0', isActive: true,
  })
  ok(d1.status === 200 && d1.json?.data?.id, 'first write → 200 with row id', JSON.stringify(d1.json?.data?.id))
  const rowId = d1.json?.data?.id
  const pub1 = await makeSession()('GET', '/api/legal/terms_of_service')
  ok(pub1.status === 200 && pub1.json?.data?.document?.version === '1.0', 'public detail serves v1.0 verbatim', JSON.stringify(pub1.json?.data?.document?.version))
  ok(pub1.json?.data?.document?.titleBn === 'শর্তাবলী', 'Bangla title round-trips')
  const toc1 = await makeSession()('GET', '/api/legal')
  ok((toc1.json?.data?.grouped?.platformPolicies ?? []).some((d) => d.docType === 'terms_of_service'), 'TOC slots the doc under platformPolicies')
  const d2 = await admin('PUT', '/api/admin/legal/terms_of_service', {
    titleEn: 'Terms of Service', titleBn: 'শর্তাবলী', contentEn: TERMS_V11, version: '1.1', isActive: true,
  })
  ok(d2.status === 200 && d2.json?.data?.id === rowId, 're-edit keeps the SAME row id (honest upsert, no churn)', JSON.stringify(d2.json?.data?.id))
  const pub2 = await makeSession()('GET', '/api/legal/terms_of_service')
  ok(pub2.json?.data?.document?.version === '1.1' && String(pub2.json?.data?.document?.contentEn).includes('72 hours'), 'public detail reflects v1.1 content verbatim')

  /* ── E. parked semantics ── */
  console.log('— E. parked semantics —')
  const d3 = await admin('PUT', '/api/admin/legal/terms_of_service', {
    titleEn: 'Terms of Service', contentEn: TERMS_V11, version: '1.1', isActive: false,
  })
  ok(d3.status === 200 && d3.json?.data?.isActive === false, 'parked via isActive:false')
  ok((await makeSession()('GET', '/api/legal/terms_of_service')).status === 404, 'parked detail → the SAME 404 as a phantom (reader already promised this)')
  const toc2 = await makeSession()('GET', '/api/legal')
  ok((toc2.json?.data?.all ?? []).length === 0, 'parked doc leaves the TOC')
  const slots = await admin('GET', '/api/admin/legal')
  const termsSlot = (slots.json?.data ?? []).find((s) => s.docType === 'terms_of_service')
  ok(termsSlot?.filled === true && termsSlot?.document?.isActive === false, 'console keeps the parked row (filled, inactive)')
  ok(slots.json?.stats?.parked === 1 && slots.json?.stats?.published === 0 && slots.json?.stats?.empty === 8, 'slot stats exact {parked 1, published 0, empty 8}', JSON.stringify(slots.json?.stats))

  /* ── F. delete ── */
  console.log('— F. delete —')
  ok((await admin('DELETE', '/api/admin/legal/terms_of_service')).status === 200, 'delete parked doc → 200')
  ok((await makeSession()('GET', '/api/legal/terms_of_service')).status === 404, 'deleted doc → 404 on the public rail')
  ok((await admin('DELETE', '/api/admin/legal/terms_of_service')).status === 404, 're-delete → 404')
  const slotsAfter = await admin('GET', '/api/admin/legal')
  const termsAfter = (slotsAfter.json?.data ?? []).find((s) => s.docType === 'terms_of_service')
  ok(termsAfter?.filled === false && slotsAfter.json?.stats?.empty === 9, 'slot honestly reverts to Not written (empty 9)', JSON.stringify(slotsAfter.json?.stats))

  /* ── G. milestones ── */
  console.log('— G. milestones —')
  ok((await admin('POST', '/api/admin/milestones', { year: 2024, month: 13, title: 'T', description: 'D' })).status === 400, 'month 13 → 400')
  ok((await admin('POST', '/api/admin/milestones', { year: 1800, title: 'T', description: 'D' })).status === 400, 'year 1800 → 400')
  ok((await admin('POST', '/api/admin/milestones', { year: 2024, title: 'T', description: 'D', iconType: 'banana' })).status === 400, 'invented iconType → 400')
  ok((await admin('POST', '/api/admin/milestones', { year: 2024, title: 'T', description: 'D', bogus: 1 })).status === 400, 'strict keys → 400')
  ok((await admin('POST', '/api/admin/milestones', { year: 2024.5, title: 'T', description: 'D' })).status === 400, 'fractional year → 400')
  const m1 = await admin('POST', '/api/admin/milestones', {
    year: 2021, month: 6, title: 'Zylod opens the wholesale marketplace',
    description: 'First hundred sellers onboarded with verified trade licenses and the escrow rail live.',
    iconType: 'rocket', sortOrder: 1, isPublished: true,
  })
  ok(m1.status === 201 && m1.json?.data?.iconType === 'rocket', 'milestone created with rocket icon', JSON.stringify(m1.json?.data))
  const m2 = await admin('POST', '/api/admin/milestones', {
    year: 2022, title: 'Escrow release window standardized', description: 'Draft milestone — not yet part of the public story.', isPublished: false,
  })
  ok(m2.status === 201 && m2.json?.data?.isPublished === false, 'draft milestone saved')
  const pubM = await makeSession()('GET', '/api/about/milestones')
  ok(pubM.json?.data?.total === 1 && pubM.json?.data?.milestones?.[0]?.iconType === 'rocket', 'public timeline serves ONLY the published one (draft == phantom)', JSON.stringify(pubM.json?.data?.total))
  ok(pubM.json?.data?.years?.includes(2021) && !pubM.json?.data?.years?.includes(2022), 'years list reflects the public view')
  const patch1 = await admin('PATCH', `/api/admin/milestones/${m1.json?.data?.id}`, { title: 'Zylod opens wholesale to 1,000 sellers' })
  ok(patch1.status === 200 && patch1.json?.data?.title === 'Zylod opens wholesale to 1,000 sellers', 'PATCH title → public story changes')
  const pubM2 = await makeSession()('GET', '/api/about/milestones')
  ok(pubM2.json?.data?.milestones?.[0]?.title === 'Zylod opens wholesale to 1,000 sellers', 'public timeline reflects the edit verbatim')
  const patch2 = await admin('PATCH', `/api/admin/milestones/${m2.json?.data?.id}`, { isPublished: true })
  ok(patch2.status === 200 && patch2.json?.data?.isPublished === true, 'draft promoted to published')
  const pubM3 = await makeSession()('GET', '/api/about/milestones')
  ok(pubM3.json?.data?.total === 2, 'timeline now serves both')
  ok((await admin('PATCH', '/api/admin/milestones/phantom-id', { title: 'X' })).status === 404, 'phantom PATCH → 404')
  ok((await admin('DELETE', '/api/admin/milestones/phantom-id')).status === 404, 'phantom DELETE → 404')
  ok((await admin('DELETE', `/api/admin/milestones/${m2.json?.data?.id}`)).status === 200, 'delete milestone → 200')
  ok((await admin('DELETE', `/api/admin/milestones/${m2.json?.data?.id}`)).status === 404, 're-delete → 404')
  const pubM4 = await makeSession()('GET', '/api/about/milestones')
  ok(pubM4.json?.data?.total === 1, 'timeline honestly drops the deleted one')

  /* ── H. stats + audits ── */
  console.log('— H. stats + audits —')
  const mAdmin = await admin('GET', '/api/admin/milestones')
  ok(mAdmin.json?.stats?.total === 1 && mAdmin.json?.stats?.published === 1 && mAdmin.json?.stats?.drafts === 0, 'milestone console stats exact', JSON.stringify(mAdmin.json?.stats))
  const audits = await db.auditLogs.groupBy({ by: ['action'], _count: { action: true } })
  const count = (a) => audits.find((x) => x.action === a)?._count.action ?? 0
  ok(count('legal_document_saved') === 3, 'audit legal_document_saved ×3 (two edits + park)', JSON.stringify(count('legal_document_saved')))
  ok(count('legal_document_deleted') === 1, 'audit legal_document_deleted ×1')
  ok(count('milestone_created') === 2 && count('milestone_updated') === 2 && count('milestone_deleted') === 1, 'audit milestone created×2 updated×2 deleted×1')
  const updAudit = await db.auditLogs.findFirst({ where: { action: 'milestone_updated', entityId: m1.json?.data?.id }, orderBy: { createdAt: 'desc' } })
  const meta = JSON.parse(updAudit?.metadata ?? '{}')
  ok(meta?.before?.title === 'Zylod opens the wholesale marketplace' && meta?.after?.title === 'Zylod opens wholesale to 1,000 sellers', 'milestone audit carries REAL before/after', JSON.stringify(meta))

  console.log(`\nRESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('FATAL', e)
  await db.$disconnect()
  process.exit(1)
})
