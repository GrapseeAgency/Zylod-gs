#!/bin/bash
{
echo "=== ZOMBIE EVICT RUN $(date -u +%H:%M:%S) ==="
K="3JE5rYvuzDKdCpShBXWHk1RAEjz_dfwAxJNvszcVWxL1ieJF"
H1="Authorization: Bearer $K"
H2="Ngrok-Version: 2022-06-06"

echo "--- tunnel_sessions:"
curl -s -m 15 -H "$H1" -H "$H2" https://api.ngrok.com/tunnel_sessions > /tmp/sessions.json
head -c 1500 /tmp/sessions.json; echo

IDS=$(grep -o '"id":"[^"]*"' /tmp/sessions.json | cut -d'"' -f4)
echo "--- session ids: $IDS"

if [ -z "$IDS" ]; then
  echo "--- agent_bindings fallback:"
  curl -s -m 15 -H "$H1" -H "$H2" https://api.ngrok.com/agent_bindings > /tmp/bindings.json
  head -c 1500 /tmp/bindings.json; echo
  BIDS=$(grep -o '"id":"[^"]*"' /tmp/bindings.json | cut -d'"' -f4)
  echo "--- binding ids: $BIDS"
  for B in $BIDS; do
    echo "--- DELETE binding $B:"
    curl -s -m 15 -X DELETE -H "$H1" -H "$H2" "https://api.ngrok.com/agent_bindings/$B" | head -c 300; echo
  done
else
  for S in $IDS; do
    echo "--- DELETE session $S:"
    curl -s -m 15 -X DELETE -H "$H1" -H "$H2" "https://api.ngrok.com/tunnel_sessions/$S" | head -c 300; echo
  done
fi

sleep 5
echo "--- port check:"
echo "2000: $(curl -s -m 5 http://localhost:2000/api/app/version | head -c 200)"
echo "3000: $(curl -s -m 5 http://localhost:3000/api/app/version | head -c 200)"
V2K=$(curl -s -m 5 http://localhost:2000/api/app/version | head -c 200)
PORT=3000
case "$V2K" in *6b757f9*) PORT=2000;; esac
echo "--- chosen port: $PORT (2000 only if it serves 6b757f9, else 3000)"

echo "--- rebind:"
(setsid nohup /home/z/bin/ngrok http --url=jugular-winnings-backfield.ngrok-free.dev $PORT > /tmp/ngrok-launch3.log 2>&1 &)
sleep 14
echo "PUB: $(curl -s -m 15 https://jugular-winnings-backfield.ngrok-free.dev/api/app/version | head -c 300)"
echo "IDENTITY_COUNT: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://jugular-winnings-backfield.ngrok-free.dev/?page=home | grep -c __ZylodBundleIdentity)"
echo "PAGE_HAS_SHA: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://jugular-winnings-backfield.ngrok-free.dev/?page=home | grep -c 6b757f9)"
echo "NGROK_LOG:"; tail -5 /tmp/ngrok-launch3.log
} 2>&1 | tee /tmp/zombie-evict.log
