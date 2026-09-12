#!/bin/bash
{
echo "=== ZOMBIE EVICT 3 RUN $(date -u +%H:%M:%S) ==="
K="3JE5rYvuzDKdCpShBXWHk1RAEjz_dfwAxJNvszcVWxL1ieJF"
AH="Authorization: Bearer $K"
VH="Ngrok-Version: 2"

echo "--- endpoints list:"
curl -s -m 15 -H "$AH" -H "$VH" "https://api.ngrok.com/endpoints" | head -c 1500; echo
EPID=$(curl -s -m 15 -H "$AH" -H "$VH" "https://api.ngrok.com/endpoints" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "--- first endpoint id: [$EPID]"
if [ -n "$EPID" ]; then
  echo "--- POST stop endpoint $EPID:"
  curl -s -m 15 -X POST -H "$AH" -H "$VH" "https://api.ngrok.com/endpoints/$EPID/stop" | head -c 400; echo
fi

echo "--- DELETE credential cr_3I9UE2G7MfaZcIgSi05d0YtQZmW (revocation disconnects zombie):"
curl -s -m 15 -X DELETE -H "$AH" -H "$VH" "https://api.ngrok.com/credentials/cr_3I9UE2G7MfaZcIgSi05d0YtQZmW" | head -c 400; echo
sleep 8

echo "--- tunnel_sessions after credential delete:"
SESS=$(curl -s -m 15 -H "$AH" -H "$VH" "https://api.ngrok.com/tunnel_sessions")
echo "$SESS" | head -c 900; echo

echo "--- create fresh credential:"
NEW=$(curl -s -m 15 -X POST -H "$AH" -H "$VH" -H "Content-Type: application/json" -d '{"description":"zylod-rebind-2026"}' "https://api.ngrok.com/credentials")
echo "$NEW" | head -c 600; echo
NTOK=$(echo "$NEW" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "--- new token present: $([ -n "$NTOK" ] && echo YES || echo NO)"
if [ -n "$NTOK" ]; then /home/z/bin/ngrok config add-authtoken "$NTOK" 2>&1 | tail -1; fi

echo "--- rebind to 3000:"
(setsid nohup /home/z/bin/ngrok http --url=jugular-winnings-backfield.ngrok-free.dev 3000 > /tmp/ngrok-launch5.log 2>&1 &)
sleep 15
echo "PUB: $(curl -s -m 15 https://jugular-winnings-backfield.ngrok-free.dev/api/app/version | head -c 300)"
echo "IDENTITY_COUNT: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://jugular-winnings-backfield.ngrok-free.dev/?page=home | grep -c __ZylodBundleIdentity)"
echo "PAGE_HAS_SHA: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://jugular-winnings-backfield.ngrok-free.dev/?page=home | grep -c 6b757f9)"
echo "NGROK_LOG:"; tail -5 /tmp/ngrok-launch5.log
} 2>&1 | tee /tmp/zombie-evict3.log
