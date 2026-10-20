/**
 * Task 108 E2E — THE DELIVERY-METHODS RAIL ("the checkout has asked for
 * admin-configured couriers since day one and honestly showed an empty
 * page; this round the writer exists").
 *
 *   A. public reader — honest zero, then the rows appear verbatim
 *   B. admin gates — requireUserType 401-first
 *   C. validation — STRICT keys, price bounds, icon enum
 *   D. full CRUD — create, edit (public reflects verbatim), park (buyer
 *      loses the option while the console keeps the row), delete, re-delete
 *   E. ordering + stats — sortOrder wins; real groupBy
 *   F. audits — created/updated/deleted exact
 *
 * Run: node scripts/qa/t108-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.108.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA108 ${userType}` }
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
  const PASSWORD = 't108-E2e-Str0ng1!'
  const admin = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa108-admin@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa108-buyer@qa.local', PASSWORD)
  console.log('  accounts ready')

  /* ── A. public reader ── */
  console.log('— A. public reader —')
  const empty = await makeSession()('GET', '/api/delivery-methods')
  ok(empty.status === 200 && Array.isArray(empty.json?.data) && empty.json.data.length === 0, 'public list → 200, honest zero before any write', JSON.stringify(empty.json?.data))

  /* ── B. admin gates ── */
  console.log('— B. admin gates —')
  ok((await makeSession()('GET', '/api/admin/delivery-methods')).status === 401, 'anon admin list → 401')
  ok((await makeSession()('POST', '/api/admin/delivery-methods', { name: 'X', price: 0 })).status === 401, 'anon create → 401')
  ok((await buyer('GET', '/api/admin/delivery-methods')).status === 401, 'buyer admin list → 401')
  ok((await buyer('POST', '/api/admin/delivery-methods', { name: 'Courier X', price: 100 })).status === 401, 'buyer create → 401')
  ok((await buyer('DELETE', '/api/admin/delivery-methods/whatever')).status === 401, 'buyer delete → 401')

  /* ── C. validation ── */
  console.log('— C. validation —')
  ok((await admin('POST', '/api/admin/delivery-methods', { name: 'Courier X', price: 100, bogus: 1 })).status === 400, 'strict keys → 400')
  ok((await admin('POST', '/api/admin/delivery-methods', { price: 100 })).status === 400, 'missing name → 400')
  ok((await admin('POST', '/api/admin/delivery-methods', { name: 'Courier X', price: -5 })).status === 400, 'negative price → 400')
  ok((await admin('POST', '/api/admin/delivery-methods', { name: 'Courier X', price: 999_999 })).status === 400, 'price over cap → 400')
  ok((await admin('POST', '/api/admin/delivery-methods', { name: 'Courier X', price: 100, icon: 'dragon' })).status === 400, 'invented icon → 400')
  ok((await admin('PATCH', '/api/admin/delivery-methods/phantom-id', { name: 'X', price: 1 })).status === 404, 'phantom PATCH → 404')
  ok((await admin('DELETE', '/api/admin/delivery-methods/phantom-id')).status === 404, 'phantom DELETE → 404')

  /* ── D. full CRUD ── */
  console.log('— D. full CRUD —')
  const c1 = await admin('POST', '/api/admin/delivery-methods', {
    name: 'Sundarban Courier', description: 'Doorstep with tracking', price: 140,
    estimatedDelivery: '2-4 days', badge: 'Most used', icon: 'truck', sortOrder: 2,
  })
  ok(c1.status === 201 && c1.json?.data?.isActive === true, 'courier created live', JSON.stringify(c1.json?.data?.name))
  const id1 = c1.json?.data?.id
  const c2 = await admin('POST', '/api/admin/delivery-methods', {
    name: 'Air Express', price: 350, estimatedDelivery: 'overnight', icon: 'plane', sortOrder: 1,
  })
  const id2 = c2.json?.data?.id
  ok(c2.status === 201, 'second courier (plane) created')
  const pub1 = await makeSession()('GET', '/api/delivery-methods')
  ok(pub1.json?.data?.length === 2, 'buyer sees both live couriers', JSON.stringify(pub1.json?.data?.length))
  ok(pub1.json?.data?.[0]?.name === 'Air Express' && pub1.json?.data?.[1]?.name === 'Sundarban Courier', 'public order follows sortOrder (1 before 2)')
  ok(pub1.json?.data?.[1]?.estimated_delivery === '2-4 days' && pub1.json?.data?.[1]?.badge === 'Most used', 'estimated_delivery + badge round-trip in the public shape')
  const upd = await admin('PATCH', `/api/admin/delivery-methods/${id1}`, { price: 160, estimatedDelivery: '1-3 days' })
  ok(upd.status === 200 && upd.json?.data?.price === 160, 'edit → price updated')
  const pub2 = await makeSession()('GET', '/api/delivery-methods')
  ok(pub2.json?.data?.find((m) => m.id === id1)?.price === 160, 'public reflects the edit verbatim')
  ok((await admin('PATCH', `/api/admin/delivery-methods/${id1}`, { bogus: 1 })).status === 400, 'PATCH strict keys → 400')
  const park = await admin('PATCH', `/api/admin/delivery-methods/${id2}`, { isActive: false })
  ok(park.status === 200 && park.json?.data?.isActive === false, 'park the plane courier')
  const pub3 = await makeSession()('GET', '/api/delivery-methods')
  ok(pub3.json?.data?.length === 1 && !pub3.json?.data?.some((m) => m.id === id2), 'parked courier vanishes from the buyer rail (draft == phantom)')
  const adminList = await admin('GET', '/api/admin/delivery-methods')
  ok(adminList.json?.data?.length === 2, 'console keeps the parked row')
  ok(adminList.json?.stats?.active === 1 && adminList.json?.stats?.inactive === 1 && adminList.json?.stats?.total === 2, 'stats exact {2 total, 1 active, 1 inactive}', JSON.stringify(adminList.json?.stats))
  ok((await admin('DELETE', `/api/admin/delivery-methods/${id2}`)).status === 200, 'delete parked courier → 200')
  ok((await admin('DELETE', `/api/admin/delivery-methods/${id2}`)).status === 404, 're-delete → 404')

  /* ── E. audits ── */
  console.log('— E. audits —')
  const audits = await db.auditLogs.groupBy({ by: ['action'], _count: { action: true } })
  const count = (a) => audits.find((x) => x.action === a)?._count.action ?? 0
  ok(count('delivery_method_created') === 2 && count('delivery_method_updated') === 2 && count('delivery_method_deleted') === 1, 'audit counts exact {created 2, updated 2, deleted 1}', JSON.stringify({ c: count('delivery_method_created'), u: count('delivery_method_updated'), d: count('delivery_method_deleted') }))
  const updAudit = await db.auditLogs.findFirst({ where: { action: 'delivery_method_updated', entityId: id1 }, orderBy: { createdAt: 'desc' } })
  const meta = JSON.parse(updAudit?.metadata ?? '{}')
  ok(meta?.before?.price === 140 && meta?.after?.price === 160, 'audit carries REAL before/after pricing', JSON.stringify(meta))

  console.log(`\nRESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('FATAL', e)
  await db.$disconnect()
  process.exit(1)
})
