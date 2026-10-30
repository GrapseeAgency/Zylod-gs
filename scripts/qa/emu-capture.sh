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

# t229g: tap a BOTTOM-BAR tab by label, region-filtered to the bottom 15% of
# the screen (WebView content can never match there — the Scaffold keeps the
# tab bar zone clear). This is the deterministic way to drive the native
# bottom bar from CI.
tap_tab () {
  local text="$1"
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || true
  adb pull /sdcard/ui.xml ui.xml > /dev/null 2>&1 || true
  local bounds
  bounds=$(python3 scripts/qa/uia-tap-tab.py "$text" ui.xml)
  if [ -n "$bounds" ]; then
    adb shell input tap $bounds && echo "tapped tab '$text' at $bounds"
  else
    echo "::warning::tab '$text' not found in the bottom-bar region"
  fi
}

# t234: best-effort "is this text on screen?" probe — same uiautomator dump
# the tap helpers use, but only reports presence (exit 0) / absence (exit 1).
ui_has_text () {
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || true
  adb pull /sdcard/ui.xml ui.xml > /dev/null 2>&1 || true
  [ -n "$(python3 scripts/qa/uia-tap-center.py "$1" ui.xml 2>/dev/null)" ]
}

# t234: deep-link capture helper — fire a VIEW intent on the debug package
# (rides onNewIntent; unknown pageIds route natively via NativePageRegistry),
# let the page settle, screenshot. Never fatal: an am start failure is
# tolerated and the capture still runs.
deeplink () { # name sleep_seconds uri
  adb shell am start -a android.intent.action.VIEW -d "$3" com.zylod.wholesale.debug >/dev/null 2>&1 || true
  sleep "$2"
  cap "screenshots/$1.png"
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

log "t229g: owner-named native return flows — bottom-bar Home from web tabs + system Back"
# These capture the EXACT flows the owner reported broken ("from search or
# hot deals I cannot come back to the home page", "system back button doesn't
# work"). Each screenshot is real evidence either way: if the return were
# broken, 21/23/24 would show the previous page still painted.
tap_tab "Search"
sleep 10
cap screenshots/20-search-tab.png
tap_tab "Home"
sleep 10
cap screenshots/21-home-return-from-search.png

tap_tab "Hot Deals"
sleep 10
cap screenshots/22-hot-deals-tab.png
tap_tab "Home"
sleep 10
cap screenshots/23-home-return-from-hot-deals.png

# System BACK from a web tab → NavHost pops → home must be visible again.
tap_tab "Search"
sleep 10
adb shell input keyevent 4 || true
sleep 8
cap screenshots/24-back-from-search.png

# Footer build badge inside the native shell (web commit + APK versionName).
# t229g: the HOME feed is infinite-scroll — the footer sits below an
# ever-growing feed, so the badge is captured on a SHORT Tier-3 page instead
# (privacy-policy renders the legal doc with the footer right below it).
# Swipe coordinates are computed from the ACTUAL screen size (the previous
# hardcoded 540/1800 values were off-screen on the 320x640 default AVD).
adb shell am start -a android.intent.action.VIEW -d "zylod://privacy-policy" com.zylod.wholesale.debug > /dev/null 2>&1 || true
sleep 12
SW=$(adb shell wm size | grep -oE '[0-9]+' | head -1 | tr -d '[:space:]')
SH=$(adb shell wm size | grep -oE '[0-9]+' | tail -1 | tr -d '[:space:]')
SW=${SW:-320}; SH=${SH:-640}
CX=$((SW / 2)); Y1=$((SH * 3 / 4)); Y2=$((SH / 5))
for i in 1 2 3 4 5 6 7 8; do
  adb shell input swipe $CX $Y1 $CX $Y2 400 || true
  sleep 2
done
sleep 3
cap screenshots/25-footer-build-badge.png

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

log "Native Buyer Orders (guest state — Phase 2 ownership row)"
# Host-form link (same pattern as zylod://cart above) parses to the
# buyer-orders pageId → RouteOwnership Phase 2 row → native Orders screen;
# unauthenticated it must show the in-screen sign-in CTA (guest policy),
# never a redirect. Numbering follows the orchestrator's plan (08 reserved).
adb shell am start -a android.intent.action.VIEW -d "zylod://buyer-orders" com.zylod.wholesale.debug > /dev/null 2>&1 || true
sleep 8
cap screenshots/09-orders-guest.png

log "t234: deep-link suite (guest context) — registry pages route natively"
# Deep links drain on HOME_ROUTE, so return home first (same bottom-bar idiom
# as the 21/23 return captures). Numbers 10-19 are reserved for this suite;
# every call is non-fatal via the deeplink helper.
tap_tab "Home"
sleep 6
deeplink "10-deals" 12 "zylod://deals"
deeplink "11-search" 8 "zylod://search"
deeplink "12-seller-dashboard" 10 "zylod://seller-dashboard"
deeplink "13-wallet" 8 "zylod://wallet"
deeplink "14-notifications" 8 "zylod://notifications"
deeplink "15-admin-dashboard" 10 "zylod://admin-dashboard"
# App-Link path proof: the https host-form must resolve to the same native
# wallet page as zylod://wallet above.
deeplink "16-applink-wallet" 8 "https://zylod.com/?page=wallet"

log "t234: authenticated buyer flow (seeded credential buyer1@zylod.bd) — best effort"
# seed-marketplace.mjs registers buyer1@zylod.bd / Passw0rd!23 as a real
# buyer. Re-open the native login through the guest Profile policy and sign
# in via the email dialog (TAB = keyevent 61, ENTER = keyevent 66). Every
# step is guarded: if the dialog can't be reached, the authed captures are
# skipped and the script continues.
AUTHED=0
if ui_has_text "Profile"; then
  tap_text "Profile"
  sleep 6
  if ui_has_text "Continue with Email"; then
    tap_text "Continue with Email"
    sleep 4
    tap_text "Email" || true
    sleep 2
    adb shell input text "buyer1@zylod.bd" || true
    adb shell input keyevent 61 || true
    adb shell input text "Passw0rd!23" || true
    adb shell input keyevent 66 || true
    sleep 12
    AUTHED=1
  else
    echo "::warning::'Continue with Email' not found — authed captures skipped"
  fi
else
  echo "::warning::Profile entry not found — authed captures skipped"
fi
if [ "$AUTHED" -eq 1 ]; then
  deeplink "17-profile" 8 "zylod://profile"
  deeplink "18-orders-authed" 8 "zylod://buyer-orders"
fi

log "Screen inventory"
ls -la screenshots/ || true

# Provenance diagnostics — WebProvenance logs every gate decision under
# ZylodProvenance; full logcat covers WebView console + network too.
adb logcat -d -s ZylodProvenance > screenshots/provenance.log 2>/dev/null || true
adb logcat -d > screenshots/logcat-full.txt 2>/dev/null || true
echo "--- provenance log ---"
cat screenshots/provenance.log 2>/dev/null | tail -30 || true
