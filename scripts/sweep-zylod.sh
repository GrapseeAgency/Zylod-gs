#!/bin/bash
{
echo "=== SWEEP + ZYLOD RUN $(date -u +%H:%M:%S) ==="
K="3JE5rYvuzDKdCpShBXWHk1RAEjz_dfwAxJNvszcVWxL1ieJF"
AH="Authorization: Bearer $K"
VH="Ngrok-Version: 2"
EP="ep_3JDx60cMU193wOFRRQCU9NCSvdd"
TS="ts_3JDx606AEJwe8C4bjtiDslPvmzy"
DOM="jugular-winnings-backfield.ngrok-free.dev"
echo "--- DELETE /endpoints/$EP:"
curl -s -m 12 -X DELETE -H "$AH" -H "$VH" "https://api.ngrok.com/endpoints/$EP" | head -c 300; echo
echo "--- POST /endpoints/$EP/stop with body:"
curl -s -m 12 -X POST -H "$AH" -H "$VH" -H "Content-Type: application/json" -d '{}' "https://api.ngrok.com/endpoints/$EP/stop" | head -c 300; echo
echo "--- POST /tunnel_sessions/$TS/stop:"
curl -s -m 12 -X POST -H "$AH" -H "$VH" -H "Content-Type: application/json" -d '{}' "https://api.ngrok.com/tunnel_sessions/$TS/stop" | head -c 300; echo
echo "--- PATCH credential cr_3I9UE2G7MfaZcIgSi05d0YtQZmW:"
curl -s -m 12 -X PATCH -H "$AH" -H "$VH" -H "Content-Type: application/json" -d '{}' "https://api.ngrok.com/credentials/cr_3I9UE2G7MfaZcIgSi05d0YtQZmW" | head -c 300; echo
SESS=$(curl -s -m 12 -H "$AH" -H "$VH" "https://api.ngrok.com/tunnel_sessions")
echo "--- sessions after sweep: $(echo "$SESS" | head -c 400)"
if ! echo "$SESS" | grep -q "ts_3JDx606"; then
  echo ">>> ZOMBIE GONE - FAST BIND:"
  (setsid nohup /home/z/bin/ngrok http --url=$DOM 3000 > /tmp/ngrok-sweep-bind.log 2>&1 &)
  sleep 14
fi
echo "PUB: $(curl -s -m 15 https://$DOM/api/app/version | head -c 300)"
echo "IDENTITY_COUNT: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://$DOM/?page=home | grep -c __ZylodBundleIdentity)"
echo "PAGE_HAS_SHA: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://$DOM/?page=home | grep -c 6b757f9)"
echo "=== ZYLOD PROBE ==="
echo "ZYLOD_VERSION: $(curl -s -m 12 https://zylod.com/api/app/version | head -c 300)"
echo "ZYLOD_IDCNT: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 'https://zylod.com/?page=home' | grep -c __ZylodBundleIdentity)"
echo "ZYLOD_HEADERS: $(curl -sI -m 12 https://zylod.com | head -8 | tr '\n' '|')"
echo "ZYLOD_ROOT_SNIP: $(curl -s -m 12 https://zylod.com | head -c 400)"
echo "ZYLOD_DNS: $(getent hosts zylod.com | head -1)"
echo "DONE"
} 2>&1 | tee /tmp/sweep-zylod.log
