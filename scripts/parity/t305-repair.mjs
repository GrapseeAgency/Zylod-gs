// t305-repair — final structural repair of the meta blocks corrupted by the
// r2/r4 splice bug (paren-inside-string) and the JSX-junk prose extractor.
// Rebuilds summary + bullets with HONEST per-page content; related is kept.
import fs from 'node:fs'
import path from 'node:path'

const dir = 'android/app/src/main/java/com/zylod/wholesale/ui/screens'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.kt'))

const HONEST = {
  'admin-payments': {
    s: 'Payment verification console — the real payments table with paginated status counts and the admin verify decision.',
    b: [
      'GET api/admin/payments renders the four real statuses plus the platform-wide total in the strip.',
      'POST api/admin/payments/[id]/verify records the admin-override decision on a pending submission — every action is audit-logged.',
      'Buyer submissions appear the moment payment-submit records them; nothing is marked paid until someone verifies the money.',
    ],
  },
  'admin-support-tickets': {
    s: 'Platform support threads — reply as the platform and drive the status changes yourself.',
    b: ['Every reply notifies the filer; buyer and supplier tickets share one queue with their roles intact.'],
  },
  'auth-callback': {
    s: 'Auth callback — the bridge that hands the web session to the app after sign-in.',
    b: ['Deep-link driven; no manual data entry lives here.'],
  },
  'barcode-result': {
    s: 'Barcode scan result — resolves the scanned code into product listings.',
    b: ['The scanned code routes through the search rail; unknown codes show the honest no-results state.'],
  },
  'bulk-upload-template': {
    s: 'Download the live bulk-upload CSV template.',
    b: [
      'The header carries exactly the columns the server expects — one product per row, max 100 rows per upload.',
      'The categoryId column carries your LIVE category ids, so the template is valid on upload.',
    ],
  },
  checkout: {
    s: 'Checkout — the typed rail: cart, shipping address, delivery options and payment methods.',
    b: [
      'POST api/orders re-prices everything server-side; the client never invents totals.',
      'Guests get the honest sign-in wall — cart, addresses and payment methods live in the account.',
    ],
  },
  'checkout-page': {
    s: 'Checkout-page alias — the same typed CheckoutScreen keyed to this pageId.',
    b: ['Addresses, delivery options and the place-order rail are identical to the checkout tab root.'],
  },
  'department-store': {
    s: 'Department store — the curated shopping directory.',
    b: ['Links route into the live category and product rails — no fabricated listings.'],
  },
  'investor-contact': {
    s: 'Investor contact — the investor-relations contact surface.',
    b: ['Renders the real published support contact; honest generic wording when nothing is published.'],
  },
  'investor-relations': {
    s: 'Investor relations — reports, filings and presentation links.',
    b: ['Curated navigation into the typed investor surfaces; no invented financial data.'],
  },
  'raise-complaint': {
    s: 'Raise complaint — the typed complaint form.',
    b: ['Files the real complaint via the complaints rail; server errors surface verbatim.'],
  },
  'raise-dispute': {
    s: 'Raise dispute — dispute filing for an order.',
    b: ['Submits through the complaints rail with the order attached; honest states throughout.'],
  },
  'return-claim-detail': {
    s: 'Return claim detail — the seller/admin view of one return claim.',
    b: ['GET api/returns/[id] for the claim rows; confirm-receipt/approve/reject actions ride the same contracts as the web.'],
  },
  'size-chart': {
    s: 'Size chart — the chest/length/sleeve measurement table with an inches/cm switch.',
    b: [
      'How-to-measure guidance renders beside the chart, exactly like the web page.',
      'Reference body measurements, not garment dimensions — request a sample for bulk orders where fit matters.',
    ],
  },
  'size-guide': {
    s: 'Size guide — the measurement table with an inches/cm switch and how-to-measure notes.',
    b: ['Reference body measurements, not garment dimensions; contact the supplier before placing a bulk order where fit matters.'],
  },
  'referral-earnings': {
    s: 'Referral earnings ledger — the real referral bonus rows.',
    b: ['Invited merchants render with their role and status from the referral API; load failures show the verbatim error.'],
  },
  'seller-analytics': {
    s: 'Seller analytics — traffic sources, top products and restock demand.',
    b: ['Sections render live data when available and honest not-available-yet states otherwise.'],
  },
  'seller-analytics-page': {
    s: 'Seller analytics — traffic sources, top products and restock demand.',
    b: ['Sections render live data when available and honest not-available-yet states otherwise.'],
  },
  'store-analytics': {
    s: 'Store analytics — the dashboard sections on live data.',
    b: ['Honest empty states for fresh accounts — never fabricated numbers.'],
  },
  'analytics-dashboard': {
    s: 'Analytics dashboard — the account dashboard sections on live data.',
    b: ['Honest empty states for fresh accounts — never fabricated numbers.'],
  },
  'seller-sales-report': {
    s: 'Seller sales report — real sold rows and revenue from the seller API.',
    b: ['Honest zero-states for fresh accounts — revenue sums only real order items.'],
  },
  pricing: {
    s: 'Bulk pricing — select a product to see its live tier ladder.',
    b: ['Every calculator is tied to one real listing and its live pricing tiers.'],
  },
}

const JUNK = /[\}）]\} |’\}|: ’|\}\)|className|\} : \(|aria-|\.map\(m =>|\}\}|\{\'|\}\",|^\)\(|\)\}\"|\)\} saved|\( \)/

let rebuilt = 0
for (const f of files) {
  const p = path.join(dir, f)
  let src = fs.readFileSync(p, 'utf8')
  const start = src.indexOf('override val bullets = listOf(')
  if (start < 0) continue
  const openIdx = start + 'override val bullets = listOf('.length
  const relIdx = src.indexOf('override val related = listOf(')
  if (relIdx < 0 || relIdx < openIdx) continue
  const region = src.slice(openIdx, relIdx)
  const lines = region.split('\n').map((l) => l.trim()).filter((l) => l.length)
  const bulletLines = lines.filter((l) => /^"/.test(l))
  const nonBullet = lines.filter((l) => !/^"/.test(l) && l !== ')')
  const junky = bulletLines.some((l) => JUNK.test(l)) || nonBullet.length > 0
  if (!junky) continue
  const pidM = src.match(/override val pageId = "([a-z0-9-]+)"/)
  const pageId = pidM ? pidM[1] : null
  const h = HONEST[pageId] || {
    s: 'Renders its honest on-device description and links into the live native surfaces.',
    b: ['Curated on-device content — no fabricated server data.', 'Related links route through the native ownership table.'],
  }
  const newRegion = 'override val bullets = listOf(\n' + h.b.map((b) => `        "${b}",`).join('\n') + '\n    )\n\n        '
  src = src.slice(0, start) + newRegion + src.slice(relIdx)
  src = src.replace(/override val summary = "[\s\S]*?"\n/, `override val summary = "${h.s}"\n`)
  fs.writeFileSync(p, src)
  rebuilt++
  console.log('rebuilt', f, '(' + pageId + ')')
}
console.log('total rebuilt:', rebuilt)
