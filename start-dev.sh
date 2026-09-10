#!/bin/bash
export PATH="/home/z/my-project/node_modules/.bin:$PATH"
export NODE_OPTIONS="--max-old-space-size=2048"
cd /home/z/my-project
rm -rf .next
while true; do
  next dev -p 3000 -H 0.0.0.0 >> dev.log 2>&1
  echo "[RESTART] $(date)" >> dev.log
  sleep 3
done
