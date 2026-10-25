// Normalize PageLoader import placement: move it into the leading import block.
const fs = require('fs');

const files = process.argv.slice(2);
const IMPORT_RE = /^import \{ PageLoader \} from '@\/components\/ui\/page-loader';?\s*$/m;

let fixed = 0;
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('@/components/ui/page-loader')) continue;
  // remove all existing PageLoader import lines
  const had = IMPORT_RE.test(src);
  if (!had) { console.error(`!! ${file}: PageLoader import line not found in expected form`); continue; }
  src = src.split('\n').filter((l) => !IMPORT_RE.test(l)).join('\n');

  const lines = src.split('\n');
  let i = 0;
  // skip leading directives/comments/blank
  while (i < lines.length && (/^\s*['"]use (client|server)['"]/.test(lines[i]) || /^\s*(\/\/|\/\*)/.test(lines[i]) || lines[i].trim() === '')) i++;
  // consume import statements (multi-line aware)
  let depth = 0;
  let lastImportEnd = i; // if no imports, insert here
  let j = i;
  let sawImport = false;
  while (j < lines.length) {
    const line = lines[j];
    if (depth === 0) {
      if (/^\s*import\s/.test(line)) sawImport = true;
      else if (line.trim() === '' || /^\s*(\/\/|\/\*)/.test(line)) { j++; continue; }
      else break;
    }
    for (const ch of line) {
      if (ch === '{' || ch === '(') depth++;
      else if (ch === '}' || ch === ')') depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && sawImport) lastImportEnd = j + 1;
    j++;
  }
  lines.splice(lastImportEnd, 0, "import { PageLoader } from '@/components/ui/page-loader'");
  fs.writeFileSync(file, lines.join('\n'));
  fixed++;
}
console.log(`normalized imports in ${fixed} files`);
