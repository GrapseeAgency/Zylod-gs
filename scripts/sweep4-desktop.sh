#!/bin/bash
# t182 pass 4 — desktop width (1280px) mobile-chrome leak check.
# At desktop width, mobile headers (md:hidden) must be display:none.
# Detects: any element whose class contains md:hidden but is still VISIBLE (w>600 or h>40).
IDX_START=${1:-0}
IDX_END=${2:-427}
MODE=${3:-light}
PAGES=$(node -e "const a=require('/tmp/sweep-pages.json'); console.log(a.slice($IDX_START,$IDX_END+1).map(p=>p.page).join('\n'))")

DETECTOR="(() => {
  const vw = innerWidth;
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const cls = typeof el.className === 'string' ? el.className : '';
    if (!cls) return;
    const hasMobileOnly = /(^|\s)(md:hidden|lg:hidden|xl:hidden)(\s|$)/.test(cls) || /md:hidden/.test(cls);
    if (!hasMobileOnly) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.height > 30 && r.width > 100) {
      bad.push({t: el.tagName, c: cls.slice(0,90), h: Math.round(r.height), w: Math.round(r.width)});
    }
  });
  return JSON.stringify({vw: vw, n: bad.length, bad: bad.slice(0,4)});
})()"

agent-browser set viewport 1280 800 > /dev/null 2>&1
agent-browser eval "localStorage.setItem('theme','$MODE')" > /dev/null 2>&1

OUT=/tmp/sw4-desktop-$IDX_START.jsonl
> "$OUT"
i=0
for PAGE in $PAGES; do
  i=$((i+1))
  agent-browser open "http://localhost:3000/?page=$PAGE" > /dev/null 2>&1
  agent-browser wait 700 > /dev/null 2>&1
  RES=$(agent-browser eval "$DETECTOR" 2>/dev/null)
  if [ -z "$RES" ]; then RES='{"err":"empty-eval"}'; fi
  echo "{\"page\":\"$PAGE\",\"res\":$RES}" >> "$OUT"
  if [ $((i % 40)) -eq 0 ]; then echo "[desktop/$IDX_START] progress $i / $((IDX_END-IDX_START+1))" >&2; fi
done
echo "DONE desktop chunk $IDX_START-$IDX_END: $(wc -l < $OUT) pages" >&2
