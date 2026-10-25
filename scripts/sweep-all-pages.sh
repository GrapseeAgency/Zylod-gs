#!/usr/bin/env bash
# t187 FULL-PAGE SWEEP v2 — RESUMABLE.
# Loops every registered page id, screenshots it, extracts DOM text, flags
# mock-data patterns / stuck PageLoader / open-failures.
# Resumable: skips pages that already have BOTH a screenshot and a report line,
# so an OOM-killed server mid-sweep only costs the pages in flight.
# Target: the FUSE-free mirror dev server (work copy) on port 3007.

set -u
OUT=/home/z/my-project/qa-screenshots
REPORT=/home/z/my-project/qa-screenshots/report.jsonl
BASE="${SWEEP_BASE:-http://localhost:3007}"
mkdir -p "$OUT"
touch "$REPORT"

PAGES=/tmp/all-pages.txt
TOTAL=$(wc -l < "$PAGES")
i=0

while IFS= read -r page; do
  i=$((i+1))
  [ -z "$page" ] && continue

  shot="${OUT}/${page}.png"
  # RESUME: skip if both artifacts exist
  if [ -s "$shot" ] && grep -q "\"page\":\"$page\"" "$REPORT" 2>/dev/null; then
    continue
  fi

  url="${BASE}/?page=${page}"

  if ! agent-browser open "$url" > /tmp/ab-open.txt 2>&1; then
    printf '{"page":"%s","error":"open-failed"}\n' "$page" >> "$REPORT"
    continue
  fi

  sleep 3

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

  agent-browser screenshot "$shot" > /dev/null 2>&1 || true

  printf '{"page":"%s","body":%s}\n' "$page" "$body" >> "$REPORT"

  if [ $((i % 50)) -eq 0 ]; then
    echo "[$(date +%H:%M:%S)] $i/$TOTAL processed (last: $page)"
  fi
done < "$PAGES"

echo "SWEEP COMPLETE: $i pages processed"
