// Codemod: replace page-level loading blocks with <PageLoader />
// Rules:
//  R1: bare centered wrapper (flex/centering/padding/gap/text-color only) + spinner (+ optional p/span text)
//      → replace WHOLE wrapper with <PageLoader /> or <PageLoader label="…" />
//  R2: wrapper carries layout context (bg/border/grid/min-h/rounded/p-*/container)
//      → keep wrapper, replace content with <PageLoader className="min-h-0" [label] />
const fs = require('fs');

const FILES = process.argv.slice(2);

function decodeEntities(s) {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function toLabel(rawText) {
  let t = decodeEntities(rawText);
  t = t.replace(/\.{3}$/, '…');
  // skip pure punctuation/empty
  if (!t || t === '…') return null;
  return t.replace(/"/g, '&quot;');
}

const ALLOWED = /^(flex|flex-col|items-center|justify-center|py-\d+(\.\d+)?|p-\d+|gap-\d+(\.\d+)?|text-\S+|dark:text-\S+|mx-auto|my-\d+)$/;
function isBare(cls) {
  return cls.trim().split(/\s+/).every((t) => ALLOWED.test(t));
}

let totalR1 = 0, totalR2 = 0;
const changed = [];

for (const file of FILES) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  const log = [];

  // Match: <div className="CLS"> SPINNER (<p|span>text</p|span>)? </div>
  // SPINNER = <Loader2 className="...animate-spin..."/> or border-circle <div className="...animate-spin..."></div>
  const re = /<div className="([^"]*)">(\s*)(?:<Loader2 className="[^"]*animate-spin[^"]*"\s*\/>|<div className="[^"]*animate-spin[^"]*"\s*><\/div>)(\s*)(?:<(p|span)([^>]*)>([^<]*)<\/\4>(\s*))?<\/div>/g;

  const DRY = process.env.DRY === '1';

  src = src.replace(re, (full, cls, sp1, sp2, tag, tagAttrs, text, sp3) => {
    const hasPad = /(py-([89]|1\d|2\d)\b|p-([89]|1\d)\b)/.test(cls);
    const hasCenter = /justify-center/.test(cls) || (/items-center/.test(cls) && /flex-col/.test(cls));
    if (!hasPad || !hasCenter) return full;
    const bare = isBare(cls);
    const label = text ? toLabel(text) : null;
    const pl = label ? `<PageLoader label="${label}" />` : '<PageLoader />';
    if (bare) {
      totalR1++;
      log.push(`R1: [${cls}] → ${pl}`);
      return pl;
    }
    totalR2++;
    log.push(`R2: kept wrapper [${cls}] → inner <PageLoader className="min-h-0" />`);
    return `<div className="${cls}">${sp1}<PageLoader className="min-h-0" />${(sp3 || sp2)}</div>`;
  });

  if (src === orig) continue;
  if (DRY) { console.log(`\n### ${file}`); for (const l of log) console.log('  ' + l); continue; }

  // Add import if missing
  if (!/from '@\/components\/ui\/page-loader'/.test(src)) {
    const importRe = /^import\s+(?:type\s+)?[^;]*;?\s*$/gm;
    let lastEnd = -1, m;
    while ((m = importRe.exec(src)) !== null) lastEnd = m.index + m[0].length;
    if (lastEnd >= 0) {
      src = src.slice(0, lastEnd) + "\nimport { PageLoader } from '@/components/ui/page-loader'" + src.slice(lastEnd);
    } else {
      console.error(`!! ${file}: no import block found`);
    }
  }

  // Remove unused Loader2 import
  const withoutImport = src.replace(/^import\s+\{[^}]*Loader2[^}]*\}\s+from\s+'lucide-react';?\s*$/gm, '');
  if (!/\bLoader2\b/.test(withoutImport)) {
    src = src.replace(/^import\s+\{([^}]*)\}\s+from\s+'lucide-react';?\s*$/gm, (full, names) => {
      const kept = names.split(',').map(s => s.trim()).filter(n => n && n !== 'Loader2');
      if (kept.length === 0) return '';
      return `import { ${kept.join(', ')} } from 'lucide-react'`;
    });
  }

  fs.writeFileSync(file, src);
  changed.push(file);
  console.log(`\n### ${file}`);
  for (const l of log) console.log('  ' + l);
}

console.log(`\n=== changed files: ${changed.length}, R1(whole): ${totalR1}, R2(kept wrapper): ${totalR2}`);
