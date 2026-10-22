// Task 143 E2E — earned rewards get REAL checkout teeth. Redemption now
// writes a BOUND single-use coupon (the table checkout actually validates),
// enforces the binding in preview + order write, deducts points ATOMICALLY
// (conditional decrement — a concurrent redemption can never double-spend),
// refuses unknown rewardType (the old unvalidated string deducted points and
// granted NOTHING), rate-limits the rail, credits the wallet with a real
// ledger row, and the VAULT merges bound coupons so a spendable voucher is
// never invisible where buyers manage coupons. Run on a FRESH wipe.
const BASE = 'http://127.0.0.1:3000'
const { PrismaClient } = await import('@prisma/client')
const db = new PrismaClient()
let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function makeSession() {
  let cookie = ''
  const ip = `10.143.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, path, body) {
    for (let a = 0; a < 7; a++) {
      const res = await fetch(`${BASE}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), 'X-Forwarded-For': ip }, body: body ? JSON.stringify(body) : undefined })
      for (const c of res.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
      const json = await res.json().catch(() => null)
      if (res.status !== 429) return { status: res.status, json }
      await sleep(10_000 * (a + 1))
    }
    throw new Error('429 exhausted: ' + path)
  }
}
async function reg(session, userType, email, pw, company) {
  const payload = { userType, authProvider: 'email', email, password: pw, fullName: 'T143 ' + userType, ...(company ? { businessName: company } : {}) }
  for (let a = 0; a < 4; a++) {
    const r = await session('POST', '/api/auth/register', payload)
    if (r.status === 201 || r.status === 200) return true
    if (r.status !== 429) { const l = await session('POST', '/api/auth/login', { email, password: pw }); return l.status === 200 || l.status === 201 }
    await sleep(4000 * (a + 1))
  }
  return false
}
const STAMP = Date.now()
const PW = 't143-Qa-Str0ng1!'
const admin = makeSession(), seller = makeSession(), buyer1 = makeSession(), buyer2 = makeSession(), buyer3 = makeSession()
ok(await reg(seller, 'supplier', `t143-seller-${STAMP}@t143.test`, PW, 'T143 Voucher Depot'), 'seller registered')
ok(await reg(admin, 'admin', `t143-admin-${STAMP}@t143.test`, PW), 'admin registered')
ok(await reg(buyer1, 'buyer', `t143-b1-${STAMP}@t143.test`, PW), 'buyer1 registered (redeemer)')
ok(await reg(buyer2, 'buyer', `t143-b2-${STAMP}@t143.test`, PW), 'buyer2 registered (binding + race)')
ok(await reg(buyer3, 'buyer', `t143-b3-${STAMP}@t143.test`, PW), 'buyer3 registered (rate-limit)')

// ── redemption gates ──
ok((await makeSession()('POST', '/api/rewards/redeem', { pointsToRedeem: 100 })).status === 401, 'redeem: anon → 401')
let r = await buyer2('POST', '/api/rewards/redeem', { pointsToRedeem: 50 })
ok(r.status === 400, 'redeem: 50 points → 400 (minimum is 100)', JSON.stringify(r.json))
r = await buyer2('POST', '/api/rewards/redeem', { pointsToRedeem: 'lots' })
ok(r.status === 400, 'redeem: non-numeric points → 400 (Zod)', JSON.stringify(r.json))
const couponCountBefore = await db.coupons.count()
r = await buyer2('POST', '/api/rewards/redeem', { pointsToRedeem: 100, rewardType: 'banana' })
ok(r.status === 400, "redeem: rewardType 'banana' → 400 (the old code DEDUCTED points and granted nothing)", JSON.stringify(r.json))
const b2row0 = await db.buyerRewards.findUnique({ where: { buyerId: (await db.users.findFirst({ where: { email: `t143-b2-${STAMP}@t143.test` } })).id } })
ok(!b2row0 || (b2row0.pointsBalance === 0 && b2row0.totalRedeemed === 0), 'theft vector closed: no points moved for the rejected type')
ok((await db.coupons.count()) === couponCountBefore, 'theft vector closed: no coupon row created for the rejected type')

// ── honest points, earned through the real rails ──
r = await buyer2('GET', '/api/rewards/loyalty')
ok(r.status === 200 && r.json?.data?.pointsBalance === 150, 'buyer2 welcome grant: 150 points on first loyalty read', JSON.stringify(r.json?.data))
r = await buyer2('POST', '/api/rewards/redeem', { pointsToRedeem: 999999 })
ok(r.status === 400 && String(r.json?.error || '').includes('150'), 'redeem: insufficient → 400 carrying the REAL balance (150)', JSON.stringify(r.json))

r = await buyer1('GET', '/api/rewards/loyalty')
ok(r.json?.data?.pointsBalance === 150, 'buyer1 welcome grant: 150 points')
r = await buyer1('POST', '/api/rewards/checkin')
ok(r.status === 200 || r.status === 201, 'buyer1 daily check-in: +50 points', JSON.stringify(r.json))
r = await buyer1('GET', '/api/rewards')
ok(r.json?.data?.balance === 200, 'buyer1 balance: 200 points (150 + 50, real earned rails)', JSON.stringify(r.json?.data))

// ── the voucher circuit ──
r = await buyer1('POST', '/api/rewards/redeem', { pointsToRedeem: 100, rewardType: 'voucher' })
ok(r.status === 201, 'redeem 100 points → 201', JSON.stringify(r.json))
const code = r.json?.data?.coupon?.code
ok(typeof code === 'string' && /^POINTS-10-[A-Z0-9]{4,8}$/.test(code), `voucher code carries the real value: ${code}`, JSON.stringify(r.json?.data))
const buyer1Id = (await db.users.findFirst({ where: { email: `t143-b1-${STAMP}@t143.test` } })).id
const row = await db.coupons.findUnique({ where: { code } })
ok(!!row && row.userId === buyer1Id && row.discountType === 'fixed' && row.discountPercent === 10 && row.minOrderAmount === 30 && row.usageLimit === 1 && row.usedCount === 0 && row.isActive === true, 'DB: BOUND single-use coupon (userId set, fixed ৳10, min ৳30, limit 1, unused)', JSON.stringify(row))
const reward1 = await db.buyerRewards.findUnique({ where: { buyerId: buyer1Id } })
ok(reward1.pointsBalance === 100 && reward1.totalRedeemed === 100, 'points deducted exactly once (100 left, totalRedeemed 100)')
const txRow = await db.rewardTransactions.findFirst({ where: { buyerId: buyer1Id, type: 'redeem', points: -100 } })
ok(!!txRow, 'ledger: rewardTransactions −100 row')
const audit1 = await db.auditLogs.findFirst({ where: { action: 'reward_voucher_issued', entityId: row.id } })
ok(!!audit1 && String(audit1.metadata || '').includes(code), 'audit: reward_voucher_issued carries the code')
const notif = await db.notifications.findFirst({ where: { userId: buyer1Id, title: { contains: 'Points Redeemed' } }, orderBy: { createdAt: 'desc' } })
ok(!!notif && notif.body.includes(code), 'notification carries the REAL spendable code')

// ── the vault shows it BEFORE it is spendable anywhere else ──
r = await buyer1('GET', '/api/coupons/my?status=active')
const vaultHit = (r.json?.data || []).find((c) => c.code === code)
ok(!!vaultHit && vaultHit.status === 'active' && vaultHit.title === '৳10 Loyalty Voucher' && vaultHit.categoryLabel === 'Loyalty Reward' && vaultHit.minOrderBDT === 30, 'vault (active): bound voucher listed with the same display shape as claimed vouchers', JSON.stringify(vaultHit))
r = await buyer1('GET', '/api/coupons/my?status=used')
ok(!(r.json?.data || []).some((c) => c.code === code), 'vault (used): not listed before use')

// ── validate teeth: the binding is enforced in preview ──
r = await buyer2('POST', '/api/coupons/validate', { code, orderAmount: 100 })
ok(r.status === 400 && r.json?.valid === false && String(r.json?.error || '').includes('another account'), 'validate: another account → 400 "belongs to another account"', JSON.stringify(r.json))
r = await buyer1('POST', '/api/coupons/validate', { code, orderAmount: 20 })
ok(r.status === 400 && String(r.json?.error || '').includes('Minimum order amount is 30'), 'validate: owner below minimum (৳20 < ৳30) → 400', JSON.stringify(r.json))
r = await buyer1('POST', '/api/coupons/validate', { code, orderAmount: 100 })
ok(r.status === 200 && r.json?.valid === true, 'validate: owner above minimum → valid:true', JSON.stringify(r.json))

// ── order teeth: the discount is real money off a real order ──
let categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id
if (!categoryId) { await admin('POST', '/api/admin/categories', { name: 'Garments', isActive: true }); categoryId = (await db.categories.findFirst({ where: { slug: 'garments' } }))?.id }
r = await seller('POST', '/api/supplier/products', { name: 'T143 Voucher Widget', description: 'drill', categoryId, unit: 'pcs', moq: 5, basePrice: 12, currency: 'BDT', stockQuantity: 1000, priceTiers: [{ minQty: 5, pricePerUnit: 12 }], images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [] })
const productId = r.json?.data?.id ?? r.json?.id
ok(Boolean(productId), 'product created ৳12 × MOQ 5')
let appr = null
for (let a = 0; a < 4; a++) { appr = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'T143' }); if (appr.status === 200) break; await sleep(4000) }
ok(appr.status === 200, 'product approved', JSON.stringify(appr.json)?.slice(0, 120))

r = await buyer1('POST', '/api/orders', { items: [{ productId, quantity: 5 }], couponCode: code })
ok(r.status === 201, 'order with voucher code → 201', JSON.stringify(r.json)?.slice(0, 200))
const ordId = r.json?.data?.orderId ?? r.json?.id
const ordRow = await db.orders.findUnique({ where: { id: ordId } })
ok(ordRow && Math.abs(ordRow.totalAmount - 50) < 0.01, 'order total: 5 × ৳12 − ৳10 voucher = ৳50 (the discount is REAL money)', JSON.stringify({ total: ordRow?.totalAmount }))
const afterUse = await db.coupons.findUnique({ where: { code } })
ok(afterUse.usedCount === 1, 'coupon usedCount → 1 (single-use consumed)')
r = await buyer1('POST', '/api/orders', { items: [{ productId, quantity: 5 }], couponCode: code })
ok(r.status === 409 && String(r.json?.error || '').toLowerCase().includes('usage limit'), 'second order with the same code → 409 (the documented CouponError contract: single-use enforced)', JSON.stringify(r.json)?.slice(0, 160))

// ── the vault reflects the spend ──
r = await buyer1('GET', '/api/coupons/my?status=used')
ok((r.json?.data || []).some((c) => c.code === code && c.status === 'used'), 'vault (used): voucher now listed as used')
r = await buyer1('GET', '/api/coupons/my?status=active')
ok(!(r.json?.data || []).some((c) => c.code === code), 'vault (active): voucher no longer active')
r = await buyer1('GET', '/api/buyer/dashboard')
ok(r.status === 200 && (r.json?.data?.stats?.totalSavingsBDT ?? 0) >= 10, `dashboard totalSavingsBDT includes the used voucher (got ৳${r.json?.data?.stats?.totalSavingsBDT})`, JSON.stringify(r.json?.data?.stats))

// ── the wallet circuit ──
r = await buyer1('POST', '/api/rewards/redeem', { pointsToRedeem: 100, rewardType: 'wallet_credit' })
ok(r.status === 201 && r.json?.data?.walletBalanceAfter === 10, 'redeem 100 points → wallet credit ৳10 (balanceAfter 10)', JSON.stringify(r.json))
const wallet = await db.wallets.findFirst({ where: { userId: buyer1Id } })
ok(wallet && Math.abs(wallet.balance - 10) < 0.001, 'DB: wallet balance ৳10')
const wtx = await db.walletTransactions.findFirst({ where: { walletId: wallet.id, type: 'cashback', amount: 10 } })
ok(!!wtx && Math.abs(wtx.balanceAfter - 10) < 0.001, 'ledger: walletTransactions cashback +৳10 with balanceAfter (no untraceable money)')
const audit2 = await db.auditLogs.findFirst({ where: { action: 'reward_wallet_credit', actorId: buyer1Id } })
ok(!!audit2, 'audit: reward_wallet_credit row')
const reward2 = await db.buyerRewards.findUnique({ where: { buyerId: buyer1Id } })
ok(reward2.pointsBalance === 0 && reward2.totalRedeemed === 200, 'buyer1 points fully spent (0 left, 200 redeemed)')

// ── the race: concurrent redemptions cannot double-spend ──
const [raceA, raceB] = await Promise.all([
  buyer2('POST', '/api/rewards/redeem', { pointsToRedeem: 150, rewardType: 'voucher' }),
  buyer2('POST', '/api/rewards/redeem', { pointsToRedeem: 150, rewardType: 'voucher' }),
])
const statuses = [raceA.status, raceB.status].sort()
ok(statuses[0] === 201 && statuses[1] === 409, `parallel double-redeem of the same 150 points: exactly one 201 + one 409 (got ${statuses})`, JSON.stringify([raceA.status, raceB.status]))
const b2Id = (await db.users.findFirst({ where: { email: `t143-b2-${STAMP}@t143.test` } })).id
const b2reward = await db.buyerRewards.findUnique({ where: { buyerId: b2Id } })
ok(b2reward.pointsBalance === 0 && b2reward.totalRedeemed === 150, 'race: balance 0, totalRedeemed exactly 150 (never negative, never doubled)')
const b2coupons = await db.coupons.findMany({ where: { userId: b2Id } })
ok(b2coupons.length === 1, 'race: exactly ONE voucher exists for buyer2')

// ── the rate limit: 10/min, the 11th hammer gets 429 ──
await buyer3('GET', '/api/rewards/loyalty')
let raw429 = null
{
  let cookie = ''
  const login = await buyer3('POST', '/api/auth/login', { email: `t143-b3-${STAMP}@t143.test`, password: PW })
  const setCookies = []
  // rebuild the cookie jar from the login response headers via a raw call
  const res0 = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.143.99.99' }, body: JSON.stringify({ email: `t143-b3-${STAMP}@t143.test`, password: PW }) })
  for (const c of res0.headers.getSetCookie?.() ?? []) { const p = c.split(';')[0]; if (p) cookie = cookie ? `${cookie}; ${p}` : p }
  let last = null
  for (let i = 0; i < 11; i++) {
    const res = await fetch(`${BASE}/api/rewards/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Forwarded-For': '10.143.99.99' }, body: JSON.stringify({ pointsToRedeem: 999999 }) })
    last = res.status
    if (res.status === 429) { raw429 = i; break }
    await res.json().catch(() => null)
  }
  ok(raw429 === 10, `hammer: the 11th redeem in a minute → 429 (blocked at call #${raw429 === null ? 'none' : raw429 + 1}, last ${last})`)
}

console.log(`\nT143 RESULT: ${PASS} pass / ${FAIL} fail`)
await db.$disconnect()
process.exitCode = FAIL === 0 ? 0 : 1
