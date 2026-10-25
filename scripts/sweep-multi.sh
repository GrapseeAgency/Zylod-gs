#!/usr/bin/env bash
# t187 multi-pass sweep driver — runs the resumable sweep repeatedly until a
# full clean pass completes or MAX_PASSES is reached. Between passes it purges
# failed entries (open-failed / empty body) + their screenshots so they retry.
set -u
MAX_PASSES="${1:-6}"
OUT=/home/z/my-project/qa-screenshots
REPORT=/home/z/my-project/qa-screenshots/report.jsonl

for pass in $(seq 1 "$MAX_PASSES"); do
  # Purge failed pages so they retry this pass
  python3 - "$REPORT" "$OUT" <<'PYEOF'
import json, os, sys
report, out = sys.argv[1], sys.argv[2]
if not os.path.exists(report): sys.exit(0)
kept_lines = []
retry_pages = set()
with open(report, encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line: continue
        try: d = json.loads(line)
        except Exception: continue
        body = d.get('body') or {}
        failed = ('error' in d) or body.get('parse_error') or (len(body.get('t','')) < 40)
        if failed:
            retry_pages.add(d.get('page'))
        else:
            kept_lines.append(line)
with open(report, 'w', encoding='utf-8') as f:
    f.write('\n'.join(kept_lines) + ('\n' if kept_lines else ''))
for p in retry_pages:
    if p:
        try: os.remove(os.path.join(out, p + '.png'))
        except OSError: pass
print(f"pass {sys.argv[0]}: retrying {len(retry_pages)} failed pages")
PYEOF

  good=$(grep -c '"t"' "$REPORT" 2>/dev/null || echo 0)
  echo "=== PASS $pass starting (good so far: $good) ==="
  bash /home/z/my-project/scripts/sweep-all-pages.sh

  total=$(wc -l < "$REPORT")
  failed=$(python3 -c "
import json,sys
n=0
for line in open('$REPORT', encoding='utf-8'):
    try: d=json.loads(line)
    except Exception: n+=1; continue
    b=d.get('body') or {}
    if ('error' in d) or b.get('parse_error') or len(b.get('t',''))<40: n+=1
print(n)")
  echo "=== PASS $pass done: total=$total failed=$failed ==="
  if [ "$failed" = "0" ] && [ "$total" -ge 700 ]; then
    echo "SWEEP CLEAN — stopping"
    break
  fi
done
echo "MULTI-PASS SWEEP DONE"
