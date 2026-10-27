/**
 * seed-marketplace.mjs — full marketplace seed via the REAL APIs.
 *
 * Why: after scripts/qa/wipe.mjs the DB is 127 empty tables and the whole
 * website renders empty states ("No products found", "Join 0 suppliers").
 * This script rebuilds a realistic demo marketplace through the same rails
 * the UI uses — register/login, admin categories, supplier products (with
 * price tiers + real /public/images/products photos), admin approvals,
 * buyer reviews, admin flash/daily deals and home_top banners.
 *
 * A final direct-SQLite pass enriches discovery counters (soldCount,
 * ratingAvg, reviewCount, ratingCount) — seed provenance only, never
 * fabricated at runtime.
 *
 * Idempotent-ish: run AFTER wipe. Emails are fixed; re-running on a dirty
 * DB will fail registration (duplicate email) — wipe first.
 *
 * Run: node scripts/qa/wipe.mjs && node scripts/qa/seed-marketplace.mjs
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', 'db', 'custom.db')
const BASE = 'http://127.0.0.1:3000'
const IMG = (f) => `/images/products/${f}`

function makeSession() {
  let cookie = ''
  const ip = `10.201.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`
  return async function call(method, apiPath, body) {
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
}

async function registerAndLogin(session, userType, email, password, fullName, businessName) {
  const payload = { userType, authProvider: 'email', email, password, fullName, ...(businessName ? { businessName } : {}) }
  const reg = await session('POST', '/api/auth/register', payload)
  if (reg.status !== 201 && reg.status !== 200) throw new Error(`register ${email} -> ${reg.status}: ${JSON.stringify(reg.json).slice(0, 200)}`)
  const login = await session('POST', '/api/auth/login', { email, password })
  if (login.status !== 200 && login.status !== 201) throw new Error(`login ${email} -> ${login.status}`)
}

const log = (m) => console.log(`[seed] ${m}`)

// ─── 1. Accounts ───────────────────────────────────────────────
const admin = makeSession()
await registerAndLogin(admin, 'admin', 'market@zylod.bd', 'Passw0rd!23', 'Zylod Market Admin')
log('admin registered')

const SUPPLIERS = [
  { email: 'dhaka.textile@zylod.bd', name: 'Rafiq Ahmed', company: 'Dhaka Textile Mills Ltd', cat: 'textiles' },
  { email: 'bengal.agro@zylod.bd', name: 'Kamrul Hasan', company: 'Bengal Agro Foods', cat: 'agriculture' },
  { email: 'smart.tech@zylod.bd', name: 'Tanvir Islam', company: 'SmartTech Distribution', cat: 'electronics' },
  { email: 'green.jute@zylod.bd', name: 'Nazma Begum', company: 'GreenJute Packaging', cat: 'packaging' },
  { email: 'muslin.craft@zylod.bd', name: 'Shirin Akter', company: 'Muslin Craft House', cat: 'crafts' },
  { email: 'led.bangla@zylod.bd', name: 'Mahfuz Rahman', company: 'LED Bangladesh Ltd', cat: 'electronics' },
  { email: 'bangla.garments@zylod.bd', name: 'Jahangir Alam', company: 'Bangla Garments Ltd', cat: 'garments' },
]
const supplierSessions = {}
for (const s of SUPPLIERS) {
  const sess = makeSession()
  await registerAndLogin(sess, 'supplier', s.email, 'Passw0rd!23', s.name, s.company)
  supplierSessions[s.email] = sess
  log(`supplier registered: ${s.company}`)
}

const BUYERS = [
  { email: 'buyer1@zylod.bd', name: 'Sabbir Hossain' },
  { email: 'buyer2@zylod.bd', name: 'Farhana Yasmin' },
]
const buyerSessions = {}
for (const b of BUYERS) {
  const sess = makeSession()
  await registerAndLogin(sess, 'buyer', b.email, 'Passw0rd!23', b.name)
  buyerSessions[b.email] = sess
  log(`buyer registered: ${b.name}`)
}

// ─── 2. Categories ─────────────────────────────────────────────
const CATS = [
  { name: 'Textiles & Fabrics', slug: 'textiles-fabrics', sortOrder: 1 },
  { name: 'Agriculture & Food', slug: 'agriculture-food', sortOrder: 2 },
  { name: 'Electronics & Accessories', slug: 'electronics', sortOrder: 3 },
  { name: 'Packaging & Jute', slug: 'packaging', sortOrder: 4 },
  { name: 'Home & Crafts', slug: 'home-garden', sortOrder: 5 },
  { name: 'Garments & Apparel', slug: 'garments', sortOrder: 6 },
  { name: 'Leather Goods', slug: 'leather', sortOrder: 7 },
  { name: 'LED & Lighting', slug: 'led-lighting', sortOrder: 8 },
]
const catIds = {}
for (const c of CATS) {
  const res = await admin('POST', '/api/admin/categories', { name: c.name, slug: c.slug, isActive: true, sortOrder: c.sortOrder })
  const id = res.json?.data?.id ?? res.json?.id
  if (!id) throw new Error(`category ${c.name} failed: ${JSON.stringify(res.json).slice(0, 200)}`)
  catIds[c.slug] = id
  log(`category: ${c.name}`)
}

// ─── 3. Products (via each supplier's own session) ─────────────
// name, category, supplier email, price, moq, stock, image, tiers
const PRODUCTS = [
  // Dhaka Textile Mills
  { name: 'Premium Cotton Fabric — Dyed 44"', cat: 'textiles-fabrics', sup: 'dhaka.textile@zylod.bd', price: 320, moq: 100, stock: 5000, img: 'cotton-fabric.png', unit: 'kg', sold: 1240, rating: 4.7 },
  { name: 'Export Quality Denim Fabric 12oz', cat: 'textiles-fabrics', sup: 'dhaka.textile@zylod.bd', price: 480, moq: 200, stock: 3200, img: 'denim-fabric.png', unit: 'kg', sold: 860, rating: 4.6 },
  { name: 'Pure Silk Fabric — Handloom', cat: 'textiles-fabrics', sup: 'dhaka.textile@zylod.bd', price: 1250, moq: 50, stock: 800, img: 'silk-fabric.png', unit: 'kg', sold: 310, rating: 4.8 },
  { name: 'Cotton Bath Towels — 6pc Bundle', cat: 'textiles-fabrics', sup: 'dhaka.textile@zylod.bd', price: 850, moq: 20, stock: 1500, img: 'towels.png', unit: 'bundle', sold: 540, rating: 4.4 },
  // Bengal Agro
  { name: 'Premium Basmati Rice — 50kg Bag', cat: 'agriculture-food', sup: 'bengal.agro@zylod.bd', price: 4200, moq: 10, stock: 2000, img: 'basmati-rice.png', unit: 'pcs', sold: 2100, rating: 4.9 },
  { name: 'Aromatic Kataribhog Rice — 25kg', cat: 'agriculture-food', sup: 'bengal.agro@zylod.bd', price: 2600, moq: 20, stock: 1400, img: 'rice.png', unit: 'pcs', sold: 780, rating: 4.5 },
  // SmartTech
  { name: 'Smartphone Galaxy S24 — Wholesale Lot', cat: 'electronics', sup: 'smart.tech@zylod.bd', price: 92000, moq: 5, stock: 120, img: 'galaxy-s24.png', unit: 'pcs', sold: 95, rating: 4.6 },
  { name: 'iPhone 15 — Bulk Import Carton', cat: 'electronics', sup: 'smart.tech@zylod.bd', price: 118000, moq: 5, stock: 80, img: 'iphone-15.png', unit: 'pcs', sold: 60, rating: 4.7 },
  { name: 'Solar Power Bank 20000mAh', cat: 'electronics', sup: 'smart.tech@zylod.bd', price: 2350, moq: 50, stock: 2200, img: 'solar-powerbank.png', unit: 'pcs', sold: 640, rating: 4.3 },
  // GreenJute
  { name: 'Natural Jute Shopping Bags — 1000pc Bale', cat: 'packaging', sup: 'green.jute@zylod.bd', price: 18, moq: 1000, stock: 50000, img: 'jute-shopping-bags.png', unit: 'pcs', sold: 18000, rating: 4.8 },
  { name: 'Heavy Duty Jute Gunny Bags', cat: 'packaging', sup: 'green.jute@zylod.bd', price: 65, moq: 500, stock: 30000, img: 'jute-bags.png', unit: 'pcs', sold: 9500, rating: 4.6 },
  { name: 'Raw Jute Fabric Roll — 40"', cat: 'packaging', sup: 'green.jute@zylod.bd', price: 145, moq: 200, stock: 8000, img: 'jute-fabric.png', unit: 'kg', sold: 2600, rating: 4.4 },
  // Muslin Craft House
  { name: 'Authentic Jamdani Muslin Saree', cat: 'home-garden', sup: 'muslin.craft@zylod.bd', price: 8500, moq: 5, stock: 200, img: 'muslin-fabric.png', unit: 'pcs', sold: 85, rating: 4.9 },
  { name: 'Muslin Banner Cloth — Printed', cat: 'home-garden', sup: 'muslin.craft@zylod.bd', price: 220, moq: 100, stock: 1600, img: 'muslin-banner.png', unit: 'kg', sold: 420, rating: 4.2 },
  { name: 'Tribal Handloom Fabric Piece', cat: 'home-garden', sup: 'muslin.craft@zylod.bd', price: 680, moq: 30, stock: 600, img: 'tribal-fabric.png', unit: 'kg', sold: 180, rating: 4.5 },
  { name: 'Terracotta Planters — Set of 12', cat: 'home-garden', sup: 'muslin.craft@zylod.bd', price: 1400, moq: 10, stock: 900, img: 'terracotta.png', unit: 'set', sold: 260, rating: 4.3 },
  { name: 'Ceramic Dinner Set — 32pc Export', cat: 'home-garden', sup: 'muslin.craft@zylod.bd', price: 5600, moq: 6, stock: 400, img: 'ceramic-dinner-set.png', unit: 'set', sold: 150, rating: 4.6 },
  // LED Bangladesh
  { name: 'LED Panel Light 36W — Carton of 20', cat: 'led-lighting', sup: 'led.bangla@zylod.bd', price: 540, moq: 20, stock: 5000, img: 'led-panel.png', unit: 'pcs', sold: 3400, rating: 4.7 },
  // Bangla Garments
  { name: 'Basic Cotton T-Shirts — Export Lot', cat: 'garments', sup: 'bangla.garments@zylod.bd', price: 145, moq: 500, stock: 40000, img: 'tshirts.png', unit: 'pcs', sold: 12500, rating: 4.5 },
  { name: 'Full Grain Leather Hides — 20sqft', cat: 'leather', sup: 'bangla.garments@zylod.bd', price: 3800, moq: 10, stock: 700, img: 'leather-hides.png', unit: 'pcs', sold: 340, rating: 4.6 },
]

async function createProduct(supEmail, p) {
  const sess = supplierSessions[supEmail]
  const tiers = [
    { minQty: p.moq, maxQty: Math.round(p.moq * 3) - 1, pricePerUnit: p.price },
    { minQty: Math.round(p.moq * 3), maxQty: Math.round(p.moq * 10) - 1, pricePerUnit: Math.round(p.price * 0.92) },
    { minQty: Math.round(p.moq * 10), pricePerUnit: Math.round(p.price * 0.85) },
  ]
  const res = await sess('POST', '/api/supplier/products', {
    name: p.name,
    description: `${p.name} — wholesale supply from a verified Bangladeshi manufacturer. Bulk tier discounts apply; MOQ ${p.moq} ${p.unit}. Quality checked before dispatch, trade-assurance eligible.`,
    categoryId: catIds[p.cat],
    unit: p.unit,
    moq: p.moq,
    basePrice: p.price,
    stockQuantity: p.stock,
    weightKg: 1,
    priceTiers: tiers,
    images: [{ imageUrl: IMG(p.img), sortOrder: 0 }],
    videos: [],
  })
  const id = res.json?.data?.id ?? res.json?.id
  if (!id) throw new Error(`product ${p.name} failed: ${res.status} ${JSON.stringify(res.json).slice(0, 300)}`)
  return id
}

const productIds = []
for (const p of PRODUCTS) {
  const id = await createProduct(p.sup, p)
  productIds.push({ id, ...p })
  log(`product: ${p.name}`)
}

// ─── 4. Approve products + 6 of 7 suppliers ────────────────────
for (const p of productIds) {
  const res = await admin('PATCH', '/api/admin/products', { productId: p.id, action: 'approve', reason: 'Marketplace seed' })
  if (res.status !== 200) throw new Error(`approve product failed: ${JSON.stringify(res.json).slice(0, 200)}`)
}
log(`approved ${productIds.length} products`)

// Approve the first 6 suppliers; Bangla Garments stays pending (realistic admin queue)
const listRes = await admin('GET', '/api/admin/suppliers?status=pending&limit=50')
const pendingSuppliers = listRes.json?.data ?? []
let approvedCount = 0
for (const s of pendingSuppliers) {
  if (s.companyName === 'Bangla Garments Ltd') continue
  const res = await admin('PATCH', '/api/admin/suppliers', { supplierId: s.id, action: 'approve' })
  if (res.status === 200) approvedCount++
}
log(`approved ${approvedCount} suppliers (Bangla Garments stays pending)`)

// ─── 5. Buyer reviews on top products ──────────────────────────
const REVIEW_COMMENTS = [
  'Consistent quality across the lot, exactly as described. Supplier responded fast on chat.',
  'Good wholesale pricing with the tier discount. Delivery arrived within the promised window.',
  'Solid product for the price. Packaging survived transport — will reorder.',
  'Verified sample first, then ordered the full MOQ. No regrets, quality is uniform.',
]
const REVIEWERS = [buyerSessions['buyer1@zylod.bd'], buyerSessions['buyer2@zylod.bd']]
let reviewCount = 0
for (const p of productIds.filter(x => x.sold > 500).slice(0, 12)) {
  for (let i = 0; i < 2; i++) {
    const sess = REVIEWERS[i % 2]
    const rating = i === 0 ? Math.round(Math.min(5, Math.max(4, p.rating))) : (Math.round(p.rating * 2) >= 9 ? 5 : 4)
    const res = await sess('POST', `/api/products/${p.id}/reviews`, {
      rating,
      comment: REVIEW_COMMENTS[(reviewCount + i) % REVIEW_COMMENTS.length],
      images: [],
    })
    if (res.status === 201 || res.status === 200) reviewCount++
  }
}
log(`posted ${reviewCount} buyer reviews`)

// ─── 6. Flash + daily deals (admin rails) ──────────────────────
const now = Date.now()
const H = 3600_000
const dealTargets = productIds.filter(p => ['cotton-fabric.png', 'basmati-rice.png', 'jute-shopping-bags.png', 'led-panel.png'].includes(p.img))
for (const [i, p] of dealTargets.entries()) {
  const dealPrice = Math.round(p.price * (0.78 - i * 0.02))
  const res = await admin('POST', '/api/admin/deals', {
    type: 'flash', productId: p.id, dealPrice,
    startAt: new Date(now - 2 * H).toISOString(), endAt: new Date(now + 20 * H + i * 3 * H).toISOString(),
    totalStock: Math.round(p.stock * 0.2), maxPerBuyer: Math.round(p.moq * 2),
  })
  if (res.status !== 201) throw new Error(`flash deal failed: ${JSON.stringify(res.json).slice(0, 250)}`)
  log(`flash deal: ${p.name} @ ${dealPrice}`)
}
const dailyTargets = productIds.filter(p => ['tshirts.png', 'solar-powerbank.png', 'towels.png'].includes(p.img))
for (const p of dailyTargets) {
  const dealPrice = Math.round(p.price * 0.88)
  const day = new Date(); day.setUTCHours(0, 0, 0, 0)
  const res = await admin('POST', '/api/admin/deals', { type: 'daily', productId: p.id, dealPrice, dayDate: day.toISOString() })
  if (res.status !== 201) throw new Error(`daily deal failed: ${JSON.stringify(res.json).slice(0, 250)}`)
  log(`daily deal: ${p.name} @ ${dealPrice}`)
}

// ─── 7. Home banners (admin rail, root-relative image URLs) ─────
const BANNERS = [
  { title: 'Source Textiles Direct From Mills', subtitle: 'Verified suppliers · MOQ from 100 meters · Tier discounts up to 15%', imageUrl: '/images/banners/textile-warehouse.png', linkPageId: 'category-products', linkParams: 'category=textiles-fabrics', sortOrder: 0 },
  { title: 'Bulk Agro & Jute Exports', subtitle: 'Basmati, jute bags & packaging — factory-direct BDT pricing', imageUrl: '/images/banners/bulk-goods.png', linkPageId: 'category-products', linkParams: 'category=agriculture-food', sortOrder: 1 },
  { title: 'Electronics Wholesale Lots', subtitle: 'Smartphones, power banks & LED panels with trade assurance', imageUrl: '/images/banners/electronics-factory.png', linkPageId: 'category-products', linkParams: 'category=electronics', sortOrder: 2 },
]
for (const b of BANNERS) {
  const res = await admin('POST', '/api/admin/banners', { ...b, position: 'home_top', isActive: true })
  if (res.status !== 201) throw new Error(`banner failed: ${JSON.stringify(res.json).slice(0, 250)}`)
  log(`banner: ${b.title}`)
}

// ─── 8. Direct SQLite enrichment: discovery counters ───────────
// Seed provenance only — represents each seeded line's import history.
const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA foreign_keys = OFF;')
let enriched = 0
for (const p of productIds) {
  const reviewsOfP = reviewCount > 0 ? null : null // count via SQL below
  const stmt = `UPDATE products SET soldCount = ?, ratingAvg = ?, reviewCount = (SELECT COUNT(*) FROM reviews WHERE productId = ?) WHERE id = ?`
  db.prepare(stmt).run(p.sold, p.rating, p.id, p.id)
  enriched++
}
// Supplier aggregate ratings from their products
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

// ─── 9. Summary ────────────────────────────────────────────────
const chk = await fetch(`${BASE}/api/products?limit=1`).then(r => r.json())
const sup = await fetch(`${BASE}/api/suppliers?limit=1`).then(r => r.json())
console.log(JSON.stringify({
  ok: true,
  products: chk.pagination?.total,
  suppliers: sup.pagination?.total,
  flashDeals: dealTargets.length,
  dailyDeals: dailyTargets.length,
  banners: BANNERS.length,
  accounts: 1 + SUPPLIERS.length + BUYERS.length,
}, null, 2))
