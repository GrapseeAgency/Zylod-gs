/**
 * Task 111 E2E — THE REWARD TASKS RAIL on the real couponEarningTasks +
 * userCoupons tables. The earn page has been a public promise since day one
 * with zero writers, and the old POST was a money printer (POST a taskId →
 * instant voucher, no proof, no one-claim guard). This drill proves the
 * rewritten circuit:
 *   public honest-zero → admin gates + STRICT validation (only
 *   server-verifiable types can be minted) → create/park/edit/delete with
 *   real audits → PROOF-driven claims (the server counts the buyer's real
 *   orders / wishlists / check-ins and refuses with the honest shortfall) →
 *   one-claim-per-buyer 409 → claimed flags + progress on the buyer GET →
 *   vouchers verbatim in the vault + notifications → audit counts exact.
 *
 * Run: node scripts/qa/wipe.mjs && bun scripts/qa/t111-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.111.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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

async function registerAndLogin(session, userType, email, password, businessName) {
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA111 ${userType}`, ...(businessName ? { businessName } : {}) }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json).slice(0, 200)}`)
    await sleep(4000 * (attempt + 1))
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const login = await session('POST', '/api/auth/login', { email, password })
    if (login.status === 200 || login.status === 201) return
    if (login.status !== 429) throw new Error(`login ${email} exhausted`)
    await sleep(4000 * (attempt + 1))
  }
}

console.log('── A. SETUP (accounts, approved product, REAL orders) ───')
const STAMP = Date.now()
const admin = makeSession()
const seller = makeSession()
const buyer = makeSession()
const buyer2 = makeSession() // never orders — the honest refusal

const B1 = `qa111-buyer-${STAMP}@t111.test`
await registerAndLogin(admin, 'admin', `qa111-admin-${STAMP}@t111.test`, 'Passw0rd!111')
await registerAndLogin(seller, 'supplier', `qa111-seller-${STAMP}@t111.test`, 'Passw0rd!111', 'QA111 RewardWorks')
await registerAndLogin(buyer, 'buyer', B1, 'Passw0rd!111')
await registerAndLogin(buyer2, 'buyer', `qa111-b2-${STAMP}@t111.test`, 'Passw0rd!111')

const cat = await admin('POST', '/api/admin/categories', { name: 'QA111 Rewards', isActive: true })
const categoryId = cat.json?.data?.id ?? cat.json?.id
const prod = await seller('POST', '/api/supplier/products', {
  name: 'QA111 Reward Widget', description: 'the product the bulk line rides on', categoryId,
  unit: 'pcs', bundleSize: null, moq: 1, basePrice: 300, stockQuantity: 500, weightKg: 1,
  priceTiers: [{ minQty: 1, pricePerUnit: 300 }],
  images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
})
const productId = prod.json?.data?.id ?? prod.json?.id
await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA111' })
ok(!!productId, 'approved product live')

async function makePurchaser(session, emailLocal, qty) {
  const addr = await session('POST', '/api/addresses', {
    label: 'Home', address_line1: `House 11, Road ${emailLocal}`,
    city: 'Dhaka', district: 'Dhaka', contact_phone: '+8801700000111', postal_code: '1200',
  })
  const addressId = addr.json?.data?.id ?? addr.json?.id
  const user = await db.users.findUnique({ where: { email: emailLocal } })
  await db.wallets.create({ data: { userId: user.id, balance: 999999 } })
  const ord = await session('POST', '/api/orders', {
    items: [{ productId, quantity: qty }], shippingAddressId: addressId, payWithWallet: true,
  })
  if (ord.status !== 201) throw new Error(`order for ${emailLocal} -> ${ord.status}: ${JSON.stringify(ord.json).slice(0, 200)}`)
  return ord.json?.data?.orderId ?? ord.json?.id
}

await makePurchaser(buyer, B1, 1)   // order 1 — first_order proof
await makePurchaser(buyer, B1, 3)   // order 2 — the bulk line (qty 3 ≥ target 2)
ok(true, 'buyer holds TWO real wallet-paid orders (one with a qty-3 line)')
const buyerRow = await db.users.findUnique({ where: { email: B1 } })

console.log('── B. PUBLIC HONEST-ZERO (before any task exists) ───────')
{
  const guest = makeSession()
  const g = await guest('GET', '/api/coupons/earn')
  ok(g.status === 200 && Array.isArray(g.json?.data) && g.json.data.length === 0, 'public GET serves success with an empty task list before writers exist', JSON.stringify(g.json).slice(0, 120))
}

console.log('── C. ADMIN GATES + STRICT VALIDATION ───────────────────')
function TASK(over) {
  return {
    type: 'first_order', title: 'Place your first wholesale order',
    description: 'Order anything from any seller to unlock your welcome reward.',
    rewardLabel: '৳50 OFF', rewardBDT: 50, targetCount: 1, isActive: true, sortOrder: 2, ...(over || {}),
  }
}
{
  const guest = makeSession()
  ok((await guest('GET', '/api/admin/reward-tasks')).status === 401, 'admin GET without a session → 401')
  ok((await guest('POST', '/api/admin/reward-tasks', TASK())).status === 401, 'create without a session → 401')
  ok((await buyer('GET', '/api/admin/reward-tasks')).status === 401, 'buyer-role admin GET → 401')
  ok((await buyer('POST', '/api/admin/reward-tasks', TASK())).status === 401, 'buyer-role create → 401')

  const invented = await admin('POST', '/api/admin/reward-tasks', TASK({ type: 'share' }))
  ok(invented.status === 400 && /share/.test(invented.json?.error ?? ''), 'invented type "share" refused with the honest reason (no proof source)', JSON.stringify(invented.json).slice(0, 140))
  ok((await admin('POST', '/api/admin/reward-tasks', TASK({ type: 'referral' }))).status === 400, 'type "referral" refused (no referral tracking exists)')
  ok((await admin('POST', '/api/admin/reward-tasks', TASK({ type: 'review_photo' }))).status === 400, 'type "review_photo" refused (reviews carry no images)')

  const strict = await admin('POST', '/api/admin/reward-tasks', { ...TASK(), bogus: 1 })
  ok(strict.status === 400, 'unknown key refused (strict body)', JSON.stringify(strict.json).slice(0, 100))
  ok((await admin('POST', '/api/admin/reward-tasks', TASK({ rewardBDT: -5 }))).status === 400, 'negative reward refused')
  ok((await admin('POST', '/api/admin/reward-tasks', TASK({ rewardBDT: 20000 }))).status === 400, 'reward over the ৳10000 cap refused')
  ok((await admin('POST', '/api/admin/reward-tasks', TASK({ iconColor: 'red' }))).status === 400, 'non-hex iconColor refused')
  ok((await admin('POST', '/api/admin/reward-tasks', TASK({ targetCount: 0 }))).status === 400, 'targetCount 0 refused')
  ok((await admin('POST', '/api/admin/reward-tasks', { ...TASK(), title: undefined })).status === 400, 'missing title refused')
}

console.log('── D. CREATE + PUBLIC REFLECTION ────────────────────────')
const T = {}
{
  for (const [key, body] of [
    ['wishlist', TASK({ type: 'wishlist', title: 'Wishlist your first product', description: 'Save any product to your wishlist.', rewardLabel: '৳20 OFF', rewardBDT: 20, targetCount: 1, sortOrder: 0 })],
    ['milestone', TASK({ type: 'milestone', title: 'Reach 2 orders', description: 'Place two orders to unlock this milestone.', rewardLabel: '৳100 OFF', rewardBDT: 100, targetCount: 2, sortOrder: 1 })],
    ['first', TASK({})],
    ['bulk', TASK({ type: 'bulk', title: 'Order in bulk', description: 'Any single order line with quantity 2 or more.', rewardLabel: '৳30 OFF', rewardBDT: 30, targetCount: 2, sortOrder: 3 })],
    ['checkin', TASK({ type: 'checkin', title: 'Check in today', description: 'Keep your daily check-in streak alive.', rewardLabel: '৳10 OFF', rewardBDT: 10, targetCount: 1, sortOrder: 4 })],
  ]) {
    const r = await admin('POST', '/api/admin/reward-tasks', body)
    if (r.status !== 201) throw new Error(`create ${key} -> ${r.status}: ${JSON.stringify(r.json).slice(0, 200)}`)
    T[key] = r.json.data
  }
  ok(!!T.first?.id && !!T.milestone?.id && !!T.wishlist?.id && !!T.bulk?.id && !!T.checkin?.id, 'five reward tasks created')

  const list = await admin('GET', '/api/admin/reward-tasks')
  ok(list.status === 200 && list.json?.data?.length === 5, 'admin list serves all five')
  ok(list.json?.stats?.total === 5 && list.json?.stats?.active === 5 && list.json?.stats?.parked === 0 && list.json?.stats?.totalClaims === 0, 'stats {total 5, active 5, parked 0, claims 0}', JSON.stringify(list.json?.stats))
  ok(list.json?.data?.every((t) => t.claimCount === 0), 'every row reports claimCount 0 before claims')

  const pub = await buyer('GET', '/api/coupons/earn')
  ok(pub.status === 200 && pub.json?.data?.length === 5, 'public GET serves the five live tasks')
  ok(JSON.stringify(pub.json.data.map((t) => t.sortOrder)) === '[0,1,2,3,4]', 'public rail ordered by sortOrder', JSON.stringify(pub.json.data.map((t) => t.sortOrder)))
  const plainGuest = makeSession()
  const pg = await plainGuest('GET', '/api/coupons/earn')
  ok(pg.json?.data?.every((t) => t.claimed === undefined && t.progress === undefined), 'guest GET gets plain tasks (no claimed/progress fields)')
  ok(pub.json.data.every((t) => t.claimed === false && typeof t.progress?.count === 'number' && t.progress?.met === (t.progress.count >= (t.targetCount ?? 1))), 'authed buyer GET carries claimed:false + real progress (buyer already holds orders — wishlist/checkin read 0)')
}

console.log('── E. CLAIM GATES + HONEST REFUSALS (buyer2, zero orders) ──')
{
  const guest = makeSession()
  ok((await guest('POST', '/api/coupons/earn', { taskId: T.first.id })).status === 401, 'guest claim → 401')

  const broke = await buyer2('POST', '/api/coupons/earn', { taskId: T.first.id })
  ok(broke.status === 403 && /needs 1 — you have 0/.test(broke.json?.error ?? ''), 'claim without proof refused with the honest shortfall', JSON.stringify(broke.json).slice(0, 140))
  ok(broke.json?.progress?.count === 0 && broke.json?.progress?.required === 1, 'the refusal carries the real progress numbers')

  ok((await buyer2('POST', '/api/coupons/earn', { taskId: T.first.id, bogus: 1 })).status === 400, 'unknown key in claim body refused (strict)')
  ok((await buyer2('POST', '/api/coupons/earn', {})).status === 400, 'missing taskId refused')
  ok((await buyer2('POST', '/api/coupons/earn', { taskId: 'nonexistent-task-id' })).status === 404, 'phantom taskId → 404')

  const mine = await buyer2('GET', '/api/coupons/earn')
  const first = mine.json?.data?.find((t) => t.id === T.first.id)
  ok(first?.claimed === false && first?.progress?.count === 0 && first?.progress?.met === false, 'authed buyer GET carries claimed:false + honest zero progress', JSON.stringify(first))
}

console.log('── F. PROOF-DRIVEN CLAIMS (buyer with real rows) ────────')
{
  const pre = await buyer('GET', '/api/coupons/earn')
  const p = Object.fromEntries(pre.json.data.map((t) => [t.id, t.progress]))
  ok(p[T.first.id]?.count === 2, 'first_order progress counts BOTH real orders (2)', JSON.stringify(p[T.first.id]))
  ok(p[T.milestone.id]?.count === 2 && p[T.milestone.id]?.met === true, 'milestone 2-of-2 already met')
  ok(p[T.bulk.id]?.count === 3 && p[T.bulk.id]?.met === true, 'bulk progress = the buyer\'s largest line quantity (3) vs target 2 — met', JSON.stringify(p[T.bulk.id]))
  ok(p[T.wishlist.id]?.count === 0, 'wishlist progress honestly 0')

  const c1 = await buyer('POST', '/api/coupons/earn', { taskId: T.first.id })
  ok(c1.status === 201 && c1.json?.success === true, 'first_order claim pays out with proof in hand')
  const v = c1.json?.data ?? {}
  ok(typeof v.code === 'string' && v.code.startsWith('EARN-FIRSTORDER-'), 'voucher code names the task type', v.code)
  ok(v.title === `Reward: ${T.first.title}` && v.discountLabel === '৳50 OFF' && v.savingsBDT === 50 && v.minOrderBDT === 250, 'voucher row verbatim (title/label/savings/min-order)', JSON.stringify(v).slice(0, 160))
  ok(v.status === 'active' && v.categoryLabel === 'Task Reward', 'voucher active, category Task Reward')
  ok(new Date(v.validUntil).getTime() - Date.now() > 13 * 86400000 && new Date(v.validUntil).getTime() - Date.now() < 15 * 86400000, 'validUntil ~14 days out')

  const re = await buyer('POST', '/api/coupons/earn', { taskId: T.first.id })
  ok(re.status === 409, 're-claim the same task → 409 (one claim per buyer, forever)', JSON.stringify(re.json).slice(0, 120))

  ok((await buyer('POST', '/api/coupons/earn', { taskId: T.milestone.id })).status === 201, 'milestone claim pays (2 real orders)')
  ok((await buyer('POST', '/api/coupons/earn', { taskId: T.bulk.id })).status === 201, 'bulk claim pays (real qty-3 line)')

  const noWish = await buyer('POST', '/api/coupons/earn', { taskId: T.wishlist.id })
  ok(noWish.status === 403 && /needs 1 — you have 0/.test(noWish.json?.error ?? ''), 'wishlist claim refused before the wishlist exists')

  const wl = await buyer('POST', '/api/wishlist', { productId })
  ok(wl.status === 201 || wl.status === 200, 'buyer wishlists the real product', JSON.stringify(wl.json).slice(0, 120))
  ok((await buyer('POST', '/api/coupons/earn', { taskId: T.wishlist.id })).status === 201, 'wishlist claim pays after the real wishlist row')

  const ck = await buyer('POST', '/api/rewards/checkin')
  ok(ck.status === 201 || ck.status === 200 || ck.status === 409, 'daily check-in recorded (or already checked in today)', String(ck.status))
  ok((await buyer('POST', '/api/coupons/earn', { taskId: T.checkin.id })).status === 201, 'checkin claim pays on the real check-in row')

  const after = await buyer('GET', '/api/coupons/earn')
  ok(after.json?.data?.every((t) => t.claimed === true), 'authed GET now marks ALL five claimed', JSON.stringify(after.json?.data?.map((t) => [t.id, t.claimed])))

  const vault = await buyer('GET', '/api/coupons/my')
  const vaultRows = vault.json?.data ?? vault.json ?? []
  ok(vault.status === 200 && vaultRows.length >= 5, 'the voucher vault holds the five earned vouchers', String(vaultRows.length))

  const notifs = await db.notifications.count({ where: { userId: buyerRow.id, type: 'promotion' } })
  ok(notifs >= 5, 'a real notification fired for every claim', String(notifs))
}

console.log('── G. PARK / EDIT / DELETE with real audits ─────────────')
{
  const park = await admin('PATCH', `/api/admin/reward-tasks/${T.checkin.id}`, { isActive: false })
  ok(park.status === 200 && park.json?.data?.isActive === false, 'park via PATCH isActive:false')
  const pubAfterPark = await buyer('GET', '/api/coupons/earn')
  ok(pubAfterPark.json?.data?.length === 4 && !pubAfterPark.json.data.some((t) => t.id === T.checkin.id), 'parked task vanishes from the public rail (reader filters isActive)', String(pubAfterPark.json?.data?.length))
  const listAfterPark = await admin('GET', '/api/admin/reward-tasks')
  ok(listAfterPark.json?.data?.length === 5 && listAfterPark.json?.stats?.parked === 1, 'console keeps the parked row (stats parked 1)')

  const edit = await admin('PATCH', `/api/admin/reward-tasks/${T.milestone.id}`, { rewardBDT: 150 })
  ok(edit.status === 200 && edit.json?.data?.rewardBDT === 150, 'PATCH edits only the arrived keys (rewardBDT 100 → 150)')
  ok((await admin('PATCH', `/api/admin/reward-tasks/${T.milestone.id}`, {})).status === 400, 'empty PATCH refused (no fields to update)')
  ok((await admin('PATCH', '/api/admin/reward-tasks/phantom-id', { rewardBDT: 5 })).status === 404, 'phantom PATCH → 404')
  ok((await admin('DELETE', '/api/admin/reward-tasks/phantom-id')).status === 404, 'phantom DELETE → 404')

  const del = await admin('DELETE', `/api/admin/reward-tasks/${T.checkin.id}`)
  ok(del.status === 200, 'delete the parked task')
  ok((await admin('DELETE', `/api/admin/reward-tasks/${T.checkin.id}`)).status === 404, 're-delete → 404')
  const finalList = await admin('GET', '/api/admin/reward-tasks')
  ok(finalList.json?.data?.length === 4 && finalList.json?.stats?.totalClaims === 4, 'final list 4 rows, totalClaims 4 among surviving tasks (the deleted task\'s voucher keeps existing but leaves the group)', JSON.stringify(finalList.json?.stats))
}

console.log('── H. AUDITS + RAW ROWS ─────────────────────────────────')
{
  const created = await db.auditLogs.count({ where: { action: 'reward_task_created' } })
  const updated = await db.auditLogs.count({ where: { action: 'reward_task_updated' } })
  const deleted = await db.auditLogs.count({ where: { action: 'reward_task_deleted' } })
  const claimed = await db.auditLogs.count({ where: { action: 'reward_claimed' } })
  ok(created === 5, 'reward_task_created audits: 5', String(created))
  ok(updated === 2, 'reward_task_updated audits: 2 (park + edit)', String(updated))
  ok(deleted === 1, 'reward_task_deleted audits: 1', String(deleted))
  ok(claimed === 5, 'reward_claimed audits: 5', String(claimed))

  const delMeta = await db.auditLogs.findFirst({ where: { action: 'reward_task_deleted' } })
  const meta = JSON.parse(delMeta?.metadata ?? '{}')
  ok(meta.liveClaimsAtDeletion === 1, 'deletion audit stamps the live claim count', JSON.stringify(meta))
  const editMeta = await db.auditLogs.findFirst({ where: { action: 'reward_task_updated', entityType: 'couponEarningTasks', entityId: T.milestone.id }, orderBy: { createdAt: 'desc' } })
  const em = JSON.parse(editMeta?.metadata ?? '{}')
  ok(em.before?.rewardBDT === 100 && em.after?.rewardBDT === 150, 'edit audit carries REAL before/after reward', JSON.stringify(em))
  const claimMeta = await db.auditLogs.findFirst({ where: { action: 'reward_claimed' }, orderBy: { createdAt: 'desc' } })
  const cm = JSON.parse(claimMeta?.metadata ?? '{}')
  ok(!!cm.voucherCode && !!cm.taskId && cm.proofCount >= 1, 'claim audits carry voucher + task + proof count', JSON.stringify(cm))

  const vouchers = await db.userCoupons.count({ where: { userId: buyerRow.id, couponId: { in: Object.values(T).map((t) => t.id) } } })
  ok(vouchers === 5, 'exactly 5 voucher rows exist for the five claims (no farmer duplicates)', String(vouchers))
}

console.log('─────────────────────────────────────────────────────────')
console.log(`t111 RESULT: ${PASS} PASS / ${FAIL} FAIL`)
process.exit(FAIL === 0 ? 0 : 1)
