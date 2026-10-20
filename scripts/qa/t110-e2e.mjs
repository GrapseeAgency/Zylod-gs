/**
 * Task 110 E2E — THE PRESS & INVESTOR RAIL ("four public pages — media
 * kit, investor relations, financial filings, annual report — have read
 * two tables with zero writers since day one").
 *
 * Run: node scripts/qa/t110-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.110.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA110 ${userType}` }
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
  console.log('— setup —')
  const PASSWORD = 't110-E2e-Str0ng1!'
  const admin = makeSession()
  await registerAndLogin(admin, 'admin', 'qa110-admin@qa.local', PASSWORD)
  console.log('  admin ready')

  /* A. public readers honest-zero */
  console.log('— A. public readers —')
  const mkEmpty = await makeSession()('GET', '/api/press/media-kit')
  ok(mkEmpty.status === 200 && mkEmpty.json?.data?.total === 0, 'media kit → honest zero before any write')
  const invEmpty = await makeSession()('GET', '/api/investor')
  ok(invEmpty.status === 200 && invEmpty.json?.data?.total === 0, 'investor list → honest zero', JSON.stringify(invEmpty.json?.data?.total))

  /* B. gates */
  console.log('— B. gates —')
  ok((await makeSession()('GET', '/api/admin/media-kit')).status === 401, 'anon media kit → 401')
  ok((await makeSession()('GET', '/api/admin/investor-docs')).status === 401, 'anon investor docs → 401')

  /* C. media kit */
  console.log('— C. media kit —')
  ok((await admin('POST', '/api/admin/media-kit', { assetType: 'logo', title: 'T', fileUrl: 'ftp://bad', })).status === 400, 'non-https fileUrl → 400')
  ok((await admin('POST', '/api/admin/media-kit', { assetType: 'logo', title: 'T', fileUrl: 'https://x.test/a.png', bogus: 1 })).status === 400, 'strict keys → 400')
  ok((await admin('POST', '/api/admin/media-kit', { assetType: 'meme', title: 'T', fileUrl: 'https://x.test/a.png' })).status === 400, 'invented assetType → 400')
  const a1 = await admin('POST', '/api/admin/media-kit', { assetType: 'logo', title: 'Zylod primary logo pack', fileUrl: 'https://cdn.zylod.test/logo-pack.zip', fileFormat: 'zip', fileSizeMB: 12.5 })
  ok(a1.status === 201 && a1.json?.data?.isPublic === true, 'logo asset created public')
  const a2 = await admin('POST', '/api/admin/media-kit', { assetType: 'executive_photo', title: 'CEO portrait', fileUrl: '/uploads/press/ceo.jpg', isPublic: false })
  ok(a2.status === 201 && a2.json?.data?.isPublic === false, 'private asset created')
  const mk1 = await makeSession()('GET', '/api/press/media-kit')
  ok(mk1.json?.data?.total === 1 && mk1.json?.data?.assets?.[0]?.title === 'Zylod primary logo pack', 'private asset never leaves; public one does', JSON.stringify(mk1.json?.data?.total))
  ok(mk1.json?.data?.grouped?.logo?.length === 1, 'grouped by assetType verbatim')
  const aupd = await admin('PATCH', `/api/admin/media-kit/${a2.json?.data?.id}`, { isPublic: true })
  ok(aupd.status === 200 && aupd.json?.data?.isPublic === true, 'asset made public')
  const mk2 = await makeSession()('GET', '/api/press/media-kit')
  ok(mk2.json?.data?.total === 2, 'public rail reflects the flip')
  ok((await admin('DELETE', `/api/admin/media-kit/${a2.json?.data?.id}`)).status === 200, 'delete asset → 200')
  ok((await admin('DELETE', `/api/admin/media-kit/${a2.json?.data?.id}`)).status === 404, 're-delete → 404')

  /* D. investor docs */
  console.log('— D. investor docs —')
  ok((await admin('POST', '/api/admin/investor-docs', { docType: 'tax_return', title: 'T', fileUrl: 'https://x.test/a.pdf' })).status === 400, 'invented docType → 400')
  const d1 = await admin('POST', '/api/admin/investor-docs', { docType: 'annual_report', title: 'Zylod Annual Report FY2026', fiscalYear: '2026', fileUrl: 'https://cdn.zylod.test/ar-2026.pdf', summary: 'The full year in numbers.', isPublished: true })
  ok(d1.status === 201, 'annual report published')
  const d2 = await admin('POST', '/api/admin/investor-docs', { docType: 'quarterly_report', title: 'Q3 draft', fiscalYear: '2026', fiscalQ: 'q3', fileUrl: 'https://cdn.zylod.test/q3.pdf', isPublished: false })
  ok(d2.status === 201 && d2.json?.data?.isPublished === false, 'quarterly draft saved')
  const inv1 = await makeSession()('GET', '/api/investor')
  ok(inv1.json?.data?.total === 1 && !inv1.json?.data?.documents?.some((x) => x.id === d2.json?.data?.id), 'draft invisible on the public rail', JSON.stringify(inv1.json?.data?.total))
  const fin = await makeSession()('GET', '/api/investor/financial_filing')
  ok(fin.status === 200 || fin.status === 404, 'docType-scoped route answers honestly')
  const upd = await admin('PATCH', `/api/admin/investor-docs/${d2.json?.data?.id}`, { isPublished: true })
  ok(upd.status === 200, 'draft promoted')
  const inv2 = await makeSession()('GET', '/api/investor')
  ok(inv2.json?.data?.total === 2, 'public rail serves both after promotion')
  ok((await admin('DELETE', `/api/admin/investor-docs/${d2.json?.data?.id}`)).status === 200, 'delete doc → 200')

  /* E. audits */
  console.log('— E. audits —')
  const audits = await db.auditLogs.groupBy({ by: ['action'], _count: { action: true } })
  const count = (a) => audits.find((x) => x.action === a)?._count.action ?? 0
  ok(count('media_asset_created') === 2 && count('media_asset_updated') === 1 && count('media_asset_deleted') === 1, 'media audits exact {2/1/1}')
  ok(count('investor_doc_created') === 2 && count('investor_doc_updated') === 1 && count('investor_doc_deleted') === 1, 'investor audits exact {2/1/1}')

  console.log(`\nRESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('FATAL', e)
  await db.$disconnect()
  process.exit(1)
})
