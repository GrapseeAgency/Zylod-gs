#!/usr/bin/env bash
LOG=/tmp/fix-status.txt
exec >> "$LOG" 2>&1
echo "=== PHASE0 RUN $(date -u +%FT%TZ) ==="
echo "--- [1] ngrok process ---"
if ps aux | grep "ngrok http" | grep -v grep >/dev/null 2>&1; then
  echo "NGROK: running:"; ps aux | grep "ngrok http" | grep -v grep | head -2
else
  echo "NGROK: NOT running"
  if command -v ngrok >/dev/null 2>&1; then
    echo "NGROK binary found: $(command -v ngrok) — starting tunnel"
    (setsid nohup ngrok http --domain=jugular-winnings-backfield.ngrok-free.dev 3000 > /tmp/ngrok-launch.log 2>&1 &)
    sleep 5
    if ps aux | grep "ngrok http" | grep -v grep >/dev/null 2>&1; then echo "NGROK: started OK"; else echo "NGROK: FAILED TO START"; tail -8 /tmp/ngrok-launch.log; fi
  else
    echo "NGROK: NO BINARY"; ls -la /usr/local/bin/ngrok /usr/bin/ngrok /snap/bin/ngrok 2>/dev/null || true
  fi
fi
echo "--- [2] version via ngrok default UA ---"
curl -s -m 10 https://jugular-winnings-backfield.ngrok-free.dev/api/app/version | head -c 300; echo
echo "--- [3] SPA via ngrok Chrome UA first 400 ---"
curl -s -m 10 -A "Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120 Mobile Safari/537.36" "https://jugular-winnings-backfield.ngrok-free.dev/?page=home" | head -c 400; echo
echo "--- [4] SPA via ngrok Chrome UA + skip header marker count ---"
curl -s -m 10 -A "Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120 Mobile Safari/537.36" -H "ngrok-skip-browser-warning: 1" "https://jugular-winnings-backfield.ngrok-free.dev/?page=home" | grep -c "__ZylodBundleIdentity"
echo "--- [5] android webview settings ---"
rg -n "userAgentString|settings\." /home/z/my-project/android/app/src -g '*.kt' | head -40
echo "--- [6] android loadUrl sites ---"
rg -n "loadUrl\(" /home/z/my-project/android/app/src -g '*.kt' -C 5 | head -140
echo "--- [7] ios webview ---"
rg -n "WKWebView\(|customUserAgent|\.load\(" /home/z/my-project/ios/Zylod -g '*.swift' | head -30
echo "=== PHASE0 DONE ==="
