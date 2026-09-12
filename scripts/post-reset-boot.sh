#!/bin/bash
# Run AFTER sandbox reset in the NEW epoch: boot dev server + bind ngrok + verify
{
echo "=== POST-RESET BOOT $(date -u +%H:%M:%S) ==="
DOM="jugular-winnings-backfield.ngrok-free.dev"
if [ ! -x /home/z/bin/ngrok ]; then
  mkdir -p /home/z/bin
  cp /home/z/my-project/scripts/ngrok-persist/ngrok /home/z/bin/ngrok && chmod +x /home/z/bin/ngrok
fi
NG=/home/z/bin/ngrok
$NG config add-authtoken 3JE9DuR0pRycly8BrfkBBo4BU4w_2yZwDZEwYA46szMtyxKgk 2>&1 | tail -1
if ! curl -s -m 3 http://localhost:3000/api/app/version | grep -q 6b757f9; then
  git -C /home/z/my-project reset -q 6b757f9 || true; echo "HEAD pinned: $(git -C /home/z/my-project rev-parse --short HEAD)";
  cd /home/z/my-project
  (setsid nohup bun run dev > /home/z/my-project/dev.log 2>&1 &)
  for i in $(seq 1 90); do sleep 2; curl -s -m 4 http://localhost:3000/api/app/version | grep -q 6b757f9 && break; done
fi
echo "LOCAL: $(curl -s -m 5 http://localhost:3000/api/app/version | head -c 160)"
(setsid nohup $NG http --url=$DOM 3000 > /tmp/ngrok-boot.log 2>&1 &)
sleep 14
echo "PUB: $(curl -s -m 15 https://$DOM/api/app/version | head -c 300)"
echo "IDENTITY_COUNT: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://$DOM/?page=home | grep -c __ZylodBundleIdentity)"
echo "PAGE_HAS_SHA: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://$DOM/?page=home | grep -c 6b757f9)"
echo "NGROK_LOG:"; tail -5 /tmp/ngrok-boot.log
echo "BOOT DONE - LIVE iff PUB has 6b757f9+bundle and IDENTITY_COUNT>=1"
} 2>&1 | tee /home/z/my-project/scripts/post-reset-boot.log
