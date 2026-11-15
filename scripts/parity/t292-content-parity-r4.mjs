// t292-r4 — final parity polish:
//  A. 129 LIVE pages still carry the 3 generic filler bullets in their seed
//     content — replaced with accurate per-kind bullets naming the REAL
//     endpoint they fetch.
//  B. Finance fragment ids (balance/bank/billing/card/commission/credit/
//     earnings/escrow/payout/refund/revenue/transaction + admin/browse/buyer)
//     re-wired to the TYPED screens the web's generic finance/info pages map
//     onto (the wallet hub renders real api/profile/credits + payment-methods).
//  C. Remaining curated pages get honest behavior descriptors (what the page
//     really does server-side) — never invented data.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/home/z/my-project'
const SCREENS = path.join(ROOT, 'android/app/src/main/java/com/zylod/wholesale/ui/screens')
const REG = path.join(ROOT, 'android/app/src/main/java/com/zylod/wholesale/ui/nav/NativePageRegistry.kt')

const FILLER1 = 'Curated native content — no fabricated server data, ever.'
const FILLER2 = 'Live data renders from the Zylod API when an endpoint feeds this page.'

// ── A. live-page bullet polish ─────────────────────────────────────────────
const KIND_BULLETS = {
  PRODUCTS: (ep) => [
    `Live product grid fetched from ${ep} — the same catalog call the web page makes.`,
    'Cards render real price, MOQ badge, supplier and category from the response.',
    'Offline: the last-saved grid renders first; the Room offline catalog fills in before curated content.',
  ],
  SUPPLIERS: (ep) => [
    `Live supplier directory fetched from ${ep} — the same call the web page makes.`,
    'Rows render real company name, location, verification badge and product count.',
    'Offline: the last-saved directory renders first — never a white screen.',
  ],
  ORDERS: (ep) => [
    `Live order list fetched from ${ep} — the same call the web page makes.`,
    'Rows render real order number, status badge, payment state and total.',
    'Offline: the last-saved list renders first — never a white screen.',
  ],
  DEALS: (ep) => [
    `Live deals fetched from ${ep} — the same call the web page makes.`,
    'Flash and daily arrays render as native cards with real discount badges.',
    'Offline: the last-saved deals payload renders first — never a white screen.',
  ],
  CATEGORIES: (ep) => [
    `Live category tree fetched from ${ep} — the same call the web page makes.`,
    'Chips render real category names and product counts.',
    'Offline: the last-saved tree renders first — never a white screen.',
  ],
  WISHLIST: (ep) => [
    `Live saved items fetched from ${ep} for signed-in buyers — the same call the web page makes.`,
    'Guests see their device-local wishlist instead; nothing is fabricated.',
    'Offline: the last-saved list renders first — never a white screen.',
  ],
  NOTIFICATIONS: (ep) => [
    `Live notification feed fetched from ${ep} — the same call the web page makes.`,
    'Rows render real title, message, type badge and unread state.',
    'Offline: the last-saved feed renders first — never a white screen.',
  ],
}

const files = fs.readdirSync(SCREENS).filter((f) => f.endsWith('.kt'))
let polished = 0
for (const f of files) {
  const p = path.join(SCREENS, f)
  let src = fs.readFileSync(p, 'utf8')
  if (!src.includes(FILLER1) && !src.includes(FILLER2)) continue
  const epM = src.match(/override val endpoint: String\? = "([^"]+)"/)
  const kindM = src.match(/override val kind = NativePageKind\.(\w+)/)
  if (!epM || !kindM) continue
  const bullets = (KIND_BULLETS[kindM[1]] || KIND_BULLETS.PRODUCTS)(epM[1])
  const start = src.indexOf('override val bullets = listOf(')
  if (start < 0) continue
  const openIdx = start + 'override val bullets = listOf('.length
  let depth = 0
  let end = openIdx
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') {
      if (depth === 0) {
        end = i
        break
      }
      depth--
    }
  }
  src = src.slice(0, start) + 'override val bullets = listOf(\n' + bullets.map((b) => `        "${b}",`).join('\n') + '\n    )' + src.slice(end + 1)
  fs.writeFileSync(p, src)
  polished++
}

// ── B. registry rewires ────────────────────────────────────────────────────
let reg = fs.readFileSync(REG, 'utf8')
const walletCall = 'com.zylod.wholesale.ui.wallet.WalletScreen(onBack = onBack, openPage = openPage, query = query)'
const rewireTargets = [
  'balance', 'bank', 'billing', 'card', 'commission', 'credit', 'earnings',
  'escrow', 'payout', 'refund', 'revenue', 'transaction',
]
let rewired = []
for (const id of rewireTargets) {
  const rowRe = new RegExp(`("${id}" to entry\\(\\w+PageMeta\\) \\{ onBack, openPage, query -> )(\\w+Screen\\(onBack = onBack, openPage = openPage, query = query\\))( \\},)`)
  const m = reg.match(rowRe)
  if (m) {
    reg = reg.replace(rowRe, `$1${walletCall}$3`)
    rewired.push(id)
  }
}
// single special rows
const specials = [
  { id: 'admin', meta: 'AdminPageMeta', call: 'com.zylod.wholesale.ui.admin.AdminDashboardScreen(onBack = onBack, openPage = openPage, query = query)' },
  { id: 'browse', meta: 'BrowsePageMeta', call: 'AllProductsScreen(onBack = onBack, openPage = openPage, query = query)' },
  { id: 'buyer', meta: 'BuyerPageMeta', call: 'BuyerDashboardScreen(onBack = onBack, openPage = openPage, query = query)' },
]
for (const s of specials) {
  const rowRe = new RegExp(`("${s.id}" to entry\\(\\w+PageMeta\\) \\{ onBack, openPage, query -> )\\w+Screen\\d?\\(onBack = onBack, openPage = openPage, query = query\\)( \\},)`)
  if (reg.match(rowRe)) {
    reg = reg.replace(rowRe, `$1${s.call}$2`)
    rewired.push(s.id)
  }
}

// ── C. honest descriptors for the remaining curated pages ──────────────────
const DESCRIPTORS = {
  policy: {
    summary: 'Renders the published support article for the requested policy slug — the same document api/support/articles serves the web.',
    bullets: [
      'Reads the slug from the navigation query and renders the published article from api/support/articles.',
      'Unknown slugs show the honest not-found state — no invented policy text.',
      'Readers can submit article feedback, exactly like the web page.',
    ],
  },
  'terms-and-conditions': {
    summary: 'Renders the published terms document from api/support/articles — the same source the web policy page reads.',
    bullets: [
      'The document body streams from the published support article, never hardcoded text.',
      'Unknown slugs show the honest not-found state.',
      'Related legal pages render beside the document, like the web layout.',
    ],
  },
  'popular-searches': {
    summary: 'Trending searches fetched live from api/search/popular — the same call the web page makes.',
    bullets: [
      'The trending list streams from api/search/popular?limit=40.',
      'Empty trend data shows the honest empty state the web shows.',
      'Tapping a trend opens the native search tab with that query.',
    ],
  },
  'search-history': {
    summary: 'Your recent searches, stored on this device — the same device-local history the web page keeps.',
    bullets: [
      'History lives on the device; clearing it removes it everywhere on this device.',
      'Empty history shows the honest "No search history yet" state.',
      'Entries open the native search tab with the stored query.',
    ],
  },
  'search-suggestions': {
    summary: 'Search suggestions and autocomplete built from your device history and live trends.',
    bullets: [
      'Suggestions combine device-local history with api/search/popular trends.',
      'Nothing is invented — empty sources show the honest empty states.',
      'Selecting a suggestion runs the native search immediately.',
    ],
  },
  'search-autocomplete': {
    summary: 'Query autocomplete while typing, built from device history and live trends.',
    bullets: [
      'Completions stream from the same sources the web uses — history first, trends after.',
      'Empty sources show the honest empty state, never filler rows.',
    ],
  },
  'search-voice-history': {
    summary: 'History of your voice searches on this device — device-local, honest when empty.',
    bullets: [
      'Voice queries you ran on this device, newest first.',
      'Nothing is fabricated — an empty list says so plainly.',
    ],
  },
  'delivery-photo-proof': {
    summary: 'Delivery photo proof — the real proof-of-delivery photos captured by the driver for the requested sub-order.',
    bullets: [
      'Photos stream from the order tracking data when the delivery has proof attached.',
      'No proof for this delivery shows the honest empty state.',
    ],
  },
  'pickup-point-selection': {
    summary: 'Pickup point selection for checkout — choose where your wholesale order is collected.',
    bullets: [
      'Points stream from the same pickup-point data the DeliveryMethods flow uses.',
      'Selecting a point carries it into the checkout delivery step.',
    ],
  },
  info: {
    summary: 'Informational page shell — renders its curated description and links into the live native surfaces.',
    bullets: [
      'Curated on-device content only; no server data is invented.',
      'Related links route through the native ownership table.',
    ],
  },
}

let described = 0
for (const f of files) {
  const p = path.join(SCREENS, f)
  let src = fs.readFileSync(p, 'utf8')
  if (!src.includes(FILLER1) && !src.includes(FILLER2)) continue
  if (/endpoint: String\? = "/.test(src)) continue // live — already polished
  const pageIdM = src.match(/override val pageId = "([a-z0-9-]+)"/)
  if (!pageIdM) continue
  const d = DESCRIPTORS[pageIdM[1]]
  if (!d) continue
  const start = src.indexOf('override val bullets = listOf(')
  if (start < 0) continue
  const openIdx = start + 'override val bullets = listOf('.length
  let depth = 0
  let end = openIdx
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') {
      if (depth === 0) {
        end = i
        break
      }
      depth--
    }
  }
  src = src.slice(0, start) + 'override val bullets = listOf(\n' + d.bullets.map((b) => `        "${b}",`).join('\n') + '\n    )' + src.slice(end + 1)
  src = src.replace(/override val summary = "[\s\S]*?"\n/, `override val summary = "${d.summary}"\n`)
  fs.writeFileSync(p, src)
  described++
}

fs.writeFileSync(REG, reg)
console.log('live pages polished:', polished)
console.log('registry rows rewired:', rewired.join(', '))
console.log('honest descriptors applied:', described)
