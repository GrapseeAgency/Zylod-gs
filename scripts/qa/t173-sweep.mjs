// Task 173 — EXTENDED RESPONSIVE SWEEP, tail completion.
// t166 curated 74 surfaces; t172 covered ~220 more. This script sweeps EVERY
// remaining registered page id (the ~650 unswept tail) at 320 + 768 with role
// sessions (public → buyer → seller → admin), recording scrollWidth overflow
// and JS errors. Batched: `node t173-sweep.mjs <batchIndex> <batchCount>`.
// Findings append to /tmp/t173-findings.json.
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:3000'
const STAMP = process.env.T173_STAMP || String(Date.now())
const PW = 't173-Qa-Str0ng1!'
const BATCH = Number(process.argv[2] || 0)
const BATCHES = Number(process.argv[3] || 1)
const ab = (cmd, t = 45000) => { try { return execSync(`agent-browser ${cmd}`, { encoding: 'utf8', timeout: t }).trim() } catch (e) { return String(e.stdout || '') + String(e.stderr || '') } }
// agent-browser eval prints a JSON-encoded string (e.g. `"320"` WITH quotes) — strip them.
const num = (s) => String(s).trim().replace(/^["']+|["']+$/g, '')

// ── role sessions ────────────────────────────────────────────────────────────
function apiLogin(email) {
  for (let a = 0; a < 5; a++) {
    try {
      const out = execSync(
        `curl -s -i --max-time 30 -X POST ${BASE}/api/auth/login -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.173.9.9' -d '{"email":"${email}","password":"${PW}"}'`,
        { encoding: 'utf8' })
      const m = out.match(/set-cookie: ([^;\r\n]+)/i)
      if (m) return m[1]
    } catch {}
    execSync('sleep 8') // server likely OOM-rebooting (disk-cached boot ~15-35s)
  }
  return null
}
function setCookie(pair) {
  fs.writeFileSync('/tmp/ab-cookie.txt', `Cookie: ${pair}\n`)
  ab('cookies set --curl /tmp/ab-cookie.txt --domain 127.0.0.1')
}
const ROLE_EMAIL = {
  buyer: `t173-buyer-${STAMP}@t173.test`,
  seller: `t173-supp-${STAMP}@t173.test`,
  admin: `t173-admin-${STAMP}@t173.test`,
}

// ── page → role classifier (prefix heuristics; gates render honestly anyway) ─
function roleFor(id) {
  if (/^admin[-_]/.test(id)) return 'admin'
  if (/^(seller|supplier|store|payouts|bulk-upload|bulk-price|go-live|revenue|promotion|catalog-management|add-listing|import-products|product-upload|merchant|vendor|join-seller|sell-with|fulfillment-center|warehouse-management|shipping-zones|inventory|live-studio|customer-queries|customer-rfq|return-claim|shipping-zone|self-pickup|bulk-enquiry|approved-suppliers|sellercenter|quality-check|manufacturing-partners|product-listings|product-variant-matrix|product-pricing-tiers|product-spec-editor|product-media-gallery|store-|seller-)/.test(id)) return 'seller'
  if (/^(buyer|wishlist|favorite|favorites|cart|checkout|orders|order|refund|return|dispute|wallet|my-wallet|balance-overview|add-money|withdraw-money|transaction|bank-accounts|upi-payment|credit|add-card|payment|notification|promo|back-in-stock|delivery-updates|order-updates|price|stock-alert|search-history|browsing-history|my-coupons|earn-coupons|spin|daily-checkin|referral|loyalty|points|vip|exclusive-deal|group-buy|membership|reorder|buy-now|quick-order|bulk-order|shipping-address|add-address|edit-address|delivery-method|add-payment-method|apply-credits|gift-card|split-payment|installment-payment|my-queries|buyer-queries|instant-chat|messaging-center|support-tickets|ticket|raise|report|save-for-later|recently|collection|my-samples|custom-orders|draft-orders|pending-orders|all-orders|inquiry|rfq|quote-request|rfp|my-orders|compare|rate-products|missed-delivery|reschedule-delivery|delivery-chat|delivery-confirmation|delivery-proof|pickup-point|warehouse-locator|shipping-calculator|track|freight-tracking|import-export|customs-clearance|size-guide|my-profile|profile|account|gdpr|privacy-settings|language-settings|theme-settings|linked-accounts|delete-account|business-profile|tax-information|credit-score|credit-limit|earnings|commission|invoice-management|onboarding|feedback|frequently|product-quick-view|quick-view|order-bulk-actions|my-orders|past)/.test(id)) return 'buyer'
  return 'public'
}

// ── the full registered page list + t166's curated coverage (excluded) ───────
const t166 = new Set(['home','categories','category-browser','flash-sale','flash-deals','live-shopping','trending-products','new-arrivals','explore','global-search','search','sitemap','faq','about','contact-us','trust-center','help-center','become-a-seller','pricing','download-app','top-suppliers','verified-suppliers','featured-suppliers','business-directory','marketplace-news','careers','press','partner-program','wholesale-pricing','trade-assurance','track-package','order-tracking','pickup-points','system-status','vip-program','loyalty-program','reward-points','spin-wheel','store-page','group-buy','rfq-list','seller-verification','supplier-profile','buyer-dashboard','wishlist','favorites','orders-history','purchase-history','buyer-settings','buyer-credit','buyer-favorites','checkout','wallet-page','withdraw-money','notification-center','account-settings','buyer-profile','cart','seller-dashboard','supplier-products','seller-payouts','seller-financial-statements','seller-rankings','seller-sales-funnel','seller-customer-insights','seller-live-console','supplier-samples','inventory-management','bulk-upload-products','seller-add-product','seller-verification-status','admin-dashboard','admin-payments','admin-deliveries','admin-audit-logs'])

const files = fs.readdirSync('src/lib/page-chunks').filter((f) => f.startsWith('chunk-'))
const all = []
for (const f of files) {
  const src = fs.readFileSync(`src/lib/page-chunks/${f}`, 'utf8')
  const m = src.match(/export const \w+ *[:=] *new Set\(\[(.*?)\]/s)
  if (m) for (const id of m[1].match(/'[^']+'/g) || []) all.push(id.slice(1, -1))
}
const targets = [...new Set(all)].filter((id) => !t166.has(id)).sort()

// ── batch slice ──────────────────────────────────────────────────────────────
const per = Math.ceil(targets.length / BATCHES)
const slice = targets.slice(BATCH * per, (BATCH + 1) * per)
console.log(`t173 sweep batch ${BATCH + 1}/${BATCHES} — ${slice.length} of ${targets.length} unswept pages`)

// ── resumable progress (OOM-reboot survival) ────────────────────────────────
const PROG = '/tmp/t173-progress.json'
let progress = {}
try { progress = JSON.parse(fs.readFileSync(PROG, 'utf8')) } catch {}
const saveProgress = () => fs.writeFileSync(PROG, JSON.stringify(progress))

// ── group by role so cookies are set once per segment ───────────────────────
const groups = { public: [], buyer: [], seller: [], admin: [] }
for (const id of slice) groups[roleFor(id)].push(id)

const overflows = [], jsErrors = [], connFails = []
let consecutiveFail = 0
// incremental findings (survive OOM crashes): merge into /tmp/t173-findings.json
const FND = '/tmp/t173-findings.json'
let savedFnd = { overflows: [], jsErrors: [], connFails: [] }
try { savedFnd = JSON.parse(fs.readFileSync(FND, 'utf8')) } catch {}
const saveFindings = () => {
  const merged = {
    overflows: [...savedFnd.overflows, ...overflows.filter((o) => !savedFnd.overflows.some((s) => s.page === o.page && s.vp === o.vp))],
    jsErrors: [...savedFnd.jsErrors, ...jsErrors.filter((o) => !savedFnd.jsErrors.some((s) => s.page === o.page))],
    connFails: [...savedFnd.connFails, ...connFails],
  }
  fs.writeFileSync(FND, JSON.stringify(merged, null, 1))
}

for (const [role, pages] of Object.entries(groups)) {
  if (!pages.length) continue
  if (role !== 'public') {
    const ck = apiLogin(ROLE_EMAIL[role])
    if (!ck) { console.log(`LOGIN FAILED for ${role} — skipping ${pages.length} pages to gates`); }
    else setCookie(ck)
  }
  for (const [w, h] of [[320, 700], [768, 1024], [1280, 900]]) {
    ab(`set viewport ${w} ${h}`)
    for (let i = 0; i < pages.length; i++) {
      const id = pages[i]
      const pkey = `${role}:${id}:${w}`
      if (progress[pkey]) continue
      let okPage = false
      for (let attempt = 0; attempt < 3 && !okPage; attempt++) {
        const out = ab(`open "${BASE}/?page=${id}"`, 45000)
        let connected = !/REFUSED|RESET|ERR_|timeout|Navigation failed/i.test(out)
        // POST-HYDRATION measurement: client hydration can widen the layout
        // AFTER the load event — wait before measuring (t173 lesson: pre-hydration
        // eval missed the points-history 350px overflow).
        execSync('sleep 1.8')
        let sw = num(ab('eval "String(document.documentElement.scrollWidth)"'))
        if (!connected || !/^\d+$/.test(sw)) {
          execSync('sleep 2')
          const out2 = ab(`open "${BASE}/?page=${id}"`, 45000)
          connected = !/REFUSED|RESET|ERR_|timeout|Navigation failed/i.test(out2)
          execSync('sleep 2.5')
          sw = num(ab('eval "String(document.documentElement.scrollWidth)"'))
        }
        if (!connected || !/^\d+$/.test(sw)) {
          consecutiveFail++
          if (consecutiveFail >= 4) {
            // server likely OOM-rebooted: wait for the watcher (disk-cached boot ~15-35s)
            console.log(`  [reboot-wait] ${id} @${w} — waiting 35s for dev server`)
            execSync('sleep 35')
            consecutiveFail = 0
          } else execSync('sleep 4')
          continue
        }
        consecutiveFail = 0
        okPage = true
        const iw = num(ab('eval "String(window.innerWidth)"'))
        const overflow = /^\d+$/.test(sw) && /^\d+$/.test(iw) && Number(sw) > Number(iw) + 1
        if (overflow) {
          const errText = ab('errors').trim()
          overflows.push({ role, page: id, vp: `${w}x${h}`, sw: Number(sw), iw: Number(iw), errs: errText.slice(0, 200) })
          console.log(`  OVERFLOW [${role}] ${id} @${w} sw=${sw} iw=${iw}`)
        }
        if (w === 320) {
          const errText = ab('errors').trim()
          if (errText && !/No page errors/i.test(errText) && /\[error\]|Error:|Uncaught/i.test(errText)) {
            jsErrors.push({ role, page: id, err: errText.split('\n').slice(0, 2).join(' | ').slice(0, 250) })
            console.log(`  JSERROR [${role}] ${id} — ${errText.split('\n')[0]?.slice(0, 120)}`)
          }
        }
      }
      if (!okPage) { connFails.push({ role, page: id, vp: `${w}x${h}` }) }
      else progress[pkey] = 1
      saveProgress()
      saveFindings()
      execSync('sleep 1.2')
    }
  }
}

saveFindings()
console.log(`BATCH ${BATCH + 1} DONE — overflows: ${overflows.length}, jsErrors: ${jsErrors.length}, connFails: ${connFails.length}`)
for (const r of connFails) console.log(`  CONNFAIL [${r.role}] ${r.page} @${r.vp}`)
