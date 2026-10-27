#!/bin/bash
# Task 2-b: navy/blue-dominant background scan (runtime computed styles)
IP="21.0.21.97"
EVAL='(() => {
  const hits = [];
  const seen = new Set();
  let n = 0;
  document.querySelectorAll("*").forEach(el => {
    n++;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) {
      const r = +m[1], g = +m[2], b = +m[3], a = m[4] === undefined ? 1 : +m[4];
      if (a > 0.05 && b > r + 40 && b > 100) {
        const key = bg + "|" + String(el.className).slice(0,60);
        if (!seen.has(key)) {
          seen.add(key);
          const r2 = el.getBoundingClientRect();
          hits.push({bg, cls: String(el.className).slice(0,90), tag: el.tagName, visible: r2.width > 0 && r2.height > 0});
        }
      }
    }
  });
  return JSON.stringify({elements: n, blueHits: hits.length, hits: hits.slice(0,12)});
})()'
for p in "$@"; do
  agent-browser open "http://$IP:3000/?page=$p" >/dev/null 2>&1
  agent-browser wait 2500 >/dev/null 2>&1
  echo "== $p"
  agent-browser eval "$EVAL" 2>/dev/null
  echo
done
