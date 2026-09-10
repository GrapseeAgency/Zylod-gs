# ZYLOD SESSION HANDOFF — read this first (2026-09-10)

Written by the outgoing agent (context wiped). Project owner audits on real
devices; agents implement. **Phase 1 is NOT authorised. Phase 0 is still OPEN.**

## 1. IMMEDIATE NEXT TASK (in-flight, half-done)

**iOS CI compile is failing on `ios/Zylod/Networking/ApiClient.swift`.**

- Latest failing run: commit `e9c3da1`, ios-build run **34424562108** (job 102706923947).
- One bug was already fixed (generic `get<Envelope>` now decodes the requested
  envelope shape). The remaining error is almost certainly in `ApiClient.init`:

```swift
init(base: String) {
    base = URL(string: base.hasSuffix("/") ? base : base + "/")!   // WRONG
}
```

The assignment target resolves to the immutable `base` **parameter**, not the
stored property. Fix: `self.base = URL(string: ...)`. Then commit, push, and
poll the run whose `name` is **ios-build** for the new SHA (verify the name —
grepping the runs list cross-contaminates between android-build and
ios-build; parse JSON with node, see the pattern used before).
- The workflow prints only `tail -80` of `ios/build/xcodebuild.log` on failure.
  If more errors remain, get the full log via the job logs API (pattern in use)
  or grep `error:` from the log file in the workflow step.
- Expect 1–3 more Swift fix rounds; android-build is already green.

## 2. What this project is

- **Zylod (WholeSale)** — B2B wholesale marketplace. Web: Next.js 16 SPA with a
  custom pageId router (ONE `src/app/page.tsx` → `AppEntry` → 404 lazy page
  components; registry `src/lib/page-loader.ts`; 249 API routes; Prisma +
  Supabase, 130 models, BDT currency; custom Bearer auth in `src/lib/auth.ts`
  — next-auth installed but unused; no websockets; polling everywhere).
- **Dual-platform product** (owner decision, do NOT redefine as Android-only):
  native core + WebView for the Tier 3 long tail, on Android AND iOS.
- Repo: `github.com/GrapseeAgency/Zylod-gs` (branch main, PUBLIC — treat
  carefully). Local path: `/mnt/new_volume/Grapsee Products/Zylod (WholeSale)`.
  PAT is embedded in the git remote URL; owner was advised to rotate it.

## 3. Phase 0 status (both platforms)

**Android — DONE, owner-audited through several rounds:**
- Hand-rolled Kotlin WebView shell (`android/`, `com.zylod.wholesale`, shipped
  v2.4.x) + NEW Compose foundation: theme from frozen tokens
  (`android/.../ui/theme`), Retrofit+kotlinx API layer, server auto-discovery
  (`data/api/ServerConfig`), SessionManager (bridge's encrypted store,
  key `auth_token`), Home reference screen (`ui/home`), 5-tab shell +
  WebView fallback (`ui/nav`, `ui/web`), entry `NativeMainActivity` (launcher).
- Crashes fixed this session: tab-nav route with empty query segment
  (NavigationStack) + async-child HttpException escaping viewModelScope —
  fixed via `safeCall()` failure isolation in `HomeViewModel`.
- DTO contracts fixed against the REAL DB: `/api/deals` returns
  `{flashDeals[], dailyDeals[]}`; product `images` are OBJECTS
  `{id, imageUrl, sortOrder}` with RELATIVE paths (resolve against base URL).
- Verified on emulator with live seeded data via the ngrok tunnel: renders
  105 products / 25 suppliers, zero crashes. android-build CI: GREEN.

**iOS — IN PROGRESS (compile-fix loop, see §1):**
- `ios/` XcodeGen project (Xcode 16 format → CI must use **macos-15**),
  SwiftUI mirror of the Android foundation: `ZylodTheme.swift` (dynamic
  light/dark tokens), `ServerConfig.swift` (same probe list + UserDefaults
  cache), `SessionManager.swift` (Keychain), `ApiClient.swift` + Codable DTOs
  (real contracts incl. image objects + deals object), `HomeViewModel.swift`
  (parallel try?-await section loads), `HomeView.swift` (full Home port),
  `RootView.swift` (5 TabView tabs + NavigationStack push to web),
  `WebViewScreen.swift` (WKWebView, `?page=<id>`).
- `.github/workflows/ios-build.yml`: macos-15, brew xcodegen, xcodegen
  generate, signing-free simulator build, PlistBuddy stamps
  `CFBundleShortVersionString = 2.4.5-<sha7>`, artifact
  `Zylod-ios-simulator-<sha>`. Audit on iPhone needs Apple signing secrets
  (not yet provided) — simulator artifact is the current deliverable.

## 4. Frozen documents (do not violate)

- `android/ARCHITECTURE.md` — hybrid architecture freeze, tier lists, gates.
- `design-tokens.md` — ONLY color/type source for both platforms.
- `platform-contracts.md` — shared Android/iOS contracts (discovery, auth,
  API envelopes, pageId routing, phase gates).
- `AUDIT-WORKFLOW.md` — the install/audit loop, hard rules, phase ledger,
  install & traceability instructions per platform.
- `auth-endpoint-audit.md`, `checkout-payment-audit.md` — local-only (untracked
  by another agent's commit 81d933b; still in git HISTORY — repo should stay
  private or be history-cleaned). Critical findings: ~50 mutating API routes
  lack auth (admin PATCHes, supplier verify, wallet topup free-money bug);
  web checkout is a setTimeout mock; real `POST /api/orders` is orphaned;
  `orders/create-direct` trusts client prices and fakes 'paid'.

## 5. The audit loop (owner's law)

agent implements → commit+push to main → both CIs build → owner installs
artifact → audits → reports → agent fixes ONLY reported findings → repeat.
Never claim done because it compiles. Never remove/disable/mock existing
functionality. No next phase, no extra screens, no drive-by refactors without
explicit instruction. Every artifact must be traceable to its commit SHA
(version strings carry the short SHA; artifact names carry the full SHA).

## 6. Environment facts & gotchas

- Owner's dev server currently runs on **port 2000** (not 3000) and the ngrok
  tunnel `jugular-winnings-backfield.ngrok-free.dev` forwards to it — the app
  probe list includes ngrok, so devices get real data through it. zylod.com's
  API returns nothing (prod deploy stale/down — flag to owner).
- Supabase DB was restored + `db:seed` (105 products, 25 suppliers) — live.
- A supervisor loop on this machine keeps respawning `next dev`; it took port
  3000 back repeatedly during tests. Fixture server used for offline tests:
  `/tmp/zylod-fixture-server.mjs` (binds :3000/:3100 — kill before real tests).
- Emulator: AVD `grapsee`, dies under load; `adb reverse` was flaky on it.
- API exploration from CLI: pass `-A "okhttp/4.12.0"` UA to curl for ngrok.
- GitHub API via curl with `-H "Authorization: Bearer <PAT from git remote>"`.
- `pkill -f next` kills your own shell (matches the command string). Careful.

## 7. Phase gates

Phase 0 exit = BOTH platforms' Phase 0 builds owner-audited and accepted
(Android awaiting final audit of `Zylod-debug-apk-ea704b2` or newer; iOS
pending CI green + owner simulator audit). Only the owner authorises Phase 1
(auth + product-detail + cart native, both platforms). checkout stays out of
native until backend fixes (orders/[id]/pay + payment callbacks) are merged.
