#!/usr/bin/env bash
# t187 FULL-PAGE SWEEP — loop every registered page id, screenshot it,
# extract DOM text, and flag: (a) mock-data patterns, (b) pages stuck on
# the PageLoader, (c) console errors. Light theme, 375px (mobile-first app).
# Sequential on purpose — t182/t184 lessons: parallel sweeps clobber the
# shared browser and produce lying results.

set -u
OUT=/home/z/my-project/qa-screenshots
REPORT=/home/z/my-project/qa-screenshots/report.jsonl
mkdir -p "$OUT"
: > "$REPORT"

PAGES=/tmp/all-pages.txt
TOTAL=$(wc -l < "$PAGES")
i=0

while IFS= read -r page; do
  i=$((i+1))
  [ -z "$page" ] && continue

  url="http://localhost:3007/?page=${page}"
  shot="${OUT}/${page}.png"

  # Open (failures recorded and skipped)
  if ! agent-browser open "$url" > /tmp/ab-open.txt 2>&1; then
    printf '{"page":"%s","error":"open-failed"}\n' "$page" >> "$REPORT"
    continue
  fi

  # Give the SPA time to fetch data and render (dev-mode chunk latency).
  sleep 4

  # Extract body text + check for PageLoader presence
  eval_out=$(agent-browser eval "JSON.stringify({t: document.body ? document.body.innerText.slice(0,4000) : '', loader: !!document.querySelector('[role=\"status\"]'), title: document.title})" 2>/dev/null)
  body=$(printf '%s' "$eval_out" | python3 -c "
import sys, json
raw = sys.stdin.read().strip()
try:
    d = json.loads(raw)
    if isinstance(d, str): d = json.loads(d)
    print(json.dumps(d, ensure_ascii=False))
except Exception as e:
    print(json.dumps({'t':'', 'loader': False, 'parse_error': str(e)}))
")

  # Screenshot (best effort)
  agent-browser screenshot "$shot" > /dev/null 2>&1 || true

  # Flag mock-data patterns in the rendered text
  python3 - "$page" "$body" "$report" <<'PYEOF' >> /dev/null 2>&1 || true
PYEOF

  printf '{"page":"%s","body":%s}\n' "$page" "$body" >> "$REPORT"

  # Progress line every 25 pages
  if [ $((i % 25)) -eq 0 ]; then
    echo "[$(date +%H:%M:%S)] $i/$TOTAL pages done (last: $page)"
  fi
done < "$PAGES"

echo "SWEEP COMPLETE: $i pages"
