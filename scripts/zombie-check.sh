#!/bin/bash
{
echo "=== LOCAL ZOMBIE CHECK $(date -u +%H:%M:%S) ==="
echo "--- pgrep:"; pgrep -ax ngrok || echo NO_LOCAL_NGROK_PROCESS
echo "--- 4040 api:"; curl -s -m 5 http://localhost:4040/api/tunnels | head -c 800; echo
NAME=$(curl -s -m 5 http://localhost:4040/api/tunnels | tr ',' '\n' | grep '"name"' | head -1 | cut -d'"' -f4)
echo "--- tunnel name: [$NAME]"
if [ -n "$NAME" ]; then
  echo "--- DELETE local tunnel via ngrok local API (releases domain binding, no process killed):"
  curl -s -m 5 -X DELETE "http://localhost:4040/api/tunnels/$NAME" | head -c 400; echo
  sleep 4
  echo "--- rebind with our config:"
  (setsid nohup /home/z/bin/ngrok http --url=jugular-winnings-backfield.ngrok-free.dev 3000 > /tmp/ngrok-launch2.log 2>&1 &)
  sleep 12
  echo "PUB: $(curl -s -m 15 https://jugular-winnings-backfield.ngrok-free.dev/api/app/version | head -c 300)"
  echo "IDENTITY_COUNT: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://jugular-winnings-backfield.ngrok-free.dev/?page=home | grep -c __ZylodBundleIdentity)"
  echo "PAGE_HAS_SHA: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://jugular-winnings-backfield.ngrok-free.dev/?page=home | grep -c 6b757f9)"
  echo "NGROK_LOG:"; tail -4 /tmp/ngrok-launch2.log
else
  echo "NO_LOCAL_TUNNEL_TO_DELETE — the endpoint holder is NOT this machine (remote old-epoch agent). Owner must stop it from the ngrok dashboard (old account)."
fi
} 2>&1 | tee /tmp/zombie-check.log
