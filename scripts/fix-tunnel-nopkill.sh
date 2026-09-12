#!/bin/bash
{
echo "=== RUN $(date -u +%H:%M:%S) ==="
/home/z/bin/ngrok config add-authtoken 3I9UE2G7MfaZcIgSi05d0YtQZmW_2WtGpU48xjp1MsZ4hyqfx 2>&1 | tail -1
echo "old_token_refs=$(grep -c 3JDsI01f /home/z/.config/ngrok/ngrok.yml)"
(setsid nohup /home/z/bin/ngrok http --domain=jugular-winnings-backfield.ngrok-free.dev 3000 > /tmp/ngrok-launch.log 2>&1 &)
sleep 12
echo "PUB: $(curl -s -m 15 https://jugular-winnings-backfield.ngrok-free.dev/api/app/version | head -c 300)"
echo "IDENTITY_COUNT: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://jugular-winnings-backfield.ngrok-free.dev/?page=home | grep -c __ZylodBundleIdentity)"
echo "PAGE_HAS_SHA: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://jugular-winnings-backfield.ngrok-free.dev/?page=home | grep -c 6b757f9)"
echo "LOCAL: $(curl -s -m 5 http://localhost:3000/api/app/version | head -c 200)"
echo "NGROK_LOG:"
tail -5 /tmp/ngrok-launch.log
} 2>&1 | tee /tmp/tunnel-fix-10.log
