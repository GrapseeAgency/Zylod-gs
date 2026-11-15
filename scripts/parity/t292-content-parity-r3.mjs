// t292-r3 — wire the still-filler CATEGORY_IDS + DEAL_IDS metas to the SAME
// live endpoints the web's generic-category / generic-deal pages call:
//   categories -> kind=PRODUCTS, endpoint="api/products?limit=24"
//   deals      -> kind=DEALS,    endpoint="api/deals?limit=20"
// Summaries/bullets come from the web's own CATEGORY_META copy (verbatim).
import fs from 'node:fs'
import path from 'node:path'

const ROOT = '/home/z/my-project'
const SCREENS = path.join(ROOT, 'android/app/src/main/java/com/zylod/wholesale/ui/screens')
const CAT_PAGE = path.join(ROOT, 'src/components/pages/generic-category-page.tsx')
const DEALS_ENDPOINT = 'api/deals?limit=20'
const PRODUCTS_ENDPOINT = 'api/products?limit=24'

// CATEGORY_META lifted from the web page (name + description only)
const catSrc = fs.readFileSync(CAT_PAGE, 'utf8')
const CATEGORY_META = {}
for (const m of catSrc.matchAll(/'([a-z-]+)': \{ name: '([^']+)', description: '([^']+)'/g)) {
  CATEGORY_META[m[1]] = { name: m[2], description: m[3] }
}

const CATEGORY_IDS = [
  'textiles-fabrics', 'agriculture-food', 'electronics', 'construction', 'packaging',
  'home-garden', 'gifts-crafts', 'beauty-personal-care', 'promotional-items', 'garments',
  'spices', 'mobile-accessories', 'led-lighting', 'automotive', 'sports-fitness',
  'books-stationery', 'toys', 'jewelry', 'medical-supplies', 'furniture',
]
const DEAL_IDS = ['mega-sale', 'bulk-discounts', 'week-special', 'factory-direct', 'best-sellers', 'recommended']

const report = { wired: [], missed: [] }

function replaceKind(kt, newKind) {
  return kt.replace(/override val kind = NativePageKind\.\w+/, `override val kind = NativePageKind.${newKind}`)
}
function replaceEndpoint(kt, endpoint) {
  return kt.replace(
    /override val endpoint: String\? = null/,
    `override val endpoint: String? = "${endpoint}"`,
  )
}
function replaceListBlock(kt, anchor, body) {
  const start = kt.indexOf(anchor)
  if (start < 0) return kt
  const openIdx = start + anchor.length
  let depth = 0
  let end = openIdx
  for (let i = openIdx; i < kt.length; i++) {
    if (kt[i] === '(') depth++
    else if (kt[i] === ')') {
      if (depth === 0) {
        end = i
        break
      }
      depth--
    }
  }
  return kt.slice(0, start) + anchor + '\n' + body + '\n    )' + kt.slice(end + 1)
}

for (const pageId of [...CATEGORY_IDS, ...DEAL_IDS]) {
  const isCat = CATEGORY_IDS.includes(pageId)
  const files = fs.readdirSync(SCREENS).filter((f) => f.endsWith('Screen.kt'))
  const file = files.find((f) => fs.readFileSync(path.join(SCREENS, f), 'utf8').includes(`override val pageId = "${pageId}"`))
  if (!file) {
    report.missed.push(pageId + ' (no meta file)')
    continue
  }
  const ktPath = path.join(SCREENS, file)
  let kt = fs.readFileSync(ktPath, 'utf8')
  if (!kt.includes('Curated native content') && !kt.includes('Live data renders from the Zylod API')) {
    report.missed.push(pageId + ' (remote-typed, skip)')
    continue
  }
  if (!kt.includes('endpoint: String? = null')) {
    report.missed.push(pageId + ' (already wired)')
    continue
  }

  const endpoint = isCat ? PRODUCTS_ENDPOINT : DEALS_ENDPOINT
  const kind = isCat ? 'PRODUCTS' : 'DEALS'
  const meta = CATEGORY_META[pageId]
  const title = meta?.name || pageId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  const description = meta?.description || `Wholesale ${pageId.replace(/-/g, ' ')} on the Zylod marketplace.`

  kt = replaceKind(kt, kind)
  kt = replaceEndpoint(kt, endpoint)
  kt = kt.replace(
    /override val summary = "[\s\S]*?"\n/,
    `override val summary = "${description} — the same live catalog the web category page fetches."\n`,
  )
  const bullets = isCat
    ? [
        `${title} — ${description}.`,
        'Live product grid fetched from api/products — the same call the web page makes.',
        'Offline: the last-saved grid renders first; the Room offline catalog fills in before curated content.',
      ]
    : [
        `${title} — live deals fetched from api/deals, the same call the web page makes.`,
        'Flash and daily arrays render as native product cards with real discount badges.',
        'Offline: the last-saved deals payload renders first — never a white screen.',
      ]
  kt = replaceListBlock(kt, 'override val bullets = listOf(', bullets.map((b) => `        "${b}",`).join('\n'))
  kt = kt.replace(/No obvious SPA endpoint feeds this page[^\n]*\n/, '')
  fs.writeFileSync(ktPath, kt)
  report.wired.push(`${pageId} -> ${endpoint} (${kind})`)
}

fs.writeFileSync('/tmp/t292-r3-report.json', JSON.stringify(report, null, 1))
console.log('wired:', report.wired.length)
console.log(report.wired.join('\n'))
console.log('missed:', report.missed.join(', '))
