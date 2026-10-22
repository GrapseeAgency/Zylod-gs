// Page-registry doctor — the standing tool for the registration-trap class
// (hit twice: t145 seller-live-studio, t146 buyer-queries). A page id must be
// CONSISTENT across the registries or the SPA answers "Page not found" or
// swallows the page into the generic renderer. The real failure classes:
//   A. an id whose component lives in a NON-misc chunk but which
//      getChunkForPage routes to 'misc' (no explicit list, no prefix rule,
//      and the fallback is misc) — the component is UNREACHABLE;
//   B. an id claimed by getGenericType's prefix rules (seller-/buyer-/
//      admin-/supplier- → generic info) that is NOT in REAL_PAGES — the
//      generic claim fires BEFORE the chunk fallback, so the real component
//      never loads.
// Run: node scripts/qa/registry-doctor.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CHUNKS_DIR = join(ROOT, 'src/lib/page-chunks')
const LOADER = readFileSync(join(ROOT, 'src/lib/page-loader.ts'), 'utf8')

let PASS = 0, FAIL = 0
const ok = (c, l, e = '') => { if (c) { PASS++; console.log('  ✅ ' + l) } else { FAIL++; console.log('  ❌ ' + l + (e ? ' — ' + e : '')) } }

const chunkFiles = readdirSync(CHUNKS_DIR).filter((f) => f.startsWith('chunk-') && f.endsWith('.ts') && f !== 'types.ts')
const mappedIds = new Map() // id → { chunk, owner }
for (const f of chunkFiles) {
  const src = readFileSync(join(CHUNKS_DIR, f), 'utf8')
  for (const m of src.matchAll(/'([a-z0-9-]+)':\s*\(\)\s*=>\s*import\('@\/components\//g)) {
    if (!mappedIds.has(m[1])) mappedIds.set(m[1], { chunk: f, owner: f.replace('chunk-', '').replace('.ts', '') })
  }
}

const gcfStart = LOADER.indexOf('export function getChunkForPage')
const gcfBody = LOADER.slice(gcfStart)
const routedIds = new Set([...gcfBody.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]))
// prefix rules route WHOLE families: seller- → 'seller', buyer-/admin- → 'misc', supplier- → 'seller'
const gcfPrefix = new Map()
for (const m of gcfBody.matchAll(/if \(pageId\.startsWith\('([a-z]+-)'\)[^]*?return '([a-z]+)'/g)) {
  if (!gcfPrefix.has(m[1])) gcfPrefix.set(m[1], m[2])
}

const realStart = LOADER.indexOf('const REAL_PAGES = new Set([')
const realEnd = LOADER.indexOf('])', realStart)
const realIds = new Set([...LOADER.slice(realStart, realEnd).matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]))
const gtBody = LOADER.slice(LOADER.indexOf('function getGenericType'))
const gtPrefixes = [...gtBody.matchAll(/pageId\.startsWith\('([a-z]+-)'\)/g)].map((m) => m[1])

const unreachable = []
const genericSwallowed = []
for (const [id, info] of mappedIds) {
  if (info.owner === 'core') continue // CHUNK_CORE loads first, before every other path
  // Class A: non-misc owner but the router sends it to misc
  if (info.owner !== 'misc' && !routedIds.has(id) && ![...gcfPrefix.entries()].some(([p, target]) => id.startsWith(p) && target === info.owner)) {
    unreachable.push(`${id} (${info.chunk})`)
  }
  // Class B: a generic-claiming prefix + not in REAL_PAGES → generic wins before the chunk
  if (!realIds.has(id) && gtPrefixes.some((p) => id.startsWith(p))) {
    genericSwallowed.push(`${id} (${info.chunk})`)
  }
}

console.log('Scanning', mappedIds.size, 'mapped page ids across', chunkFiles.length, 'chunks…')
ok(unreachable.length === 0, `class A — no unreachable components (router sends to misc): ${unreachable.length} found`, unreachable.slice(0, 6).join(' | '))
ok(genericSwallowed.length === 0, `class B — no generic-swallowed components: ${genericSwallowed.length} found`, genericSwallowed.slice(0, 6).join(' | '))
ok(mappedIds.size > 300, 'the scan actually saw the page map (sanity: >300 ids)')
console.log(`\nREGISTRY DOCTOR RESULT: ${PASS} pass / ${FAIL} fail`)
process.exitCode = FAIL === 0 ? 0 : 1
