#!/bin/bash
{
echo "=== PRE-RESET PREP $(date -u +%H:%M:%S) ==="
echo "--- zombie direct probes (is old VM publicly reachable?):"
for P in 2000 3000 4040; do
  echo "port $P version: $(curl -s -m 6 http://103.42.203.204:$P/api/app/version | head -c 150)"
  echo "port $P root-code: $(curl -s -m 6 -o /dev/null -w '%{http_code}' http://103.42.203.204:$P/)"
done
echo "port 4040 tunnels api: $(curl -s -m 6 http://103.42.203.204:4040/api/tunnels | head -c 300)"
echo "--- persist ngrok artifacts into project:"
mkdir -p /home/z/my-project/scripts/ngrok-persist
cp -f /home/z/bin/ngrok /home/z/my-project/scripts/ngrok-persist/ngrok 2>/dev/null && chmod +x /home/z/my-project/scripts/ngrok-persist/ngrok && echo "binary copied OK" || echo "binary copy FAILED"
printf '%s\n' '# old-account tunnel token (owner-provided): 3I9UE2G7MfaZcIgSi05d0YtQZmW_2WtGpU48xjp1MsZ4hyqfx' '# api-minted token (cr_3JE9DuR0pRycly8BrfkBBo4BU4w): 3JE9DuR0pRycly8BrfkBBo4BU4w_2yZwDZEwYA46szMtyxKgk' '# ngrok API key (owner-provided): 3JE5rYvuzDKdCpShBXWHk1RAEjz_dfwAxJNvszcVWxL1ieJF' > /home/z/my-project/scripts/ngrok-persist/tokens.txt
echo "tokens persisted"
echo "--- local identity check:"
echo "LOCAL: $(curl -s -m 5 http://localhost:3000/api/app/version | head -c 120)"
echo "HEAD: $(git -C /home/z/my-project rev-parse --short HEAD)"
} 2>&1 | tee /tmp/pre-reset-prep.log
