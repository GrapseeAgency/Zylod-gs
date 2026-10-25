// Dump context around each page-level loading candidate
const fs = require('fs');
const path = require('path');

const ROOTS = ['src/components/pages', 'src/components/mobile', 'src/components/shared'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const big = /(h-8|w-8|h-7|w-7|h-6|w-6)/.test(line) && /animate-spin/.test(line);
    const border = /animate-spin/.test(line) && /rounded-full/.test(line) && /border/.test(line);
    if (big || border) {
      const ctx = lines.slice(Math.max(0, i - 3), i + 5).join('\n');
      console.log(`\n@@@ ${f}:${i + 1}\n${ctx}`);
    }
  });
}
