#!/bin/bash
{
echo "=== PROBE + WATCH RUN $(date -u +%H:%M:%S) ==="
echo "ZYLOD: $(curl -s -m 12 https://zylod.com/api/app/version | head -c 300)"
echo "ZYLOD_PAGE_IDCNT: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://zylod.com/?page=home | grep -c __ZylodBundleIdentity)"
echo "ZYLOD_HEADERS: $(curl -sI -m 12 https://zylod.com | head -6 | tr '\n' ' ')"
echo "LOCAL: $(curl -s -m 5 http://localhost:3000/api/app/version | head -c 160)"
pgrep -x ngrok >/dev/null 2>&1 && echo "NGROK_PROC: running" || echo "NGROK_PROC: none"
if ! pgrep -f "ngrok-watchdog.sh" >/dev/null 2>&1; then
  (setsid nohup bash /home/z/my-project/scripts/ngrok-watchdog.sh > /dev/null 2>&1 &)
  sleep 2
  pgrep -f "ngrok-watchdog.sh" >/dev/null 2>&1 && echo "WATCHDOG: started" || echo "WATCHDOG: FAILED TO START"
else
  echo "WATCHDOG: already running"
fi
} 2>&1 | tee /tmp/probe-watch.log
