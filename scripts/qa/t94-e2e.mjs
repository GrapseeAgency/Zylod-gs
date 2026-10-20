/**
 * Task 94 E2E — THE SHIPPING CONFIG CIRCUIT (zones × methods × weight bands).
 *
 * shippingZones / shippingMethods / shippingRates existed in the schema
 * from day one with NO route, NO writer, NO reader — while checkout
 * charged nothing for moving wholesale weight across Bangladesh. This
 * loop proves the configuration circuit:
 *   A. gates — every admin rail 401-first, anon quote PUBLIC
 *   B. zones — district coverage, cross-zone district conflicts (409
 *      naming the owning zone), case-insensitive whole-entry matching,
 *      deactivate-frees-reactivate-conflicts cycle
 *   C. methods — case-insensitive name clash 409
 *   D. rates — half-open weight-band tiling ([0,10] then [10,50] legal;
 *      genuinely overlapping bands 409 with the conflicting band named),
 *      phantom zone/method 404, band sanity (weightMax <= weightMin 400)
 *   E. THE QUOTE — the public rail serving exactly the configured truth:
 *      district resolution (exact + case-insensitive; 'Dhaka Division'
 *      must NOT match 'Dhaka'), band boundaries (9.9 → first, 10 → second),
 *      freeAbove crossings (price 0 + freeShipping + basePrice preserved),
 *      inactive zone/method excluded, unknown district HONEST empty
 *   F. cascade — zone delete reports removedRates and the quote goes empty
 *   G. audit trail — all six shipping_* actions in raw DB
 *
 * Run: bun scripts/qa/t94-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.96.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
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
    return { status: res.status, json }
  }
}

async function registerAndLogin(session, userType, email, password) {
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA94 ${userType}` }
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

const quote = (district, weightKg, subtotal = 0) =>
  makeSession()('GET', `/api/shipping/quote?district=${encodeURIComponent(district)}&weightKg=${weightKg}&subtotal=${subtotal}`)

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't94-E2e-Str0ng1!'
  const admin = makeSession()
  await registerAndLogin(admin, 'admin', 'qa94-admin@qa.local', PASSWORD)
  console.log('  admin ready')

  /* ── A. gates ── */
  console.log('— A. gates —')
  ok((await makeSession()('GET', '/api/admin/shipping/zones')).status === 401, 'anon zones GET → 401')
  ok((await makeSession()('GET', '/api/admin/shipping/methods')).status === 401, 'anon methods GET → 401')
  ok((await makeSession()('GET', '/api/admin/shipping/rates')).status === 401, 'anon rates GET → 401')
  ok((await makeSession()('POST', '/api/admin/shipping/zones', { name: 'X Zone', districts: ['Dhaka'] })).status === 401, 'anon zone POST → 401')
  ok((await makeSession()('POST', '/api/admin/shipping/rates', { zoneId: 'z', methodId: 'm', weightMin: 0, price: 1 })).status === 401, 'anon rate POST → 401')
  const nonAdmin = makeSession()
  await registerAndLogin(nonAdmin, 'buyer', 'qa94-buyer@qa.local', PASSWORD)
  ok((await nonAdmin('GET', '/api/admin/shipping/zones')).status === 401, 'buyer on admin rail → 401 (requireUserType contract)')
  const q0 = await quote('Nowhere', 5)
  ok(q0.status === 200 && q0.json?.count === 0, 'anon public quote → 200, honest empty before any config', JSON.stringify(q0.json))

  /* ── B. zones ── */
  console.log('— B. zones —')
  ok((await admin('POST', '/api/admin/shipping/zones', { name: 'X', districts: ['Dhaka'] })).status === 400, '1-char zone name → 400')
  ok((await admin('POST', '/api/admin/shipping/zones', { name: 'X Zone', districts: [] })).status === 400, 'empty districts → 400')
  ok((await admin('POST', '/api/admin/shipping/zones', { name: 'X Zone', districts: ['Dhaka'], bogus: 1 })).status === 400, 'strict keys → 400')

  const dz = await admin('POST', '/api/admin/shipping/zones', { name: 'Dhaka Metro', districts: ['Dhaka', 'Gazipur', 'Narayanganj'] })
  ok(dz.status === 201 && dz.json?.data?.districts?.length === 3, 'zone created with parsed districts', JSON.stringify(dz.json))
  const zoneA = dz.json?.data?.id
  const cz = await admin('POST', '/api/admin/shipping/zones', { name: 'Chattogram Belt', districts: ['Chattogram', 'Coxs Bazar'] })
  const zoneB = cz.json?.data?.id

  const dup = await admin('POST', '/api/admin/shipping/zones', { name: 'Sneaky Zone', districts: ['dhaka'] })
  ok(dup.status === 409 && String(dup.json?.error).includes('Dhaka Metro'), 'case-insensitive district conflict → 409 naming the owning zone', JSON.stringify(dup.json))
  const pat = await admin('POST', '/api/admin/shipping/zones', { name: 'Substring Trap', districts: ['Gazipur City'] })
  ok(pat.status === 201, 'whole-entry matching: "Gazipur City" is NOT "Gazipur" → allowed (never substring)')
  const zoneC = pat.json?.data?.id

  // The deactivate-frees-reactivate-conflicts cycle runs on zoneC (zoneA
  // must STAY active — its districts carry the rate book under test).
  const deact = await admin('PATCH', `/api/admin/shipping/zones/${zoneC}`, { isActive: false })
  ok(deact.status === 200 && deact.json?.data?.isActive === false, 'zone deactivated')
  const steal = await admin('POST', '/api/admin/shipping/zones', { name: 'Gazipur City Zone', districts: ['Gazipur City'] })
  ok(steal.status === 201, 'inactive zone frees its districts (only ACTIVE zones conflict)')
  const zoneD = steal.json?.data?.id
  const reactivate = await admin('PATCH', `/api/admin/shipping/zones/${zoneC}`, { isActive: true })
  ok(reactivate.status === 409, 'reactivating into a claimed district → 409 (a district resolves to ONE price book)')
  const zonesList = await admin('GET', '/api/admin/shipping/zones')
  ok(zonesList.json?.count === 4, 'zones list serves every row with parsed districts')

  /* ── C. methods ── */
  console.log('— C. methods —')
  const m1 = await admin('POST', '/api/admin/shipping/methods', { name: 'Sundarban Courier', description: 'Doorstep, tracked', estimatedDays: '2-4 days' })
  ok(m1.status === 201, 'method created')
  const methodM = m1.json?.data?.id
  ok((await admin('POST', '/api/admin/shipping/methods', { name: 'sundarban courier' })).status === 409, 'case-insensitive method name clash → 409')
  const m2 = await admin('POST', '/api/admin/shipping/methods', { name: 'Zylod Freight Line', estimatedDays: '5-7 days' })
  const methodF = m2.json?.data?.id
  ok((await admin('PATCH', `/api/admin/shipping/methods/${methodF}`, { estimatedDays: '4-6 days', isActive: false })).status === 200, 'method PATCH (relabel + deactivate)')

  /* ── D. rates ── */
  console.log('— D. rates —')
  ok((await admin('POST', '/api/admin/shipping/rates', { zoneId: 'phantom', methodId: methodM, weightMin: 0, price: 100 })).status === 404, 'phantom zone → 404')
  ok((await admin('POST', '/api/admin/shipping/rates', { zoneId: zoneA, methodId: 'phantom', weightMin: 0, price: 100 })).status === 404, 'phantom method → 404')
  ok((await admin('POST', '/api/admin/shipping/rates', { zoneId: zoneA, methodId: methodM, weightMin: 50, weightMax: 50, price: 100 })).status === 400, 'weightMax <= weightMin → 400')

  const b1 = await admin('POST', '/api/admin/shipping/rates', { zoneId: zoneA, methodId: methodM, weightMin: 0, weightMax: 10, price: 120 })
  ok(b1.status === 201, 'band [0,10) created at ৳120')
  const b2 = await admin('POST', '/api/admin/shipping/rates', { zoneId: zoneA, methodId: methodM, weightMin: 10, weightMax: 50, price: 300, freeAbove: 40000 })
  ok(b2.status === 201, 'adjacent band [10,50) is a legal TILING (no false 409)', JSON.stringify(b2.json))
  const b3 = await admin('POST', '/api/admin/shipping/rates', { zoneId: zoneA, methodId: methodM, weightMin: 40, weightMax: null, price: 500 })
  ok(b3.status === 409 && Boolean(b3.json?.conflictId), 'genuinely overlapping band [40,∞) → 409 with conflictId', JSON.stringify(b3.json))
  const b4 = await admin('POST', '/api/admin/shipping/rates', { zoneId: zoneB, methodId: methodM, weightMin: 0, weightMax: null, price: 250 })
  ok(b4.status === 201, 'same band on ANOTHER zone is fine (conflicts are per zone×method)')
  const band2Id = b2.json?.data?.id
  const band1Id = b1.json?.data?.id
  const reprice = await admin('PATCH', `/api/admin/shipping/rates/${band1Id}`, { price: 140 })
  ok(reprice.status === 200 && reprice.json?.data?.price === 140, 'rate reprice PATCH → 200')

  /* ── E. THE QUOTE ── */
  console.log('— E. the public quote —')
  const q1 = await quote('Dhaka', 5, 5000)
  ok(q1.json?.count === 1 && q1.json?.data?.[0]?.price === 140, '5kg in Dhaka → ৳140 (repriced first band)', JSON.stringify(q1.json))
  const q2 = await quote('DHAKA', 10, 5000)
  ok(q2.json?.count === 1 && q2.json?.data?.[0]?.price === 300, '10kg (case-insensitive district) → second band ৳300, never both', JSON.stringify(q2.json))
  const q3 = await quote('Dhaka', 9.9, 5000)
  ok(q3.json?.data?.[0]?.price === 140, '9.9kg → first band (half-open boundary honest)')
  const qFree = await quote('Dhaka', 10, 50000)
  ok(qFree.json?.data?.[0]?.price === 0 && qFree.json?.data?.[0]?.freeShipping === true && qFree.json?.data?.[0]?.basePrice === 300, 'subtotal crosses freeAbove → price 0, freeShipping, basePrice preserved', JSON.stringify(qFree.json?.data?.[0]))
  const qNotFree = await quote('Dhaka', 10, 39999)
  ok(qNotFree.json?.data?.[0]?.price === 300 && qNotFree.json?.data?.[0]?.freeShipping === false, 'one taka below the threshold → full price (honest math)')
  const qSub = await quote('Gazipur', 100)
  ok(qSub.json?.count === 0, 'weight above every band of the covering zone → honest empty (no fabricated fallback)')
  const qChatt = await quote('chattogram', 100, 0)
  ok(qChatt.json?.count === 1 && qChatt.json?.data?.[0]?.methodName === 'Sundarban Courier', 'Chattogram case-insensitive → zone B open band ৳250', JSON.stringify(qChatt.json?.data?.[0]))
  const qOff = await quote('Dhaka Division', 10)
  ok(qOff.json?.count === 0, '"Dhaka Division" does NOT substring-match "Dhaka" → honest empty')
  const qInactive = await quote('Coxs Bazar', 10)
  ok(qInactive.json?.count === 1, 'zone B active → its second district quotes')
  const rateF = await admin('POST', '/api/admin/shipping/rates', { zoneId: zoneA, methodId: methodF, weightMin: 0, weightMax: null, price: 450 })
  ok(rateF.status === 201, 'second method priced on the same zone (different method → no band conflict)')
  await admin('PATCH', `/api/admin/shipping/methods/${methodF}`, { isActive: true })
  const qTwoMethods = await quote('Dhaka', 20, 1000)
  ok(qTwoMethods.json?.count === 2 && qTwoMethods.json?.data?.[0]?.price <= qTwoMethods.json?.data?.[1]?.price, 'second method activated → buyer sees BOTH options (sorted by price)', JSON.stringify(qTwoMethods.json?.data?.map((o) => o.price)))
  await admin('PATCH', `/api/admin/shipping/methods/${methodF}`, { isActive: false })
  const qBad = await quote('', 10)
  ok(qBad.status === 400, 'missing district → 400')
  ok((await makeSession()('GET', '/api/shipping/quote?district=Dhaka&weightKg=abc')).status === 400, 'junk weightKg → 400')
  const zoneBAfter = await admin('GET', '/api/admin/shipping/rates')
  ok(zoneBAfter.json?.count === 4, 'admin rates list serves the whole price book with names resolved')

  /* ── F. cascade ── */
  console.log('— F. cascade —')
  const delZone = await admin('DELETE', `/api/admin/shipping/zones/${zoneB}`)
  ok(delZone.status === 200 && delZone.json?.data?.removedRates === 1, 'zone DELETE reports the rates that went with it', JSON.stringify(delZone.json))
  ok((await quote('Coxs Bazar', 10)).json?.count === 0, 'quote for the deleted zone\'s district → honest empty')
  const delMethod = await admin('DELETE', `/api/admin/shipping/methods/${methodF}`)
  ok(delMethod.status === 200, 'method DELETE (its zoneA rate cascades away with it)')
  ok((await admin('DELETE', `/api/admin/shipping/rates/${band2Id}`)).status === 200, 'rate DELETE works')
  const afterDel = await quote('Dhaka', 10)
  ok(afterDel.json?.count === 0, 'band deleted → 10kg in Dhaka now honestly unquotable (never a stale price)')

  /* ── G. audit trail ── */
  console.log('— G. audit trail —')
  const audits = await db.auditLogs.groupBy({ by: ['action'], where: { entityType: { in: ['shippingZones', 'shippingMethods', 'shippingRates'] } }, _count: { action: true } })
  const actions = Object.fromEntries(audits.map((a) => [a.action, a._count.action]))
  ok((actions.shipping_zone_created ?? 0) >= 4, `shipping_zone_created audited (${actions.shipping_zone_created ?? 0})`)
  ok((actions.shipping_zone_updated ?? 0) >= 1, `shipping_zone_updated audited (${actions.shipping_zone_updated ?? 0})`)
  ok((actions.shipping_zone_deleted ?? 0) >= 1, 'shipping_zone_deleted audited')
  ok((actions.shipping_method_created ?? 0) >= 2 && (actions.shipping_method_deleted ?? 0) >= 1, 'method created/deleted audited')
  ok((actions.shipping_rate_created ?? 0) >= 4 && (actions.shipping_rate_updated ?? 0) >= 1 && (actions.shipping_rate_deleted ?? 0) >= 1, 'rate created/updated/deleted audited', JSON.stringify(actions))

  console.log(`\n===== t94 RESULT: ${PASS} PASS / ${FAIL} FAIL =====`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('FATAL:', e)
  await db.$disconnect()
  process.exit(1)
})
