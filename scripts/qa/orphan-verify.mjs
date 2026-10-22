/**
 * scripts/qa/orphan-verify.mjs — second stage: for each candidate route,
 * search ONLY consumer dirs (components/store/hooks) for its exact path
 * regex, and print the class + the first consumer file if found.
 * Run: bun scripts/qa/orphan-verify.mjs > /tmp/orphan-report.txt
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const API_DIR = join(ROOT, 'src/app/api')
const CONSUMER_DIRS = ['src/components', 'src/store', 'src/hooks']

const CANDIDATES = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], 'utf8'))
  : [
      '/api/wishlist/price-alerts',
      '/api/native/offline-sync',
      '/api/careers/departments',
      '/api/payments/webhook',
      '/api/products/*/bulk-pricing',
      '/api/products/*/price-tiers',
      '/api/products/*/frequently-bought',
      '/api/products/size-guide',
      '/api/products/catalog',
      '/api/wallet/ipn/sslcommerz',
      '/api/categories/browse',
      '/api/admin/investor-docs/*',
      '/api/admin/inspections',
      '/api/admin/orders/*/verify-payment',
      '/api/admin/media-kit/*',
      '/api/admin/maintenance/*',
      '/api/coupons/validate',
      '/api/orders/*/payments/initiate',
      '/api/orders/*/receipt',
      '/api/orders/*/invoices',
      '/api/supplier/queries/*',
      '/api/rewards/history',
      '/api/delivery/suborders/*/location',
      '/api/profile/linked-accounts/*/disconnect',
      '/api/profile/linked-accounts/*/connect',
      '/api/invoices/*',
    ]

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = CONSUMER_DIRS.flatMap((d) => {
  try {
    return walk(join(ROOT, d)).filter((f) => /\.(ts|tsx)$/.test(f))
  } catch {
    return []
  }
})
const fileContents = files.map((f) => ({ f, c: readFileSync(f, 'utf8') }))

for (const route of CANDIDATES) {
  const rx = new RegExp(
    route
      .split('/')
      .map((s) =>
        s === '*'
          ? '(?:\\$\\{[^/}]+\\}|[^/\'"`]+)'
          : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      )
      .join('/') + '([\'"`/\\\\?$]|$)'
  )
  const hits = fileContents.filter(({ c }) => rx.test(c)).map(({ f }) => f.replace(ROOT + '/', ''))
  console.log(`${route}\n  ${hits.length ? 'CONSUMED: ' + hits.slice(0, 4).join(', ') : 'REAL ORPHAN — no consumer in components/store/hooks'}`)
}
