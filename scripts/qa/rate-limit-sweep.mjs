// Rate-limit coverage sweep: enumerate every mutating handler (POST/PATCH/PUT/DELETE)
// in src/app/api/**/route.ts and report whether checkRateLimit appears INSIDE that
// handler's span (per-handler check — t151 proved per-file checks hide mis-wires).
// Usage: bun scripts/qa/rate-limit-sweep.mjs [--list-uncovered]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'src/app/api';
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (e === 'route.ts') out.push(p);
  }
  return out;
}

// Find the body span of each exported handler: from `export async function NAME`
// (or const NAME = async) to the next `export ` at the same level or EOF.
function handlerSpans(src) {
  const spans = [];
  const re = /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const start = m.index;
    // body ends at the next top-level `export ` after this one, or EOF
    const next = src.indexOf('\nexport ', start + 10);
    const end = next === -1 ? src.length : next;
    spans.push({ method: m[1], body: src.slice(start, end) });
  }
  return spans;
}

const files = walk(ROOT).sort();
let totalMut = 0, covered = 0;
const uncovered = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const route = '/' + relative(ROOT, f).replace(/\/route\.ts$/, '').replace(/\((.*?)\)/g, '');
  for (const h of handlerSpans(src)) {
    if (!MUTATING.has(h.method)) continue;
    totalMut++;
    // gate call-site check: `checkRateLimit(` only matches an actual call —
    // an import line (checkRateLimit,) must never mask a bare handler
    // (t152: a bottom-placed import made a gateless DELETE look covered).
    const has = h.body.includes('checkRateLimit(');
    if (has) covered++;
    else uncovered.push(`${route} ${h.method}`);
  }
}
console.log(`mutating handlers: ${totalMut}, covered: ${covered}, UNCOVERED: ${uncovered.length}`);
if (process.argv.includes('--list-uncovered') || uncovered.length <= 200) {
  for (const u of uncovered) console.log(u);
}
