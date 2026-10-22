// Full regression battery: every e2e drill on a fresh wipe, sequentially.
// Extracts the LAST "N pass(es) ... M fail" pair from each drill's output —
// drills use at least five RESULT formats, so no single RESULT regex.
import { readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const drills = readdirSync('scripts/qa')
  .filter((f) => f.endsWith('-e2e.mjs') && !f.includes('battery'))
  .map((f) => f.replace('-e2e.mjs', ''))
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

const results = [];
for (const d of drills) {
  let verdict = 'CRASH';
  let line = '';
  try {
    execSync('node /home/z/.qa/wipe.js', { stdio: 'pipe' });
    const out = execSync(`bun scripts/qa/${d}-e2e.mjs`, { stdio: 'pipe', timeout: 300_000 }).toString();
    // last "N pass(es)[,] / M fail(ed)" pair anywhere in the output
    const m = [...out.matchAll(/(\d+)\s+passes?,?\s*\/?\s*(\d+)\s+fails?/gi)].slice(-1)[0];
    if (m) {
      const [, p, f] = m;
      verdict = Number(f) === 0 ? 'OK' : 'FAIL';
      line = `${p} pass / ${f} fail`;
    } else {
      verdict = 'NO-RESULT';
      line = out.trim().split('\n').slice(-1)[0].slice(0, 100);
    }
  } catch (e) {
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    const m = [...out.matchAll(/(\d+)\s+passes?,?\s*\/?\s*(\d+)\s+fails?/gi)].slice(-1)[0];
    if (m) {
      const [, p, f] = m;
      verdict = Number(f) === 0 ? 'OK' : 'FAIL';
      line = `${p} pass / ${f} fail`;
    } else {
      line = (out.trim().split('\n').slice(-1)[0] || 'no output').slice(0, 100);
    }
  }
  results.push({ d, verdict, line });
  const icon = verdict === 'OK' ? '✅' : verdict === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${d}: ${verdict} — ${line}`);
}
const fails = results.filter((r) => r.verdict !== 'OK');
console.log(`\n=== BATTERY: ${results.length} drills, OK=${results.length - fails.length}, not-ok=${fails.length} ===`);
for (const f of fails) console.log(`  ${f.verdict} ${f.d}: ${f.line}`);
process.exit(0);
