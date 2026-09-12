#!/usr/bin/env bash
exec > >(tee /tmp/callC.log) 2>&1
echo "=== CALL C START $(date -u +%FT%TZ) ==="
TOK="3JDsI01f0d3qtcqowUk0fOpWeEv_2E52NLmPc9sVnxb2DLXrc"
echo "--- zombie hunt ---"
docker ps 2>/dev/null | head -5 || echo "no docker"
if ! command -v ngrok >/dev/null 2>&1; then
  curl -sSL -m 120 -o /tmp/ngrok.tgz https://dl.ngrok.com/ngrok-v3-stable-linux-amd64.tgz && { tar -xzf /tmp/ngrok.tgz -C /usr/local/bin 2>/dev/null || (mkdir -p "$HOME/bin" && tar -xzf /tmp/ngrok.tgz -C "$HOME/bin"); }
fi
NG=$(command -v ngrok || echo "$HOME/bin/ngrok")
chmod +x "$NG"
"$NG" --version
"$NG" config add-authtoken "$TOK" && echo "token added"
(setsid nohup "$NG" http --domain=jugular-winnings-backfield.ngrok-free.dev 3000 > /tmp/ngrok-launch.log 2>&1 &)
sleep 7
ps aux | grep "ngrok http" | grep -v grep | head -2
tail -8 /tmp/ngrok-launch.log
echo "--- restart dev for HEAD identity ---"
pkill -f 'bun run dev'
pkill -f 'next dev'
sleep 2
cd /home/z/my-project
(nohup bun run dev > /tmp/devserver-launch.log 2>&1 & disown)
sleep 15
echo "[local version]"
curl -s -m 8 http://localhost:3000/api/app/version | head -c 220
echo
echo "[ngrok default UA]"
curl -s -m 10 https://jugular-winnings-backfield.ngrok-free.dev/api/app/version | head -c 260
echo
echo "[webview UA marker count]"
curl -s -m 10 -A "ZylodAndroidNative/2.4.5-6b757f9 (Linux; Android 13; SM-A55)" "https://jugular-winnings-backfield.ngrok-free.dev/?page=home" | grep -c "__ZylodBundleIdentity"
echo "[chrome UA + skip header marker count]"
curl -s -m 10 -A "Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120 Mobile Safari/537.36" -H "ngrok-skip-browser-warning: 1" "https://jugular-winnings-backfield.ngrok-free.dev/?page=home" | grep -c "__ZylodBundleIdentity"
echo "=== CALL C DONE ==="
