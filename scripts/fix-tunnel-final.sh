#!/bin/bash
cd /home/z/my-project || exit 1
git reset -q 6b757f9
echo "HEAD=$(git rev-parse --short HEAD)"
/home/z/bin/ngrok config add-authtoken 3JDsI01f0d3qtcqowUk0fOpWeEv_2E52NLmPc9sVnxb2DLXrc 2>&1 | tail -1
pkill -f ngrok 2>/dev/null; sleep 2
pkill -f "next dev" 2>/dev/null; pkill -f "bun run dev" 2>/dev/null; sleep 3
(setsid nohup bun run dev > /home/z/my-project/dev.log 2>&1 &)
V=""
for i in $(seq 1 60); do
  sleep 2
  V=$(curl -s -m 5 http://localhost:3000/api/app/version 2>/dev/null)
  if echo "$V" | grep -q "6b757f9"; then echo "LOCAL_OK after ${i}x2s"; break; fi
done
echo "LOCAL: $(echo "$V" | head -c 300)"
(setsid nohup /home/z/bin/ngrok http --domain=jugular-winnings-backfield.ngrok-free.dev 3000 > /tmp/ngrok-launch.log 2>&1 &)
sleep 12
echo "PUB: $(curl -s -m 15 https://jugular-winnings-backfield.ngrok-free.dev/api/app/version | head -c 300)"
echo "IDENTITY_COUNT: $(curl -s -m 20 -A 'ZylodAndroidNative/2.4.5' -H 'ngrok-skip-browser-warning: 1' 'https://jugular-winnings-backfield.ngrok-free.dev/?page=home' | grep -c __ZylodBundleIdentity)"
echo "NGROK_LOG:"; tail -5 /tmp/ngrok-launch.log
