#!/usr/bin/env bash
# t187 emulator capture sequence — everything the workflow's line-by-line sh
# cannot do (functions, if-blocks, retries). Runs on the CI emulator with adb
# in PATH and PRODUCT_ID in env. Never fatal: warnings instead of failures.
#
# t238 REWRITE — auth-first state machine. t237's run produced 21 PNGs of
# which 9 were byte-identical LOGIN screens, because:
#   1. login never happened: the authed block typed via TAB (keyevent 61),
#      but TAB does not move focus between Compose text fields, so the text
#      went nowhere and nothing was submitted;
#   2. deep links fired while NOT on HOME_ROUTE sit in ZylodRoot's pending
#      queue (it drains only on HOME_ROUTE) and flush all at once later —
#      captures showed stale screens and 06-product-detail never even fired;
#   3. 22-hot-deals-tab caught the full-screen loading spinner mid-load;
#   4. nobody noticed the duplicates (no byte-level audit).
# The flow is now: guest tab captures → guest-evidence captures (05, 09)
# BEFORE login → login_buyer() (tap the EditText centers directly, submit,
# VERIFY authed) → the gated deep-link suite 06→18, each link preceded by an
# ensure_home() guard → md5 dedup audit. Everything stays non-fatal.
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

# t238: one uiautomator dump, many needles — the ensure_home / settle polls
# need several probes per iteration and ui_has_text re-dumps per call (too
# slow). Exit 0 when ANY needle appears in a text= or content-desc= attr.
any_text_on_screen () {
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || true
  adb pull /sdcard/ui.xml ui.xml > /dev/null 2>&1 || true
  python3 - ui.xml "$@" <<'PYEOF'
import re, sys
try:
    xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
except OSError:
    sys.exit(1)
hay = "\n".join(re.findall(r'\b(?:text|content-desc)="([^"]*)"', xml))
sys.exit(0 if any(needle in hay for needle in sys.argv[2:]) else 1)
PYEOF
}

# t238: center coords of the Nth android.widget.EditText in a uiautomator
# dump (Compose OutlinedTextFields surface as EditText in the accessibility
# tree; on the native login screen 1st = email, 2nd = password). Prints "x y"
# for `adb shell input tap`, prints nothing when absent — never fatal.
edittext_center () {
  python3 - "$2" "$1" <<'PYEOF'
import re, sys
try:
    xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
except OSError:
    sys.exit(0)
idx = int(sys.argv[2])
hits = [
    ((int(m.group(1)) + int(m.group(3))) // 2, (int(m.group(2)) + int(m.group(4))) // 2)
    for m in re.finditer(
        r'<node[^>]*class="android\.widget\.EditText"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
        xml,
    )
]
if len(hits) >= idx:
    print(f"{hits[idx - 1][0]} {hits[idx - 1][1]}")
PYEOF
}

# t238: close the soft keyboard if it is showing (BACK dismisses the IME
# before it pops a route) so it cannot cover the next EditText tap.
hide_ime () {
  if adb shell dumpsys input_method 2>/dev/null | grep -q "mInputShown=true"; then
    adb shell input keyevent 4 || true
    sleep 1
  fi
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

# t238: guarantee the app sits on HOME_ROUTE before a deep link fires.
# Detection uses NATIVE text unique to HomeScreen — the home feed's own
# section titles "Hot deals" / "Featured products" (lowercase; the bar's tab
# is "Hot Deals" capital-D and the deals screen title is "Hot Deals", so
# case distinguishes them). The spec's "Products" needle was REJECTED on
# purpose: "All Products" also renders on the native search screen, which
# would false-positive ensure_home right after the 11-search capture and
# re-introduce the queue desync. Chain: already-home probe → bottom-bar Home
# tab → BACK out of a fullscreen route (login/register hide the bar) → one
# more BACK → app relaunch (recovers a BACK-exited task). Returns 1 only if
# nothing worked; callers skip the link with a warning (never fatal).
ensure_home () {
  local i
  if any_text_on_screen "Hot deals" "Featured products"; then
    return 0
  fi
  tap_tab "Home" || true
  for i in 1 2 3 4; do
    sleep 2
    any_text_on_screen "Hot deals" "Featured products" && return 0
  done
  # Fullscreen native routes (login, register-buyer, otp...) hide the bottom
  # bar entirely — BACK pops one route and the bar comes back.
  adb shell input keyevent 4 || true
  sleep 2
  tap_tab "Home" || true
  for i in 1 2 3 4; do
    sleep 2
    any_text_on_screen "Hot deals" "Featured products" && return 0
  done
  adb shell input keyevent 4 || true
  sleep 2
  tap_tab "Home" || true
  for i in 1 2 3 4; do
    sleep 2
    any_text_on_screen "Hot deals" "Featured products" && return 0
  done
  # Last resort: BACK may have exited the task to the launcher — re-launch.
  log "ensure_home: relaunching the app to recover HOME_ROUTE"
  adb shell monkey -p com.zylod.wholesale.debug -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1 || true
  sleep 8
  for i in 1 2 3 4; do
    sleep 2
    any_text_on_screen "Hot deals" "Featured products" && return 0
  done
  echo "::warning::ensure_home: HOME not detected — deep link would queue (desync risk)"
  return 1
}

# t238: deep links fired while NOT on HOME_ROUTE are queued by ZylodRoot
# (drains only on HOME_ROUTE) and flush all at once later — t237's wrong /
# byte-identical captures came from exactly that. Enforce home first; when
# home can't be reached, SKIP the link with a warning (never fatal).
guarded_deeplink () { # name sleep_seconds uri
  if ensure_home; then
    deeplink "$1" "$2" "$3"
  else
    echo "::warning::ensure_home failed — skipping '$1' capture (queue desync guard)"
  fi
}

# t238: sign in the seeded buyer (scripts/qa/seed-marketplace.mjs:
# buyer1@zylod.bd / Passw0rd!23) on the NATIVE login screen, then VERIFY the
# session. Returns 0 when auth is verified, 1 otherwise (caller continues as
# guest — never fatal).
#
# WHY NOT the "Continue with Email" dialog: SocialConsentDialog collects
# email + DISPLAY NAME and runs the social exchange — it has NO password
# field and its "Continue" button is not the credential submit. The real
# email + password + "Login" form sits directly on the main login screen
# (LoginScreen.kt). We therefore land on the login screen, dismiss the
# consent dialog if it is open, and fill the main form by TAPPING each
# EditText's center (TAB/keyevent 61 cannot move focus between Compose
# fields — that is why t237's typed text went nowhere).
login_buyer () {
  # If the consent dialog is open (04 just captured it), dismiss it.
  if ui_has_text "Sign in with your email"; then
    adb shell input keyevent 4 || true
    sleep 2
  fi
  # Field 1 = email: tap the FIRST EditText's center, then type.
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || true
  adb pull /sdcard/ui.xml /tmp/ui.xml > /dev/null 2>&1 || true
  local c1
  c1=$(edittext_center 1 /tmp/ui.xml)
  if [ -n "$c1" ]; then
    adb shell input tap $c1 || true
    sleep 2
    adb shell input text "buyer1@zylod.bd" || true
    sleep 1
    hide_ime
  else
    echo "::warning::login: no email EditText found on the login screen"
  fi
  # Field 2 = password: FRESH dump (the layout may have shifted), tap the
  # SECOND EditText's center, then type.
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || true
  adb pull /sdcard/ui.xml /tmp/ui.xml > /dev/null 2>&1 || true
  local c2
  c2=$(edittext_center 2 /tmp/ui.xml)
  if [ -n "$c2" ]; then
    adb shell input tap $c2 || true
    sleep 2
    adb shell input text "Passw0rd!23" || true
    sleep 1
    hide_ime
  else
    echo "::warning::login: no password EditText found on the login screen"
  fi
  # Submit: the native form's button is labelled "Login" (ZylodButton).
  if ui_has_text "Login"; then
    tap_text "Login"
  elif ui_has_text "Sign in"; then
    tap_text "Sign in"
  else
    echo "::warning::login: no Login/Sign-in button found on screen"
  fi
  sleep 14
  # Authed verification. Strong signals first ("Sign out" / the seeded email
  # are only visible signed-in); the fallback is the bottom bar being back —
  # a successful login lands on home via goHomeAfterAuth, while the
  # fullscreen login route NEVER shows the bar.
  local i
  for i in 1 2 3; do
    if ui_has_text "Sign out" || ui_has_text "buyer1" || { ui_has_text "Profile" && ui_has_text "Hot Deals"; }; then
      echo "login_buyer: authed ✓ (seeded buyer session verified)"
      return 0
    fi
    sleep 5
  done
  cap screenshots/04b-login-attempt.png
  echo "::warning::login_buyer: AUTH NOT VERIFIED — continuing as guest; downstream gated captures will show the login gate (acceptable, non-fatal)"
  return 1
}

log "Installing APK"
adb install -r android/app/build/outputs/apk/debug/app-debug.apk || echo "::warning::apk install failed"
# t238: keep the software IME out of the way when a hard keyboard is
# attached — `input text` injects events directly, and a hidden IME cannot
# cover the second EditText when login_buyer taps it.
adb shell settings put secure show_ime_with_hard_keyboard 0 > /dev/null 2>&1 || true

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
# t238: state.loading renders ONLY a full-screen spinner — t237's fixed 10s
# sleep caught it mid-load (11.5KB, no content). Poll up to 15s for real
# content ("Flash Deals" section / "N flash" meta / "N sold" counters).
# "Deal" is NOT a usable needle: the always-on "Hot Deals" top-bar title and
# the bottom-bar tab match it while the spinner is still up.
SETTLED=0
for i in 1 2 3 4 5; do
  sleep 3
  if any_text_on_screen "Flash" "flash" "sold"; then
    SETTLED=1
    break
  fi
done
if [ "$SETTLED" -eq 0 ]; then
  echo "::warning::hot-deals content not detected after 15s — retry tap + wait"
  tap_tab "Hot Deals" || true
  for i in 1 2 3 4 5; do
    sleep 3
    if any_text_on_screen "Flash" "flash" "sold"; then break; fi
  done
fi
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
# t238: guarded by ensure_home — this link must be fired from HOME_ROUTE or
# it queues behind whatever is pending.
if ensure_home; then
  deeplink "25-footer-build-badge-pre" 12 "zylod://privacy-policy"
else
  adb shell am start -a android.intent.action.VIEW -d "zylod://privacy-policy" com.zylod.wholesale.debug > /dev/null 2>&1 || true
  sleep 12
fi
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
tap_tab "Profile"
sleep 8
cap screenshots/03-login.png

log "Open Continue-with-Email dialog (tap by UI text)"
tap_text "Continue with Email"
sleep 5
cap screenshots/04-email-signin-dialog.png

log "t238: guest-context evidence BEFORE login — 05 register + 09 orders-guest"
# These two captures must stay GUEST (the register screen and the Phase 2
# ownership row: unauthenticated buyer-orders shows the in-screen sign-in
# CTA, never a redirect). They are deep links, so each is fired ONLY after
# ensure_home — a link fired off-home queues (ZylodRoot drains on
# HOME_ROUTE only) and that is how t237 captured wrong screens. The consent
# dialog is dismissed first (if open) so the ensure_home BACK-chain starts
# clean — BACK with no dialog would pop the login route instead.
if ui_has_text "Sign in with your email"; then
  adb shell input keyevent 4 || true
  sleep 2
fi
if ensure_home; then
  deeplink "05-register-buyer" 8 "zylod://register-buyer"
else
  echo "::warning::ensure_home failed — 05-register-buyer skipped (queue desync guard)"
fi
if ensure_home; then
  deeplink "09-orders-guest" 8 "zylod://buyer-orders"
else
  echo "::warning::ensure_home failed — 09-orders-guest skipped (queue desync guard)"
fi

log "t238: AUTH-FIRST — sign in the seeded buyer (buyer1@zylod.bd) before the gated suite"
# The gated deep-link suite below only means something signed-in (authed
# cart, orders, profile, wallet). Return home, open the native login through
# the guest Profile policy (bottom-bar tab — deterministic), then run
# login_buyer (tap EditText centers → type → Login → verify).
if ensure_home; then
  tap_tab "Profile"
  sleep 6
else
  tap_text "Profile" || true
  sleep 6
fi
AUTHED=0
if login_buyer; then
  AUTHED=1
fi

if [ "$AUTHED" -eq 1 ]; then
  log "t238: authed deep-link suite (seeded buyer session) — ensure_home before EVERY link"
else
  log "t238: deep-link suite (GUEST fallback — gated captures will show the sign-in gate)"
fi
# Order: PDP (real seeded product) → cart (authed now) → registry suite →
# app-link wallet → authed profile → authed orders. Numbers follow the
# orchestrator's plan (08 reserved); every call is non-fatal.
if [ -n "${PRODUCT_ID:-}" ]; then
  guarded_deeplink "06-product-detail" 12 "zylod://product/$PRODUCT_ID"
else
  echo "::warning::No product id — PDP screenshot skipped"
fi
guarded_deeplink "07-cart" 8 "zylod://cart"
guarded_deeplink "10-deals" 12 "zylod://deals"
guarded_deeplink "11-search" 8 "zylod://search"
guarded_deeplink "12-seller-dashboard" 10 "zylod://seller-dashboard"
guarded_deeplink "13-wallet" 8 "zylod://wallet"
guarded_deeplink "14-notifications" 8 "zylod://notifications"
guarded_deeplink "15-admin-dashboard" 10 "zylod://admin-dashboard"
# App-Link path proof: the https host-form must resolve to the same native
# wallet page as zylod://wallet above.
guarded_deeplink "16-applink-wallet" 8 "https://zylod.com/?page=wallet"
guarded_deeplink "17-profile" 10 "zylod://profile"
guarded_deeplink "18-orders-authed" 10 "zylod://buyer-orders"

log "Screen inventory"
ls -la screenshots/ || true

# t238: MD5 dedup audit — 9 of t237's 21 PNGs were byte-identical login
# screens and nobody noticed. List every byte-identical group in
# screenshots/duplicates.txt (artifact evidence; NEVER fatal).
log "MD5 dedup audit"
DUP_REPORT=$(md5sum screenshots/*.png 2>/dev/null | sort | awk '
  { count[$1]++; names[$1] = names[$1] " " $2 }
  END {
    groups = 0
    for (h in count) {
      if (count[h] > 1) { groups++; printf "%s x%d:%s\n", h, count[h], names[h] }
    }
    if (groups == 0) print "OK: no byte-identical captures"
  }')
echo "$DUP_REPORT"
printf '%s\n' "$DUP_REPORT" > screenshots/duplicates.txt

# Provenance diagnostics — WebProvenance logs every gate decision under
# ZylodProvenance; full logcat covers WebView console + network too.
adb logcat -d -s ZylodProvenance > screenshots/provenance.log 2>/dev/null || true
adb logcat -d > screenshots/logcat-full.txt 2>/dev/null || true
echo "--- provenance log ---"
cat screenshots/provenance.log 2>/dev/null | tail -30 || true
