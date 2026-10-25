#!/usr/bin/env bash
# t187 watchdog — keeps the mirror dev server on 3007 alive during the sweep.
# Skips restart if the port holder is an unkillable D-state zombie (sandbox FUSE issue).
set -u
while true; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3007/api/categories 2>/dev/null)
  if [ "$CODE" != "200" ]; then
    # Is the port held by a zombie we cannot kill?
    PID=$(ss -tlnp 2>/dev/null | grep ":3007 " | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
    if [ -n "$PID" ]; then
      STATE=$(cat /proc/$PID/status 2>/dev/null | grep State | awk '{print $2}')
      if [ "$STATE" = "D" ]; then
        echo "[$(date +%H:%M:%S)] port 3007 held by unkillable D-state pid $PID — cannot restart"
      else
        kill -9 "$PID" 2>/dev/null
        sleep 2
      fi
    fi
    if ! ss -tln 2>/dev/null | grep -q ":3007 "; then
      echo "[$(date +%H:%M:%S)] restarting dev server on 3007"
      cd /home/z/work
      nohup node node_modules/next/dist/bin/next dev -p 3007 -H 0.0.0.0 >> /tmp/devwork-watchdog.log 2>&1 &
      # wait for readiness up to 90s
      for w in $(seq 1 18); do
        C=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3007/api/categories 2>/dev/null)
        [ "$C" = "200" ] && break
        sleep 5
      done
    fi
  fi
  sleep 10
done
