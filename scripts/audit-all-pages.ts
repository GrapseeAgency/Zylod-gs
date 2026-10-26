import { loadPage, getChunkForPage } from '@/lib/page-loader'
import * as chunkLoader from '@/lib/chunk-loader'
import { readFileSync } from 'fs'

const raw = readFileSync('/tmp/all-targets.txt', 'utf8').split('\n').map(s=>s.trim()).filter(Boolean)
const targets = [...new Set(raw)].sort()

const bad: string[] = []
const generic: string[] = []
for (const t of targets) {
  try {
    const r = await loadPage(t)
    if (r.component) continue
    if (r.genericType) { generic.push(`${t} -> ${r.genericType}`); continue }
    const chunk = getChunkForPage(t)
    if (!chunk) { bad.push(`${t} -> null chunk`); continue }
    const pr = await (chunkLoader as any).loadPageFromChunk(chunk, t)
    if (pr && pr.component) continue
    bad.push(`${t} -> chunk ${chunk} returned null`)
  } catch (e: any) {
    bad.push(`${t} -> threw ${String(e).slice(0,60)}`)
  }
}
console.log('TOTAL TARGETS:', targets.length)
console.log('\n=== NO COMPONENT (dead navigate targets) ===')
bad.forEach(b => console.log(b))
console.log('\n=== GENERIC PLACEHOLDER PAGES ===')
generic.forEach(g => console.log(g))
