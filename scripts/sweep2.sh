#!/bin/bash
# t182 sweep v2 — sequential DOM dark-in-light detector, correct JS quoting.
# Usage: sweep2.sh <startIdx> <endIdx> <mode: light|dark>
IDX_START=${1:-0}
IDX_END=${2:-427}
MODE=${3:-light}
PAGES=$(node -e "const a=require('/tmp/sweep-pages.json'); console.log(a.slice($IDX_START,$IDX_END+1).map(p=>p.page).join('\n'))")

# JS uses ONLY single quotes inside — no backslash escaping anywhere.
DETECTOR='(() => { const html = document.documentElement; const isDark = html.classList.contains('"'"'dark'"'"'); const mode = html.classList.contains('"'"'dark'"'"') ? '"'"'dark'"'"' : '"'"'light'"'"'; const luma = (c) => { const m = c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/); if (!m) return null; if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return null; return (0.2126*m[1]+0.7152*m[2]+0.0722*m[3])/255; }; const vw = innerWidth, vh = innerHeight; const bad = []; document.querySelectorAll('"'"'body *'"'"').forEach(el => { const r = el.getBoundingClientRect(); if (r.width < vw*0.3 || r.height < 36) return; if (r.width*r.height < vw*vh*0.05) return; const cs = getComputedStyle(el); const l = luma(cs.backgroundColor); const wantDark = MODE === '"'"'dark'"'"'; const hit = wantDark ? (l !== null && l > 0.9) : (l !== null && l < 0.2); if (hit) { const cls = (typeof el.className === '"'"'string'"'"') ? el.className.slice(0,80) : el.tagName; bad.push({t: el.tagName, c: cls, bg: cs.backgroundColor, w: Math.round(r.width), h: Math.round(r.height)}); } }); const bodyBg = getComputedStyle(document.body).backgroundColor; return JSON.stringify({mode: mode, bodyBg: bodyBg, n: bad.length, bad: bad.slice(0,5)}); })()'
# substitute MODE token into detector
DETECTOR=${DETECTOR//MODE/$MODE}

agent-browser set viewport 375 700 > /dev/null 2>&1
agent-browser eval "localStorage.setItem('theme','$MODE')" > /dev/null 2>&1

OUT=/tmp/sw2-${MODE}-$IDX_START.jsonl
> "$OUT"
i=0
for PAGE in $PAGES; do
  i=$((i+1))
  agent-browser open "http://localhost:3000/?page=$PAGE" > /dev/null 2>&1
  agent-browser wait 700 > /dev/null 2>&1
  RES=$(agent-browser eval "$DETECTOR" 2>/dev/null)
  if [ -z "$RES" ]; then RES='{"err":"empty-eval"}'; fi
  echo "{\"page\":\"$PAGE\",\"res\":$RES}" >> "$OUT"
  if [ $((i % 40)) -eq 0 ]; then echo "[$MODE/$IDX_START] progress $i / $((IDX_END-IDX_START+1))" >&2; fi
done
echo "DONE $MODE chunk $IDX_START-$IDX_END: $(wc -l < $OUT) pages" >&2
