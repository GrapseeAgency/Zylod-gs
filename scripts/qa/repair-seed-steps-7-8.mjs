/**
 * repair-seed-steps-7-8.mjs — repairs the two seed steps that never ran
 * because seed-marketplace.mjs crashed at step 7 (banners) under the old
 * absolute-URL-only zod contract:
 *
 *   step 7 — home_top banners (via the REAL admin API, root-relative URLs)
 *   step 8 — direct-SQLite enrichment of discovery counters (soldCount,
 *            ratingAvg, reviewCount, supplier aggregates)
 *
 * No wipe, no re-registration: everything else (accounts, categories,
 * products, approvals, reviews, deals) already exists. Banner POSTs are
 * skipped if the table is already populated; enrichment UPDATEs are
 * idempotent by construction.
 *
 * Run: node scripts/qa/repair-seed-steps-7-8.mjs
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', 'db', 'custom.db')
const BASE = 'http://127.0.0.1:3000'
const log = (m) => console.log(`[repair] ${m}`)

// ── admin session (existing account — login only) ──────────────
let cookie = ''
const ip = `10.201.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
async function call(method, apiPath, body) {
  const res = await fetch(`${BASE}${apiPath}`, {
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

const login = await call('POST', '/api/auth/login', { email: 'market@zylod.bd', password: 'Passw0rd!23' })
if (login.status !== 200 && login.status !== 201) throw new Error(`admin login failed: ${login.status}`)
log('admin logged in')

// ── step 7: home_top banners (root-relative image URLs) ────────
const BANNERS = [
  { title: 'Source Textiles Direct From Mills', subtitle: 'Verified suppliers · MOQ from 100 meters · Tier discounts up to 15%', imageUrl: '/images/banners/textile-warehouse.png', linkPageId: 'category-products', linkParams: 'category=textiles-fabrics', sortOrder: 0 },
  { title: 'Bulk Agro & Jute Exports', subtitle: 'Basmati, jute bags & packaging — factory-direct BDT pricing', imageUrl: '/images/banners/bulk-goods.png', linkPageId: 'category-products', linkParams: 'category=agriculture-food', sortOrder: 1 },
  { title: 'Electronics Wholesale Lots', subtitle: 'Smartphones, power banks & LED panels with trade assurance', imageUrl: '/images/banners/electronics-factory.png', linkPageId: 'category-products', linkParams: 'category=electronics', sortOrder: 2 },
]

const existing = await fetch(`${BASE}/api/banners?position=home_top`).then((r) => r.json())
const existingCount = existing?.data?.banners?.length ?? 0
if (existingCount > 0) {
  log(`banners already present (${existingCount}) — skipping creation`)
} else {
  for (const b of BANNERS) {
    const res = await call('POST', '/api/admin/banners', { ...b, position: 'home_top', isActive: true })
    if (res.status !== 201) throw new Error(`banner failed: ${JSON.stringify(res.json).slice(0, 250)}`)
    log(`banner: ${b.title}`)
  }
}

// ── step 8: direct SQLite enrichment (verbatim seed semantics) ─
// Original step 8: soldCount + ratingAvg come from the seed line's own
// values (documented "seed provenance — import history, never fabricated
// at runtime"); reviewCount is REAL (COUNT of reviews rows). Products are
// matched by exact name — the seed creates products with these names.
const seedSrc = await import('node:fs').then((fs) =>
  fs.readFileSync(path.join(__dirname, 'seed-marketplace.mjs'), 'utf8'),
)
const productLines = [...seedSrc.matchAll(/\{\s*name:\s*'((?:[^'\\]|\\.)*)'[^}]*?sold:\s*(\d+),\s*rating:\s*([\d.]+)/g)]
const seedByName = new Map(productLines.map((m) => [m[1].replace(/\\'/g, "'"), { sold: Number(m[2]), rating: Number(m[3]) }]))
log(`seed provenance parsed for ${seedByName.size} products`)

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA foreign_keys = OFF;')
const products = db.prepare('SELECT id, name FROM products').all()
let enriched = 0
let provenanceHits = 0
for (const p of products) {
  const prov = seedByName.get(p.name)
  const sold = prov?.sold ?? 0
  const rating = prov?.rating ?? 0
  if (prov) provenanceHits++
  db.prepare(
    'UPDATE products SET soldCount = ?, ratingAvg = ?, reviewCount = (SELECT COUNT(*) FROM reviews WHERE productId = ?) WHERE id = ?',
  ).run(sold, rating, p.id, p.id)
  enriched++
}
log(`provenance matched ${provenanceHits}/${products.length} products`)
db.exec(`
  UPDATE supplierProfiles SET
    ratingAvg = COALESCE((SELECT AVG(ratingAvg) FROM products WHERE supplierId = supplierProfiles.id AND isApproved = 1), 0),
    ratingCount = (SELECT COUNT(*) FROM supplierReviews WHERE supplierId = supplierProfiles.id)
  WHERE verificationStatus = 'approved';
`)
db.exec('PRAGMA wal_checkpoint(TRUNCATE);')
db.exec('PRAGMA foreign_keys = ON;')
db.close()
log(`enriched ${enriched} product counters + supplier aggregates`)

// ── summary ─────────────────────────────────────────────────────
const chk = await fetch(`${BASE}/api/products?limit=5`).then((r) => r.json())
const bannersNow = await fetch(`${BASE}/api/banners?position=home_top`).then((r) => r.json())
console.log(JSON.stringify({
  ok: true,
  products: chk.pagination?.total,
  banners: bannersNow?.data?.banners?.length ?? 0,
  sampleRatings: (chk.data ?? []).map((p) => ({ n: p.name.slice(0, 24), r: p.ratingAvg, rc: p.reviewCount, sold: p.soldCount })),
}, null, 2))
