/**
 * scripts/qa/orphan-scan.mjs — the Task 121-style cohesion scan, persisted.
 *
 * Lists every API route under src/app/api and checks whether ANY frontend /
 * lib / store / hook / mini-service file references its path (or a prefix of
 * it — dynamic segments like [id] can't be matched statically, so a route
 * counts as REFERENCED when any file mentions its parent path literal).
 *
 * This under-detects orphans by design (low false-positive gap-finder, not a
 * proof). Every candidate must be manually verified: real orphan vs.
 * externally-called surface (webhooks, native bridge, socket control loop).
 *
 * Run: bun scripts/qa/orphan-scan.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const API_DIR = join(ROOT, 'src/app/api')
const SCAN_DIRS = ['src/components', 'src/lib', 'src/store', 'src/hooks', 'src/app', 'mini-services', 'public']

/** Externally-called surfaces — never orphans regardless of in-repo references. */
const EXTERNAL_PREFIXES = [
  '/api/webhooks', // payment gateways call these
  '/api/health', // platform probes
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
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// 1. collect routes: api dir tree → path segments; a folder [x] is a dynamic segment
function collectRoutes(dir, segments = [], out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      collectRoutes(p, [...segments, e], out)
    } else if (e === 'route.ts' || e === 'route.tsx') {
      const path =
        '/api/' +
        segments
          .map((s) => (s.startsWith('[') ? '*' : s))
          .join('/')
      out.push({ path, file: p })
    }
  }
  return out
}

const routes = collectRoutes(API_DIR)

// 2. collect all scannable file contents
const scanFiles = []
for (const d of SCAN_DIRS) {
  const full = join(ROOT, d)
  let st
  try {
    st = statSync(full)
  } catch {
    continue
  }
  if (st.isDirectory()) scanFiles.push(...walk(full))
  else scanFiles.push(full)
}
const contents = scanFiles
  .filter((f) => /\.(ts|tsx|js|jsx|mjs|html|sh)$/.test(f))
  .map((f) => {
    try {
      return readFileSync(f, 'utf8')
    } catch {
      return ''
    }
  })
  .join('\n')

// 3. match: build a regex from the route path where a dynamic segment '*'
//    matches a real id OR a template-literal hole like ${id} / `${...}`.
const routeRegexes = routes.map((r) => {
  const parts = r.path.split('/')
  const rx =
    parts
      .map((s) => {
        if (s !== '*') return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // one path segment: either a plain id or a JS template hole (${...})
        return '(?:\\$\\{[^/}]+\\}|[^/\'"`]+)'
      })
      .join('/') +
    '([\'"`/\\\\?#]|$)'
  return { route: r, rx: new RegExp(rx) }
})

const orphans = []
for (const { route, rx } of routeRegexes) {
  if (EXTERNAL_PREFIXES.some((p) => route.path.startsWith(p))) continue
  if (rx.test(contents)) continue
  orphans.push(route)
}

console.log(`routes=${routes.length} scanned-files=${scanFiles.length}`)
if (orphans.length === 0) {
  console.log('orphans: NONE — every route path literal is referenced somewhere in-repo')
} else {
  console.log(`orphan CANDIDATES (${orphans.length}) — verify manually:`)
  for (const o of orphans) console.log(`  ${o.path}  (${o.file.replace(ROOT + '/', '')})`)
}
