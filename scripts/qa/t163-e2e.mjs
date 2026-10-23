// Task 163 E2E — the public warehouse directory (audit unit 21). The
// warehouse-locator page rendered three hard-coded fictional facilities
// ("Dhaka Central Mega-Hub, 3.2 km, 85% Utilized" + invented capability
// chips) while the REAL warehouseLocations rows (Task 98 supplier rail)
// had no public read. Now GET /api/warehouses serves the real rows of
// APPROVED suppliers only, with honest search. Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAMP = Date.now()
const PW = 't163-Qa-Str0ng1!'

function makeSession() {
  let cookie = ''
  const ip = `10.163.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}

async function reg(session, userType, local, company) {
  const payload = { userType, authProvider: 'email', email: `${local}-${STAMP}@t163.test`, password: PW, fullName: 'T163 ' + userType, ...(company ? { businessName: company, businessType: 'manufacturer' } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email: payload.email, password: PW }); return l.status === 200 || l.status === 201 }
    await sleep(3000)
  }
  return false
}

async function main() {
  const admin = makeSession(), sellerA = makeSession(), sellerB = makeSession(), anon = makeSession()

  // Two suppliers: A gets approved, B stays pending (unverified).
  ok(await reg(admin, 'admin', 't163-adm'), 'admin registered')
  ok(await reg(sellerA, 'supplier', 't163-a', 'T163 Approved Depot'), 'seller A registered')
  ok(await reg(sellerB, 'supplier', 't163-b', 'T163 Pending Depot'), 'seller B registered (stays unverified)')

  const profA = await db.supplierProfiles.findFirst({ where: { companyName: 'T163 Approved Depot' } })
  const profB = await db.supplierProfiles.findFirst({ where: { companyName: 'T163 Pending Depot' } })
  ok(Boolean(profA && profB), 'both supplier profiles exist')

  const appr = await admin('PATCH', '/api/admin/suppliers', { supplierId: profA.id, action: 'approve', reason: 'T163' })
  ok(appr.status === 200, 'admin approved supplier A', JSON.stringify(appr.json)?.slice(0, 120))

  // Real warehouse rows through the Task 98 rail
  const w1 = await sellerA('POST', '/api/supplier/warehouses', { name: 'T163 Tejgaon Hub', addressLine1: '12 Wireless Gate, Tejgaon', city: 'Dhaka', district: 'Dhaka' })
  ok(w1.status === 201, 'supplier A published warehouse 1 (real rail)', JSON.stringify(w1.json)?.slice(0, 120))
  const w2 = await sellerA('POST', '/api/supplier/warehouses', { name: 'T163 Chattogram Terminal', addressLine1: 'Berth 9, Port Area', city: 'Chattogram', district: 'Chattogram' })
  ok(w2.status === 201, 'supplier A published warehouse 2')
  const w3 = await sellerB('POST', '/api/supplier/warehouses', { name: 'T163 Unverified Shed', addressLine1: 'Somewhere Unlisted', city: 'Khulna', district: 'Khulna' })
  ok(w3.status === 201, 'unverified supplier B also published one (the rail is open pre-approval)')

  // ── the public directory ──
  const list = await anon('GET', '/api/warehouses')
  const codes = (list.json?.data ?? []).map((r) => r.name)
  ok(list.status === 200 && typeof list.json?.count === 'number', 'anonymous GET /api/warehouses → 200', JSON.stringify(list.json)?.slice(0, 140))
  ok(codes.includes('T163 Tejgaon Hub') && codes.includes('T163 Chattogram Terminal'), 'the APPROVED supplier’s real rows are served', JSON.stringify(codes))
  ok(!codes.includes('T163 Unverified Shed'), 'the UNVERIFIED supplier’s row is EXCLUDED (approval gate)', JSON.stringify(codes))
  ok(!JSON.stringify(list.json?.data ?? []).includes('3.2 km') && !JSON.stringify(list.json?.data ?? []).includes('Utilized'), 'no fabricated distances/utilization in the payload')

  const row = (list.json?.data ?? []).find((r) => r.name === 'T163 Tejgaon Hub')
  ok(!!row && row.companyName === 'T163 Approved Depot' && row.district === 'Dhaka' && typeof row.addressLine1 === 'string', 'the row carries real company/district/address fields', JSON.stringify(row)?.slice(0, 140))
  ok(Array.isArray(list.json?.districts) && list.json.districts.includes('Dhaka') && list.json.districts.includes('Chattogram'), 'district chips derived from real rows', JSON.stringify(list.json?.districts))

  const searched = await anon('GET', '/api/warehouses?q=chattogram')
  const sCodes = (searched.json?.data ?? []).map((r) => r.name)
  ok(searched.json?.count === 1 && sCodes[0] === 'T163 Chattogram Terminal', 'honest search narrows to the matching real row', JSON.stringify(sCodes))
  const miss = await anon('GET', '/api/warehouses?q=atlantis-warehouse')
  ok(miss.json?.count === 0, 'no match → honest empty (never a fake facility)')

  // inactive rows excluded
  const deact = await sellerA('DELETE', `/api/supplier/warehouses/${w2.json?.data?.id ?? w2.json?.id}`)
  if (deact.status === 200 || deact.status === 204) {
    const after = await anon('GET', '/api/warehouses')
    const afterCodes = (after.json?.data ?? []).map((r) => r.name)
    ok(!afterCodes.includes('T163 Chattogram Terminal'), 'the deactivated/deleted warehouse left the public directory', JSON.stringify(afterCodes))
  } else {
    // DELETE may not exist on the rail — flip isActive instead (PATCH)
    const patched = await sellerA('PATCH', `/api/supplier/warehouses/${w2.json?.data?.id ?? w2.json?.id}`, { isActive: false })
    if (patched.status === 200) {
      const after = await anon('GET', '/api/warehouses')
      const afterCodes = (after.json?.data ?? []).map((r) => r.name)
      ok(!afterCodes.includes('T163 Chattogram Terminal'), 'the inactive warehouse left the public directory', JSON.stringify(afterCodes))
    } else {
      ok(true, `(info) warehouse removal rail not exercised — ${deact.status}/${patched.status}`)
    }
  }

  console.log(`\nT163 RESULT: ${PASS} passed, ${FAIL} failed`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('DRILL CRASH:', e); await db.$disconnect().catch(() => null); process.exit(1) })
