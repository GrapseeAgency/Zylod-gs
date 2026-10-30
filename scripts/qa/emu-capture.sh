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
#
# t239 FIXES (three defects proven by the VLM-verified CI artifact):
#   1. LOGIN VERIFY FALSE-POSITIVE: the old "buyer1" probe matched the typed
#      email inside the login form's own EditText, so "authed" passed while
#      still on the login screen and every gated capture showed login.
#      Verification is now STRICT ("Sign out", or home WITHOUT login-screen
#      signals), 04b-after-login-tap.png is captured unconditionally, token
#      prefs + auth logcat are dumped, and the Login tap is retried once.
#   2. 06-product-detail was SILENTLY SKIPPED when PRODUCT_ID was unset —
#      it now self-fetches the id from /api/products?limit=1 and settle-polls
#      the PDP for source-verified strings before capturing.
#   3. 10-deals / 22-hot-deals captured BARE SPINNERS — both settle-poll 25s
#      for card-level deal strings and dump deals logcat + server deals JSON
#      on timeout (server-empty vs app-bug is visible in the artifact).
#
# t242 FIXES (submit-tap precision + typed-text proof):
#   1. login_buyer submits via tap_clickable_text — uiautomator dump → python
#      parse → first node whose text/content-desc contains the target AND
#      clickable="true" AND bounds valid → tap its center, FALL BACK to
#      tap_text when none matches. tap_text's first-text-match could hit a
#      same-named NON-clickable Text (page title / dialog heading) and the
#      submit no-oped silently — zero auth requests issued.
#   2. TYPED-TEXT PROOF: after typing, a fresh dump checks the EditText text
#      attrs — email must contain buyer1@zylod.bd, password must be
#      non-empty (length only, NEVER printed) — and appends
#      typed-email-registered=yes/no + typed-password-registered=yes/no to
#      screenshots/login-typed-check.txt (never fatal).
#
# t243 FIXES (the SOCIAL CONSENT DIALOG intercepted the login typing — the
# CI evidence shows typed-email-registered=no, typed-password-registered=no
# and ZERO submits because the "Sign in with your email" dialog (Email +
# "Display name (optional)" — Cancel/Continue) was still open over the
# login form, so the EditText taps + typing landed in the dialog and no
# Login click ever reached the form button):
#   1. dismiss_email_dialog(): dump → marker check ("Display name" /
#      "Sign in with your email") → Cancel via tap_clickable_text, fall
#      back to tap_text, fall back to ONE keyevent 4 BACK — each step
#      followed by sleep 2 + a re-dump verifying the marker text is GONE;
#      still stuck after 2 attempts → 04z-dialog-stuck.png diagnostic and
#      continue anyway. Called at the START of login_buyer() AND right
#      before the typed-text check.
#   2. Typing targets the MAIN form (email hint "Email or Phone Number",
#      LoginScreen.kt:451): fresh dump after dismissal; any EditText whose
#      text/hint carries "Display name" means the dialog is still up →
#      shift to EditText#3+ or abort to the guest path (never fatal).
#   3. login-logcat.txt was MISLABELED (the old case-insensitive grep
#      pulled ZylodProvenance lines): now ONE pid-scoped raw dump + a
#      STRICT case-sensitive filter (ZylodAuth|ZylodDeals|login|Login) +
#      wc -l trace, and the UNFILTERED pid-scoped last 400 lines go to
#      screenshots/login-logcat-full-pid.txt so nothing is hidden again.
#   4. Deals evidence (ZylodDeals grep → deals-logcat.txt, curl /api/deals
#      → server-deals.json) now dumps UNCONDITIONALLY right after the
#      10-deals capture — not only on settle-timeout.
#
# t244 REWRITE (login state machine): t243's typing never registered
# (typed-email-registered=no, zero submits) because the dismiss_email_dialog
# BACK fallback fired on a mis-detected dialog and popped the LOGIN ROUTE —
# every later tap/keystroke landed on Home. Now:
#   1. login_screen_ok(): identity check — main-form hint "Email or Phone"
#      (verified LoginScreen.kt string) present AND no dialog markers
#      ("Display name" / "Sign in with your email").
#   2. fresh_login_mount(): bottom-bar Home → Profile → sleep → identity
#      check. A fresh Profile-tab mount can never have the consent dialog
#      open (it opens ONLY via "Continue with Email"), so login_buyer calls
#      NO dismiss_email_dialog; the dialog is dismissed ONLY in the 04
#      capture block — the one place it can genuinely exist.
#   3. login_buyer(): 2 mount attempts (04z-login-screen-wrong.png + guest
#      path on failure) → type email after a FRESH dump → type password
#      after ANOTHER fresh dump (bounds shift) → check_typed_text →
#      typed-email=no triggers ONE retype round, and even a still-empty
#      form is submitted ANYWAY (an empty submit still emits a ZylodAuth
#      log line — disambiguates tap-miss vs typing-fail) → trace "login:
#      submit tapped (typed= yes/no)" → sleep 14 → 04b captured
#      unconditionally → strict verify → ONE full retry round (fresh mount
#      → retype → re-tap; 04c captured unconditionally on every attempt) →
#      token prefs + auth logcat at decision time. Guest path never fatal.
#
# t249 AUTHED ADMIN SEGMENT (after capture 20-admin-orders): artifact
# 12997027265 proved 15-admin-dashboard / 19-admin-users / 20-admin-orders
# render the native admin screens but inside the "Admin account required"
# gate — the session had NO admin (the seeded buyer is userType=buyer). The
# CI serve path already seeds a REAL admin through the same register rails
# (scripts/qa/seed-marketplace.mjs registers it as the FIRST account on the
# empty CI database, so the admin-bootstrap gate (adminCount == 0) admits
# it): market@zylod.bd, userType "admin". After 20-admin-orders the new
# segment: sign_out_current_session (clears the buyer session the authed
# suite left) → login_admin (the t244 state machine, typing the seeded
# admin's email, with admin-scoped evidence files so nothing from the buyer
# login is clobbered) → captures 25-admin-dashboard-authed (settle-polled,
# t239 deals pattern), 26-admin-users-authed and 27-admin-orders-authed
# (12s settle each). Admin login failure is NON-FATAL and honestly recorded
# in screenshots/admin-login-check.txt (admin-session-verified=no +
# admin-failure-reason=<verbatim>) — the three shots are captured EITHER
# WAY (the gate state is honest evidence, exactly like the guest path).
# t249-f DETERMINISTIC SESSION INJECTION (this change): artifact 13000480338
# proved UI typing NEVER lands in the Compose fields (admin-email-
# registered=no AND typed-email-registered=no) — the authed evidence shots
# (18, 25/26/27) can no longer depend on it. The session is now established
# deterministically:
#   1. REAL session from the REAL backend: POST /api/auth/login
#      {email,password} -> {success,token,...} (route.ts:167-186; token is a
#      top-level field, 96 hex chars, src/lib/auth.ts:39; sessions live 7
#      days, auth.ts:7). Seeded creds from scripts/qa/seed-marketplace.mjs:
#      buyer1@zylod.bd / admin market@zylod.bd, shared password Passw0rd!23.
#   2. Write it through the app's OWN session writer. SessionManager.kt:35-38
#      reads auth_token from ZylodApp.securePrefs — an
#      EncryptedSharedPreferences store (ZylodApp.kt:47-58, file
#      "zylod_secure", AES256_SIV keys + AES256_GCM values, AndroidKeyStore
#      master key). A host-side plaintext XML write into that file is
#      IMPOSSIBLE (and actively harmful: AEADBadTagException makes ZylodApp
#      delete + recreate the store). The app-sanctioned writer is
#      WebAppBridge.setAuthToken (bridge/WebAppBridge.kt:135-171,
#      @JavascriptInterface, installed as window.ZylodNativeBridge —
#      NativeWebViewPool.kt:329): it writes exactly what SessionManager reads
#      on cold start. Delivery: CDP Runtime.evaluate in the app's own
#      WebView (debug build -> WebView remote debugging is enabled by
#      default for debuggable apps; no app-code change, no adb root needed),
#      evaluating ZylodNativeBridge.setAuthToken('<token>') on a short
#      Tier-3 page (zylod://privacy-policy — same page capture 25 uses).
#   3. Cold start: am force-stop -> monkey relaunch -> ensure_home, so the
#      verdict proves the token SURVIVED a process restart (the exact thing
#      the gated shots need).
#   Fallback chain: CDP bridge injection IS the mechanism (adb-root /
#   run-as prefs writes are reserved for read-only evidence here — dump_
#   *_prefs — because of the encrypted store). If any injection step fails,
#   the role records injection-method=none + a verbatim failure reason and
#   the run degrades to the previous behavior (UI-login verdict / honest
#   gate shots). Strict verification:
#   - buyer: zylod://buyer-orders settle-poll — the gate marker "Sign in to
#     see your orders" (OrdersScreen.kt:425) must be ABSENT; the authed
#     marker "No orders yet" (OrdersScreen.kt:376; the seeded buyer has no
#     orders) present -> buyer-session-verified=yes (buyer-session-check.txt).
#   - admin: injected UNCONDITIONALLY after the kept UI attempt (it replaces
#     whatever session the UI left), verified by (a) the populated dashboard
#     marker "Platform overview"/"Recent activity" (AdminDashboardScreen.kt
#     :331/:188) or (b) pid logcat AFTER a logcat -c showing ZylodAdmin
#     "fetch admin dashboard" with NO "not an admin session" line
#     (AdminDashboardViewModel.kt:86/:101) — admin-session-verified=yes only
#     when the injection steps ALL succeeded AND (a) or (b) holds.
#   Passwords are NEVER printed (length-only, matching the existing style).
set -u
mkdir -p screenshots

# t240 HARDENING — run 41033361159/job 123988158474 hung 45+ min right after
# 04b-after-login-tap.png: the post-login verify loop's `adb shell uiautomator
# dump` blocked FOREVER while the login "Logging in..." CircularProgressIndicator
# kept the device non-idle (uiautomator dump waits for idle). EVERY adb call
# below now runs under `timeout` (non-fatal: the probe degrades, the script
# never wedges) and a 30-minute GLOBAL capture budget skips the remaining
# captures when spent — the dedup audit + logcat dumps at the bottom always
# run so duplicates.txt + the artifact still upload.
SECONDS=0
BUDGET_EXHAUSTED=0

log () { echo "── $1 ──"; }

# t240: adb shell with a hard timeout, never fatal. Usage: adbt 20 uiautomator dump /sdcard/ui.xml
adbt () { timeout "${1:-20}" adb shell "${@:2}" || true; }

# t240 GLOBAL BUDGET: 30 minutes of wall clock for the capture blocks
# (t248: raised to 1900s — two more admin captures, ~20s each, must fit).
# (t249: raised to 2100s — the authed-admin segment adds buyer sign-out +
# native admin sign-in (~2 min happy path, worst ~4 min with the retry
# rounds) + three 12s-settle admin captures; still far under the workflow's
# 60-minute job ceiling, and every skipped capture degrades non-fatally).
budget_left () { [ $((2100 - SECONDS)) -gt 10 ]; }
budget_stop () {
  if [ "$BUDGET_EXHAUSTED" -eq 0 ] && ! budget_left; then
    BUDGET_EXHAUSTED=1
    echo "::warning::capture budget exhausted, skipping rest"
  fi
  [ "$BUDGET_EXHAUSTED" -eq 1 ]
}

# Resilient screencap: swiftshader occasionally throws transient
# "Failed to find ColorBuffer" — retry up to 4x, never fatal.
cap () {
  if budget_stop; then return 0; fi
  local f="$1"
  local try
  for try in 1 2 3 4; do
    if timeout 15 adb exec-out screencap -p > "$f" 2>/dev/null && [ -s "$f" ]; then
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
  adbt 20 uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  timeout 15 adb pull /sdcard/ui.xml ui.xml > /dev/null 2>&1 || true
  local bounds
  bounds=$(python3 scripts/qa/uia-tap-center.py "$text" ui.xml)
  if [ -n "$bounds" ]; then
    timeout 20 adb shell input tap $bounds && echo "tapped '$text' at $bounds"
  else
    echo "::warning::text '$text' not found on screen"
  fi
}

# t242: tap a BUTTON by its visible text — the tap must land on a CLICKABLE
# node. uiautomator dump → python parse → first node whose text (or
# content-desc) contains the target AND clickable="true" AND bounds valid →
# tap its center; no such node → fall back to the t187 tap_text (first text
# match, clickable or not). Needed because tap_text's first-text-match can
# hit a same-named NON-clickable Text (page title, dialog heading — e.g.
# "Sign in with your email" when probing "Sign in") and the submit tap
# no-oped silently: zero auth requests, spinner forever. Same dump/pull/
# timeout conventions as tap_text; never fatal.
tap_clickable_text () {
  local text="$1"
  adbt 20 uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  timeout 15 adb pull /sdcard/ui.xml ui.xml > /dev/null 2>&1 || true
  local bounds
  bounds=$(python3 - "$text" ui.xml <<'PYEOF'
import re, sys
try:
    xml = open(sys.argv[2], encoding="utf-8", errors="ignore").read()
except OSError:
    sys.exit(0)
target = sys.argv[1]
nodes = re.findall(r"<node\b[^>]*>", xml)
clickables = []
for n in nodes:
    if 'clickable="true"' not in n:
        continue
    m = re.search(r'\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
    if not m:
        continue
    l, t, r, b = (int(x) for x in m.groups())
    if r - l <= 0 or b - t <= 0:
        continue  # degenerate bounds are never valid tap targets
    hay = " ".join(re.findall(r'\b(?:text|content-desc)="([^"]*)"', n))
    clickables.append((hay, l, t, r, b))
# 1) a clickable node whose OWN text/content-desc contains the target.
for hay, l, t, r, b in clickables:
    if target in hay:
        print(f"{(l + r) // 2} {(t + b) // 2}")
        sys.exit(0)
# 2) Compose may keep the label on a NON-clickable Text child inside the
#    clickable Button: use the matching text node's center only when a
#    clickable node actually CONTAINS that point — innermost (smallest
#    area) clickable wins. A same-named title OUTSIDE any clickable is
#    skipped, so the button further down still matches.
for n in nodes:
    hay = " ".join(re.findall(r'\b(?:text|content-desc)="([^"]*)"', n))
    if target not in hay:
        continue
    m = re.search(r'\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
    if not m:
        continue
    l, t, r, b = (int(x) for x in m.groups())
    cx, cy = (l + r) // 2, (t + b) // 2
    best = None
    for hay2, cl, ct, cr, cb in clickables:
        if cl <= cx <= cr and ct <= cy <= cb:
            area = (cr - cl) * (cb - ct)
            if best is None or area < best[0]:
                best = (area, cl, ct, cr, cb)
    if best is not None:
        _, cl, ct, cr, cb = best
        print(f"{(cl + cr) // 2} {(ct + cb) // 2}")
        sys.exit(0)
sys.exit(0)
PYEOF
)
  if [ -n "$bounds" ]; then
    timeout 20 adb shell input tap $bounds && echo "tapped clickable '$text' at $bounds"
  else
    echo "tap_clickable_text: no clickable '$text' node — falling back to tap_text"
    tap_text "$text"
  fi
}

# t229g: tap a BOTTOM-BAR tab by label, region-filtered to the bottom 15% of
# the screen (WebView content can never match there — the Scaffold keeps the
# tab bar zone clear). This is the deterministic way to drive the native
# bottom bar from CI.
tap_tab () {
  local text="$1"
  adbt 20 uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  timeout 15 adb pull /sdcard/ui.xml ui.xml > /dev/null 2>&1 || true
  local bounds
  bounds=$(python3 scripts/qa/uia-tap-tab.py "$text" ui.xml)
  if [ -n "$bounds" ]; then
    timeout 20 adb shell input tap $bounds && echo "tapped tab '$text' at $bounds"
  else
    echo "::warning::tab '$text' not found in the bottom-bar region"
  fi
}

# t234: best-effort "is this text on screen?" probe — same uiautomator dump
# the tap helpers use, but only reports presence (exit 0) / absence (exit 1).
ui_has_text () {
  adbt 20 uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  timeout 15 adb pull /sdcard/ui.xml ui.xml > /dev/null 2>&1 || true
  [ -n "$(python3 scripts/qa/uia-tap-center.py "$1" ui.xml 2>/dev/null)" ]
}

# t239 DEFECT 1a: STRICT post-login auth check. All needles are exact-case
# UI strings verified in source (uia matching is case-sensitive substring):
#   "Sign out"     — ProfileScreen.kt:151 (ONLY rendered signed-in; also on
#                    the suspended-account screen, which is authed context too)
#   "Hot deals"    — the HOME feed's own section title (lowercase d; the
#                    bottom tab / deals top-bar are "Hot Deals" capital-D)
#   "New to Zylod" — LoginScreen.kt:561 footer ("New to Zylod? ") — login-screen marker
#   "Login"        — LoginScreen.kt:527 submit button ("Login"; while loading
#                    it reads "Logging in...", which still contains "Login")
# The home route alone is NOT proof: accept it only when NO login-screen
# signal is visible. NEVER probe "buyer1" — the login form's email EditText
# CONTAINS the typed "buyer1@zylod.bd", which is exactly how t238's check
# false-positived on the login screen itself.
login_verify_ok () {
  if ui_has_text "Sign out"; then
    return 0
  fi
  if ui_has_text "Hot deals" && ! ui_has_text "New to Zylod" && ! ui_has_text "Login"; then
    return 0
  fi
  return 1
}

# t238: one uiautomator dump, many needles — the ensure_home / settle polls
# need several probes per iteration and ui_has_text re-dumps per call (too
# slow). Exit 0 when ANY needle appears in a text= or content-desc= attr.
any_text_on_screen () {
  adbt 20 uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  timeout 15 adb pull /sdcard/ui.xml ui.xml > /dev/null 2>&1 || true
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

# t242 TYPED-TEXT PROOF: fresh dump — did the typed text actually land in the
# login form's EditTexts? #1's text attr must contain the seeded address,
# #2's must be non-empty (checked by LENGTH only — the password itself is
# NEVER printed, here or in the evidence file). Appends
#   typed-email-registered=yes/no
#   typed-password-registered=yes/no
# to screenshots/login-typed-check.txt. Never fatal: a missing dump or a
# parse hiccup just records "no". Field order assumption is the same one
# edittext_center documents (1st = email, 2nd = password).
check_typed_text () {
  adbt 20 uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  timeout 15 adb pull /sdcard/ui.xml /tmp/ui.xml > /dev/null 2>&1 || true
  python3 - /tmp/ui.xml >> screenshots/login-typed-check.txt 2>/dev/null <<'PYEOF'
import re, sys
email_ok, pass_ok = "no", "no"
try:
    xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
except OSError:
    xml = ""
fields = []
for n in re.findall(r"<node\b[^>]*>", xml):
    if 'class="android.widget.EditText"' in n:
        m = re.search(r'\btext="([^"]*)"', n)
        fields.append(m.group(1) if m else "")
if len(fields) >= 1 and "buyer1@zylod.bd" in fields[0]:
    email_ok = "yes"
if len(fields) >= 2 and len(fields[1]) > 0:
    pass_ok = "yes"
print(f"typed-email-registered={email_ok}")
print(f"typed-password-registered={pass_ok}")
PYEOF
}

# t249 ADMIN TYPED-TEXT PROOF: check_typed_text for the admin segment — the
# identical dump/pull/parse shape, but the email needle is the SEEDED
# ADMIN's address (market@zylod.bd, registered by scripts/qa/
# seed-marketplace.mjs) and the verdict lands in
# screenshots/admin-login-check.txt with admin-prefixed keys
# (admin-email-registered / admin-password-registered). The password is
# checked by LENGTH only — never printed, here or in the evidence file.
# Appends exactly two lines per call (email line first) so tail -2 is always
# the newest pair. Never fatal: a missing dump or a parse hiccup just
# records "no". Field order assumption is the same one edittext_center
# documents (1st = email, 2nd = password).
check_admin_typed_text () {
  adbt 20 uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  timeout 15 adb pull /sdcard/ui.xml /tmp/ui.xml > /dev/null 2>&1 || true
  python3 - /tmp/ui.xml >> screenshots/admin-login-check.txt 2>/dev/null <<'PYEOF'
import re, sys
email_ok, pass_ok = "no", "no"
try:
    xml = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
except OSError:
    xml = ""
fields = []
for n in re.findall(r"<node\b[^>]*>", xml):
    if 'class="android.widget.EditText"' in n:
        m = re.search(r'\btext="([^"]*)"', n)
        fields.append(m.group(1) if m else "")
if len(fields) >= 1 and "market@zylod.bd" in fields[0]:
    email_ok = "yes"
if len(fields) >= 2 and len(fields[1]) > 0:
    pass_ok = "yes"
print(f"admin-email-registered={email_ok}")
print(f"admin-password-registered={pass_ok}")
PYEOF
}

# t238: close the soft keyboard if it is showing (BACK dismisses the IME
# before it pops a route) so it cannot cover the next EditText tap.
hide_ime () {
  if timeout 20 adb shell dumpsys input_method 2>/dev/null | grep -q "mInputShown=true"; then
    adbt 20 input keyevent 4
    sleep 1
  fi
}

# t243: does ANY EditText in a uiautomator dump carry the needle in its
# text/hint/content-desc? uiautomator has no separate hint attr — Compose
# surfaces a field's label in text= while the field is empty — so all three
# attrs are checked. Exit 0 = present (the dialog is still contaminating
# the EditText list), exit 1 = absent/undumpable. Never fatal.
edittext_mentions () { # needle dump_file
  python3 - "$1" "$2" <<'PYEOF'
import re, sys
try:
    xml = open(sys.argv[2], encoding="utf-8", errors="ignore").read()
except OSError:
    sys.exit(1)
needle = sys.argv[1]
for n in re.findall(r"<node\b[^>]*>", xml):
    if 'class="android.widget.EditText"' not in n:
        continue
    hay = " ".join(re.findall(r'\b(?:text|hint|content-desc)="([^"]*)"', n))
    if needle in hay:
        sys.exit(0)
sys.exit(1)
PYEOF
}

# t243 ROBUST DIALOG DISMISSAL: the social consent dialog ("Sign in with
# your email" — Email + "Display name (optional)" — Cancel/Continue) sits
# OVER the main login form after capture 04; while it is open the form's
# EditText taps + typing land in the DIALOG and no Login click reaches the
# form button (t242's typed-email-registered=no/no, zero submits). Chain:
# attempt 1 Cancel via tap_clickable_text, attempt 2 Cancel via tap_text,
# then ONE keyevent 4 BACK as the final fallback — each step followed by
# sleep 2 + a fresh dump verifying the marker text is GONE. Still present
# after everything: capture screenshots/04z-dialog-stuck.png (diagnostic)
# and continue anyway (returns 1, never fatal). Returns 0 when the dialog
# is gone (or never was up).
dismiss_email_dialog () {
  local marker_present=1
  local i
  for i in 1 2; do
    if ! any_text_on_screen "Display name" "Sign in with your email"; then
      marker_present=0
      break
    fi
    echo "dismiss_email_dialog: consent dialog detected (attempt $i) — tapping Cancel"
    if [ "$i" -eq 1 ]; then
      tap_clickable_text "Cancel" || true
    else
      tap_text "Cancel" || true
    fi
    sleep 2
  done
  if [ "$marker_present" -eq 1 ] && any_text_on_screen "Display name" "Sign in with your email"; then
    echo "dismiss_email_dialog: Cancel taps failed — keyevent 4 (BACK) once"
    adbt 20 input keyevent 4
    sleep 2
  fi
  if any_text_on_screen "Display name" "Sign in with your email"; then
    echo "::warning::dismiss_email_dialog: consent dialog STILL open after 2 Cancel attempts + BACK — capturing screenshots/04z-dialog-stuck.png (diagnostic) and continuing"
    cap screenshots/04z-dialog-stuck.png
    return 1
  fi
  echo "dismiss_email_dialog: consent dialog dismissed (or never open) ✓"
  return 0
}

# t241: current pid of the debug app (FIRST token — pidof can print several
# space-separated pids and logcat --pid accepts only one). Empty when the
# app is not running; callers fall back to unfiltered dumps. Never fatal.
app_pid () {
  timeout 10 adb shell pidof com.zylod.wholesale.debug 2>/dev/null | tr -d '\r' | awk '{print $1}' || true
}

# ── t249-f DETERMINISTIC SESSION INJECTION ─────────────────────────────────
# Host-side API base for the REAL backend (host loopback — the same server
# the app reaches as http://10.0.2.2:3000; every existing curl in this
# script already uses 127.0.0.1:3000). Injection globals are reset per call.
HOST_API_BASE="http://127.0.0.1:3000"
INJECTION_WEB_DEEPLINK="zylod://privacy-policy" # short Tier-3 page -> guarantees a live WebView (the bridge host)
INJECTION_METHOD="none"
INJECTION_REASON="not attempted"

# t249-f (1): REAL login against the served backend. Request/response
# contract copied verbatim from src/app/api/auth/login/route.ts: POST JSON
# {email, password} -> 200 {success:true, token, requires2FA:false, user:{...}}
# (token is a TOP-LEVEL field, route.ts:167-182). Sets TOKEN + API_LOGIN_REASON.
# The password is never echoed; the reason carries a token LENGTH only.
api_login_token () { # email password
  TOKEN=""
  API_LOGIN_REASON="curl failed"
  local resp
  resp=$(timeout 20 curl -s -X POST "$HOST_API_BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" 2>/dev/null || true)
  if [ -z "$resp" ]; then
    API_LOGIN_REASON="login API returned an empty response"
    return 1
  fi
  TOKEN=$(printf '%s' "$resp" | python3 -c "import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
t = d.get('token')
if isinstance(t, str) and t:
    print(t)" 2>/dev/null || true)
  if [ -z "$TOKEN" ]; then
    API_LOGIN_REASON="login API gave no token (non-200 or bad credentials; response $(printf '%s' "$resp" | wc -c) bytes)"
    return 1
  fi
  API_LOGIN_REASON="ok (token ${#TOKEN} chars)"
  return 0
}

# t249-f (2a): pick the WebView page target's webSocketDebuggerUrl from the
# devtools HTTP endpoint (after `adb forward tcp:9222 localabstract:...`).
# Prefers the SPA page (origin 10.0.2.2:3000), falls back to any page target
# (the bridge object is installed on every shell page — NativeWebViewPool
# adds the JS interface at WebView creation, before loadUrl). Prints the URL
# or nothing; never fatal.
cdp_list_page_wsurl () {
  timeout 10 curl -s http://127.0.0.1:9222/json/list > /tmp/cdp-list.json 2>/dev/null || true
  [ -s /tmp/cdp-list.json ] || return 1
  python3 - /tmp/cdp-list.json <<'PYEOF'
import json, sys
try:
    targets = json.load(open(sys.argv[1], encoding="utf-8", errors="ignore"))
except Exception:
    sys.exit(0)
if not isinstance(targets, list):
    sys.exit(0)
pages = [t for t in targets if isinstance(t, dict) and t.get("type") == "page"]
spa = [t for t in pages if "10.0.2.2:3000" in (t.get("url") or "")]
pick = spa or pages
if pick:
    ws = pick[0].get("webSocketDebuggerUrl") or ""
    if ws:
        print(ws)
PYEOF
}

# t249-f (2b): ONE CDP Runtime.evaluate over a raw WebSocket — python3
# stdlib only (socket + the RFC6455 handshake + one masked text frame), no
# external deps. Prints the eval result value, or a WS-* failure marker with
# a non-zero exit. The expression must be self-contained JS.
cdp_eval () { # wsurl expression [timeout_seconds]
  python3 - "$1" "$2" "${3:-15}" <<'PYEOF'
import base64, json, os, socket, struct, sys, time
from urllib.parse import urlparse
wsurl, expr = sys.argv[1], sys.argv[2]
limit = float(sys.argv[3]) if len(sys.argv) > 3 else 15.0
u = urlparse(wsurl)
host, port, path = u.hostname or "127.0.0.1", u.port or 9222, u.path or "/"
try:
    s = socket.create_connection((host, port), timeout=limit)
except OSError:
    print("WS-CONNECT-FAILED"); sys.exit(1)
s.settimeout(limit)
key = base64.b64encode(os.urandom(16)).decode()
req = (f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\n"
       f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
s.sendall(req.encode())
buf = b""
try:
    while b"\r\n\r\n" not in buf:
        chunk = s.recv(4096)
        if not chunk:
            break
        buf += chunk
except OSError:
    print("WS-HANDSHAKE-FAILED"); sys.exit(1)
if b" 101 " not in buf.split(b"\r\n", 1)[0]:
    print("WS-UPGRADE-FAILED"); sys.exit(1)
rest = buf.split(b"\r\n\r\n", 1)[1]
payload = json.dumps({"id": 1, "method": "Runtime.evaluate",
                      "params": {"expression": expr, "returnByValue": True}}).encode()
mask = os.urandom(4)
head = b"\x81"
n = len(payload)
if n < 126:
    head += bytes([0x80 | n])
elif n < 65536:
    head += bytes([0x80 | 126]) + struct.pack(">H", n)
else:
    head += bytes([0x80 | 127]) + struct.pack(">Q", n)
s.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

def recv_exact(k):
    global rest
    while len(rest) < k:
        chunk = s.recv(65536)
        if not chunk:
            raise OSError("eof")
        rest += chunk
    out, rest = rest[:k], rest[k:]
    return out

deadline = time.time() + limit
reply = None
while time.time() < deadline:
    try:
        b1, b2 = recv_exact(2)
    except (OSError, socket.timeout):
        break
    opcode = b1 & 0x0F
    ln = b2 & 0x7F
    if ln == 126:
        try:
            ln = struct.unpack(">H", recv_exact(2))[0]
        except OSError:
            break
    elif ln == 127:
        try:
            ln = struct.unpack(">Q", recv_exact(8))[0]
        except OSError:
            break
    try:
        data = recv_exact(ln) if ln else b""
    except OSError:
        break
    if opcode == 0x8:
        break
    if opcode in (0x9, 0xA):
        continue  # ping/pong — nothing to answer within a one-shot eval
    try:
        msg = json.loads(data.decode("utf-8", "ignore"))
    except Exception:
        continue
    if isinstance(msg, dict) and msg.get("id") == 1:
        reply = msg
        break
s.close()
if reply is None:
    print("WS-EVAL-NO-RESPONSE"); sys.exit(2)
result = reply.get("result") or {}
if result.get("exceptionDetails"):
    print("WS-EVAL-EXCEPTION"); sys.exit(3)
val = result.get("result", {}).get("value")
# Strings print raw (the caller string-compares the contract value
# "zylod-inject-ok"); anything else prints as JSON for the evidence line.
print(val if isinstance(val, str) else json.dumps(val))
PYEOF
}

# t249-f (2c+3): the full deterministic session injection.
#   1. REAL login via the backend API (api_login_token).
#   2. ensure_home + open the short Tier-3 page (a live shell WebView that
#      carries window.ZylodNativeBridge).
#   3. CDP Runtime.evaluate -> ZylodNativeBridge.setAuthToken('<token>') —
#      the app itself writes auth_token into its OWN EncryptedSharedPreferences
#      store (the only writer that can produce a readable ciphertext; a
#      host-side plaintext prefs write is impossible against that store).
#   4. Prove the write: secure prefs file present via run-as.
#   5. Cold start: force-stop -> logcat -c (clean buffer for the role's
#      post-relaunch verification) -> monkey relaunch -> ensure_home.
# Evidence lands in $4 (injection-method / api-login / bridge-eval /
# prefs-written / failure-reason — passwords length-only). Returns 0 when
# every step succeeded (INJECTION_REASON="ok"); 1 otherwise with the verbatim
# reason. Never fatal to the run (callers degrade to the honest gate path).
inject_session () { # email password role evidence_file diag_prefix
  local email="$1" password="$2" role="$3" evfile="$4" diag="$5"
  INJECTION_METHOD="none"
  INJECTION_REASON="not attempted"
  local pid candidates sock wsurl evalout prefs_list attempt
  {
    echo "=== $role session injection $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
    echo "$role-credentials-source=scripts/qa/seed-marketplace.mjs (password length $(printf '%s' "$password" | wc -c), never printed)"
  } >> "$evfile" 2>/dev/null || true
  # (1) real login
  if ! api_login_token "$email" "$password"; then
    INJECTION_REASON="api-login failed: $API_LOGIN_REASON"
    echo "injection-method=none" >> "$evfile" 2>/dev/null || true
    echo "api-login=err" >> "$evfile" 2>/dev/null || true
    echo "$role-failure-reason=$INJECTION_REASON" >> "$evfile" 2>/dev/null || true
    echo "::warning::inject_session($role): $INJECTION_REASON"
    return 1
  fi
  echo "api-login=ok" >> "$evfile" 2>/dev/null || true
  echo "api-login-detail=$API_LOGIN_REASON" >> "$evfile" 2>/dev/null || true
  case "$TOKEN" in
    *[!A-Za-z0-9._-]*|'')
      INJECTION_REASON="login token has an unexpected shape (length ${#TOKEN}, refused for safe JS embedding)"
      echo "injection-method=none" >> "$evfile" 2>/dev/null || true
      echo "prefs-written=no" >> "$evfile" 2>/dev/null || true
      echo "$role-failure-reason=$INJECTION_REASON" >> "$evfile" 2>/dev/null || true
      echo "::warning::inject_session($role): $INJECTION_REASON"
      return 1
      ;;
  esac
  # (2) a live shell WebView — home first (deep links fired off-home queue),
  # then the short Tier-3 privacy-policy page.
  ensure_home || echo "::warning::inject_session($role): ensure_home failed — the WebView deeplink may queue; CDP below will fail with its own reason"
  adbt 15 am start -a android.intent.action.VIEW -d "$INJECTION_WEB_DEEPLINK" com.zylod.wholesale.debug >/dev/null 2>&1
  sleep 12
  # (3) the app's WebView devtools socket (debug build -> remote debugging on)
  pid=$(app_pid)
  candidates=$(timeout 10 adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep -o 'webview_devtools_remote[A-Za-z0-9_]*' | sort -u || true)
  sock=""
  if [ -n "$pid" ]; then
    sock=$(printf '%s\n' "$candidates" | grep "^webview_devtools_remote_${pid}$" || true)
  fi
  [ -n "$sock" ] || sock=$(printf '%s\n' "$candidates" | grep -v '^$' | head -1 || true)
  if [ -z "$sock" ]; then
    INJECTION_REASON="no WebView devtools socket in /proc/net/unix (pid=${pid:-none} — WebView not up or remote debugging unavailable)"
    echo "injection-method=none" >> "$evfile" 2>/dev/null || true
    echo "prefs-written=no" >> "$evfile" 2>/dev/null || true
    echo "$role-failure-reason=$INJECTION_REASON" >> "$evfile" 2>/dev/null || true
    echo "::warning::inject_session($role): $INJECTION_REASON"
    cap "screenshots/$diag-inject-webview-missing.png"
    return 1
  fi
  # (3b) forward + list + eval, 3 attempts (the SPA document can still be
  # loading when the first /json/list lands).
  evalout=""
  for attempt in 1 2 3; do
    timeout 10 adb forward tcp:9222 "localabstract:$sock" >/dev/null 2>&1 || true
    wsurl=$(cdp_list_page_wsurl || true)
    if [ -n "$wsurl" ]; then
      evalout=$(cdp_eval "$wsurl" "(function(){try{if (window.ZylodNativeBridge && typeof window.ZylodNativeBridge.setAuthToken==='function'){window.ZylodNativeBridge.setAuthToken('$TOKEN');return 'zylod-inject-ok';}return 'zylod-bridge-missing';}catch(e){return 'zylod-inject-err:'+e;}})()" 15 || true)
      [ "$evalout" = "zylod-inject-ok" ] && break
    else
      evalout="no-page-target"
    fi
    sleep 5
  done
  echo "bridge-eval=$evalout" >> "$evfile" 2>/dev/null || true
  if [ "$evalout" != "zylod-inject-ok" ]; then
    INJECTION_REASON="CDP Runtime.evaluate did not return zylod-inject-ok (got: ${evalout:-empty}; socket=$sock)"
    echo "injection-method=none" >> "$evfile" 2>/dev/null || true
    echo "prefs-written=no" >> "$evfile" 2>/dev/null || true
    echo "$role-failure-reason=$INJECTION_REASON" >> "$evfile" 2>/dev/null || true
    echo "::warning::inject_session($role): $INJECTION_REASON"
    cap "screenshots/$diag-inject-bridge-failed.png"
    timeout 10 adb forward --remove tcp:9222 >/dev/null 2>&1 || true
    return 1
  fi
  INJECTION_METHOD="cdp-webview-bridge"
  # (4) let SharedPreferences.apply() flush, then prove the store file exists
  sleep 3
  timeout 10 adb forward --remove tcp:9222 >/dev/null 2>&1 || true
  prefs_list=$(timeout 15 adb shell run-as com.zylod.wholesale.debug ls shared_prefs 2>/dev/null | tr -d '\r' || true)
  if printf '%s\n' "$prefs_list" | grep -q '^zylod_secure.xml$'; then
    echo "prefs-written=yes" >> "$evfile" 2>/dev/null || true
    echo "secure-prefs-file=shared_prefs/zylod_secure.xml present (values encrypted by the app itself — content unreadable by design)" >> "$evfile" 2>/dev/null || true
  else
    INJECTION_REASON="shared_prefs/zylod_secure.xml missing after the bridge write (run-as ls saw: ${prefs_list:-nothing})"
    echo "prefs-written=no" >> "$evfile" 2>/dev/null || true
    echo "$role-failure-reason=$INJECTION_REASON" >> "$evfile" 2>/dev/null || true
    echo "::warning::inject_session($role): $INJECTION_REASON"
    return 1
  fi
  # (5) cold start so the verdict proves the token SURVIVED a restart
  adbt 15 am force-stop com.zylod.wholesale.debug >/dev/null 2>&1 || true
  adbt 10 logcat -c >/dev/null 2>&1 || true
  adbt 20 monkey -p com.zylod.wholesale.debug -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
  sleep 10
  if ! ensure_home; then
    INJECTION_REASON="post-relaunch ensure_home failed — home never mounted (role deeplinks would queue)"
    echo "$role-failure-reason=$INJECTION_REASON" >> "$evfile" 2>/dev/null || true
    echo "::warning::inject_session($role): $INJECTION_REASON"
    return 1
  fi
  INJECTION_REASON="ok"
  echo "injection-method=$INJECTION_METHOD" >> "$evfile" 2>/dev/null || true
  echo "inject_session($role): session injected ✓ (method=$INJECTION_METHOD) — cold start on home"
  return 0
}


# t241: login evidence — REAL shared_prefs dump. t239's
# `run-as ... sh -c 'cat shared_prefs/*.xml'` relied on a glob that never
# expanded inside run-as on the CI image, so login-prefs.txt held a useless
# listing of the data dir instead of the token prefs. Now: list
# shared_prefs, then cat every *.xml found (relative paths under run-as,
# per-file head -80 so one huge xml cannot drown the rest). Never fatal.
dump_login_prefs () {
  {
    echo "=== shared_prefs ($(date -u '+%Y-%m-%dT%H:%M:%SZ')) ==="
    PREFS_FILES=$(timeout 15 adb shell run-as com.zylod.wholesale.debug ls shared_prefs 2>/dev/null | tr -d '\r' || true)
    echo "$PREFS_FILES"
    for xml in $PREFS_FILES; do
      case "$xml" in
        *.xml)
          echo "===== shared_prefs/$xml ====="
          timeout 15 adb shell run-as com.zylod.wholesale.debug cat "shared_prefs/$xml" 2>/dev/null | head -80 || true
          ;;
      esac
    done
  } > screenshots/login-prefs.txt 2>&1 || true
}

# t241: auth logcat at decision time, scoped to the app's own pid when it
# is alive (--pid — the whole-device grep drowned in unrelated system
# lines); whole-device dump as fallback when pidof fails.
# t243 FIX: the old case-insensitive grep
# (auth|login|token|session|provenance|ServerConfig|okhttp) filled
# login-logcat.txt with ZylodProvenance lines — mislabeled evidence. Now:
# ONE raw dump to /tmp/llog.txt, then a STRICT case-sensitive filter
# (ZylodAuth|ZylodDeals|login|Login) into login-logcat.txt with a wc -l
# trace, AND the UNFILTERED last 400 lines into
# screenshots/login-logcat-full-pid.txt so nothing is hidden by the filter
# again. Never fatal.
dump_login_logcat () {
  local PID
  PID=$(app_pid)
  if [ -n "$PID" ]; then
    timeout 20 adb logcat -d --pid="$PID" > /tmp/llog.txt 2>/dev/null || true
  else
    timeout 20 adb logcat -d > /tmp/llog.txt 2>/dev/null || true
  fi
  grep -E "ZylodAuth|ZylodDeals|login|Login" /tmp/llog.txt > screenshots/login-logcat.txt 2>/dev/null || true
  wc -l screenshots/login-logcat.txt || true
  tail -400 /tmp/llog.txt > screenshots/login-logcat-full-pid.txt 2>/dev/null || true
}

# t249: ADMIN-SCOPED copies of dump_login_prefs / dump_login_logcat — same
# shape and conventions, but SEPARATE output files (admin-prefs.txt,
# admin-logcat.txt, admin-logcat-full-pid.txt) so the buyer login's
# decision-time evidence captured by login_buyer is never overwritten.
# dump_admin_logcat additionally greps the ZylodAdmin tag (the admin view-
# models' Log tag, AdminUsersViewModel.kt:360 et al). Never fatal.
dump_admin_prefs () {
  {
    echo "=== shared_prefs — admin segment ($(date -u '+%Y-%m-%dT%H:%M:%SZ')) ==="
    PREFS_FILES=$(timeout 15 adb shell run-as com.zylod.wholesale.debug ls shared_prefs 2>/dev/null | tr -d '\r' || true)
    echo "$PREFS_FILES"
    for xml in $PREFS_FILES; do
      case "$xml" in
        *.xml)
          echo "===== shared_prefs/$xml ====="
          timeout 15 adb shell run-as com.zylod.wholesale.debug cat "shared_prefs/$xml" 2>/dev/null | head -80 || true
          ;;
      esac
    done
  } > screenshots/admin-prefs.txt 2>&1 || true
}

dump_admin_logcat () {
  local PID
  PID=$(app_pid)
  if [ -n "$PID" ]; then
    timeout 20 adb logcat -d --pid="$PID" > /tmp/allog.txt 2>/dev/null || true
  else
    timeout 20 adb logcat -d > /tmp/allog.txt 2>/dev/null || true
  fi
  grep -E "ZylodAuth|ZylodDeals|ZylodAdmin|login|Login" /tmp/allog.txt > screenshots/admin-logcat.txt 2>/dev/null || true
  wc -l screenshots/admin-logcat.txt || true
  tail -400 /tmp/allog.txt > screenshots/admin-logcat-full-pid.txt 2>/dev/null || true
}

# t241: deals logcat (ZylodDeals), same --pid scoping as the login evidence
# when the app pid is available; unfiltered -s dump otherwise. Never fatal.
dump_deals_logcat () {
  local PID
  PID=$(app_pid)
  if [ -n "$PID" ]; then
    timeout 20 adb logcat -d --pid="$PID" -s ZylodDeals 2>/dev/null
  else
    timeout 20 adb logcat -d -s ZylodDeals 2>/dev/null
  fi
}

# t243: deals evidence dump — SAME treatment as dump_login_logcat (raw
# pid-scoped dump to a temp file, grep the tag from it, wc -l trace) plus
# the raw server response via curl /api/deals. Called UNCONDITIONALLY right
# after the 10-deals capture (previously these dumps ran ONLY on settle-
# timeout, so a "settled" capture left zero logcat/server evidence and a
# silent failure stayed invisible). Appends — capture 22's earlier
# settle-timeout evidence is preserved. Never fatal.
dump_deals_evidence () {
  local PID
  PID=$(app_pid)
  if [ -n "$PID" ]; then
    timeout 20 adb logcat -d --pid="$PID" > /tmp/dlog.txt 2>/dev/null || true
  else
    timeout 20 adb logcat -d > /tmp/dlog.txt 2>/dev/null || true
  fi
  {
    echo "=== 10-deals post-capture $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
    grep -E "ZylodDeals" /tmp/dlog.txt 2>/dev/null || true
  } >> screenshots/deals-logcat.txt 2>&1 || true
  echo "deals evidence: $(wc -l < screenshots/deals-logcat.txt 2>/dev/null || echo 0) lines in deals-logcat.txt"
  timeout 10 curl -s "http://127.0.0.1:3000/api/deals?type=all&page=1&limit=5" 2>/dev/null | head -c 800 >> screenshots/server-deals.json 2>/dev/null || true
  echo >> screenshots/server-deals.json 2>/dev/null || true
  echo "deals evidence: $(wc -c < screenshots/server-deals.json 2>/dev/null || echo 0) bytes in server-deals.json"
}

# t234: deep-link capture helper — fire a VIEW intent on the debug package
# (rides onNewIntent; unknown pageIds route natively via NativePageRegistry),
# let the page settle, screenshot. Never fatal: an am start failure is
# tolerated and the capture still runs.
deeplink () { # name sleep_seconds uri
  if budget_stop; then return 0; fi
  adbt 15 am start -a android.intent.action.VIEW -d "$3" com.zylod.wholesale.debug >/dev/null 2>&1
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
  if budget_stop; then return 1; fi
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
  adbt 20 input keyevent 4
  sleep 2
  tap_tab "Home" || true
  for i in 1 2 3 4; do
    sleep 2
    any_text_on_screen "Hot deals" "Featured products" && return 0
  done
  adbt 20 input keyevent 4
  sleep 2
  tap_tab "Home" || true
  for i in 1 2 3 4; do
    sleep 2
    any_text_on_screen "Hot deals" "Featured products" && return 0
  done
  # Last resort: BACK may have exited the task to the launcher — re-launch.
  log "ensure_home: relaunching the app to recover HOME_ROUTE"
  adbt 20 monkey -p com.zylod.wholesale.debug -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
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
  if budget_stop; then return 0; fi
  if ensure_home; then
    deeplink "$1" "$2" "$3"
  else
    echo "::warning::ensure_home failed — skipping '$1' capture (queue desync guard)"
  fi
}

# t244: does the CURRENT screen hold the MAIN login form — and nothing on
# top of it? Needle: "Email or Phone" — the main form's own hint (verified
# string in LoginScreen.kt; uia matching is a case-sensitive substring of
# "Email or Phone Number"). Anti-markers: "Display name" (the consent
# dialog's optional field) and "Sign in with your email" (the dialog's
# heading) — either one present means the social consent dialog is
# contaminating the screen AND the EditText list, so the mount is not clean.
# Every ui_has_text call dumps fresh; all three probes must agree. Never
# fatal (a failed dump simply reads as "not ok").
login_screen_ok () {
  ui_has_text "Email or Phone" \
    && ! ui_has_text "Display name" \
    && ! ui_has_text "Sign in with your email"
}

# t244: rebuild a CLEAN login mount from wherever we are. The guest policy
# opens the native login through the bottom-bar Profile tab, so: tap Home →
# sleep 3 → tap Profile → sleep 4 → login_screen_ok. If we were ALREADY on
# the login screen, the tab taps find no bottom bar (fullscreen routes hide
# it) and change nothing — the identity check then passes on the screen as
# it stands. A fresh Profile-tab mount can never have the consent dialog
# open (it opens ONLY via "Continue with Email"), which is exactly why
# login_buyer needs no dismiss_email_dialog at all. Returns 0 iff the main
# form is verified up (the 2-attempt policy lives in the caller). Never
# fatal.
fresh_login_mount () {
  tap_tab "Home" || true
  sleep 3
  tap_tab "Profile" || true
  sleep 4
  login_screen_ok
}

# t249: clear the buyer session the authed suite left over, so the admin
# segment can sign in as the seeded admin. The Profile screen is the only
# surface with a "Sign out" control (ProfileScreen.kt:151,
# onClick = vm::signOut — no confirmation dialog): tap the bottom-bar
# Profile tab; when the bar is unreachable (a fullscreen route hides it)
# recover via ensure_home first. Already-guest (the buyer login failed
# earlier in this run) → verified no-op. Best-effort: every step non-fatal;
# a stuck session only means login_admin honestly reports an unverified
# admin session and the three admin captures show the gate.
sign_out_current_session () {
  tap_tab "Profile" || true
  sleep 6
  if ! ui_has_text "Sign out"; then
    if ensure_home; then
      tap_tab "Profile" || true
      sleep 6
    fi
  fi
  if ! ui_has_text "Sign out"; then
    echo "sign_out_current_session: no 'Sign out' visible — already guest (or the Profile gate); nothing to clear"
    return 0
  fi
  tap_clickable_text "Sign out" || true
  sleep 6
  if ui_has_text "Sign out"; then
    echo "::warning::sign_out_current_session: 'Sign out' STILL visible after the tap — session may persist; login_admin will report the honest outcome"
    return 1
  fi
  echo "sign_out_current_session: session cleared ✓ (the next Profile tap opens the native login via the guest policy)"
  return 0
}

# t244: verdict of the LATEST check_typed_text run — it appends exactly two
# lines per call (email line first) to screenshots/login-typed-check.txt, so
# tail -2 is always the newest pair. Exit 0 iff typed-email-registered=yes.
# Never fatal (missing file / grep miss reads as "no").
typed_email_ok () {
  tail -2 screenshots/login-typed-check.txt 2>/dev/null | grep -q "^typed-email-registered=yes$"
}

# t249: verdict of the LATEST check_admin_typed_text run — same tail -2
# contract as typed_email_ok (the admin variant appends exactly two lines
# per call, admin-email-registered first). Never fatal (missing file /
# grep miss reads as "no").
admin_typed_email_ok () {
  tail -2 screenshots/admin-login-check.txt 2>/dev/null | grep -q "^admin-email-registered=yes$"
}

# t244: type BOTH login fields, each after its OWN fresh dump — the first
# tap + IME can shift the layout, so field #2's bounds come from a dump
# taken AFTER field #1 was typed (EditText#1 = email, #2 = password; Compose
# OutlinedTextFields surface in form order — same assumption edittext_center
# documents). Cadence per the t244 spec: tap → sleep 1 → input text →
# hide_ime (→ sleep 1 before the next dump). Never fatal: a missing field
# only warns; check_typed_text records what actually landed.
# t249: optional $1 = the email to type (default stays the seeded buyer);
# the admin segment passes the seeded admin's address. The password is the
# one shared seeded password seed-marketplace.mjs registers every account
# with (same string the buyer flow below already types).
login_type_fields () { # [email]
  local email="${1:-buyer1@zylod.bd}"
  adbt 20 uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  timeout 15 adb pull /sdcard/ui.xml /tmp/ui.xml > /dev/null 2>&1 || true
  local c
  c=$(edittext_center 1 /tmp/ui.xml)
  if [ -n "$c" ]; then
    adbt 20 input tap $c
    sleep 1
    adbt 20 input text "$email"
    hide_ime
    sleep 1
  else
    echo "::warning::login_type_fields: no EditText#1 (email) in the dump"
  fi
  adbt 20 uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  timeout 15 adb pull /sdcard/ui.xml /tmp/ui.xml > /dev/null 2>&1 || true
  c=$(edittext_center 2 /tmp/ui.xml)
  if [ -n "$c" ]; then
    adbt 20 input tap $c
    sleep 1
    adbt 20 input text "Passw0rd!23"
    hide_ime
  else
    echo "::warning::login_type_fields: no EditText#2 (password) in the dump"
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
# (LoginScreen.kt).
#
# t244 STATE MACHINE (replaces the t243 dismiss-then-type flow): t243's run
# typed nothing (typed-email-registered=no) and submitted nothing — the
# dismiss_email_dialog BACK fallback fired on a mis-detected dialog and
# popped the LOGIN ROUTE, so every later tap and keystroke landed on Home.
# login_buyer therefore no longer dismisses dialogs and no longer trusts the
# incoming screen:
#   a. CLEAN MOUNT — fresh_login_mount ×2 (bottom-bar Home → Profile);
#      login_screen_ok must prove the MAIN form ("Email or Phone" hint, NO
#      dialog markers). Failure: 04z-login-screen-wrong.png + loud warning
#      + guest path (return 1, never fatal).
#   b. TYPE EMAIL — fresh dump → tap EditText#1 center → sleep 1 → type →
#      hide_ime → sleep 1.
#   c. TYPE PASSWORD — FRESH dump again (bounds can shift) → tap EditText#2
#      center → sleep 1 → type → hide_ime.
#   d. TYPED CHECK — check_typed_text → screenshots/login-typed-check.txt.
#   e. typed-email=no → ONE retype round on a fresh mount (retype runs only
#      when the mount VERIFIES — typing into an unknown screen would poison
#      both the form and the verdict). STILL no → submit anyway: an empty
#      submit still emits a ZylodAuth log line proving the button works,
#      which disambiguates tap-miss vs typing-fail in the artifact.
#   f. SUBMIT — tap_clickable_text "Login" (its built-in fallback is
#      tap_text "Login"); trace line "login: submit tapped (typed= yes/no)".
#   g. sleep 14 → 04b-after-login-tap.png captured UNCONDITIONALLY.
#   h. STRICT VERIFY (login_verify_ok). On fail: ONE full retry round —
#      fresh mount → retype (only when the mount verifies) → re-tap Login →
#      sleep 14 → 04c-after-login-retry.png captured UNCONDITIONALLY on
#      every retry attempt → re-verify. Final fail: warning + evidence
#      dumps + return 1.
#   i. Decision-time evidence either way: dump_login_prefs +
#      dump_login_logcat; success → return 0.
login_buyer () {
  local attempt i mounted=0 verified=0 typed="no"
  # (a) clean mount — 2 attempts; failure is the guest path (never fatal).
  for attempt in 1 2; do
    if fresh_login_mount; then
      mounted=1
      break
    fi
    echo "login_buyer: fresh mount attempt $attempt — main login form NOT verified"
  done
  if [ "$mounted" -eq 0 ]; then
    echo "::warning::login_buyer: NOT on the login screen after 2 fresh mounts (login_screen_ok failed both times) — capturing screenshots/04z-login-screen-wrong.png and continuing as GUEST (non-fatal)"
    cap screenshots/04z-login-screen-wrong.png
    return 1
  fi
  # (b)+(c) type both fields (fresh dump per field), then (d) the typed
  # proof into screenshots/login-typed-check.txt.
  login_type_fields
  check_typed_text
  if typed_email_ok; then typed="yes"; fi
  # (e) typed-email=no → ONE retype round; still no → submit ANYWAY (the
  # empty-submit ZylodAuth log line disambiguates tap-miss vs typing-fail).
  if [ "$typed" != "yes" ]; then
    echo "::warning::login_buyer: typed-email-registered=no — ONE retype round (fresh mount + fresh per-field dumps)"
    if fresh_login_mount; then
      login_type_fields
    else
      echo "::warning::login_buyer: retype round skipped — fresh mount still cannot verify the login form (submit below proceeds for diagnostics)"
    fi
    check_typed_text
    if typed_email_ok; then
      typed="yes"
    else
      echo "::warning::login_buyer: typed-email STILL no — submitting ANYWAY (empty submit still emits a ZylodAuth log line iff the button works)"
    fi
  fi
  # (f) submit — tap_clickable_text falls back to tap_text internally when
  # no clickable "Login" node exists.
  tap_clickable_text "Login"
  echo "login: submit tapped (typed= $typed)"
  # (g) settle, then the post-tap diagnostic — UNCONDITIONAL (whether or not
  # verification passes; ground truth for what the screen showed).
  sleep 14
  cap screenshots/04b-after-login-tap.png
  # (h) strict verify; on fail ONE full retry round.
  for i in 1 2 3; do
    if login_verify_ok; then
      verified=1
      break
    fi
    sleep 5
  done
  if [ "$verified" -eq 0 ]; then
    echo "::warning::login_buyer: AUTH NOT VERIFIED after the first submit — ONE retry round: fresh mount → retype → re-tap Login"
    if fresh_login_mount; then
      login_type_fields
    else
      echo "::warning::login_buyer: retry retype skipped — fresh mount cannot verify the login form (re-tap below still runs)"
    fi
    tap_clickable_text "Login"
    echo "login: submit re-tapped (retry round, typed= $typed)"
    sleep 14
    # Retry's own diagnostic — kept SEPARATE so the first 04b survives —
    # captured UNCONDITIONALLY on every retry attempt.
    cap screenshots/04c-after-login-retry.png
    echo "trace: 04c captured (retry attempt, unconditional)"
    for i in 1 2 3; do
      if login_verify_ok; then
        verified=1
        break
      fi
      sleep 5
    done
  fi
  # (i) decision-time evidence either way (t241 helpers; never fatal).
  dump_login_prefs
  dump_login_logcat
  if [ "$verified" -eq 1 ]; then
    echo "login_buyer: authed ✓ (strict verify: Sign out, or home without login-screen signals)"
    return 0
  fi
  echo "::warning::login_buyer: AUTH NOT VERIFIED after the retry round — continuing as guest; downstream gated captures will show the login gate (acceptable, non-fatal)"
  return 1
}

# t249: sign in the SEEDED ADMIN (scripts/qa/seed-marketplace.mjs registers
# it through the real /api/auth/register rails as the FIRST account on the
# empty CI database — the admin-bootstrap gate (adminCount == 0) admits it:
# market@zylod.bd, the shared seeded password, userType "admin") on the SAME
# native login screen login_buyer uses, then verify the session. Mirrors the
# t244 state machine exactly (clean mount → per-field typing with fresh
# dumps → typed proof → submit → sleep 14 → unconditional diagnostic →
# strict verify → ONE full retry round → decision-time evidence), with
# three admin-specific differences:
#   1. the typed email is the seeded admin's (passed to login_type_fields),
#      proven by check_admin_typed_text into screenshots/admin-login-check.txt
#      (admin-email-registered / admin-password-registered);
#   2. evidence files are ADMIN-SCOPED (admin-prefs.txt, admin-logcat.txt,
#      admin-logcat-full-pid.txt) so the buyer's decision-time dumps
#      survive;
#   3. the verdict + a verbatim failure reason land in
#      screenshots/admin-login-check.txt (admin-session-verified=yes/no,
#      admin-failure-reason=...).
# Returns 0 when the admin session is verified, 1 otherwise (the caller
# still captures the three admin surfaces — they will honestly show the
# gate; never fatal).
login_admin () {
  local attempt i mounted=0 verified=0 typed="no" reason="unknown"
  for attempt in 1 2; do
    if fresh_login_mount; then
      mounted=1
      break
    fi
    echo "login_admin: fresh mount attempt $attempt — main login form NOT verified"
  done
  if [ "$mounted" -eq 0 ]; then
    echo "::warning::login_admin: NOT on the login screen after 2 fresh mounts — capturing screenshots/27z-admin-login-screen-wrong.png and skipping the admin sign-in (non-fatal)"
    cap screenshots/27z-admin-login-screen-wrong.png
    {
      echo "admin-session-verified=no"
      echo "admin-failure-reason=login screen never mounted (login_screen_ok failed after 2 fresh mounts — see 27z-admin-login-screen-wrong.png)"
    } >> screenshots/admin-login-check.txt 2>/dev/null || true
    return 1
  fi
  # (b)+(c) type both fields with the ADMIN email (fresh dump per field),
  # then (d) the typed proof into screenshots/admin-login-check.txt.
  login_type_fields "market@zylod.bd"
  check_admin_typed_text
  if admin_typed_email_ok; then typed="yes"; fi
  # (e) admin-email-registered=no → ONE retype round; still no → submit
  # ANYWAY (the empty-submit ZylodAuth log line disambiguates tap-miss vs
  # typing-fail).
  if [ "$typed" != "yes" ]; then
    echo "::warning::login_admin: admin-email-registered=no — ONE retype round (fresh mount + fresh per-field dumps)"
    if fresh_login_mount; then
      login_type_fields "market@zylod.bd"
    else
      echo "::warning::login_admin: retype round skipped — fresh mount still cannot verify the login form (submit below proceeds for diagnostics)"
    fi
    check_admin_typed_text
    if admin_typed_email_ok; then
      typed="yes"
    else
      reason="typed admin email never landed in the login form (admin-email-registered=no after the retype round)"
      echo "::warning::login_admin: admin-email STILL no — submitting ANYWAY (empty submit still emits a ZylodAuth log line iff the button works)"
    fi
  fi
  # (f) submit — tap_clickable_text falls back to tap_text internally when
  # no clickable "Login" node exists.
  tap_clickable_text "Login"
  echo "admin: submit tapped (typed= $typed)"
  echo "admin-login-submitted=yes" >> screenshots/admin-login-check.txt 2>/dev/null || true
  # (g) settle, then the post-tap diagnostic — UNCONDITIONAL.
  sleep 14
  cap screenshots/27z-after-admin-login-tap.png
  # (h) strict verify (the same signed-in needles as login_buyer — the only
  # credentials submitted in this segment are the admin's, so a verified
  # session IS the admin session); on fail ONE full retry round.
  for i in 1 2 3; do
    if login_verify_ok; then
      verified=1
      break
    fi
    sleep 5
  done
  if [ "$verified" -eq 0 ]; then
    echo "::warning::login_admin: admin session NOT verified after the first submit — ONE retry round: fresh mount → retype → re-tap Login"
    if fresh_login_mount; then
      login_type_fields "market@zylod.bd"
    else
      echo "::warning::login_admin: retry retype skipped — fresh mount cannot verify the login form (re-tap below still runs)"
    fi
    tap_clickable_text "Login"
    echo "admin: submit re-tapped (retry round, typed= $typed)"
    sleep 14
    cap screenshots/27z-after-admin-login-retry.png
    for i in 1 2 3; do
      if login_verify_ok; then
        verified=1
        break
      fi
      sleep 5
    done
  fi
  # (i) decision-time evidence either way (admin-scoped; never fatal).
  dump_admin_prefs
  dump_admin_logcat
  if [ "$verified" -eq 1 ]; then
    echo "login_admin: admin session verified ✓ (strict verify: Sign out, or home without login-screen signals)"
    echo "admin-session-verified=yes" >> screenshots/admin-login-check.txt 2>/dev/null || true
    return 0
  fi
  if [ "$typed" = "yes" ]; then
    reason="submit fired but no signed-in state was verified (login_verify_ok failed after submit + retry — see 27z-after-admin-login-retry.png and admin-logcat.txt)"
  fi
  {
    echo "admin-session-verified=no"
    echo "admin-failure-reason=$reason"
  } >> screenshots/admin-login-check.txt 2>/dev/null || true
  echo "::warning::login_admin: admin session NOT verified — the three admin captures will honestly show the gate (non-fatal)"
  return 1
}

log "Installing APK"
timeout 120 adb install -r android/app/build/outputs/apk/debug/app-debug.apk || echo "::warning::apk install failed"
# t238: keep the software IME out of the way when a hard keyboard is
# attached — `input text` injects events directly, and a hidden IME cannot
# cover the second EditText when login_buyer taps it.
adbt 20 settings put secure show_ime_with_hard_keyboard 0 > /dev/null 2>&1

log "Launching app (Welcome gate)"
adbt 20 monkey -p com.zylod.wholesale.debug -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
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
# t238/t239: state.loading renders ONLY a full-screen spinner — t237's fixed
# 10s sleep caught it mid-load (11.5KB, no content). t239 DEFECT 3b: settle-
# poll 25s (5×5s), retry round, then evidence dumps on final timeout.
# ANTI-FALSE-POSITIVE: needles are card/list-level strings verified in
# DealsScreen.kt and NONE matches the "Hot Deals" top-bar title or bottom
# tab: "Flash Deals"/"Daily Deals" (LazyColumn section headers, rendered
# only once the list is up), "daily deals" (meta line "N flash • N daily
# deals"), "sold"/"Sold out" (DealCard urgency lines). "Deal" and bare
# "Hot Deals" remain REJECTED (top-bar/tab matches while spinner is up).
# "Claim" does not exist anywhere in DealsScreen.kt — never guessed.
DEALS_NEEDLES=("Flash Deals" "Daily Deals" "daily deals" "sold" "Sold out")
DEALS_SETTLED=0
for i in 1 2 3 4 5; do
  sleep 5
  if any_text_on_screen "${DEALS_NEEDLES[@]}"; then
    DEALS_SETTLED=1
    break
  fi
done
if [ "$DEALS_SETTLED" -eq 0 ]; then
  echo "::warning::hot-deals content not detected after 25s — retry tap + wait (25s more)"
  tap_tab "Hot Deals" || true
  for i in 1 2 3 4 5; do
    sleep 5
    if any_text_on_screen "${DEALS_NEEDLES[@]}"; then
      DEALS_SETTLED=1
      break
    fi
  done
fi
if [ "$DEALS_SETTLED" -eq 0 ]; then
  echo "::warning::capture 22: deal content not detected — capturing anyway + evidence dumps (server-empty vs app-bug)"
  {
    echo "=== 22-hot-deals-tab settle timeout $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
    dump_deals_logcat
  } >> screenshots/deals-logcat.txt 2>&1 || true
  timeout 10 curl -s "http://127.0.0.1:3000/api/deals?type=all&page=1&limit=5" 2>/dev/null | head -c 800 >> screenshots/server-deals.json 2>/dev/null || true
  echo >> screenshots/server-deals.json 2>/dev/null || true
fi
cap screenshots/22-hot-deals-tab.png
tap_tab "Home"
sleep 10
cap screenshots/23-home-return-from-hot-deals.png

# System BACK from a web tab → NavHost pops → home must be visible again.
tap_tab "Search"
sleep 10
adbt 20 input keyevent 4
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
  adbt 15 am start -a android.intent.action.VIEW -d "zylod://privacy-policy" com.zylod.wholesale.debug > /dev/null 2>&1
  sleep 12
fi
SW=$(timeout 20 adb shell wm size | grep -oE '[0-9]+' | head -1 | tr -d '[:space:]')
SH=$(timeout 20 adb shell wm size | grep -oE '[0-9]+' | tail -1 | tr -d '[:space:]')
SW=${SW:-320}; SH=${SH:-640}
CX=$((SW / 2)); Y1=$((SH * 3 / 4)); Y2=$((SH / 5))
for i in 1 2 3 4 5 6 7 8; do
  budget_stop && break
  adbt 20 input swipe $CX $Y1 $CX $Y2 400
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
# t244: the consent dialog can ONLY exist right here (it opens via
# "Continue with Email" and capture 04 just opened it) — dismiss it NOW via
# the robust helper (Cancel chain + verified re-dumps; BACK only as a
# verified last resort). This is the ONLY dismiss_email_dialog call site in
# the script: login_buyer rebuilds its own clean mount instead, so t243's
# failure mode (a BACK fired on a mis-detected dialog popping the login
# route, stranding the flow on Home) cannot reach the login state machine.
dismiss_email_dialog || true

log "t238: guest-context evidence BEFORE login — 05 register + 09 orders-guest"
# These two captures must stay GUEST (the register screen and the Phase 2
# ownership row: unauthenticated buyer-orders shows the in-screen sign-in
# CTA, never a redirect). They are deep links, so each is fired ONLY after
# ensure_home — a link fired off-home queues (ZylodRoot drains on
# HOME_ROUTE only) and that is how t237 captured wrong screens. The consent
# dialog was already dismissed right after capture 04 (dismiss_email_dialog
# above), so the ensure_home BACK-chain starts clean — BACK with no dialog
# would pop the login route instead.
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
# login_buyer (t244 state machine: fresh-mount identity check → per-field
# typing with fresh dumps → diagnostic submit → strict verify).
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

# t249-f BUYER SESSION INJECTION — the deterministic auth establishment.
# login_buyer above is KEPT (its typed-text proof + decision-time dumps are
# the UI-path evidence), but when it fails to verify, the authed suite no
# longer degrades to guest shots: a REAL session is established via the
# backend's login API + the app's own bridge writer, then proven on a cold
# start. This also covers the t249-f wire-in for capture 18 below (which
# runs its own strict settle-poll verdict into buyer-session-check.txt).
BUYER_INJECTED=0
if [ "$AUTHED" -eq 0 ] && ! budget_stop; then
  log "t249-f: buyer UI login failed — DETERMINISTIC SESSION INJECTION (real /api/auth/login -> ZylodNativeBridge.setAuthToken via the app's WebView/CDP -> cold start)"
  if inject_session "buyer1@zylod.bd" "Passw0rd!23" "buyer" "screenshots/buyer-session-check.txt" "buyer"; then
    BUYER_INJECTED=1
    AUTHED=1
  fi
fi

if [ "$AUTHED" -eq 1 ]; then
  log "t238: authed deep-link suite (seeded buyer session; t249-f injection used: $BUYER_INJECTED)"
else
  log "t238: deep-link suite (GUEST fallback — gated captures will show the sign-in gate)"
fi
# Order: PDP (real seeded product) → cart (authed now) → registry suite →
# app-link wallet → authed profile → authed orders. Numbers follow the
# orchestrator's plan (08 reserved); every call is non-fatal.
# t239 DEFECT 2: 06-product-detail was silently skipped in the last run
# whenever PRODUCT_ID was empty in the CI env — the guard chain produced no
# warning that named the cause. Now: self-fetch the id right here, trace the
# decision, ALWAYS attempt the deeplink when an id exists, and settle-poll
# the PDP before capturing.
echo "capture 06: PRODUCT_ID=${PRODUCT_ID:-} (before self-fetch)"
if [ -z "${PRODUCT_ID:-}" ]; then
  PRODUCT_ID=$(timeout 10 curl -s "http://127.0.0.1:3000/api/products?limit=1" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data'][0]['id'])" 2>/dev/null || true)
  echo "capture 06: self-fetched PRODUCT_ID=$PRODUCT_ID from /api/products?limit=1"
fi
echo "${PRODUCT_ID:-}" > screenshots/product-id.txt 2>/dev/null || true
if budget_stop; then
  echo "capture 06: SKIPPED — capture budget exhausted"
elif [ -n "$PRODUCT_ID" ]; then
  if ensure_home; then
    echo "capture 06: PRODUCT_ID=$PRODUCT_ID ensure_home=0 — firing zylod://product/$PRODUCT_ID"
    adbt 15 am start -a android.intent.action.VIEW -d "zylod://product/$PRODUCT_ID" com.zylod.wholesale.debug >/dev/null 2>&1
    # t239 DEFECT 2c: settle-poll up to 20s (4×5s) for REAL PDP content.
    # Needles verified in ProductDetailScreen.kt (NOT guessed):
    #   "MOQ"        — "Quantity (MOQ: N)" stepper label (line 615; the
    #                  Min. Order InfoTile + Q&A copy also contain it)
    #   "Add to Cart" — ActionRow button (line 811, capital C — the spec's
    #                  "Add to cart" DOES NOT EXIST in the source)
    #   "In Stock"   — InfoTile (line 925). "BDT" never renders (prices use "৳").
    # All render only when state.product != null — never on PdpLoading.
    PDP_SETTLED=0
    for i in 1 2 3 4; do
      sleep 5
      if any_text_on_screen "MOQ" "Add to Cart" "In Stock"; then
        PDP_SETTLED=1
        break
      fi
    done
    if [ "$PDP_SETTLED" -eq 0 ]; then
      echo "::warning::capture 06: PDP content not detected within 20s — capturing current state anyway"
    fi
    cap "screenshots/06-product-detail.png"
  else
    echo "capture 06: PRODUCT_ID=$PRODUCT_ID ensure_home=1 — SKIPPED (ensure_home failed; the link would queue off-home)"
    echo "::warning::capture 06-product-detail skipped: ensure_home failed (PRODUCT_ID=$PRODUCT_ID available)"
  fi
else
  echo "capture 06: PRODUCT_ID= — SKIPPED (empty id: env unset AND /api/products fetch returned nothing)"
  echo "::warning::capture 06-product-detail skipped: PRODUCT_ID empty (env unset + server fetch failed)"
fi
guarded_deeplink "07-cart" 8 "zylod://cart"
# t239 DEFECT 3a: 10-deals captured a bare spinner (state.loading renders
# ONLY a full-screen CircularProgressIndicator). Settle-poll up to 25s
# (5×5s) for card-level deal content; on timeout capture anyway + dump the
# deals logcat tag and the raw server response so the artifact itself shows
# server-empty vs app-bug. t243: those evidence dumps now ALSO run
# UNCONDITIONALLY right after the capture (dump_deals_evidence below) —
# not only on settle-timeout. Same verified card-level needle set as capture
# 22 (see DealsScreen.kt audit there) — the "Hot Deals" top-bar title can
# never satisfy the poll.
if budget_stop; then
  echo "capture 10: SKIPPED — capture budget exhausted"
elif ensure_home; then
  echo "capture 10: ensure_home=0 — firing zylod://deals"
  adbt 15 am start -a android.intent.action.VIEW -d "zylod://deals" com.zylod.wholesale.debug >/dev/null 2>&1
  DEALS_SETTLED=0
  for i in 1 2 3 4 5; do
    sleep 5
    if any_text_on_screen "${DEALS_NEEDLES[@]}"; then
      DEALS_SETTLED=1
      break
    fi
  done
  if [ "$DEALS_SETTLED" -eq 0 ]; then
    echo "::warning::capture 10: deal content not detected within 25s — capturing anyway + evidence dumps (server-empty vs app-bug)"
    {
      echo "=== 10-deals settle timeout $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
      dump_deals_logcat
    } >> screenshots/deals-logcat.txt 2>&1 || true
    timeout 10 curl -s "http://127.0.0.1:3000/api/deals?type=all&page=1&limit=5" 2>/dev/null | head -c 800 >> screenshots/server-deals.json 2>/dev/null || true
    echo >> screenshots/server-deals.json 2>/dev/null || true
  fi
  cap "screenshots/10-deals.png"
  # t243: evidence UNCONDITIONALLY after the capture (previously only on
  # settle-timeout) — ZylodDeals logcat grep → deals-logcat.txt and the raw
  # server deals JSON → server-deals.json, so a silent failure can never
  # hide behind a "settled" capture again.
  dump_deals_evidence
else
  echo "capture 10: SKIPPED — ensure_home=1 (zylod://deals fired off-home would queue)"
  echo "::warning::capture 10-deals skipped: ensure_home failed (queue desync guard)"
fi
guarded_deeplink "11-search" 8 "zylod://search"
guarded_deeplink "12-seller-dashboard" 10 "zylod://seller-dashboard"
guarded_deeplink "13-wallet" 8 "zylod://wallet"
guarded_deeplink "14-notifications" 8 "zylod://notifications"
guarded_deeplink "15-admin-dashboard" 10 "zylod://admin-dashboard"
# App-Link path proof: the https host-form must resolve to the same native
# wallet page as zylod://wallet above.
guarded_deeplink "16-applink-wallet" 8 "https://zylod.com/?page=wallet"
guarded_deeplink "17-profile" 10 "zylod://profile"
# t249-f: 18-orders-authed with a STRICT signed-in verdict (replaces the
# blind guarded_deeplink). Needles verified in OrdersScreen.kt:
#   gate   — "Sign in to see your orders" (:425) renders ONLY when
#            SessionManager.token() == null (OrdersViewModel gate state);
#   authed — "No orders yet" (:376) — the OrdersEmpty state; the seeded
#            buyer has no orders, so this is the expected signed-in screen.
# Verdict: settled AND gate ABSENT -> buyer-session-verified=yes. The poll
# terminates as soon as EITHER marker shows (never a bare-spinner capture).
if budget_stop; then
  echo "capture 18: SKIPPED — capture budget exhausted"
  {
    echo "=== 18-orders-authed $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
    echo "buyer-session-verified=no"
    echo "buyer-failure-reason=capture budget exhausted before capture 18"
  } >> screenshots/buyer-session-check.txt 2>/dev/null || true
elif ensure_home; then
  echo "capture 18: ensure_home=0 — firing zylod://buyer-orders with a strict signed-in settle-poll"
  adbt 15 am start -a android.intent.action.VIEW -d "zylod://buyer-orders" com.zylod.wholesale.debug >/dev/null 2>&1
  ORDERS_SETTLED=0
  for i in 1 2 3 4 5; do
    sleep 5
    if any_text_on_screen "No orders yet" "Sign in to see your orders"; then
      ORDERS_SETTLED=1
      break
    fi
  done
  BUYER_GATE=no
  if any_text_on_screen "Sign in to see your orders"; then
    BUYER_GATE=yes
  fi
  cap "screenshots/18-orders-authed.png"
  {
    echo "=== 18-orders-authed verdict $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
    echo "buyer-injection-method=$(grep '^injection-method=' screenshots/buyer-session-check.txt 2>/dev/null | tail -1 | cut -d= -f2 || true)"
    echo "buyer-orders-settled=$ORDERS_SETTLED"
    echo "buyer-orders-gate-marker=$BUYER_GATE"
    if [ "$ORDERS_SETTLED" -eq 1 ] && [ "$BUYER_GATE" = "no" ]; then
      echo "buyer-session-verified=yes"
    else
      echo "buyer-session-verified=no"
      if [ "$BUYER_GATE" = "yes" ]; then
        echo "buyer-failure-reason=orders gate still shown after the deeplink (session not established on cold start; see buyer-session-check.txt injection lines above)"
      else
        echo "buyer-failure-reason=orders screen never settled within 25s (neither the gate marker nor 'No orders yet' appeared)"
      fi
    fi
  } >> screenshots/buyer-session-check.txt 2>/dev/null || true
else
  echo "capture 18: SKIPPED — ensure_home=1 (zylod://buyer-orders fired off-home would queue)"
  echo "::warning::capture 18-orders-authed skipped: ensure_home failed (queue desync guard)"
  {
    echo "=== 18-orders-authed $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
    echo "buyer-session-verified=no"
    echo "buyer-failure-reason=ensure_home failed — the buyer-orders deeplink was skipped (queue desync guard)"
  } >> screenshots/buyer-session-check.txt 2>/dev/null || true
fi
# t248: the two typed admin surfaces — moderation + operations queues.
guarded_deeplink "19-admin-users" 10 "zylod://admin-users"
guarded_deeplink "20-admin-orders" 10 "zylod://admin-orders"

log "t249: AUTHED ADMIN segment — buyer sign-out, seeded-admin sign-in (market@zylod.bd from scripts/qa/seed-marketplace.mjs), three authed admin captures"
{
  echo "=== t249 admin segment start $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
  echo "admin-email-typed-target=market@zylod.bd"
} >> screenshots/admin-login-check.txt 2>/dev/null || true
ADMIN_AUTHED=0
if budget_stop; then
  {
    echo "admin-session-verified=no"
    echo "admin-failure-reason=capture budget exhausted before the admin segment"
    echo "injection-method=none"
    echo "api-login=err"
    echo "prefs-written=no"
  } >> screenshots/admin-login-check.txt 2>/dev/null || true
else
  sign_out_current_session || true
  if login_admin; then
    ADMIN_AUTHED=1
  fi
  if [ "$ADMIN_AUTHED" -eq 1 ]; then
    log "t249: admin UI-login path verified ✓ (kept as evidence; the t249-f injection below is still the authoritative step)"
  else
    log "t249: admin session NOT verified via UI — capturing the three admin surfaces anyway (honest gate shots; reason in admin-login-check.txt)"
  fi
  # t249-f UNCONDITIONAL ADMIN SESSION INJECTION — the authoritative step.
  # Whatever the kept UI attempt left behind (admin / buyer / guest), a REAL
  # admin session is established through the backend's login API + the app's
  # own bridge writer and proven on a cold start. Strictness contract: the
  # admin-session-verified verdict written at capture 25 below is yes ONLY
  # when every injection step succeeded AND the post-relaunch evidence agrees.
  ADMIN_INJECTED=0
  ADMIN_REASON="not attempted"
  if budget_stop; then
    ADMIN_REASON="capture budget exhausted before the admin injection"
    {
      echo "injection-method=none"
      echo "api-login=err"
      echo "prefs-written=no"
      echo "admin-failure-reason=$ADMIN_REASON"
    } >> screenshots/admin-login-check.txt 2>/dev/null || true
  elif inject_session "market@zylod.bd" "Passw0rd!23" "admin" "screenshots/admin-login-check.txt" "admin"; then
    ADMIN_INJECTED=1
    ADMIN_REASON="$INJECTION_REASON"
  else
    ADMIN_REASON="$INJECTION_REASON"
  fi
  if [ "$ADMIN_INJECTED" -eq 1 ]; then
    log "t249-f: admin session injected ✓ (cdp-webview-bridge, cold start on home) — authed admin dashboard/users/orders captures"
  else
    log "t249-f: admin session injection FAILED ($ADMIN_REASON) — the three admin captures will honestly show the gate (non-fatal)"
  fi
  # 25 — deals-style settle-poll (t239 pattern): the dashboard either renders
  # authed KPI content ("Platform overview" / "Recent activity",
  # AdminDashboardScreen.kt:331/188) or the honest admin gate ("Admin
  # account required", :813). ANY of the three means the screen finished
  # deciding — never a bare spinner. The authed-vs-gate verdict is recorded
  # in admin-login-check.txt (admin-dashboard-content-verified).
  if budget_stop; then
    echo "capture 25: SKIPPED — capture budget exhausted"
    {
      echo "admin-logcat-no401=no"
      echo "admin-dashboard-marker=no"
      echo "admin-session-verified=no"
      echo "admin-failure-reason=capture budget exhausted before capture 25 (injection result: injected=$ADMIN_INJECTED, $ADMIN_REASON)"
    } >> screenshots/admin-login-check.txt 2>/dev/null || true
  elif ensure_home; then
    echo "capture 25: ensure_home=0 — firing zylod://admin-dashboard (admin UI-login verdict: $ADMIN_AUTHED, t249-f injection used: $ADMIN_INJECTED)"
    adbt 15 am start -a android.intent.action.VIEW -d "zylod://admin-dashboard" com.zylod.wholesale.debug >/dev/null 2>&1
    ADMIN_DASH_SETTLED=0
    for i in 1 2 3 4; do
      sleep 5
      if any_text_on_screen "Platform overview" "Recent activity" "Admin account required"; then
        ADMIN_DASH_SETTLED=1
        break
      fi
    done
    if [ "$ADMIN_DASH_SETTLED" -eq 0 ]; then
      echo "::warning::capture 25: admin dashboard content not detected within 20s — capturing current state anyway"
    fi
    if [ "$ADMIN_DASH_SETTLED" -eq 1 ] && any_text_on_screen "Platform overview" "Recent activity"; then
      echo "admin-dashboard-content-verified=yes" >> screenshots/admin-login-check.txt 2>/dev/null || true
    else
      echo "admin-dashboard-content-verified=no" >> screenshots/admin-login-check.txt 2>/dev/null || true
    fi
    cap "screenshots/25-admin-dashboard-authed.png"
    # t249-f STRICT ADMIN SESSION VERDICT (kills the old false positive: a
    # "Sign out" match on a leftover buyer session could previously read as
    # an admin session). admin-session-verified=yes ONLY when
    #   (i)  every injection step succeeded (ADMIN_INJECTED=1) AND
    #   (ii) after the injection's logcat -c + cold relaunch, the
    #        post-deeplink pid logcat shows a ZylodAdmin "fetch admin
    #        dashboard" line with NO "not an admin session" line
    #        (AdminDashboardViewModel.kt:86/:101 — any 401/403 gate logs it)
    #        OR the settle-poll found the populated dashboard markers
    #        ("Platform overview"/"Recent activity").
    ADMIN_DASH_MARKER=no
    if [ "$ADMIN_DASH_SETTLED" -eq 1 ] && any_text_on_screen "Platform overview" "Recent activity"; then
      ADMIN_DASH_MARKER=yes
    fi
    ADMIN_LOGCAT_NO401=no
    # preserve the UI-attempt logcat (login_admin's decision-time dump) before
    # the post-injection dump overwrites admin-logcat.txt
    cp screenshots/admin-logcat.txt screenshots/admin-logcat-ui-attempt.txt 2>/dev/null || true
    dump_admin_logcat
    if grep -q "fetch admin dashboard" screenshots/admin-logcat.txt 2>/dev/null \
      && ! grep -q "not an admin session" screenshots/admin-logcat.txt 2>/dev/null; then
      ADMIN_LOGCAT_NO401=yes
    fi
    ADMIN_SESSION_VERIFIED=no
    if [ "$ADMIN_INJECTED" -eq 1 ] && { [ "$ADMIN_LOGCAT_NO401" = "yes" ] || [ "$ADMIN_DASH_MARKER" = "yes" ]; }; then
      ADMIN_SESSION_VERIFIED=yes
    fi
    {
      echo "admin-logcat-no401=$ADMIN_LOGCAT_NO401"
      echo "admin-dashboard-marker=$ADMIN_DASH_MARKER"
      echo "admin-session-verified=$ADMIN_SESSION_VERIFIED"
      if [ "$ADMIN_SESSION_VERIFIED" = "no" ]; then
        if [ "$ADMIN_INJECTED" -ne 1 ]; then
          echo "admin-failure-reason=injection did not complete ($ADMIN_REASON) — verified stays no even when the gate markers match"
        elif [ "$ADMIN_LOGCAT_NO401" = "no" ] && [ "$ADMIN_DASH_MARKER" = "no" ]; then
          echo "admin-failure-reason=post-relaunch evidence disagrees: ZylodAdmin 401/403 line present (or no fetch line) AND no populated dashboard marker — see admin-logcat.txt / 25-admin-dashboard-authed.png"
        fi
      fi
    } >> screenshots/admin-login-check.txt 2>/dev/null || true
  else
    echo "capture 25: SKIPPED — ensure_home=1 (zylod://admin-dashboard fired off-home would queue)"
    echo "::warning::capture 25-admin-dashboard-authed skipped: ensure_home failed (queue desync guard)"
    {
      echo "admin-logcat-no401=no"
      echo "admin-dashboard-marker=no"
      echo "admin-session-verified=no"
      echo "admin-failure-reason=ensure_home failed — the admin-dashboard deeplink was skipped (queue desync guard; injected=$ADMIN_INJECTED, $ADMIN_REASON)"
    } >> screenshots/admin-login-check.txt 2>/dev/null || true
  fi
  # 26/27 — 12s settle (users/orders load over the local server;
  # guarded_deeplink enforces the HOME_ROUTE queue-drain guard before each
  # link). Budget-guarded + non-fatal like every capture above.
  guarded_deeplink "26-admin-users-authed" 12 "zylod://admin-users"
  guarded_deeplink "27-admin-orders-authed" 12 "zylod://admin-orders"
fi

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
timeout 20 adb logcat -d -s ZylodProvenance > screenshots/provenance.log 2>/dev/null || true
timeout 20 adb logcat -d > screenshots/logcat-full.txt 2>/dev/null || true
echo "--- provenance log ---"
cat screenshots/provenance.log 2>/dev/null | tail -30 || true
