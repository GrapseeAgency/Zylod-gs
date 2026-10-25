// t187 full-web-sweep for CI — loops every registered page id, screenshots it,
// extracts DOM text, flags mock-data patterns / stuck PageLoader / console
// errors. Runs on a GitHub Actions runner (16GB) against a real seeded server.
// Usage: node scripts/qa/web-sweep-ci.mjs <baseURL> <outDir>
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'http://localhost:3000'
const OUT = process.argv[3] || 'web-screenshots'
fs.mkdirSync(OUT, { recursive: true })

// Page ids — generated from src/lib/page-loader.ts at workflow time.
const pages = fs.readFileSync('/tmp/all-pages.txt', 'utf8').split('\n').filter(Boolean)

// Rendered-text patterns that indicate fabricated/mock data (t187-b hunt list).
const MOCK_PATTERNS = [
  { re: /Apex Industrial Corp/i, label: 'fake-supplier: Apex Industrial Corp' },
  { re: /Midwest Logistics/i, label: 'fake-reviewer: Midwest Logistics' },
  { re: /Sunrise Distributors/i, label: 'fake-reviewer: Sunrise Distributors' },
  { re: /Premium Industrial Bearings/i, label: 'fake-product: Premium Industrial Bearings' },
  { re: /Pro-Grade Hammer Drill/i, label: 'fake-product: Hammer Drill bundle' },
  { re: /Titanium Drill Bit Set/i, label: 'fake-product: Titanium Drill Bits' },
  { re: /Heavy Duty Work Gloves/i, label: 'fake-product: Work Gloves bundle' },
  { re: /Heavy Duty Steel Pallet Racking/i, label: 'fake-product-name: Pallet Racking' },
  { re: /Enterprise Buyer/i, label: 'fake-author: Enterprise Buyer' },
  { re: /Bengal Express/i, label: 'fake-partner: Bengal Express' },
  { re: /Pathao Logistics/i, label: 'fake-partner: Pathao Logistics' },
  { re: /eCourier BD/i, label: 'fake-partner: eCourier BD' },
  { re: /RedX Bangladesh/i, label: 'fake-partner: RedX Bangladesh' },
  { re: /Specialist Online/i, label: 'fake-presence: Specialist Online' },
  { re: /\b9612-345678\b/, label: 'fake-hotline: 9612-345678' },
  { re: /Verified Merchant Partner/i, label: 'fake-badge: Verified Merchant Partner' },
  { re: /lorem ipsum/i, label: 'lorem-ipsum' },
  { re: /John Doe|Jane Doe|Acme Corp/i, label: 'placeholder-name' },
]

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)))

const reportPath = path.join(OUT, 'report.jsonl')
const report = fs.createWriteStream(reportPath, { flags: 'a' })
let done = 0
const t0 = Date.now()

for (const id of pages) {
  const shot = path.join(OUT, `${id}.png`)
  const url = `${BASE}/?page=${id}`
  const entry = { page: id }
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    entry.http = resp?.status() ?? 0
    await page.waitForTimeout(2500)
    const text = await page.evaluate(() => (document.body ? document.body.innerText.slice(0, 4000) : ''))
    entry.loaderStuck = await page.evaluate(() => {
      const el = document.querySelector('[role="status"]')
      return !!el && el.innerText?.includes('Loading') && document.body.innerText.trim().length < 120
    })
    entry.mockFlags = MOCK_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label)
    entry.textLen = text.length
    entry.snippet = text.slice(0, 300).replace(/\s+/g, ' ')
    entry.consoleErrors = consoleErrors.splice(0, consoleErrors.length)
    await page.screenshot({ path: shot, timeout: 15000 })
  } catch (e) {
    entry.error = String(e).slice(0, 200)
  }
  report.write(JSON.stringify(entry) + '\n')
  done++
  if (done % 50 === 0) {
    console.log(`[sweep] ${done}/${pages.length} pages (${Math.round((Date.now() - t0) / 1000)}s)`)
  }
}

report.end()
await browser.close()
console.log(`[sweep] COMPLETE ${done} pages in ${Math.round((Date.now() - t0) / 1000)}s`)
