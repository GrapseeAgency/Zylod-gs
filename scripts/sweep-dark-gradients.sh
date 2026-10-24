#!/bin/bash
# t182 sweep pass 2 — gradient-aware dark-in-light detector.
# Catches linear-gradient backgrounds whose stops are ALL dark (no light stop),
# rendering a dark hero/block in light mode.
IDX_START=${1:-0}
IDX_END=${2:-427}
PAGES=$(node -e "const a=require('/tmp/sweep-pages.json'); console.log(a.slice($IDX_START,$IDX_END+1).map(p=>p.page).join('\n'))")

DETECTOR='(() => { const html = document.documentElement; if (html.classList.contains(\"dark\")) return JSON.stringify({skip:1}); const luma = (c) => { const m = c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/); if (!m) return null; if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return null; return (0.2126*m[1]+0.7152*m[2]+0.0722*m[3])/255; }; const vw = innerWidth, vh = innerHeight; const bad = []; document.querySelectorAll(\"body *\").forEach(el => { const r = el.getBoundingClientRect(); if (r.width < vw*0.3 || r.height < 48) return; if (r.width*r.height < vw*vh*0.08) return; const cs = getComputedStyle(el); const bi = cs.backgroundImage; if (!bi || bi === \"none\" || bi.indexOf(\"gradient\") === -1) return; const stops = [...bi.matchAll(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/g)].map(m => { if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return null; return (0.2126*+m[1]+0.7152*+m[2]+0.0722*+m[3])/255; }).filter(s => s !== null); if (stops.length >= 2 && stops.every(s => s < 0.22)) { const cls = (typeof el.className === \"string\") ? el.className.slice(0,80) : el.tagName; bad.push({t: el.tagName, c: cls, bi: bi.slice(0,110), w: Math.round(r.width), h: Math.round(r.height)}); } }); return JSON.stringify({n: bad.length, bad: bad.slice(0,4)}); })()'

agent-browser set viewport 375 700 > /dev/null 2>&1
agent-browser eval "localStorage.setItem('theme','light')" > /dev/null 2>&1

OUT=/tmp/sweep-grad-$IDX_START.jsonl
> "$OUT"
i=0
for PAGE in $PAGES; do
  i=$((i+1))
  agent-browser open "http://localhost:3000/?page=$PAGE" > /dev/null 2>&1
  agent-browser wait 600 > /dev/null 2>&1
  RES=$(agent-browser eval "$DETECTOR" 2>/dev/null)
  echo "{\"page\":\"$PAGE\",\"res\":$RES}" >> "$OUT"
  if [ $((i % 25)) -eq 0 ]; then echo "[$IDX_START] grad-progress $i / $((IDX_END-IDX_START+1))" >&2; fi
done
echo "DONE grad chunk $IDX_START-$IDX_END: $(wc -l < $OUT) pages" >&2
