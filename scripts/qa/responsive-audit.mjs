// Task 166 — full responsive render audit (unattended, all roles).
// Public pages → login buyer → buyer pages → login seller → seller pages →
// login admin → admin pages. Per page × viewport: scrollWidth overflow check
// + JS error capture. Writes a FAIL ledger JSON at the end.
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:3000'
const STAMP = process.env.T165_STAMP || '1792761048804'
const PW = 't165-Qa-Str0ng1!'
const ab = (cmd) => { try { return execSync(`agent-browser ${cmd}`, { encoding: 'utf8', timeout: 60000 }) } catch (e) { return String(e.stdout || '') + String(e.stderr || '') } }

const GROUPS = {
  public: ['home','categories','category-browser','flash-sale','flash-deals','live-shopping','trending-products','new-arrivals','explore','global-search','search','sitemap','faq','about','contact-us','trust-center','help-center','become-a-seller','pricing','download-app','top-suppliers','verified-suppliers','featured-suppliers','business-directory','marketplace-news','careers','press','partner-program','wholesale-pricing','trade-assurance','track-package','order-tracking','pickup-points','system-status','vip-program','loyalty-program','reward-points','spin-wheel','store-page','group-buy','rfq-list','seller-verification','supplier-profile'],
  buyer: ['buyer-dashboard','wishlist','favorites','orders-history','purchase-history','buyer-settings','buyer-credit','buyer-favorites','checkout','wallet-page','withdraw-money','notification-center','account-settings','buyer-profile','cart'],
  seller: ['seller-dashboard','supplier-products','seller-payouts','seller-financial-statements','seller-rankings','seller-sales-funnel','seller-customer-insights','seller-live-console','supplier-samples','inventory-management','bulk-upload-products','seller-add-product','seller-verification-status'],
  admin: ['admin-dashboard','admin-payments','admin-deliveries','admin-audit-logs'],
}
const VIEWPORTS = [[1920,1080],[768,1024],[320,700]]


// ── role sessions: API login + cookie injection (agent-browser cookies set --curl) ──
function apiLoginCookie(email) {
  const out = execSync(
    `curl -s -i -X POST ${BASE}/api/auth/login -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.99.9.9' -d '{"email":"${email}","password":"${PW}"}'`,
    { encoding: 'utf8' })
  const m = out.match(/set-cookie: ([^;\r\n]+)/i)
  return m ? m[1] : null
}
function setCookie(cookiePair) {
  fs.writeFileSync('/tmp/ab-cookie.txt', `Cookie: ${cookiePair}\n`)
  ab(`cookies set --curl /tmp/ab-cookie.txt --domain 127.0.0.1`)
}
const ROLE_EMAIL = {
  buyer: `t165-buyer-${STAMP}@t165.test`,
  seller: `t165-host-${STAMP}@t165.test`,
  admin: `t165-admin-${STAMP}@t165.test`,
}

const results = []
const errors = []
for (const [role, pages] of Object.entries(GROUPS)) {
  if (role !== 'public') {
    const ck = apiLoginCookie(ROLE_EMAIL[role])
    if (ck) setCookie(ck)
    else console.log('LOGIN FAILED for', role)
  }
  for (const [w, h] of VIEWPORTS) {
    ab(`set viewport ${w} ${h}`)
    for (const id of pages) {
      ab(`open "${BASE}/?page=${id}"`)
      execSync("sleep 1.2")
      const sw = ab('eval "String(document.documentElement.scrollWidth)"').trim()
      const iw = ab('eval "String(window.innerWidth)"').trim()
      const errText = ab('errors').trim()
      const overflow = /^\d+$/.test(sw) && /^\d+$/.test(iw) && Number(sw) > Number(iw) + 1
      if (overflow) results.push({ role, page: id, viewport: `${w}x${h}`, sw: Number(sw), iw: Number(iw) })
      if (errText && errText !== '' && !errText.includes('No page errors') && /\[error\]|Error:/i.test(errText)) {
        errors.push({ role, page: id, viewport: `${w}x${h}`, err: errText.split('\n').slice(0, 3).join(' | ').slice(0, 300) })
      }
    }
  }
}
fs.writeFileSync('/tmp/audit-overflow.json', JSON.stringify(results, null, 1))
fs.writeFileSync('/tmp/audit-errors.json', JSON.stringify(errors, null, 1))
console.log('AUDIT DONE — overflow:', results.length, 'jsErrors:', errors.length)
for (const r of results) console.log(`  OVERFLOW [${r.role}] ${r.page} @${r.viewport} sw=${r.sw} iw=${r.iw}`)
