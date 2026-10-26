#!/usr/bin/env bash
# Dark-mode blue-hue scan across key pages + overlay check.
BASE="${BASE:-http://21.0.2.200:3000}"
OUT="$1"; shift
PAGES=("$@")
: > "$OUT"
for PAGE in "${PAGES[@]}"; do
  agent-browser open "$BASE/?page=$PAGE" > /dev/null 2>&1
  sleep 3.2
  RAW=$(agent-browser eval "
(() => {
  const isDark = document.documentElement.classList.contains('dark')
  const scan = []
  const els = document.querySelectorAll('*')
  for (const el of els) {
    if (scan.length >= 5) break
    const s = getComputedStyle(el)
    const bg = s.backgroundColor
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (m) {
      const r = +m[1], g = +m[2], b = +m[3]
      if (b > r + 30 && b > g + 15 && s.opacity !== '0' && el.getBoundingClientRect().width > 40 && el.getBoundingClientRect().height > 12) {
        scan.push(el.tagName + '.' + String(el.className).split(' ').slice(0,2).join('.') + ' bg=' + bg)
      }
    }
  }
  return JSON.stringify({ p: '$PAGE', isDark: isDark, blueHits: scan })
})()
" 2>&1)
  RES=$(printf '%s' "$RAW" | grep -o '{.*}' | head -1)
  [ -z "$RES" ] && RES="{\"p\":\"$PAGE\",\"BROWSER_FAIL\":true}"
  echo "$RES" >> "$OUT"
  echo "$RES" | head -c 240; echo ""
done
echo "DONE $(grep -c . "$OUT") pages" >> "$OUT"
