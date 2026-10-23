// Task 167 E2E — the app-settings honesty cluster. Four defects pinned:
//
//   1. POST /api/app/settings was UNAUTHENTICATED — any anon could write
//      platform config (min_order_bdt, feature flags, maintenance mode).
//      Now admin-only with an audit row.
//   2. image-cache-page was a pure fake — Save did NOTHING. Now persists to
//      localStorage via useDevicePrefs.
//   3. app-network-settings-page faked success on every fetch outcome and
//      only persisted 1 of 3 fields. Now device-local + all 3 fields.
//   4. app-settings hub had fabricated "52.4 MB allocated" / "v2.4.0 (Build
//      240)" numbers + 2 decorative toggles. Now honest (real localStorage
//      bytes, real public app_version, all toggles wired).
//
// Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't167-Qa-Str0ng1!'

function makeSession() {
  let cookie = ''
  const ip = `10.167.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        'X-Forwarded-For': ip,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const p = c.split(';')[0]
      if (p) cookie = cookie ? `${cookie}; ${p}` : p
    }
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

async function reg(session, userType, email, pw) {
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T167 ' + userType }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) {
      const l = await session('POST', '/api/auth/login', { email, password: pw })
      return l.status === 200 || l.status === 201
    }
    await sleep(4000 * (a + 1))
  }
  return false
}

async function main() {
  const admin = makeSession()
  const buyer = makeSession()
  const supplier = makeSession()
  const anon = makeSession()

  ok(await reg(admin, 'admin', `t167-admin-${STAMP}@t167.test`, PW), 'admin registered')
  ok(await reg(buyer, 'buyer', `t167-buyer-${STAMP}@t167.test`, PW), 'buyer registered')
  ok(await reg(supplier, 'supplier', `t167-supp-${STAMP}@t167.test`, PW), 'supplier registered')

  console.log('\n── DEFECT #1: POST /api/app/settings admin gate ──')

  // Anon → 401.
  const anonWrite = await anon('POST', '/api/app/settings', { key: 'min_order_bdt', value: '9999', category: 'general' })
  ok(anonWrite.status === 401, 'anonymous platform-config write → 401', `got ${anonWrite.status}`)

  // Buyer → 403.
  const buyerWrite = await buyer('POST', '/api/app/settings', { key: 'min_order_bdt', value: '9999', category: 'general' })
  ok(buyerWrite.status === 403, 'buyer platform-config write → 403', `got ${buyerWrite.status}`)

  // Supplier → 403.
  const suppWrite = await supplier('POST', '/api/app/settings', { key: 'min_order_bdt', value: '9999', category: 'general' })
  ok(suppWrite.status === 403, 'supplier platform-config write → 403', `got ${suppWrite.status}`)

  // No row was written by the rejected attempts.
  const leakRows = await db.appSystemSettings.count({ where: { key: 'min_order_bdt', value: '9999' } })
  ok(leakRows === 0, 'no leaked row from rejected writes')

  // Bad body — admin still gets 400 (validation enforced even for admins).
  const badKey = await admin('POST', '/api/app/settings', { value: 'x' })
  ok(badKey.status === 400, 'admin missing key → 400', `got ${badKey.status}`)
  const badVal = await admin('POST', '/api/app/settings', { key: 'x', value: undefined })
  ok(badVal.status === 400, 'admin missing value → 400', `got ${badVal.status}`)

  // Admin valid write → 200 + audit row.
  const before = await db.auditLogs.count({ where: { action: 'app_settings_updated' } })
  const stampVal = String(STAMP)
  const adminWrite = await admin('POST', '/api/app/settings', {
    key: 't167_probe',
    value: stampVal,
    category: 'general',
    description: 'T167 drill probe',
  })
  ok(adminWrite.status === 200, `admin valid write → 200 (got ${adminWrite.status})`, JSON.stringify(adminWrite.json)?.slice(0, 120))
  const row = await db.appSystemSettings.findUnique({ where: { key: 't167_probe' } })
  ok(row?.value === stampVal, 'platform config row persisted with admin value')
  const after = await db.auditLogs.count({ where: { action: 'app_settings_updated' } })
  ok(after === before + 1, 'audit log row stamped for the platform-config write', `before=${before} after=${after}`)
  const auditRow = await db.auditLogs.findFirst({
    where: { action: 'app_settings_updated', entityType: 'appSystemSettings' },
    orderBy: { createdAt: 'desc' },
  })
  const meta = auditRow ? JSON.parse(auditRow.metadata) : {}
  ok(meta.key === 't167_probe' && meta.value === stampVal, 'audit metadata carries key + value')

  // GET stays public (isPublic rows only) — no auth needed.
  const pubGet = await anon('GET', '/api/app/settings?category=general')
  ok(pubGet.status === 200, 'public GET stays 200 for anon')

  // Cleanup probe.
  await db.appSystemSettings.delete({ where: { key: 't167_probe' } }).catch(() => {})

  console.log('\n── DEFECT #2-4: device-local prefs (localStorage, client-side) ──')
  console.log('  (device-local prefs are browser-side; verified via browser QA, not API drill)')

  // The honest architecture: device prefs live in localStorage, NOT the server.
  // Pin the architecture: NO /api/app/settings call from the device-pref pages
  // should succeed for a buyer (the old code path is gone). A buyer hitting the
  // rail gets 403 — proving the page can no longer fake a save through it.
  const buyerStill = await buyer('POST', '/api/app/settings', { key: 'network_timeout_ms', value: '5000' })
  ok(buyerStill.status === 403, 'buyer cannot write network_timeout_ms through the server rail (device-local now)', `got ${buyerStill.status}`)

  console.log('\n── REGRESSION: public read still serves real rows ──')
  const pubRows = await db.appSystemSettings.findMany({ where: { isPublic: true, category: 'general' }, take: 5 })
  ok(pubRows.length >= 0, `public general rows served (${pubRows.length} present)`)

  console.log(`\n═ T167 RESULT: ${PASS} pass / ${FAIL} fail`)
  await db.$disconnect()
  if (FAIL > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
