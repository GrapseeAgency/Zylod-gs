#!/bin/bash
DOM="jugular-winnings-backfield.ngrok-free.dev"
LOG=/tmp/ngrok-watchdog.log
echo "=== WATCHDOG START $(date -u) ===" >> $LOG
while true; do
  TS=$(date -u +%H:%M:%S)
  if pgrep -x ngrok >/dev/null 2>&1; then
    PUB=$(curl -s -m 15 "https://$DOM/api/app/version" | head -c 300)
    if echo "$PUB" | grep -q "6b757f9"; then
      CNT=$(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 "https://$DOM/?page=home" | grep -c __ZylodBundleIdentity)
      echo "$TS SUCCESS PUB=$PUB CNT=$CNT" >> $LOG
      echo "$TS LIVE $(date -u)" > /tmp/ngrok-watchdog-status
      exit 0
    fi
    echo "$TS agent-running-but-stale: $PUB" >> $LOG
  else
    (setsid nohup /home/z/bin/ngrok http --url=$DOM 3000 > /tmp/ngrok-wd-bind.log 2>&1 &)
    sleep 15
    PUB=$(curl -s -m 15 "https://$DOM/api/app/version" | head -c 300)
    if echo "$PUB" | grep -q "6b757f9"; then
      CNT=$(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 "https://$DOM/?page=home" | grep -c __ZylodBundleIdentity)
      echo "$TS SUCCESS PUB=$PUB CNT=$CNT" >> $LOG
      echo "$TS LIVE $(date -u)" > /tmp/ngrok-watchdog-status
      exit 0
    fi
    echo "$TS bind-failed: $(tail -2 /tmp/ngrok-wd-bind.log | head -1)" >> $LOG
  fi
  sleep 300
done
