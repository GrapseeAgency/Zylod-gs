#!/bin/bash
{
echo "=== ZOMBIE EVICT 4 RUN $(date -u +%H:%M:%S) ==="
K="3JE5rYvuzDKdCpShBXWHk1RAEjz_dfwAxJNvszcVWxL1ieJF"
AH="Authorization: Bearer $K"
VH="Ngrok-Version: 2"
DOM="jugular-winnings-backfield.ngrok-free.dev"

echo "--- reserved_domains:"
RD=$(curl -s -m 15 -H "$AH" -H "$VH" "https://api.ngrok.com/reserved_domains")
echo "$RD" | head -c 1200; echo
RDID=$(echo "$RD" | tr '{' '\n' | grep "$DOM" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "--- reservation id: [$RDID]"

echo "--- try credential rotate:"
curl -s -m 15 -X POST -H "$AH" -H "$VH" "https://api.ngrok.com/credentials/cr_3I9UE2G7MfaZcIgSi05d0YtQZmW/rotate" | head -c 400; echo
sleep 6
SESS=$(curl -s -m 15 -H "$AH" -H "$VH" "https://api.ngrok.com/tunnel_sessions")
echo "$SESS" | head -c 700; echo
if echo "$SESS" | grep -q "ts_3JDx606"; then
  echo "--- zombie STILL alive after rotate -> reserved domain delete + re-add + fast bind"
  if [ -n "$RDID" ]; then
    echo "--- DELETE reservation $RDID:"
    curl -s -m 15 -X DELETE -H "$AH" -H "$VH" "https://api.ngrok.com/reserved_domains/$RDID" | head -c 400; echo
    sleep 4
    echo "--- endpoints now (expect empty):"
    curl -s -m 15 -H "$AH" -H "$VH" "https://api.ngrok.com/endpoints" | head -c 600; echo
    echo "--- RE-ADD reservation:"
    curl -s -m 15 -X POST -H "$AH" -H "$VH" -H "Content-Type: application/json" -d "{\"name\":\"$DOM\",\"description\":\"zylod main\"}" "https://api.ngrok.com/reserved_domains" | head -c 600; echo
  fi
fi

echo "--- FAST BIND to 3000:"
(setsid nohup /home/z/bin/ngrok http --url=$DOM 3000 > /tmp/ngrok-launch6.log 2>&1 &)
sleep 15
echo "PUB: $(curl -s -m 15 https://$DOM/api/app/version | head -c 300)"
echo "IDENTITY_COUNT: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://$DOM/?page=home | grep -c __ZylodBundleIdentity)"
echo "PAGE_HAS_SHA: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://$DOM/?page=home | grep -c 6b757f9)"
echo "--- sessions final:"
curl -s -m 15 -H "$AH" -H "$VH" "https://api.ngrok.com/tunnel_sessions" | head -c 900; echo
echo "NGROK_LOG:"; tail -6 /tmp/ngrok-launch6.log
} 2>&1 | tee /tmp/zombie-evict4.log
