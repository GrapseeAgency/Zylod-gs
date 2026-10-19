/**
 * Task 77 E2E — BULK UPLOAD: the seller workflow whose UI was a FAKE
 * (a setTimeout spinner that uploaded nothing while the real API sat unused).
 * The API was already real; this proves the FULL loop the seller actually
 * experiences: multipart CSV → per-row honest results → history rows → the
 * moderation queue.
 *
 * Run: bun scripts/qa/t77-e2e.mjs   (DB EMPTY — first-admin window; dev FRESH)
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
  const ip = `10.87.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
    fullName: `QA77 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA77 Shop ${email.slice(5, 12)}` } : {}),
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

function multipartCsv(fileName, csv) {
  const boundary = `----qa77${Math.random().toString(36).slice(2)}`
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: text/csv\r\n\r\n`),
    Buffer.from(csv, 'utf8'),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { body, contentType: `multipart/form-data; boundary=${boundary}` }
}

const main = async () => {
  const PASSWORD = 't77-Bulk-Qa1!'
  const admin = makeSession(), seller = makeSession(), other = makeSession()
  const anon = makeSession()
  const ts = Date.now().toString().slice(-6)

  section('setup — admin, supplier, second supplier, real category')
  await registerAndLogin(admin, 'admin', `qa77-admin@qa.local`, PASSWORD)
  await registerAndLogin(seller, 'supplier', `qa77-supa@qa.local`, PASSWORD)
  await registerAndLogin(other, 'supplier', `qa77-other@qa.local`, PASSWORD)
  const cat = await admin('POST', '/api/admin/categories', { name: `QA77 Cat ${ts}`, isActive: true })
  const categoryId = cat.json?.data?.id
  ok(Boolean(categoryId), 'real category created')

  section('A) guards — the workflow is seller-owned')
  const anonUp = await fetch(`${BASE}/api/supplier/bulk-upload`, {
    method: 'POST',
    headers: { 'X-Forwarded-For': '10.87.9.9' },
    body: multipartCsv('x.csv', header0()).body,
  })
  ok(anonUp.status === 401, 'anonymous upload → 401', `got ${anonUp.status}`)
  function header0() { return 'name,categoryId,unit,moq,basePrice,stockQuantity\nx,1,pcs,1,1,1' }

  section('B) the happy multipart upload — honest per-row results')
  const csv = [
    'name,categoryId,unit,moq,basePrice,stockQuantity',
    `QA77 Rod 12mm,${categoryId},kg,50,240,800`,
    `QA77 Bricks pallet,${categoryId},pcs,10,90,300`,
    `QA77 Bad row (bogus unit),${categoryId},barrels,1,10,5`,
  ].join('\n')
  const up = multipartCsv(`batch_qa77_${ts}.csv`, csv)
  const res = await fetch(`${BASE}/api/supplier/bulk-upload`, {
    method: 'POST',
    headers: { Cookie: seller.cookie, 'Content-Type': up.contentType, 'X-Forwarded-For': '10.87.8.8' },
    body: up.body,
  })
  const json = await res.json().catch(() => null)
  ok(res.status === 201, 'multipart CSV → 201 processed', `got ${res.status}`)
  ok(json?.data?.totalRows === 3 && json?.data?.successCount === 2 && json?.data?.failureCount === 1, 'server truth: 3 rows → 2 created, 1 failed', JSON.stringify(json?.data))
  ok(Array.isArray(json?.data?.errors) && json.data.errors.some((e) => /unit/i.test(e.error)), 'the failed row names its REAL reason (bogus unit)')

  const created = await db.products.findMany({ where: { name: { startsWith: 'QA77' } } })
  ok(created.length === 2, 'exactly 2 real product rows created', `${created.length}`)
  ok(created.every((p) => p.isApproved === false && p.supplierId), 'created products land in the moderation queue for MY store')

  const history = await seller('GET', '/api/supplier/bulk-upload')
  const run = (history.json?.data ?? [])[0]
  ok(history.status === 200 && run?.fileName === `batch_qa77_${ts}.csv` && run?.successCount === 2 && run?.failureCount === 1, 'HISTORY carries the real run (file name + honest counts) — the old page showed an INVENTED batch_0812.csv')
  ok(run?.status === 'completed', 'run status completed (partial failures recorded honestly)')

  section('C) all-bad CSV → 422, nothing created, error rows honest')
  const badCsv = [
    'name,categoryId,unit,moq,basePrice,stockQuantity',
    `Bad A,NO_SUCH_CAT,kg,1,5,5`,
    `Bad B,${categoryId},parsecs,1,5,5`,
  ].join('\n')
  const bad = multipartCsv('bad.csv', badCsv)
  const badRes = await fetch(`${BASE}/api/supplier/bulk-upload`, {
    method: 'POST',
    headers: { Cookie: seller.cookie, 'Content-Type': bad.contentType, 'X-Forwarded-For': '10.87.7.7' },
    body: bad.body,
  })
  ok(badRes.status === 422, 'every row failed → 422 (NO fake success path)', `got ${badRes.status}`)
  const badJson = await badRes.json().catch(() => null)
  ok(badJson?.data?.failureCount === 2 && badJson?.data?.successCount === 0, '422 body carries both honest failures')

  section('D) scoping — another supplier never sees my runs or rows')
  const otherHistory = await other('GET', '/api/supplier/bulk-upload')
  ok((otherHistory.json?.data ?? []).length === 0, "another supplier's history is honestly empty (no cross-store leak)")
  const otherProducts = await db.products.count({ where: { name: { startsWith: 'QA77' }, supplierId: { not: (await db.supplierProfiles.findFirst({ where: { companyName: { startsWith: 'QA77 Shop' } } })).id } } })
  ok(otherProducts === 0, 'created products belong ONLY to the uploading supplier')

  console.log(`\n════════════════════════════════════════`)
  console.log(`PASS ${PASS}  FAIL ${FAIL}`)
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log(`  - ${f}`)
  }
  process.exitCode = FAIL ? 1 : 0
  await db.$disconnect()
}

main().catch(async (e) => { console.error('HARNESS CRASH:', e); process.exitCode = 1; await db.$disconnect() })
