// Wire the three straggler alert item handlers (t151 wired POSTs; items left bare).
import { readFileSync, writeFileSync } from 'node:fs';

const JOBS = [
  ['src/app/api/price-alerts/[id]/route.ts', 'PATCH', 'price-alerts-item-write', 20],
  ['src/app/api/price-alerts/[id]/route.ts', 'DELETE', 'price-alerts-item-write', 20],
  ['src/app/api/stock-alerts/[id]/route.ts', 'DELETE', 'stock-alerts-item-write', 20],
];

for (const [file, method, bucket, limit] of JOBS) {
  let src = readFileSync(file, 'utf8');
  const re = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`);
  const m = src.match(re);
  if (!m) { console.log('SKIP no handler', file, method); continue; }
  const start = m.index;
  const next = src.indexOf('\nexport ', start + 10);
  const spanEnd = next === -1 ? src.length : next;
  const span = src.slice(start, spanEnd);
  if (span.includes('checkRateLimit')) { console.log('ALREADY', file, method); continue; }
  const authRe = /const\s+\w+\s*=\s*await\s+(?:authenticateRequest|requireUserType)\(/g;
  const am = authRe.exec(span);
  if (!am) { console.log('NO AUTH SHAPE', file, method); continue; }
  const constLineEnd = span.indexOf('\n', am.index);
  const ifPos = span.indexOf('if (', constLineEnd);
  let i = span.indexOf('{', ifPos), depth = 0, end = -1;
  for (; i < span.length; i++) {
    if (span[i] === '{') depth++;
    else if (span[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end === -1) { console.log('NO BLOCK END', file, method); continue; }
  const nl = span.indexOf('\n', end);
  const nextLine = span.slice(nl + 1);
  const ind = (nextLine.match(/^(\s*)\S/) || ['', '  '])[1];
  const gate = `\n${ind}const rl = checkRateLimit(request, '${bucket}', ${limit}, 60_000)\n${ind}if (!rl.ok) return rateLimitResponse(rl)`;
  let out = src.slice(0, start) + span.slice(0, end) + gate + span.slice(end) + src.slice(spanEnd);
  if (!/from '@\/lib\/rate-limit'/.test(out)) {
    const imports = [...out.matchAll(/^import[^;]+;?$/gm)];
    const last = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : 0;
    out = out.slice(0, last) + `\nimport { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'` + out.slice(last);
  }
  writeFileSync(file, out);
  console.log('WIRED', file, method, bucket);
}
