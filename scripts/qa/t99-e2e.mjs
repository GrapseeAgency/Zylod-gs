/**
 * Task 99 E2E — THE EDITORIAL RAIL ("the blog page asked /api/blog for
 * years; this round the endpoint finally exists").
 *
 *   A. public gates — the reader needs NO account (pre-purchase content)
 *   B. admin gates — requireUserType 401-first
 *   C. create — Zod STRICT, server-side slugify + uniquify on title clash,
 *      draft vs publish-now stamps
 *   D. draft invisibility — the public list hides drafts and a draft slug is
 *      the SAME 404 as a phantom one
 *   E. publish — the stamp lands ONCE and never moves (unpublish → re-publish
 *      keeps the first date; title edits don't move it either)
 *   F. unpublish — the public link genuinely refuses; the admin list keeps it
 *   G. edit — the public surface reflects the new title verbatim
 *   H. delete — gone is gone
 *   I. admin stats — real groupBy {total, published, drafts}
 *   J. audit — blog_created/updated/deleted in raw DB
 *
 * Run: bun scripts/qa/t99-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.99.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA99 ${userType}` }
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

const CONTENT = 'Sourcing in bulk means vetting before you wire money. This guide walks the full checklist: licenses, references, samples, and the platform escrow that keeps both sides honest.'
const CONTENT2 = 'Updated for the new season: the same checklist now includes certification documents and third-party inspection slots booked right on the order.'

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't99-E2e-Str0ng1!'
  const admin = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa99-admin@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa99-buyer@qa.local', PASSWORD)
  console.log('  accounts ready')

  /* ── A. public gates ── */
  console.log('— A. public gates —')
  const empty = await makeSession()('GET', '/api/blog')
  ok(empty.status === 200 && empty.json?.count === 0, 'public list → 200, honest zero before any post', JSON.stringify(empty.json?.count))
  ok((await makeSession()('GET', '/api/blog/never-written')).status === 404, 'phantom slug → 404')

  /* ── B. admin gates ── */
  console.log('— B. admin gates —')
  ok((await makeSession()('GET', '/api/admin/blog')).status === 401, 'anon admin list → 401')
  ok((await makeSession()('POST', '/api/admin/blog', { title: 'X' })).status === 401, 'anon create → 401')
  ok((await buyer('POST', '/api/admin/blog', { title: 'Xxxx', content: 'y'.repeat(30) })).status === 401, 'buyer create → 401 (requireUserType)')

  /* ── C. create ── */
  console.log('— C. create —')
  ok((await admin('POST', '/api/admin/blog', { title: 'Good title here', content: 'y'.repeat(30), bogus: 1 })).status === 400, 'strict keys → 400')
  ok((await admin('POST', '/api/admin/blog', { title: 'Hi', content: 'y'.repeat(30) })).status === 400, 'title < 4 → 400')
  ok((await admin('POST', '/api/admin/blog', { title: 'Good title here', content: 'short' })).status === 400, 'content < 20 → 400')
  ok((await admin('POST', '/api/admin/blog', { title: 'Good title here', content: 'y'.repeat(30), coverImageUrl: 'not-a-url' })).status === 400, 'bad coverImageUrl → 400')
  const d1 = await admin('POST', '/api/admin/blog', {
    title: 'How to Vet a Supplier Before a Bulk Order',
    content: CONTENT, excerpt: 'The full pre-order checklist.', category: 'Sourcing guide',
  })
  ok(d1.status === 201 && d1.json?.data?.slug === 'how-to-vet-a-supplier-before-a-bulk-order', 'draft created, server slugified the title', JSON.stringify(d1.json?.data?.slug))
  ok(d1.json?.data?.isPublished === false && d1.json?.data?.publishedAt === null, 'draft: not published, no stamp')
  const clash = await admin('POST', '/api/admin/blog', {
    title: 'How to Vet a Supplier Before a Bulk Order?!',
    content: CONTENT, isPublished: true,
  })
  ok(clash.status === 201 && clash.json?.data?.slug === 'how-to-vet-a-supplier-before-a-bulk-order-2', 'title clash → slug uniquified (-2), never a 500', JSON.stringify(clash.json?.data?.slug))
  ok(clash.json?.data?.isPublished === true && Boolean(clash.json?.data?.publishedAt), 'publish-now create stamps publishedAt')

  /* ── D. draft invisibility ── */
  console.log('— D. draft invisibility —')
  const pubList0 = await makeSession()('GET', '/api/blog')
  ok(pubList0.json?.count === 1 && pubList0.json?.data?.[0]?.slug === clash.json?.data?.slug, 'public list serves ONLY the published one (draft hidden)')
  ok((await makeSession()('GET', '/api/blog/how-to-vet-a-supplier-before-a-bulk-order')).status === 404, 'DRAFT slug → the SAME 404 as phantom (never discoverable)')

  /* ── E. publish ── */
  console.log('— E. publish —')
  const pub = await admin('PATCH', `/api/admin/blog/${d1.json?.data?.id}`, { isPublished: true })
  ok(pub.status === 200 && pub.json?.data?.isPublished === true && Boolean(pub.json?.data?.publishedAt), 'draft published → stamped')
  const stamp1 = pub.json?.data?.publishedAt
  const slug1 = d1.json?.data?.slug
  const read = await makeSession()('GET', `/api/blog/${slug1}`)
  ok(read.status === 200 && read.json?.data?.content === CONTENT && read.json?.data?.excerpt === 'The full pre-order checklist.', 'public read serves the full published body', JSON.stringify(read.json?.data?.title))
  ok(!('isPublished' in read.json?.data ?? {}), 'public read reflects no internal flags')
  // The stamp never moves: edit title, unpublish, re-publish.
  await admin('PATCH', `/api/admin/blog/${d1.json?.data?.id}`, { title: 'How to Vet a Supplier (2026 Edition)' })
  await admin('PATCH', `/api/admin/blog/${d1.json?.data?.id}`, { isPublished: false })
  await admin('PATCH', `/api/admin/blog/${d1.json?.data?.id}`, { isPublished: true })
  const reRead = await makeSession()('GET', `/api/blog/${slug1}`)
  ok(reRead.status === 200 && reRead.json?.data?.title === 'How to Vet a Supplier (2026 Edition)', 'edited title served verbatim')
  const afterCycles = await admin('GET', '/api/admin/blog')
  const mine = afterCycles.json?.data?.find((p) => p.id === d1.json?.data?.id)
  ok(mine?.publishedAt === stamp1, 'publishedAt NEVER moved (edit + unpublish + re-publish keep the first stamp)', JSON.stringify({ stamp1, now: mine?.publishedAt }))

  /* ── F. unpublish ── */
  console.log('— F. unpublish —')
  await admin('PATCH', `/api/admin/blog/${clash.json?.data?.id}`, { isPublished: false })
  ok((await makeSession()('GET', '/api/blog')).json?.count === 1, 'unpublished post drops from the public list')
  ok((await makeSession()('GET', `/api/blog/${clash.json?.data?.slug}`)).status === 404, 'unpublished slug now refuses (the link is genuinely dead)')
  ok((await admin('GET', '/api/admin/blog')).json?.data?.length === 2, 'admin list keeps both rows')

  /* ── H/I/J. delete + stats + audit ── */
  console.log('— G. delete + stats + audit —')
  ok((await admin('PATCH', '/api/admin/blog/phantom-id', { title: 'Xxxx' })).status === 404, 'phantom PATCH → 404')
  ok((await admin('DELETE', '/api/admin/blog/phantom-id')).status === 404, 'phantom DELETE → 404')
  ok((await admin('DELETE', `/api/admin/blog/${clash.json?.data?.id}`)).status === 200, 'owner delete → 200')
  ok((await admin('DELETE', `/api/admin/blog/${clash.json?.data?.id}`)).status === 404, 're-delete → 404')
  const stats = (await admin('GET', '/api/admin/blog')).json?.stats
  ok(stats?.total === 1 && stats?.published === 1 && stats?.drafts === 0, 'admin stats real groupBy', JSON.stringify(stats))
  const audit = await db.auditLogs.groupBy({ by: ['action'], where: { action: { startsWith: 'blog' } }, _count: { action: true } })
  const counts = Object.fromEntries(audit.map((a) => [a.action, a._count.action]))
  ok(counts.blog_created === 2 && counts.blog_updated === 5 && counts.blog_deleted === 1, 'audit trail exact (2 created / 5 updated / 1 deleted)', JSON.stringify(counts))

  console.log(`\n=== t99 RESULT: ${PASS} PASS / ${FAIL} FAIL ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
  await db.$disconnect()
}
main().catch(async (e) => { console.error('DRILL ERROR:', e.message); process.exitCode = 1; await db.$disconnect() })
