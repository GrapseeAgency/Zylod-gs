#!/usr/bin/env bash
# Desktop-width layout audit: overflow + mobile-bottom-nav leaking into desktop.
BASE="${BASE:-http://21.0.2.200:3000}"
OUT="$1"; shift
PAGES=("$@")
: > "$OUT"
for PAGE in "${PAGES[@]}"; do
  agent-browser open "$BASE/?page=$PAGE" > /dev/null 2>&1
  sleep 3.2
  RAW=$(agent-browser eval "
(() => {
  const t = (document.body && document.body.innerText ? document.body.innerText : '').slice(0, 3000)
  const iw = window.innerWidth
  const sw = document.documentElement ? document.documentElement.scrollWidth : 0
  const overflow = sw > iw + 2
  const overflowers = overflow
    ? Array.from(document.querySelectorAll('*')).filter(function(el){ return el.getBoundingClientRect().right > iw + 8 && el.offsetParent !== null }).slice(0, 6).map(function(el){ return el.tagName + '.' + String(el.className).split(' ').slice(0,3).join('.') + '|r=' + Math.round(el.getBoundingClientRect().right) })
    : []
  const fixedBottom = Array.from(document.querySelectorAll('*')).filter(function(el){
    if (el.offsetParent === null && el.getBoundingClientRect().width === 0) return false
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return (s.position === 'fixed' || s.position === 'sticky') && r.bottom >= window.innerHeight - 6 && r.height > 40 && r.height < 130 && r.width > window.innerWidth * 0.85
  }).map(function(el){ return el.tagName + '.' + String(el.className).slice(0,50) })
  const notFound = /Page not found/i.test(t)
  const errBoundary = /Something went wrong/i.test(t)
  const lines = t.split('\n').filter(function(x){ return x.trim() })
  const head = lines.slice(0, 3).join(' | ').slice(0, 100)
  return JSON.stringify({ p: '$PAGE', sw: sw, iw: iw, overflow: overflow, overflowers: overflowers, fixedBottom: fixedBottom, notFound: notFound, errBoundary: errBoundary, head: head })
})()
" 2>&1)
  RES=$(printf '%s' "$RAW" | grep -o '{.*}' | head -1)
  [ -z "$RES" ] && RES="{\"p\":\"$PAGE\",\"BROWSER_FAIL\":true}"
  echo "$RES" >> "$OUT"
  echo "$RES" | head -c 260; echo ""
done
echo "DONE $(grep -c . "$OUT") pages" >> "$OUT"
