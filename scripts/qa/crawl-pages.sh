#!/usr/bin/env bash
# Page crawl audit: not-found / error boundary / horizontal overflow at current viewport.
# Usage: BASE=http://21.0.2.200:3000 bash scripts/qa/crawl-pages.sh <out-file> <page-id> [page-id...]
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
  const notFound = /Page not found/i.test(t)
  const errBoundary = /Something went wrong/i.test(t)
  const errorText = /Failed to load:/i.test(t)
  const sw = document.documentElement ? document.documentElement.scrollWidth : 0
  const iw = window.innerWidth
  const overflow = sw > iw + 2
  const overflowers = overflow
    ? Array.from(document.querySelectorAll('*')).filter(function(el){ return el.getBoundingClientRect().right > iw + 8 && el.offsetParent !== null }).slice(0, 4).map(function(el){ return el.tagName + '.' + String(el.className).split(' ').slice(0,3).join('.') + '|r=' + Math.round(el.getBoundingClientRect().right) })
    : []
  const lines = t.split('\n').filter(function(x){ return x.trim() })
  const head = lines.slice(0, 3).join(' | ').slice(0, 110)
  const skeletonOnly = t.trim().length < 40 && !!document.querySelector('[data-slot=skeleton], .animate-pulse')
  return JSON.stringify({ p: '$PAGE', sw: sw, iw: iw, notFound: notFound, errBoundary: errBoundary, errorText: errorText, skeletonOnly: skeletonOnly, overflow: overflow, overflowers: overflowers, head: head })
})()
" 2>&1)
  RES=$(printf '%s' "$RAW" | grep -o '{.*}' | head -1)
  [ -z "$RES" ] && RES="{\"p\":\"$PAGE\",\"BROWSER_FAIL\":true,\"raw\":\"$(printf '%s' "$RAW" | head -c 80)\"}"
  echo "$RES" >> "$OUT"
  echo "$RES" | head -c 240; echo ""
done
echo "DONE $(grep -c . "$OUT") pages" >> "$OUT"
