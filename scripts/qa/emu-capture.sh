#!/usr/bin/env bash
# t187 emulator capture sequence — everything the workflow's line-by-line sh
# cannot do (functions, if-blocks, retries). Runs on the CI emulator with adb
# in PATH and PRODUCT_ID in env. Never fatal: warnings instead of failures.
set -u
mkdir -p screenshots

log () { echo "── $1 ──"; }

# Resilient screencap: swiftshader occasionally throws transient
# "Failed to find ColorBuffer" — retry up to 4x, never fatal.
cap () {
  local f="$1"
  local try
  for try in 1 2 3 4; do
    if adb exec-out screencap -p > "$f" 2>/dev/null && [ -s "$f" ]; then
      echo "captured $f (try $try)"
      return 0
    fi
    sleep 2
  done
  echo "::warning::screencap failed for $f after 4 tries"
  return 0
}

# Resilient tap by visible text via uiautomator dump.
tap_text () {
  local text="$1"
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || true
  adb pull /sdcard/ui.xml ui.xml > /dev/null 2>&1 || true
  local bounds
  bounds=$(python3 scripts/qa/uia-tap-center.py "$text" ui.xml)
  if [ -n "$bounds" ]; then
    adb shell input tap $bounds && echo "tapped '$text' at $bounds"
  else
    echo "::warning::text '$text' not found on screen"
  fi
}

log "Installing APK"
adb install -r android/app/build/outputs/apk/debug/app-debug.apk || echo "::warning::apk install failed"

log "Launching app (Welcome gate)"
adb shell monkey -p com.zylod.wholesale.debug -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1 || true
sleep 12
cap screenshots/01-welcome.png

# Pass the onboarding gate (deep links are deferred until the gate is seen):
# slide 1 -> "Next" -> slide 2 -> "Next" -> slide 3.
tap_text "Next"
sleep 3
tap_text "Next"
sleep 3
cap screenshots/01b-welcome-last-slide.png

# "Get Started" completes onboarding and lands in the main app (WebView home
# loads the real SPA from the runner's server at 10.0.2.2:3000).
tap_text "Get Started"
sleep 18
cap screenshots/02-home.png

log "Native Login screen via the UI path (guest policy: unauthenticated Profile tab -> native login)"
# RouteOwnership guest policy: an UNAUTHENTICATED Profile request opens the
# native login screen. The zylod://login deep link routes login to the native
# auth suite only in some flows — tapping the Profile tab is the real user
# path, so capture THAT.
tap_text "Profile"
sleep 8
cap screenshots/03-login.png

log "Open Continue-with-Email dialog (tap by UI text)"
tap_text "Continue with Email"
sleep 5
cap screenshots/04-email-signin-dialog.png

log "Dismiss dialog, capture Register buyer"
adb shell input keyevent 4 || true
sleep 3
adb shell am start -a android.intent.action.VIEW -d "zylod://register-buyer" com.zylod.wholesale.debug > /dev/null 2>&1 || true
sleep 8
cap screenshots/05-register-buyer.png

log "Native PDP with a REAL seeded product"
if [ -n "${PRODUCT_ID:-}" ]; then
  adb shell am start -a android.intent.action.VIEW -d "zylod://product/$PRODUCT_ID" com.zylod.wholesale.debug > /dev/null 2>&1 || true
  sleep 15
  cap screenshots/06-product-detail.png
else
  echo "::warning::No product id — PDP screenshot skipped"
fi

log "Native Cart"
adb shell am start -a android.intent.action.VIEW -d "zylod://cart" com.zylod.wholesale.debug > /dev/null 2>&1 || true
sleep 8
cap screenshots/07-cart.png

log "Screen inventory"
ls -la screenshots/ || true

# Provenance diagnostics — WebProvenance logs every gate decision under
# ZylodProvenance; full logcat covers WebView console + network too.
adb logcat -d -s ZylodProvenance > screenshots/provenance.log 2>/dev/null || true
adb logcat -d > screenshots/logcat-full.txt 2>/dev/null || true
echo "--- provenance log ---"
cat screenshots/provenance.log 2>/dev/null | tail -30 || true
