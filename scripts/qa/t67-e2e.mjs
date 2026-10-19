/**
 * Task 67 E2E — video reality + external attach + variant-parity API truth.
 *
 * Doctrine under test:
 *   • POST /api/upload/video is REAL (it never existed — the form's step-1
 *     posts died with 404): auth-first 401 → supplier/admin-only 403 →
 *     multipart 'video' → declared-type allowlist (mp4/webm/mov) →
 *     MAGIC-BYTE sniffing (ftyp family / EBML) → size cap → opaque filename
 *     under /uploads/videos/ → publicly served.
 *   • The attach route accepts BOTH kinds: the uploaded /uploads/videos/ path
 *     and an external https:// link; http:// and foreign spaces are rejected.
 *   • DELETE detaches the row AND unlinks the local file (fileUnlinked true
 *     for local rows, false for external ones) — write and delete touch the
 *     SAME directory (VIDEO_UPLOAD_DIR cohesion).
 *   • GET /api/products/[id] serves the variants + videos the mobile PDP's
 *     new selector renders (mobile now consumes what the API always had).
 *
 * Run: bun scripts/qa/t67-e2e.mjs   (DB must be EMPTY — first-admin window)
 */
const BASE = 'http://127.0.0.1:3000'
import { PrismaClient } from '@prisma/client'
import { existsSync, statSync, unlinkSync, readdirSync } from 'fs'
import path from 'path'
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
  const ip = `10.79.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  const call = async function call(method, path_, body, rawBody) {
    const res = await fetch(`${BASE}${path_}`, {
      method,
      headers: {
        ...(body !== undefined && !rawBody ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        'X-Forwarded-For': ip,
      },
      body: rawBody !== undefined && rawBody !== null
        ? rawBody
        : body !== undefined ? JSON.stringify(body) : undefined,
    })
    const setCookie = res.headers.getSetCookie?.() ?? []
    for (const c of setCookie) {
      const pair = c.split(';')[0]
      if (pair) cookie = cookie ? `${cookie}; ${pair}` : pair
    }
    call.cookie = cookie // exposed for raw multipart fetches (uploadVideo)
    const json = await res.json().catch(() => null)
    return { status: res.status, json }
  }
  call.cookie = ''
  return call
}

async function registerAndLogin(session, userType, email, password) {
  const payload = {
    userType, authProvider: 'email', email, password,
    fullName: `QA67 ${userType}`,
    ...(userType === 'supplier' ? { businessName: `QA67 Shop ${email.slice(5, 12)}` } : {}),
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

/* A minimal but REAL ISO-BMFF 'ftyp' box — what every MP4 and MOV starts with. */
function ftypBytes(brand = 'isom') {
  const brandBytes = Buffer.from(brand, 'ascii')
  const buf = Buffer.alloc(32, 0)
  buf.writeUInt32BE(32, 0)          // box size
  buf.write('ftyp', 4, 'ascii')     // box type at bytes 4..7
  brandBytes.copy(buf, 8)           // major brand
  buf.writeUInt32BE(0x200, 12)      // minor version
  return buf
}
/* A real EBML header — what every WebM starts with. */
function ebmlBytes() {
  return Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...Buffer.alloc(28, 0)])
}

function multipart(fields) {
  const boundary = `----qa67${Math.random().toString(36).slice(2)}`
  const parts = []
  for (const [name, value] of Object.entries(fields)) {
    if (value && typeof value === 'object' && value.bytes instanceof Buffer) {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="clip.mp4"\r\nContent-Type: ${value.declared}\r\n\r\n`
      ))
      parts.push(value.bytes)
      parts.push(Buffer.from('\r\n'))
    } else {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      ))
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`))
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` }
}

async function uploadVideo(session, declared, bytes, name = 'video') {
  const { body, contentType } = multipart({ [name]: { bytes, declared } })
  const res = await fetch(`${BASE}/api/upload/video`, {
    method: 'POST',
    headers: {
      Cookie: session.cookie || '',
      'Content-Type': contentType,
      'X-Forwarded-For': `10.79.77.${Math.floor(Math.random() * 200) + 10}`,
    },
    body,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

const VIDEOS_DIR = path.join(process.cwd(), 'public', 'uploads', 'videos')

const main = async () => {
  const PASSWORD = 't67-Video-Qa1!'
  const admin = makeSession(), sellerA = makeSession(), sellerB = makeSession(), buyer = makeSession()
  const anon = makeSession()
  const ts = Date.now().toString().slice(-6)

  section('setup — admin, two suppliers, buyer, one product with variants')
  await registerAndLogin(admin, 'admin', `qa67-admin@qa.local`, PASSWORD)
  await registerAndLogin(sellerA, 'supplier', `qa67-supa-a@qa.local`, PASSWORD)
  await registerAndLogin(sellerB, 'supplier', `qa67-supa-b@qa.local`, PASSWORD)
  await registerAndLogin(buyer, 'buyer', `qa67-buyer@qa.local`, PASSWORD)

  const cat = await admin('POST', '/api/admin/categories', { name: `QA67 Cat ${ts}`, isActive: true })
  const categoryId = cat.json?.data?.id ?? cat.json?.id
  const prod = await sellerA('POST', '/api/supplier/products', {
    name: 'QA67 tile sealant', description: 'QA t67 video reality', categoryId, unit: 'pcs',
    moq: 1, basePrice: 120, stockQuantity: 30, priceTiers: [{ minQty: 1, pricePerUnit: 120 }],
    images: [{ imageUrl: '/placeholder.svg', sortOrder: 0 }], videos: [],
    variants: [
      { variantName: 'Color', variantValue: 'Blue', stockQuantity: 30 },
      { variantName: 'Color', variantValue: 'Red', stockQuantity: 0 },
    ],
  })
  const productId = prod.json?.data?.id ?? prod.json?.id
  ok(Boolean(productId), 'product with Blue(30)/Red(0) variants created')
  const approved = await admin('PATCH', '/api/admin/products', { productId, action: 'approve', reason: 'QA67' })
  ok([200, 201].includes(approved.status), 'product approved')

  section('A) POST /api/upload/video — the route that never existed')
  const anonUp = await uploadVideo(anon, 'video/mp4', ftypBytes())
  ok(anonUp.status === 401, 'anon upload → 401', `got ${anonUp.status}`)
  const buyerUp = await uploadVideo(buyer, 'video/mp4', ftypBytes())
  ok(buyerUp.status === 401, 'buyer upload → 401 (requireUserType maps wrong-type to the 401-first convention)', `got ${buyerUp.status}`)
  const noField = await fetch(`${BASE}/api/upload/video`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=----x', Cookie: sellerA.cookie || '' },
    body: '--------x--\r\n',
  })
  ok(noField.status === 400, "upload without 'video' field → 400", `got ${noField.status}`)

  const good = await uploadVideo(sellerA, 'video/mp4', ftypBytes())
  ok(good.status === 200 && typeof good.json?.videoUrl === 'string', 'real mp4 upload → 200 + videoUrl', JSON.stringify(good.json))
  const videoUrl = good.json?.videoUrl ?? ''
  ok(videoUrl.startsWith('/uploads/videos/') && videoUrl.endsWith('.mp4'), 'videoUrl lives in /uploads/videos/ with .mp4 ext', videoUrl)
  const served = await fetch(`${BASE}${videoUrl}`)
  ok(served.status === 200, 'uploaded video is publicly served', `GET ${videoUrl} -> ${served.status}`)
  const localPath = path.join(VIDEOS_DIR, path.basename(videoUrl))
  ok(existsSync(localPath) && statSync(localPath).size > 0, 'file REALLY exists on disk under public/uploads/videos')

  const mov = await uploadVideo(sellerA, 'video/quicktime', ftypBytes('qt  '))
  ok(mov.status === 200 && (mov.json?.videoUrl ?? '').endsWith('.mov'), 'declared MOV with ftyp(qt) → 200 + .mov ext', JSON.stringify(mov.json))
  const webm = await uploadVideo(sellerA, 'video/webm', ebmlBytes())
  ok(webm.status === 200 && (webm.json?.videoUrl ?? '').endsWith('.webm'), 'real WebM (EBML) → 200 + .webm ext', JSON.stringify(webm.json))

  const lied = await uploadVideo(sellerA, 'video/mp4', Buffer.from('this is definitely not a video', 'utf8'))
  ok(lied.status === 400, 'declared mp4 but text bytes → 400 signature fail', `got ${lied.status}`)
  const swapped = await uploadVideo(sellerA, 'video/webm', ftypBytes())
  ok(swapped.status === 400, 'declared webm but ftyp bytes → 400 family mismatch', `got ${swapped.status}`)
  const pngBytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24, 0)])
  const pngAsMp4 = await uploadVideo(sellerA, 'video/mp4', pngBytes)
  ok(pngAsMp4.status === 400, 'PNG bytes declared mp4 → 400', `got ${pngAsMp4.status}`)

  section('B) attach contracts — uploaded paths AND external links')
  const attLocal = await sellerA('POST', `/api/supplier/products/${productId}/videos`, {
    videoUrl, title: 'QA67 uploaded clip',
  })
  ok(attLocal.status === 201, 'attach the UPLOADED /uploads/videos/ path → 201', `got ${attLocal.status} ${JSON.stringify(attLocal.json)}`)
  const attExt = await sellerA('POST', `/api/supplier/products/${productId}/videos`, {
    videoUrl: 'https://cdn.example.com/supplier-hosted/demo.mp4', title: 'QA67 external demo',
  })
  ok(attExt.status === 201, 'attach an external https:// link → 201', `got ${attExt.status}`)

  const badHttp = await sellerA('POST', `/api/supplier/products/${productId}/videos`, { videoUrl: 'http://insecure.example.com/v.mp4' })
  ok(badHttp.status === 400, 'http:// (insecure) link → 400', `got ${badHttp.status}`)
  const wrongSpace = await sellerA('POST', `/api/supplier/products/${productId}/videos`, { videoUrl: '/uploads/products/other.mp4' })
  ok(wrongSpace.status === 400, "foreign space '/uploads/products/' → 400 (attach accepts only /uploads/videos/ or https)", `got ${wrongSpace.status}`)
  const foreign = await sellerB('POST', `/api/supplier/products/${productId}/videos`, { videoUrl: 'https://cdn.example.com/b/steal.mp4' })
  ok(foreign.status === 404, 'seller B attaching to A’s product → no-leak 404', `got ${foreign.status}`)

  const detail = await buyer('GET', `/api/products/${productId}`)
  const vids = detail.json?.data?.videos ?? []
  ok(vids.length === 2, 'buyer PDP payload carries BOTH videos (local + external)', `got ${vids.length}`)
  ok(vids.some((v) => v.videoUrl === videoUrl) && vids.some((v) => v.videoUrl?.startsWith('https://')), 'one local + one external row visible')

  section('C) delete cohesion — row AND backing file, same directory both ways')
  const localRow = vids.find((v) => v.videoUrl === videoUrl)
  const delLocal = await sellerA('DELETE', `/api/supplier/products/${productId}/videos/${localRow.id}`)
  ok(delLocal.status === 200 && delLocal.json?.data?.fileUnlinked === true, 'DELETE local row → fileUnlinked TRUE', JSON.stringify(delLocal.json?.data))
  ok(!existsSync(localPath), 'backing file is REALLY gone from disk after delete')

  const extRow = (vids ?? []).find((v) => v.videoUrl?.startsWith('https://'))
  const delExt = await sellerA('DELETE', `/api/supplier/products/${productId}/videos/${extRow.id}`)
  ok(delExt.status === 200 && delExt.json?.data?.fileUnlinked === false, 'DELETE external row → fileUnlinked FALSE (nothing to unlink)', JSON.stringify(delExt.json?.data))

  const reAtt = await sellerA('POST', `/api/supplier/products/${productId}/videos`, { videoUrl })
  ok(reAtt.status === 201, 're-attach after delete works (cap accounting honest)')
  const detail2 = await buyer('GET', `/api/products/${productId}`)
  ok((detail2.json?.data?.videos ?? []).length === 1, 'exactly one video row remains')

  section('D) variant parity truth the mobile selector consumes')
  const variants = detail2.json?.data?.variants ?? []
  ok(variants.length === 2 && variants.some((v) => v.variantValue === 'Blue' && v.stockQuantity === 30) && variants.some((v) => v.variantValue === 'Red' && v.stockQuantity === 0), 'variants carry real per-variant stock (Blue 30 / Red 0)')

  section('DB audit')
  const rows = await db.productVideos.count({ where: { productId } })
  ok(rows === 1, 'exactly 1 productVideos row in DB', `got ${rows}`)
  const audits = await db.auditLogs.count({ where: { entityType: 'products', action: { in: ['product_video_attached', 'product_video_detached'] } } })
  ok(audits === 5, '5 real audit rows (attach local + attach external + delete local + delete external + re-attach)', `got ${audits}`)

  // cleanup: the re-attached local row + its file so the repo stays clean
  const remaining = (await buyer('GET', `/api/products/${productId}`)).json?.data?.videos ?? []
  for (const v of remaining) {
    if (v.videoUrl.startsWith('/uploads/videos/')) {
      await sellerA('DELETE', `/api/supplier/products/${productId}/videos/${v.id}`)
      const p = path.join(VIDEOS_DIR, path.basename(v.videoUrl))
      if (existsSync(p)) unlinkSync(p)
    }
  }

  console.log(`\n════════════════════════════════════════`)
  console.log(`RESULT: ${PASS} passed, ${FAIL} failed`)
  if (FAIL > 0) { console.log('FAILURES:'); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(1) }
}

main().catch((e) => { console.error('HARNESS CRASH:', e); process.exit(1) }).finally(() => db.$disconnect())
