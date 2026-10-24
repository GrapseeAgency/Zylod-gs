#!/bin/bash
# t184 RESPONSIVE sweep — DOM-level. Usage: sweep-responsive.sh <width> <height> <startIdx> <endIdx>
# Flags: (1) page horizontal overflow, (2) visible elements clipped past right edge (not in legit scrollers),
# (3) interactive touch targets < 28px.
W=${1:-320}; H=${2:-600}; IDX_START=${3:-0}; IDX_END=${4:-427}
PAGES=$(node -e "const a=require('/tmp/sweep-pages.json'); console.log(a.slice($IDX_START,$IDX_END+1).map(p=>p.page).join('\n'))")

DETECTOR="(() => {
  const vw = innerWidth, vh = innerHeight;
  const de = document.documentElement;
  const overflowX = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0) - vw;
  const inScroller = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body && p !== de) {
      const cs = getComputedStyle(p);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 2) return true;
      p = p.parentElement;
    }
    return false;
  };
  const culprits = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 4) return;
    if (r.right <= vw + 2) return;
    if (r.left >= vw * 2) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
    if (inScroller(el)) return;
    const cls = (typeof el.className === 'string') ? el.className.slice(0,90) : String(el.tagName);
    culprits.push({t: el.tagName, c: cls, w: Math.round(r.width), right: Math.round(r.right), x: Math.round(r.left)});
  });
  culprits.sort((a,b) => b.w - a.w);
  const seen = new Set(); const dedup = [];
  for (const c of culprits) { const k = c.t + '|' + c.c; if (!seen.has(k)) { seen.add(k); dedup.push(c); } if (dedup.length >= 6) break; }
  const small = [];
  const sel = 'button, a[href], [role=\"button\"], select, input:not([type=hidden]), textarea, label[data-tap]';
  document.querySelectorAll(sel).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (r.bottom < 0 || r.top > vh) return;
    if (el.tagName === 'A' && cs.display === 'inline') return;
    if (el.tagName === 'INPUT' && (cs.opacity === '0' || el.type === 'checkbox' || el.type === 'radio')) {
      if (cs.position === 'absolute') return;
    }
    if (r.height < 28 || r.width < 28) {
      const cls = (typeof el.className === 'string') ? el.className.slice(0,60) : String(el.tagName);
      small.push({t: el.tagName, c: cls, w: Math.round(r.width), h: Math.round(r.height)});
    }
  });
  const smallSeen = new Set(); const smallDedup = [];
  for (const s of small) { const k = s.t + '|' + s.c; if (!smallSeen.has(k)) { smallSeen.add(k); smallDedup.push(s); } if (smallDedup.length >= 5) break; }
  return JSON.stringify({vw, ovX: Math.round(overflowX), nc: dedup.length, culprits: dedup, ns: smallDedup.length, small: smallDedup});
})()"

agent-browser set viewport $W $H > /dev/null 2>&1
OUT=/tmp/resp-${W}-$IDX_START.jsonl
> "$OUT"
i=0
for PAGE in $PAGES; do
  i=$((i+1))
  agent-browser open "http://localhost:3000/?page=$PAGE" > /dev/null 2>&1
  agent-browser wait 1500 > /dev/null 2>&1
  RES=$(agent-browser eval "$DETECTOR" 2>/dev/null | tail -1)
  if [ -z "$RES" ]; then RES='{"err":"empty"}'; fi
  echo "{\"page\":\"$PAGE\",\"res\":$RES}" >> "$OUT"
  if [ $((i % 40)) -eq 0 ]; then echo "[$W px] progress $i / $((IDX_END-IDX_START+1))" >&2; fi
done
echo "DONE ${W}px chunk $IDX_START-$IDX_END: $(wc -l < $OUT) pages, FAILURES: $(node -e "
const fs=require('fs');const lines=fs.readFileSync('$OUT','utf8').trim().split('\n').filter(Boolean);
let f=0;for(const l of lines){try{const o=JSON.parse(l);const r=o.res;if(r.err||r.ovX>1||r.nc>0)f++;}catch(e){}}
console.log(f);")" >&2