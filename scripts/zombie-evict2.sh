#!/bin/bash
{
echo "=== ZOMBIE EVICT 2 RUN $(date -u +%H:%M:%S) ==="
K="3JE5rYvuzDKdCpShBXWHk1RAEjz_dfwAxJNvszcVWxL1ieJF"
try_list() {
  curl -s -m 15 -H "Authorization: Bearer $K" $1 https://api.ngrok.com/tunnel_sessions
}
echo "--- try no version header:"
R=$(try_list ""); echo "$R" | head -c 1500; echo
if echo "$R" | grep -q '"err'; then
  echo "--- try Ngrok-Version: 2:"
  R=$(try_list "-H 'Ngrok-Version: 2'")
  R=$(curl -s -m 15 -H "Authorization: Bearer $K" -H "Ngrok-Version: 2" https://api.ngrok.com/tunnel_sessions)
  echo "$R" | head -c 1500; echo
fi
echo "$R" > /tmp/sessions2.json
IDS=$(grep -o '"id":"[^"]*"' /tmp/sessions2.json | cut -d'"' -f4)
echo "--- session ids: $IDS"
for S in $IDS; do
  echo "--- DELETE session $S:"
  curl -s -m 15 -X DELETE -H "Authorization: Bearer $K" -H "Ngrok-Version: 2" "https://api.ngrok.com/tunnel_sessions/$S" | head -c 300; echo
  curl -s -m 15 -X DELETE -H "Authorization: Bearer $K" "https://api.ngrok.com/tunnel_sessions/$S" | head -c 300; echo
done
sleep 6
echo "--- rebind to 3000:"
(setsid nohup /home/z/bin/ngrok http --url=jugular-winnings-backfield.ngrok-free.dev 3000 > /tmp/ngrok-launch4.log 2>&1 &)
sleep 15
echo "PUB: $(curl -s -m 15 https://jugular-winnings-backfield.ngrok-free.dev/api/app/version | head -c 300)"
echo "IDENTITY_COUNT: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://jugular-winnings-backfield.ngrok-free.dev/?page=home | grep -c __ZylodBundleIdentity)"
echo "PAGE_HAS_SHA: $(curl -s -m 20 -A ZylodAndroidNative/2.4.5 -H ngrok-skip-browser-warning:1 https://jugular-winnings-backfield.ngrok-free.dev/?page=home | grep -c 6b757f9)"
echo "NGROK_LOG:"; tail -5 /tmp/ngrok-launch4.log
} 2>&1 | tee /tmp/zombie-evict2.log
