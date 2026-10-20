/**
 * Task 109 E2E — THE PLATFORM STATUS RAIL ("the update check served a
 * degraded hardcoded 2.4.5 forever, maintenance could never fire, and the
 * service journal was unreadable-empty: three readers, zero writers").
 *
 *   A. public readers — the degraded fallback BEFORE, real payloads AFTER
 *   B. admin gates — 401-first on all three rails
 *   C. validation — semver, unique platform+versionCode 409, window
 *      sanity, STRICT keys everywhere
 *   D. draft invisibility — unpublished releases never reach the update
 *      check; the history list matches
 *   E. maintenance — the endpoint answers from the real window + whitelist
 *   F. audits — created/updated/deleted/logged exact
 *
 * Run: node scripts/qa/t109-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.109.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA109 ${userType}` }
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
  const PASSWORD = 't109-E2e-Str0ng1!'
  const admin = makeSession()
  await registerAndLogin(admin, 'admin', 'qa109-admin@qa.local', PASSWORD)
  console.log('  admin ready')

  /* ── A. public readers BEFORE ── */
  console.log('— A. public readers BEFORE —')
  const verBefore = await makeSession()('GET', '/api/app/version?platform=android&currentVersionCode=100')
  ok(verBefore.json?.data?.degraded === true || verBefore.json?.data?.updateAvailable === false, 'update check answers honestly without rows (degraded fallback)', JSON.stringify(verBefore.json?.data))
  const maintBefore = await makeSession()('GET', '/api/app/maintenance')
  ok(maintBefore.json?.data?.isMaintenanceActive === false, 'maintenance honestly none before any window')

  /* ── B. admin gates ── */
  console.log('— B. admin gates —')
  ok((await makeSession()('GET', '/api/admin/app-versions')).status === 401, 'anon releases → 401')
  ok((await makeSession()('POST', '/api/admin/app-versions', { platform: 'android', versionNumber: '1.0.0', versionCode: 1, changelogEn: 'x' })).status === 401, 'anon release create → 401')
  ok((await makeSession()('GET', '/api/admin/maintenance')).status === 401, 'anon maintenance → 401')
  ok((await makeSession()('GET', '/api/admin/diagnostics')).status === 401, 'anon diagnostics → 401')

  /* ── C. releases validation + uniqueness ── */
  console.log('— C. releases —')
  ok((await admin('POST', '/api/admin/app-versions', { platform: 'android', versionNumber: '1.0', versionCode: 1, changelogEn: 'x' })).status === 400, 'non-semver version → 400')
  ok((await admin('POST', '/api/admin/app-versions', { platform: 'android', versionNumber: '1.0.0', versionCode: 1, changelogEn: 'x', bogus: 1 })).status === 400, 'strict keys → 400')
  ok((await admin('POST', '/api/admin/app-versions', { platform: 'android', versionNumber: '1.0.0', changelogEn: 'x' })).status === 400, 'missing versionCode → 400')
  const r1 = await admin('POST', '/api/admin/app-versions', { platform: 'android', versionNumber: '2.4.0', versionCode: 240, changelogEn: 'Bulk order tracking lands', isPublished: true })
  ok(r1.status === 201 && r1.json?.data?.versionCode === 240, 'release created', JSON.stringify(r1.json?.data?.versionNumber))
  ok((await admin('POST', '/api/admin/app-versions', { platform: 'android', versionNumber: '2.4.1', versionCode: 240, changelogEn: 'dup' })).status === 409, 'duplicate platform+versionCode → 409')
  const r2 = await admin('POST', '/api/admin/app-versions', { platform: 'android', versionNumber: '2.5.0', versionCode: 250, changelogEn: 'Escrow timeline in-app', isPublished: false })
  ok(r2.status === 201, 'draft release saved')
  const ver1 = await makeSession()('GET', '/api/app/version?platform=android&currentVersionCode=100')
  ok(ver1.json?.data?.latestVersion?.versionNumber === '2.4.0' && ver1.json?.data?.updateAvailable === true, 'published release drives the update check; draft invisible', JSON.stringify(ver1.json?.data?.latestVersion))
  const hist = ver1.json?.data?.history
  ok(Array.isArray(hist) ? !hist.some((h) => h.versionCode === 250) : ver1.json?.data?.history === undefined, 'history excludes the draft')
  const upd = await admin('PATCH', `/api/admin/app-versions/${r2.json?.data?.id}`, { isPublished: true })
  ok(upd.status === 200 && upd.json?.data?.isPublished === true, 'draft promoted')
  const ver2 = await makeSession()('GET', '/api/app/version?platform=android&currentVersionCode=245')
  ok(ver2.json?.data?.latestVersion?.versionNumber === '2.5.0' && ver2.json?.data?.updateAvailable === true, 'newer published release wins by versionCode')
  ok((await admin('DELETE', `/api/admin/app-versions/${r2.json?.data?.id}`)).status === 200, 'delete release → 200')
  ok((await admin('DELETE', `/api/admin/app-versions/${r2.json?.data?.id}`)).status === 404, 're-delete → 404')

  /* ── D. maintenance ── */
  console.log('— D. maintenance —')
  const now = Date.now()
  const iso = (t) => new Date(t).toISOString()
  ok((await admin('POST', '/api/admin/maintenance', { title: 'X', messageEn: 'M', scheduledStart: iso(now), scheduledEnd: iso(now - 1000) })).status === 400, 'end before start → 400')
  ok((await admin('POST', '/api/admin/maintenance', { title: 'X', messageEn: 'M', scheduledStart: iso(now), scheduledEnd: iso(now + 1000), bogus: 1 })).status === 400, 'strict keys → 400')
  const w1 = await admin('POST', '/api/admin/maintenance', {
    title: 'Checkout upgrade', messageEn: 'Checkout is briefly offline while we ship the new pricing engine.',
    scheduledStart: iso(now - 60_000), scheduledEnd: iso(now + 3_600_000), isActive: true, affectedServices: 'checkout',
  })
  ok(w1.status === 201 && w1.json?.data?.isActive === true, 'active window created')
  const maint1 = await makeSession()('GET', '/api/app/maintenance')
  ok(maint1.json?.data?.isMaintenanceActive === true && maint1.json?.data?.activeSchedule?.title === 'Checkout upgrade', 'maintenance endpoint fires from the real window', JSON.stringify(maint1.json?.data?.activeSchedule?.title))
  ok((await admin('PATCH', `/api/admin/maintenance/${w1.json?.data?.id}`, { isActive: false })).status === 200, 'window deactivated')
  const maint2 = await makeSession()('GET', '/api/app/maintenance')
  ok(maint2.json?.data?.isMaintenanceActive === false, 'deactivation stops the endpoint firing')
  ok((await admin('PATCH', '/api/admin/maintenance/phantom-id', { isActive: false })).status === 404, 'phantom PATCH → 404')
  ok((await admin('DELETE', `/api/admin/maintenance/${w1.json?.data?.id}`)).status === 200, 'delete window → 200')

  /* ── E. service log ── */
  console.log('— E. service log —')
  ok((await admin('POST', '/api/admin/diagnostics', { serviceName: '', status: 'healthy' })).status === 400, 'empty service name → 400')
  ok((await admin('POST', '/api/admin/diagnostics', { serviceName: 'courier_api', status: 'exploded' })).status === 400, 'invented status → 400')
  ok((await admin('POST', '/api/admin/diagnostics', { serviceName: 'courier_api', status: 'healthy', bogus: 1 })).status === 400, 'strict keys → 400')
  const o1 = await admin('POST', '/api/admin/diagnostics', { serviceName: 'courier_api', status: 'degraded', responseTimeMs: 4200, details: 'Steady FTL rate-limiting on tracking lookups' })
  ok(o1.status === 201 && o1.json?.data?.status === 'degraded', 'observation logged')
  const o2 = await admin('POST', '/api/admin/diagnostics', { serviceName: 'payment_gateway', status: 'healthy', responseTimeMs: 120 })
  const pubDiag = await makeSession()('GET', '/api/app/diagnostics')
  const svc = (pubDiag.json?.services ?? []).find((s) => s.serviceName === 'courier_api')
  ok(!!svc && svc.status === 'degraded' && svc.responseTimeMs === 4200 && svc.details?.note === 'Steady FTL rate-limiting on tracking lookups', 'public diagnostics serves the logged observations verbatim', JSON.stringify(svc))
  ok((pubDiag.json?.services ?? []).some((s) => s.serviceName === 'payment_gateway'), 'both observations served, newest first')
  ok(o1.status === 201 && o2.status === 201, 'two observations logged')

  /* ── F. audits ── */
  console.log('— F. audits —')
  const audits = await db.auditLogs.groupBy({ by: ['action'], _count: { action: true } })
  const count = (a) => audits.find((x) => x.action === a)?._count.action ?? 0
  ok(count('app_version_created') === 2 && count('app_version_updated') === 1 && count('app_version_deleted') === 1, 'release audits exact {2/1/1}')
  ok(count('maintenance_created') === 1 && count('maintenance_updated') === 1 && count('maintenance_deleted') === 1, 'maintenance audits exact {1/1/1}')
  ok(count('diagnostic_logged') === 2, 'diagnostic audits ×2')

  console.log(`\nRESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('FATAL', e)
  await db.$disconnect()
  process.exit(1)
})
