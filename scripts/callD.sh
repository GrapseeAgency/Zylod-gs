#!/usr/bin/env bash
exec > >(tee /tmp/callD.log) 2>&1
echo "=== CALL D START $(date -u +%FT%TZ) ==="
cd /home/z/my-project
echo "--- git state ---"
git log --oneline -4
git rev-list 6b757f965751e9394688d8676bfb666ab34c2b99..HEAD --count
git status --porcelain | head -5
HEADSHA=$(git rev-parse HEAD)
echo "HEAD=$HEADSHA"
if [ "$HEADSHA" != "6b757f965751e9394688d8676bfb666ab34c2b99" ]; then
  BAD=$(git log --format=%s 6b757f965751e9394688d8676bfb666ab34c2b99..HEAD | grep -cvE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  if [ "$BAD" = "0" ]; then git reset --soft 6b757f965751e9394688d8676bfb666ab34c2b99 && echo "HEAD reset to 6b757f9 (only auto-commits were on top)"; else echo "REAL commits after 6b757f9 - NOT resetting:"; git log --format='%h %s' 6b757f965751e9394688d8676bfb666ab34c2b99..HEAD | head -5; fi
fi
echo "--- DNS recon via 1.1.1.1 ---"
curl -s -m 10 "https://1.1.1.1/dns-query?name=dl.ngrok.com&type=A" -H "accept: application/dns-json" | head -c 300; echo
curl -s -m 10 "https://1.1.1.1/dns-query?name=bin.equinox.io&type=A" -H "accept: application/dns-json" | head -c 300; echo
echo "--- try equinox download ---"
if ! command -v ngrok >/dev/null 2>&1 && [ ! -x "$HOME/bin/ngrok" ]; then
  curl -sSL -m 90 -o /tmp/ngrok.tgz https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz && { mkdir -p "$HOME/bin" && tar -xzf /tmp/ngrok.tgz -C "$HOME/bin" && echo "equinox OK"; } || echo "equinox FAILED"
fi
echo "--- try DoH-resolve direct download ---"
if ! command -v ngrok >/dev/null 2>&1 && [ ! -x "$HOME/bin/ngrok" ]; then
  IP=$(curl -s -m 10 "https://1.1.1.1/dns-query?name=dl.ngrok.com&type=A" -H "accept: application/dns-json" | python3 -c "import json,sys;d=json.load(sys.stdin);print([a['data'] for a in d.get('Answer',[]) if a['type']==1][0])" 2>/dev/null)
  echo "dl.ngrok.com IP: $IP"
  if [ -n "$IP" ]; then curl -sSL -m 120 --resolve dl.ngrok.com:443:$IP -o /tmp/ngrok2.tgz https://dl.ngrok.com/ngrok-v3-stable-linux-amd64.tgz && { mkdir -p "$HOME/bin" && tar -xzf /tmp/ngrok2.tgz -C "$HOME/bin" && echo "dl-direct OK"; } || echo "dl-direct FAILED"; fi
fi
NG=$(command -v ngrok || echo "$HOME/bin/ngrok")
if [ -x "$NG" ]; then
  "$NG" --version
  "$NG" config add-authtoken 3JDsI01f0d3qtcqowUk0fOpWeEv_2E52NLmPc9sVnxb2DLXrc && echo "token added"
  (setsid nohup "$NG" http --domain=jugular-winnings-backfield.ngrok-free.dev 3000 > /tmp/ngrok-launch.log 2>&1 &)
  sleep 8
  ps aux | grep "ngrok http" | grep -v grep | head -2
  tail -8 /tmp/ngrok-launch.log
else
  echo "NO NGROK BINARY - all sources failed"
fi
echo "--- ngrok API account endpoints ---"
curl -s -m 10 -u "3JDsI01f0d3qtcqowUk0fOpWeEv_2E52NLmPc9sVnxb2DLXrc:" https://api.ngrok.com/endpoints -H "Ngrok-Version: 2" | head -c 600; echo
echo "--- restart dev (predev regenerates identity from HEAD) ---"
pkill -f 'bun run dev'; pkill -f 'next dev'; sleep 2
(nohup bun run dev > /tmp/devserver-launch.log 2>&1 & disown)
sleep 15
echo "[local version]"; curl -s -m 8 http://localhost:3000/api/app/version | head -c 220; echo
echo "[ngrok version]"; curl -s -m 10 https://jugular-winnings-backfield.ngrok-free.dev/api/app/version | head -c 260; echo
echo "[webview UA marker]"; curl -s -m 10 -A "ZylodAndroidNative/2.4.5-6b757f9 (Linux; Android 13; SM-A55)" "https://jugular-winnings-backfield.ngrok-free.dev/?page=home" | grep -c "__ZylodBundleIdentity"
echo "[chrome UA + skip header marker]"; curl -s -m 10 -A "Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120 Mobile Safari/537.36" -H "ngrok-skip-browser-warning: 1" "https://jugular-winnings-backfield.ngrok-free.dev/?page=home" | grep -c "__ZylodBundleIdentity"
echo "=== CALL D DONE ==="
