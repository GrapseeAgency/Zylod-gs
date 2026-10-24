const fs = require('fs');
const file = process.argv[2];
const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
let fails = [], small = [], errs = [];
for (const l of lines) {
  let o; try { o = JSON.parse(l); } catch (e) { errs.push(l.slice(0, 50)); continue; }
  let r; try { r = JSON.parse(o.res); } catch (e) { errs.push(o.page); continue; }
  if (r.err) { errs.push(o.page); continue; }
  if (r.ovX > 1) fails.push({ p: o.page, ovX: r.ovX });
  if (r.nc > 0) fails.push({ p: o.page, nc: r.nc, culprits: r.culprits });
  if (r.ns > 0) small.push({ p: o.page, small: r.small });
}
console.log('PAGES:', lines.length, '| ERR-EVAL:', errs.length, '| OVERFLOW-FAIL:', fails.length, '| SMALL-TARGET:', small.length);
errs.slice(0, 5).forEach(e => console.log('  ERR:', e));
fails.forEach(f => console.log('FAIL', JSON.stringify(f)));
small.forEach(s => console.log('SMALL', JSON.stringify(s)));
