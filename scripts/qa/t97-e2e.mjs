/**
 * Task 97 E2E — THE COLLECTIONS RAIL, REPAIRED ("a feature that 500'd on
 * every create is not a feature").
 *
 * The old routes wrote buyerId/privacy/coverColor into a schema that had
 * userId/isPublic/coverImage, behind `(db as any)` casts — EVERY call died.
 * This drill proves the rebuilt rail end to end:
 *   A. gates — auth-first everywhere except the public shared-token read
 *   B. create — Zod strict, visible-product guard (phantom == unapproved ==
 *      hidden: the SAME 404, the rail is not an existence oracle)
 *   C. list — owner-scoped only
 *   D. single GET — owner-only, no-leak 404
 *   E. patch — SHARED mints the secret token; PRIVATE revokes the link for
 *      real (same 404 as a phantom token); productIds replacement syncs
 *      membership in one call; re-sharing reuses the SAME token
 *   F. shared link — a guest holding the token reads the curation with NO
 *      owner identity and no token reflection
 *   G. items — add (201), idempotent re-add (200 alreadyAdded), unvisible
 *      product 404, remove (200) then honest 404 on re-remove
 *   H. delete — owner-only, then it's gone
 *   I. audit — every state change left a row
 *
 * Run: bun scripts/qa/t97-e2e.mjs   (DB must be EMPTY — first-admin window)
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
  const ip = `10.97.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = { userType, authProvider: 'email', email, password, fullName: `QA97 ${userType}` }
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
  const PASSWORD = 't97-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), b1 = makeSession(), b2 = makeSession()
  await registerAndLogin(admin, 'admin', 'qa97-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa97-supa@qa.local', PASSWORD)
  await registerAndLogin(b1, 'buyer', 'qa97-buyer1@qa.local', PASSWORD)
  await registerAndLogin(b2, 'buyer', 'qa97-buyer2@qa.local', PASSWORD)
  console.log('  accounts ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA97 Curate', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const mkProduct = async (name, visible = true) => {
    const p = await seller('POST', '/api/supplier/products', {
      name, description: 'Collections drill product.',
      categoryId, unit: 'pcs', moq: 2, basePrice: 300, stockQuantity: 40,
      priceTiers: [{ minQty: 1, pricePerUnit: 300 }],
      images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    })
    const id = p.json?.data?.id ?? p.json?.id
    if (visible) await admin('PATCH', '/api/admin/products', { productId: id, action: 'approve', reason: 'QA97' })
    return id
  }
  const visProduct = await mkProduct('QA97 Visible Widget', true)
  const hiddenProduct = await mkProduct('QA97 Unapproved Widget', false)

  /* ── A. gates ── */
  console.log('— A. gates —')
  ok((await makeSession()('GET', '/api/collections')).status === 401, 'anon list → 401')
  ok((await makeSession()('POST', '/api/collections', { name: 'X' })).status === 401, 'anon create → 401')
  ok((await makeSession()('GET', '/api/collections/whatever')).status === 401, 'anon single → 401')
  ok((await makeSession()('POST', '/api/collections/whatever/items', { productId: 'x' })).status === 401, 'anon item add → 401')
  const phantomShared = await makeSession()('GET', '/api/collections/shared/not-a-real-token')
  ok(phantomShared.status === 404, 'shared-token read is PUBLIC (phantom → honest 404, no auth)', JSON.stringify(phantomShared.json))

  /* ── B. create ── */
  console.log('— B. create —')
  ok((await b1('POST', '/api/collections', { name: '' })).status === 400, 'empty name → 400')
  ok((await b1('POST', '/api/collections', { name: 'X', bogus: 1 })).status === 400, 'strict keys → 400')
  ok((await b1('POST', '/api/collections', { name: 'x'.repeat(51) })).status === 400, 'name > 50 → 400')
  ok((await b1('POST', '/api/collections', { name: 'X', privacy: 'LEAKED' })).status === 400, 'bad privacy enum → 400')
  const phantom = await b1('POST', '/api/collections', { name: 'P', productIds: ['nonexistent-id'] })
  ok(phantom.status === 404 && phantom.json?.error === 'Product not available', 'phantom productId → 404', JSON.stringify(phantom.json))
  const unapproved = await b1('POST', '/api/collections', { name: 'P', productIds: [hiddenProduct] })
  ok(unapproved.status === 404 && unapproved.json?.error === 'Product not available', 'UNAPPROVED productId → the SAME 404 (no existence leak)', JSON.stringify(unapproved.json))
  const c1 = await b1('POST', '/api/collections', {
    name: 'Machining Picks', description: 'Q3 shortlist', privacy: 'PRIVATE',
    coverColor: '#C8102E', productIds: [visProduct],
  })
  ok(c1.status === 201 && c1.json?.data?.privacy === 'PRIVATE' && c1.json?.data?.shareToken === null, 'PRIVATE create → 201, no token minted', JSON.stringify(c1.json?.data))
  ok(c1.json?.data?.coverColor === '#C8102E' && c1.json?.data?.coverImageUrl === null, 'coverColor persisted, coverImageUrl honest null')
  ok(c1.json?.data?._count?.items === 1, 'create with productIds → 1 item')

  /* ── C. list ── */
  console.log('— C. list —')
  const list1 = await b1('GET', '/api/collections')
  ok(list1.json?.data?.length === 1 && list1.json?.data?.[0]?.name === 'Machining Picks', 'owner list serves own row')
  const list2 = await b2('GET', '/api/collections')
  ok(list2.json?.data?.length === 0, 'foreign buyer list is EMPTY (owner-scoped)')

  /* ── D. single GET ── */
  console.log('— D. single GET —')
  const colId = c1.json?.data?.id
  const own = await b1('GET', `/api/collections/${colId}`)
  ok(own.status === 200 && own.json?.data?.items?.[0]?.product?.id === visProduct, 'owner GET serves items with product truth', JSON.stringify(own.json?.data?.items?.[0]?.product?.name))
  ok(own.json?.data?.items?.[0]?.product?.supplier?.id, 'item product carries supplier id (cart-add ready)')
  ok((await b2('GET', `/api/collections/${colId}`)).status === 404, 'foreign single GET → the SAME 404 as phantom')
  ok((await b1('GET', '/api/collections/phantom-id')).status === 404, 'phantom single GET → 404')

  /* ── E. patch / share lifecycle ── */
  console.log('— E. patch / share lifecycle —')
  ok((await b2('PATCH', `/api/collections/${colId}`, { name: 'Stolen' })).status === 404, 'foreign PATCH → 404')
  const sh = await b1('PATCH', `/api/collections/${colId}`, { privacy: 'SHARED' })
  const token = sh.json?.data?.shareToken
  ok(sh.status === 200 && typeof token === 'string' && /^[0-9a-f]{48}$/.test(token), 'SHARED transition mints a 48-hex secret token', JSON.stringify(token))
  const g1 = await makeSession()('GET', `/api/collections/shared/${token}`)
  ok(g1.status === 200 && g1.json?.data?.name === 'Machining Picks' && g1.json?.data?.items?.length === 1, 'guest opens the shared link → 200 with items')
  ok(!JSON.stringify(g1.json).includes('shareToken') && !JSON.stringify(g1.json).includes('privacy') && !JSON.stringify(g1.json).includes('userId'), 'shared payload leaks NO owner fields and reflects NO token', JSON.stringify(Object.keys(g1.json?.data ?? {})))
  const revoke = await b1('PATCH', `/api/collections/${colId}`, { privacy: 'PRIVATE' })
  ok(revoke.json?.data?.shareToken === null, 'back to PRIVATE → token no longer served')
  const g2 = await makeSession()('GET', `/api/collections/shared/${token}`)
  ok(g2.status === 404, 'the OLD link is genuinely broken after revoke (same 404 as phantom)')
  const reshare = await b1('PATCH', `/api/collections/${colId}`, { privacy: 'SHARED' })
  ok(reshare.json?.data?.shareToken === token, 're-sharing reuses the SAME token (no re-mint)')
  const sync = await b1('PATCH', `/api/collections/${colId}`, { productIds: [] })
  ok(sync.status === 200 && sync.json?.data?._count?.items === 0, 'productIds [] empties membership in one call')
  const readd = await b1('PATCH', `/api/collections/${colId}`, { productIds: [visProduct] })
  ok(readd.json?.data?._count?.items === 1, 'productIds [vis] restores membership')
  const badsync = await b1('PATCH', `/api/collections/${colId}`, { productIds: [hiddenProduct] })
  ok(badsync.status === 404, 'replacement set containing an unvisible product → 404 (nothing half-applied)')
  const afterBad = await b1('GET', `/api/collections/${colId}`)
  ok(afterBad.json?.data?._count?.items === 1, 'membership unchanged after the refused sync')

  /* ── G. items ── */
  console.log('— G. items —')
  const second = await mkProduct('QA97 Second Widget', true)
  const add1 = await b1('POST', `/api/collections/${colId}/items`, { productId: second })
  ok(add1.status === 201, 'item add → 201')
  const add2 = await b1('POST', `/api/collections/${colId}/items`, { productId: second })
  ok(add2.status === 200 && add2.json?.alreadyAdded === true, 're-add is idempotent (200 alreadyAdded, not an error)', JSON.stringify(add2.json))
  ok((await b1('POST', `/api/collections/${colId}/items`, { productId: hiddenProduct })).status === 404, 'unvisible product add → 404')
  ok((await b2('POST', `/api/collections/${colId}/items`, { productId: second })).status === 404, 'foreign collection item add → 404')
  const rm1 = await b1('DELETE', `/api/collections/${colId}/items?productId=${second}`)
  ok(rm1.status === 200, 'item remove → 200')
  const rm2 = await b1('DELETE', `/api/collections/${colId}/items?productId=${second}`)
  ok(rm2.status === 404 && rm2.json?.error === 'Product not in this collection', 're-remove is an honest 404, not silent success', JSON.stringify(rm2.json))

  /* ── H. delete ── */
  console.log('— H. delete —')
  const c2 = await b1('POST', '/api/collections', { name: 'Doomed' })
  const doomedId = c2.json?.data?.id
  ok((await b2('DELETE', `/api/collections/${doomedId}`)).status === 404, 'foreign DELETE → 404')
  ok((await b1('DELETE', `/api/collections/${doomedId}`)).status === 200, 'owner DELETE → 200')
  ok((await b1('GET', `/api/collections/${doomedId}`)).status === 404, 'deleted collection is gone')

  /* ── I. audit ── */
  console.log('— I. audit —')
  const audit = await db.auditLogs.groupBy({ by: ['action'], where: { action: { startsWith: 'collection' } }, _count: { action: true } })
  const counts = Object.fromEntries(audit.map((a) => [a.action, a._count.action]))
  ok(counts.collection_created === 2, `collection_created ×2 (Machining Picks + Doomed; the bogus-key create was REFUSED and audited nothing)`, JSON.stringify(counts))
  ok(counts.collection_updated === 5, `collection_updated ×5 (share/revoke/reshare + productIds [] + [vis]; the refused sync audits nothing)`, JSON.stringify(counts))
  ok(counts.collection_items_synced === 2, `collection_items_synced ×2 (only SUCCESSFUL membership syncs are audited)`, JSON.stringify(counts))
  ok(counts.collection_item_added === 1 && counts.collection_item_removed === 1, 'item add/remove audited', JSON.stringify(counts))
  ok(counts.collection_deleted === 1, 'delete audited')

  console.log(`\n=== t97 RESULT: ${PASS} PASS / ${FAIL} FAIL ===`)
  process.exitCode = FAIL === 0 ? 0 : 1
  await db.$disconnect()
}
main().catch(async (e) => { console.error('DRILL ERROR:', e.message); process.exitCode = 1; await db.$disconnect() })
