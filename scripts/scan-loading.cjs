// Scanner: finds page-level loading blocks in target dirs
const fs = require('fs');
const path = require('path');

const ROOTS = [
  'src/components/pages',
  'src/components/mobile',
  'src/components/shared',
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));

const results = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');

  // Find every animate-spin occurrence and classify by size
  lines.forEach((line, i) => {
    if (!/animate-spin/.test(line)) return;
    const sizeM = line.match(/[wh]-(5|6|7|8|9|10|12)\b/);
    const size = sizeM ? sizeM[1] : null;
    const isBorderSpinner = /rounded-full[^"]*border|border[^"]*rounded-full/.test(line);
    results.push({
      file: f,
      line: i + 1,
      size,
      isBorderSpinner,
      text: line.trim().slice(0, 160),
    });
  });

  // Find page-level skeleton blocks: {loading && ( or isLoading with Skeleton right after
  lines.forEach((line, i) => {
    if (/\{\s*(isLoading|loading|isPending)\s*&&\s*\(/.test(line)) {
      // look ahead 12 lines for Skeleton
      const window = lines.slice(i, i + 14).join('\n');
      const skelCount = (window.match(/Skeleton/g) || []).length;
      if (skelCount >= 2) {
        results.push({
          file: f,
          line: i + 1,
          size: 'SKELETON-BLOCK',
          isBorderSpinner: false,
          text: `[${skelCount} Skeleton refs in 14-line window] ${line.trim().slice(0, 120)}`,
        });
      }
    }
  });
}

// Group and print
const byFile = {};
for (const r of results) {
  (byFile[r.file] ||= []).push(r);
}
let totalBlocks = 0;
for (const [f, rs] of Object.entries(byFile)) {
  const pageLevel = rs.filter((r) => r.size && r.size !== 'SKELETON-BLOCK' && Number(r.size) >= 6);
  const skeletons = rs.filter((r) => r.size === 'SKELETON-BLOCK');
  if (pageLevel.length || skeletons.length) {
    totalBlocks += pageLevel.length + skeletons.length;
    console.log(`\n### ${f}`);
    for (const r of [...pageLevel, ...skeletons]) {
      console.log(`  L${r.line} [${r.isBorderSpinner ? 'BORDER' : r.size}] ${r.text}`);
    }
  }
}
console.log(`\n=== files with page-level candidates: ${Object.keys(byFile).length}, blocks: ${totalBlocks}`);
