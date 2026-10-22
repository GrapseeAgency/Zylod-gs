/**
 * scripts/qa/orphan-verify.mjs — second stage: for each candidate route,
 * (1) check the route file still exists under src/app/api, (2) search ONLY
 * consumer dirs (components/store/hooks/lib) for its exact path regex.
 * Verdicts:
 *   RETIRED           — route file gone (stays dead by design; Task 127-a)
 *   CONSUMED          — file exists + consumer found
 *   ORPHAN (live)     — file exists, NO consumer → true work item
 * Run: node scripts/qa/orphan-verify.mjs [candidates.json]
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const API_DIR = join(ROOT, 'src/app/api')
const CONSUMER_DIRS = ['src/components', 'src/store', 'src/hooks', 'src/lib']

/* Documented verdicts (Task 128 + this round): routes whose consumer is an
   external system or a dynamic-kind URL template a static regex cannot see.
   Anything NOT here with no consumer is a real ORPHAN (live). */
const DOCUMENTED = {
  '/api/native/offline-sync': 'EXTERNAL — native-app surface (no web consumer by design)',
  '/api/payments/webhook': 'EXTERNAL — gateway→server HMAC callback (drilled t71); no UI consumer by design',
  '/api/wallet/ipn/sslcommerz': 'EXTERNAL — gateway IPN callback; no UI consumer by design',
  '/api/delivery/suborders/*/location': 'EXTERNAL — driver-app surface (documented)',
  '/api/admin/media-kit/*': 'DYNAMIC-CONSUMED — fetch(`/api/admin/${kind}/${id}`) in admin-press-investor-manager.tsx (DELETE + PATCH)',
  '/api/admin/investor-docs/*': 'DYNAMIC-CONSUMED — fetch(`/api/admin/${kind}/${id}`) in admin-press-investor-manager.tsx (DELETE + PATCH)',
  '/api/admin/maintenance/*': 'DYNAMIC-CONSUMED — fetch(`/api/admin/${kind}/${id}`) in admin-app-status-manager.tsx (DELETE + PATCH)',
}

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

/* Does a route handler actually exist for this path pattern? */
function routeFileExists(pattern) {
  // API_DIR already IS src/app/api — drop the leading 'api' segment.
  const segs = pattern.replace(/^\//, '').split('/').slice(1)
  let dirs = [API_DIR]
  for (const seg of segs) {
    const next = []
    for (const d of dirs) {
      let entries
      try {
        entries = readdirSync(d)
      } catch {
        continue
      }
      for (const e of entries) {
        if (seg === '*') {
          if (statSync(join(d, e)).isDirectory()) next.push(join(d, e))
        } else if (e === seg) {
          const p = join(d, e)
          if (statSync(p).isFile()) return true
          next.push(p)
        }
      }
    }
    dirs = next
  }
  for (const d of dirs) {
    for (const f of ['route.ts', 'route.tsx', 'route.js']) {
      if (existsSync(join(d, f))) return true
    }
  }
  return false
}

const files = CONSUMER_DIRS.flatMap((d) => {
  try {
    return walk(join(ROOT, d)).filter((f) => /\.(ts|tsx)$/.test(f))
  } catch {
    return []
  }
})
const fileContents = files.map((f) => ({ f, c: readFileSync(f, 'utf8') }))

let liveOrphans = 0
for (const route of CANDIDATES) {
  if (!routeFileExists(route)) {
    console.log(`${route}\n  RETIRED — route file gone, stays dead by design`)
    continue
  }
  if (DOCUMENTED[route]) {
    const reason = DOCUMENTED[route]
    if (reason.startsWith('DYNAMIC-CONSUMED')) {
      // The claim itself must be evidence-backed: the dynamic template must
      // exist in consumer code right now, or this route degrades to ORPHAN.
      const tpl = new RegExp(reason.includes('press-investor') || reason.includes('media-kit') || reason.includes('investor-docs')
        ? '/api/admin/\\$\\{kind\\}\\/\\$\\{id\\}'
        : '/api/admin/\\$\\{kind\\}\\/\\$\\{id\\}')
      const proof = fileContents.filter(({ c }) => tpl.test(c)).map(({ f }) => f.replace(ROOT + '/', ''))
      if (!proof.length) {
        liveOrphans++
        console.log(`${route}\n  ORPHAN (live) — documented DYNAMIC-CONSUMED template NOT FOUND anymore; consumer broken`)
        continue
      }
      console.log(`${route}\n  DOCUMENTED — ${reason}; template proven in ${proof.slice(0, 2).join(', ')}`)
      continue
    }
    console.log(`${route}\n  DOCUMENTED — ${reason}`)
    continue
  }
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
  if (hits.length) {
    console.log(`${route}\n  CONSUMED: ${hits.slice(0, 4).join(', ')}`)
  } else {
    liveOrphans++
    console.log(`${route}\n  ORPHAN (live) — route file EXISTS with no consumer in components/store/hooks/lib`)
  }
}
console.log(`\nlive orphans: ${liveOrphans}`)
