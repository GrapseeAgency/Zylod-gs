#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--max-old-space-size=256" npx next dev -p 3000 -H 0.0.0.0 --turbopack
  echo "Server died, restarting in 3s..."
  sleep 3
done
