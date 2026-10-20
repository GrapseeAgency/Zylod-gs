/**
 * Task 93 E2E — THE PRODUCT Q&A RAIL ("ask before the bulk order").
 *
 * The rail existed but was BROKEN at its core: the answer path compared
 * products.supplierId (a supplierProfiles id) against the session users.id
 * — different id spaces — so NO supplier could ever answer a question on
 * their own product. Plus: anon POST got a naked 403, no Zod, no rate
 * limits, no notifications, no UI. This loop proves the rewrite:
 *   A. gates — anon ask 401 (was 403), anon answer 401, public GET 200
 *   B. guards — strict Zod (unknown keys, 4-char question, 1-char answer),
 *      invisible product 404 no-leak, phantom product 404
 *   C. THE FIX — the product's OWN supplier answers their own question
 *      (the old rail 403'd EVERY supplier here); a FOREIGN supplier is 403
 *   D. immutability — double answer 409; foreign/phantom qaId 404 no-leak
 *   E. THE COHESION RAILS — the supplier gets a durable notification +
 *      a live 'qa:new' seller-room tap; the asker gets a durable answer
 *      notification + live push; the PUBLIC product room gets 'product:qa'
 *      taps for ask AND answer
 *   F. canAnswer — server-decided: true for the owning supplier's session,
 *      false for anon and for a foreign supplier; asker names are real
 *   G. audit trail — qa_asked / qa_answered in raw DB
 *
 * Run: bun scripts/qa/t93-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { io } from 'socket.io-client'
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
  const ip = `10.95.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
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
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA93 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA93 Works ${email.slice(7, 14)}` } : {}),
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await session('POST', '/api/auth/register', payload)
    if (reg.status === 201 || reg.status === 200) break
    if (reg.status !== 429) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json)}`)
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

function waitForEvent(socket, event, ms = 8000, predicate = null) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { socket.off(event, h); resolve(null) }, ms)
    const h = (payload) => {
      if (predicate && !predicate(payload)) return
      clearTimeout(t); socket.off(event, h); resolve(payload)
    }
    socket.on(event, h)
  })
}

const connectSocket = () => io('http://127.0.0.1:3005', { transports: ['websocket'] })

const main = async () => {
  console.log('— setup (fresh empty DB, first-admin window) —')
  const PASSWORD = 't93-E2e-Str0ng1!'
  const admin = makeSession(), seller = makeSession(), seller2 = makeSession(), buyer = makeSession()
  await registerAndLogin(admin, 'admin', 'qa93-admin@qa.local', PASSWORD)
  await registerAndLogin(seller, 'supplier', 'qa93-supa@qa.local', PASSWORD)
  await registerAndLogin(seller2, 'supplier', 'qa93-supa2@qa.local', PASSWORD)
  await registerAndLogin(buyer, 'buyer', 'qa93-buyer@qa.local', PASSWORD)
  console.log('  users ready')

  const cat = await admin('POST', '/api/admin/categories', { name: 'QA93 Cat', isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const p = await seller('POST', '/api/supplier/products', {
    name: 'QA93 Industrial Blender 40L', description: 'QA93 heavy-duty blender, bulk kitchens', categoryId, unit: 'pcs',
    moq: 4, basePrice: 26000, stockQuantity: 90,
    priceTiers: [{ minQty: 1, pricePerUnit: 26000 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const productId = p.json?.data?.id ?? p.json?.id
  await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA93' })

  // An UNAPPROVED twin — questions on it must be the same 404 as phantom.
  const pHidden = await seller('POST', '/api/supplier/products', {
    name: 'QA93 Unapproved Twin', description: 'QA93 not visible', categoryId, unit: 'pcs',
    moq: 1, basePrice: 1000, stockQuantity: 10,
    priceTiers: [{ minQty: 1, pricePerUnit: 1000 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const hiddenId = pHidden.json?.data?.id ?? pHidden.json?.id

  const qaPath = `/api/products/${productId}/qa`
  const sellerProfile = await db.supplierProfiles.findUnique({ where: { userId: (await db.users.findUnique({ where: { email: 'qa93-supa@qa.local' } })).id } })
  const seller2Profile = await db.supplierProfiles.findUnique({ where: { userId: (await db.users.findUnique({ where: { email: 'qa93-supa2@qa.local' } })).id } })
  const buyerUser = await db.users.findUnique({ where: { email: 'qa93-buyer@qa.local' } })
  ok(Boolean(sellerProfile?.id && seller2Profile?.id && buyerUser?.id), 'profiles resolved from real DB')

  /* ── A. gates ── */
  console.log('— A. gates —')
  const anonGet = await makeSession()('GET', qaPath)
  ok(anonGet.status === 200 && anonGet.json?.count === 0 && anonGet.json?.canAnswer === false, 'anon public GET → 200, count 0, canAnswer false', JSON.stringify(anonGet.json))
  ok((await makeSession()('POST', qaPath, { question: 'Do you ship to Khulna in bulk?' })).status === 401, 'anon ask → 401 (the old rail gave a naked 403)')
  ok((await makeSession()('POST', qaPath, { qaId: 'x', answer: 'Yes we do.' })).status === 401, 'anon answer → 401')

  /* ── B. guards ── */
  console.log('— B. guards —')
  ok((await buyer('POST', qaPath, { question: 'tiny' })).status === 400, '4-char question → 400')
  ok((await buyer('POST', qaPath, { question: 'Valid question?', bogus: true })).status === 400, 'strict keys → 400')
  ok((await buyer('POST', `/api/products/nonexistent/qa`, { question: 'Valid question?' })).status === 404, 'phantom product ask → 404')
  const hiddenAsk = await buyer('POST', `/api/products/${hiddenId}/qa`, { question: 'Sneaky question on a hidden listing?' })
  ok(hiddenAsk.status === 404, 'UNAPPROVED product ask → the SAME 404 as phantom (no-leak)', `got ${hiddenAsk.status}`)

  /* ── C. ask + THE ANSWER FIX ── */
  console.log('— C. ask + the answer id-space fix —')
  // Seller socket FULLY subscribed BEFORE the ask (the t90 lesson: arming a
  // listener while the join handshake is still in flight races the tap).
  const sellerSock = connectSocket()
  await new Promise((r) => { sellerSock.on('connect', r); setTimeout(r, 8000) })
  const stok = await seller('GET', `/api/realtime/room-token?room=seller:${sellerProfile.id}`)
  sellerSock.emit('subscribe', { room: `seller:${sellerProfile.id}`, token: stok.json?.token })
  ok(Boolean(await waitForEvent(sellerSock, 'subscribe:ok', 6000)), 'supplier joined token-gated seller room')

  const productSock = connectSocket()
  await new Promise((r) => { productSock.on('connect', r); setTimeout(r, 8000) })
  productSock.emit('subscribe', { room: `product:${productId}` })
  ok(Boolean(await waitForEvent(productSock, 'subscribe:ok', 6000)), 'anon socket joined PUBLIC product room')

  const sellerTapP = waitForEvent(sellerSock, 'qa:new', 9000, (d) => d?.qaId && d?.productId === productId)
  const pubTapP = waitForEvent(productSock, 'product:qa', 9000, (d) => d?.action === 'asked')

  const ask = await buyer('POST', qaPath, { question: 'Does the 40L come with a spare blade set for bulk orders?' })
  ok(ask.status === 201 && ask.json?.data?.id, 'buyer asks → 201 with real id', JSON.stringify(ask.json))
  const qaId = ask.json?.data?.id

  const tap = await sellerTapP
  ok(Boolean(tap) && tap?.question?.includes('spare blade'), "seller room got live 'qa:new' tap with the real question", JSON.stringify(tap))
  const pubTap = await pubTapP
  ok(Boolean(pubTap) && pubTap?.qaId === qaId, "PUBLIC product room got 'product:qa' asked tap", JSON.stringify(pubTap))
  productSock.close()
  sellerSock.close()

  const supNotif = await db.notifications.findFirst({
    where: { userId: sellerProfile.userId, title: { contains: 'New question' } },
    orderBy: { createdAt: 'desc' },
  })
  ok(Boolean(supNotif) && supNotif.title.includes('QA93 Industrial Blender'), 'supplier durable notification with the REAL product name', JSON.stringify(supNotif?.title))

  ok((await seller2('POST', qaPath, { qaId, answer: 'I am not your supplier, but here you go anyway.' })).status === 403, 'FOREIGN supplier answer → 403')
  ok((await buyer('POST', qaPath, { qaId, answer: 'Self-answering my own question.' })).status === 403, 'buyer answer → 403')
  ok((await seller('POST', qaPath, { qaId, answer: 'x' })).status === 400, '1-char answer → 400')

  const answer = await seller('POST', qaPath, { qaId, answer: 'Yes — spare blade sets ship with every carton of 4 at no extra cost.' })
  ok(answer.status === 200 && answer.json?.data?.answeredAt, 'THE FIX: the product\'s OWN supplier answers → 200 (the old rail 403\'d every supplier here)', JSON.stringify(answer.json))

  const buyerNotif = await db.notifications.findFirst({
    where: { userId: buyerUser.id, title: { contains: 'answered' } },
    orderBy: { createdAt: 'desc' },
  })
  ok(Boolean(buyerNotif) && buyerNotif.body.includes('spare blade'), 'asker durable notification carrying the answer preview', JSON.stringify(buyerNotif?.body))

  /* ── D. immutability + no-leak ── */
  console.log('— D. immutability + no-leak —')
  ok((await seller('POST', qaPath, { qaId, answer: 'Second, better answer after the fact.' })).status === 409, 'double answer → 409 (answers are immutable)')
  ok((await seller('POST', qaPath, { qaId: 'phantom-qa', answer: 'Answering the void.' })).status === 404, 'phantom qaId → 404')
  // A question on ANOTHER product, answered through THIS product's rail:
  const otherProduct = await seller('POST', '/api/supplier/products', {
    name: 'QA93 Other Product', description: 'QA93 second listing', categoryId, unit: 'pcs',
    moq: 1, basePrice: 500, stockQuantity: 30,
    priceTiers: [{ minQty: 1, pricePerUnit: 500 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
  })
  const otherId = otherProduct.json?.data?.id ?? otherProduct.json?.id
  await admin('PATCH', '/api/admin/products', { productId: otherId, action: 'approve', reason: 'QA93' })
  const ask2 = await buyer('POST', `/api/products/${otherId}/qa`, { question: 'Cross-product smuggle attempt question?' })
  ok((await seller('POST', qaPath, { qaId: ask2.json?.data?.id, answer: 'Answering across products.' })).status === 404, 'FOREIGN qaId through another product\'s rail → the SAME 404 as phantom')

  /* ── E. canAnswer (server-decided) ── */
  console.log('— E. canAnswer —')
  const anonView = await makeSession()('GET', qaPath)
  ok(anonView.json?.canAnswer === false, 'anon GET canAnswer false')
  const ownerView = await seller('GET', qaPath)
  ok(ownerView.json?.canAnswer === true, 'OWNING supplier GET canAnswer true')
  const foreignView = await seller2('GET', qaPath)
  ok(foreignView.json?.canAnswer === false, 'FOREIGN supplier GET canAnswer false')
  const row = (ownerView.json?.data ?? []).find((q) => q.id === qaId)
  ok(row?.askedBy === 'QA93 buyer' && Boolean(row?.answer) && row?.answeredBy === undefined, 'row serves the asker\'s REAL name + answer; answeredBy (internal user id) never leaks', JSON.stringify(row))
  ok(ownerView.json?.count === 1 && foreignView.json?.count === 1, 'counts consistent for every viewer')

  /* ── F. audit trail ── */
  console.log('— F. audit trail —')
  const audits = await db.auditLogs.groupBy({ by: ['action'], where: { entityType: 'productQas' }, _count: { action: true } })
  const asked = audits.find((a) => a.action === 'qa_asked')?._count.action ?? 0
  const answered = audits.find((a) => a.action === 'qa_answered')?._count.action ?? 0
  ok(asked >= 2, `qa_asked audited in raw DB (${asked})`)
  ok(answered >= 1, `qa_answered audited in raw DB (${answered})`)

  console.log(`\n===== t93 RESULT: ${PASS} PASS / ${FAIL} FAIL =====`)
  await db.$disconnect()
  process.exit(FAIL === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('FATAL:', e)
  await db.$disconnect()
  process.exit(1)
})
