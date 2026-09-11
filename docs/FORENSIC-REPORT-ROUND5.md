# FORENSIC REPORT — ROUND 5 (read-only investigation; zero code modified)

**Trigger:** Owner real-device audit of `v2.4.5-c71357e` — PHASE 1 HARD FAILURE.
**Method:** repository as evidence. No source edits. No commits. No pushes. No CI.
**Evidence labels:** PROVEN (line-cited from the audited tree) / INFERRED (mechanism proven, device instance not directly observable from this sandbox) / NOT VERIFIABLE (requires owner-side action; exact commands provided).

---

## 0. RUNTIME PROVENANCE — proven first, as ordered

### 0.1 What the device actually installed

| Step | Finding | Label |
|---|---|---|
| P1 | CI ships **debug APKs only**: `.github/workflows/android-build.yml` L31–37 runs `assembleDebug -PcommitSuffix=<sha>`; artifact name `Zylod-debug-apk-<sha>`. The audited release asset is `Zylod-v2.4.5-c71357e-debug.apk` (worklog R4-CI). | PROVEN |
| P2 | Debug buildType = `com.zylod.wholesale.debug` with `SERVER_ENDPOINTS = {"http://192.168.43.79:3000", "http://10.0.2.2:3000", "http://localhost:3000", "https://jugular-winnings-backfield.ngrok-free.dev", "https://zylod.com"}` (build.gradle.kts L74–86). The **release** single-endpoint list (`https://zylod.com`, L60–64) is **not** what is installed. | PROVEN |
| P3 | Endpoint selection (`data/api/ServerConfig.kt` L26–55): parallel probes of `<endpoint>/api/app/version`, 4 s budget; **first candidate in list order that returns ANY response wins — "Any HTTP response (even 404) proves the host is alive" (L16, L52)**. Winner is written to SharedPreferences on every `resolve()` (L36); the cache is read only when *every* probe fails (L35). | PROVEN |
| P4 | Consumers are cache-first: `WebScreen` L146 `ServerConfig.cached(context)` — a resolved endpoint persists across sessions until probes all fail or the user presses Retry. iOS identical (`ServerConfig.swift` L7–55, same candidate list, same any-response semantics; `WebViewScreen.resolveBaseIfNeeded` L147–157 cache-first). | PROVEN |
| P5 | `https://zylod.com` as fetched from this sandbox returns **114 bytes**: `<!DOCTYPE html><html><head><script>window.onload=function(){window.location.href="/lander"}</script></head></html>` — not the app shell. It nevertheless **passes the probe** (any response). | PROVEN (this network; device path may differ — see NOT VERIFIABLE N1) |
| P6 | This sandbox is NOT the device's content source: its IP is `21.0.13.97`, nothing listens on port 3000 here. `192.168.43.79` is a separate machine (the dev LAN host; 192.168.43.x = Android hotspot subnet). | PROVEN |
| P7 | Therefore the installed APK executes the web bundle served by **whichever candidate answered first — with the LAN dev server and the ngrok tunnel both pointing at the dev machine's Next.js server, serving whatever working tree that machine hosts at audit time — not the audited commit c71357e.** | PROVEN (mechanism) / bundle identity NOT VERIFIABLE (N1) |

**Consequence:** every round-4 web-side contract symbol — `__zylodSpaReady`, `__zylodCurrentPage`/`__zylodCurrentParams`, the `onPageChanged` ack, the `?page=` deep-link boot handler — is **optional at runtime by design**. The native shells explicitly support bundles without them ("advisory", WebScreen.kt L52–55; WebShellScripts.kt L44–53). **Old-bundle mode is a supported runtime mode, and it is precisely the failure mode the owner keeps hitting.** A perfect contract in this repository is irrelevant if the device loads a different tree.

**NOT VERIFIABLE (owner, ~1 minute):**
- N1 — which endpoint the device resolved and what it serves: on the device, `adb logcat -s ZylodWeb ZylodHome` during first navigation, or open `http://192.168.43.79:3000/api/app/version` and `https://jugular-winnings-backfield.ngrok-free.dev/api/app/version` from the audit network; on the dev machine, `git -C <server-worktree> rev-parse HEAD` vs `c71357e`.
- N2 — whether `zylod.com/lander` (final fallback) serves anything app-like: `curl -sk https://zylod.com/lander | head -c 400`.

---

## A. NAVIGATION STATE DIAGRAM (tap → rendered pixels)

### A.1 Android

```
tap (ZylodBottomBar, ZylodRoot.kt L476–484)
  → onTab → openPage(tab.pageId, "")                     (L281)
  → RouteOwnership.resolve(pageId, query, isAuth)        (L224–228, RouteOwnership.kt L93–118)
  → navigateResolved(Destination)                        (L191–219)
      NATIVE home → navigate("home"){popUpTo(home){saveState=true};singleTop;restoreState}   (L193–198)
      NATIVE cart → navigate("cart"){…same…}                                                 (L199–204)
      WEBVIEW      → navigate("web/{pageId}?params=…"){popUpTo(home){saveState=false};singleTop} (L209–217)
  → NavHost renders HomeScreen | CartScreen | ProductDetailScreen | WebScreen(pageId,query)

WebScreen lifecycle (WebScreen.kt):
  compose → baseUrl = ServerConfig.cached()              (L146, cache-first)
  LaunchedEffect(baseUrl, pageId, query, reloadTick, manualReload)   (L176)
    → checkout pooled Shell S (NativeWebViewPool L118–144)
    → navigateShell(S, pageId, query)                    (L401–429)
        1. probeLivePage: window.__zylodSpaReady/__zylodCurrentPage+params   (L436–456)
           match → restore in place (suppressContent=false)
        2. softNavigate: pushState + synthetic popstate;                    (WebShellScripts L162–193)
           script returns "ok" iff history.state.page === pageId AFTER its own pushState
           ok   → shell.lastPageId=pageId; suppressContent=false            (NativeWebViewPool L207–217)
        3. fallback: loadUrl(base + "/?page=" + pageId)                     (L237–244)
    lift paths (whichever lands first)                                      (L205–220):
      onPageFinished   → pageLoading=false; suppressContent=false   ← UNCONDITIONAL
      onPageChanged    → only if acked == pageId                     ← advisory, old bundles never emit
      watchdog 20 s    → pageError=true                              (L290–298)
  dispose → NativeWebViewPool.checkIn(S) (paused, kept warm)             (L375–383)

Tab highlight derives from the NATIVE back stack only:
  route==home→"home"; cart→"cart"; fullscreen/PDP→none; else activeTabFor(webPageId)  (L160–165)
```

### A.2 iOS

```
tap (TabView selection binding with re-tap-to-pop semantics, RootView.swift L37–50)
  → webviewTab pageIds are FIXED owned shells: category-browser/.categories,
    flash-deals/.deals, profile/.profile (L55–63, L164–172, L220–224)
  → non-tab pageIds → RouteOwnership.resolve → AppFlow.openPage → homePath.append(WebRoute)
    (AppFlow.swift L32–34; RootView.navigate L188–216)
  → WebViewScreen(.owned for tabs / .pooled for pushes)  (WebViewScreen.swift L35–52)

WebViewScreen.drive() (L159–240), keyed by .task(id: navKey):
    1. probeLivePage  (`__zylodCurrentPage` + params; 3 s timeout)      (L324–342)
    2. softNavigate   (same pushState+popstate contract; 5 s timeout)   (L303–319)
    3. fallback load(?page=…)                                          (L238)
  lift paths: ack==pageId (advisory) | softNavigate "ok" | didFinish ← UNCONDITIONAL (L89–93)
  watchdog 20 s → loadError (L262–270)
owned tab shells never recycle cross-tab; pooled shells serve pushed routes only
(WKWebViewPool.swift L14–17, maxFree=2)
```

**Structural difference that matters:** Android routes ALL Tier-3 tabs through ONE generic destination (`web/{pageId}?params={params}`) + a shared shell pool; iOS gives each Tier-3 tab a dedicated owned shell and only pools pushed routes. Android therefore has a cross-tab shell-collision surface that iOS does not.

---

## B. ROUTE OWNERSHIP TABLE (canonical, per platform)

| pageId | Android (`RouteOwnership.kt`) | iOS (`RouteOwnership.swift`) | Tab highlight |
|---|---|---|---|
| home | **NATIVE** (L79, L97) | **NATIVE** (L63, L82) | home |
| cart | **NATIVE** (L79, L98) | **NATIVE** (L63, L84) | cart |
| product-detail (with id) | **NATIVE** PDP (L99–104) | **NATIVE** (L85–92) | none |
| product-detail (no id) | WEBVIEW (L107) | WEBVIEW (L95) | home |
| profile (authenticated) | WEBVIEW (L115) | WEBVIEW (L105) | profile |
| profile (guest) | NATIVE login (L115) | NATIVE login (L105) | (login: none) |
| category-browser | WEBVIEW (default L116) | WEBVIEW (fixed tab, RootView L207–208) | categories |
| flash-deals / daily-deals | WEBVIEW (default) | WEBVIEW (fixed tab) | deals |
| welcome/login/register-*/forgot-password | NATIVE auth (L74–76, L109–114) | NATIVE auth (L57–58, L96–103) | none |
| everything else (~400 Tier-3) | WEBVIEW default | WEBVIEW default | via TAB_ALIASES |

- One resolver per platform; every entry point (tab bar, web bridge `openPage`, Home tiles, Cart links, PDP links, deep links, Back, tab reselection) funnels through it. **PROVEN**: Android `ZylodRoot.kt` L168–228 (NativeNavBus L243–246, DeepLinkBus L252–262, guest-profile parity L224–228); iOS `RootView.navigate` L188–216 + `routeWebNav` L179–183 + `routeDeepLink` L243–260. No hidden per-screen `when` branches were found in the audited tree.
- Residual debt (flagged, not a defect): the tab-alias map exists as **three hand-mirrored copies** (Kotlin `TAB_ALIASES` L126–147, Swift `tabAliases*` L123–142, web `mobile-bottom-nav.tsx getActiveId`). The code comments acknowledge the drift hazard; nothing mechanically enforces parity.

---

## C. FAILURE REPRODUCTION (code-level, full matrix)

Device-level execution of the matrix is **NOT VERifiable from this sandbox (no device)** — N3. What follows is the exact code-path execution per transition. Two runtime regimes exist:

- **Regime OLD (device bundle lacks the round-4 contract)** — every soft-navigate returns "no" (no `__zylodSpaReady`), every fallback is a full `?page=` load, and the outcome depends on whether the served bundle's AppEntry consumes `?page=`.
- **Regime NEW (device bundle has the contract)** — soft-navigations succeed; failures come from the stale-generation races of §D-RC2.

| Transition (owner matrix) | Android / Regime OLD | Android / Regime NEW | iOS |
|---|---|---|---|
| Home→Categories | native OK; web tab: probe null→softNav "no"→loadUrl(?page=category-browser) → old bundle ignores deep link → **SPA stays home** → onPageFinished lifts → **Home pixels under Categories tab** | probe('home')≠cat → softNav ok → category renders | owned shell: same as NEW; no cross-tab shell reuse |
| Categories→Home | native Home composes — visually IDENTICAL to the stale Home pixels just seen under Categories → **tap perceived dead** (§D-RC3) | native Home composes correctly | same |
| Home→Hot Deals→Home | **Hot Deals highlighted + Home content** (same as row 1) — the owner's primary symptom | correct unless a prior fallback load is still in flight (§D-RC2: native=web/flash-deals, pixels=whatever document wins) | correct (owned shell) |
| →Cart→Home | Cart is native: renders **or** HomeViewModel error state if endpoint dead/wrong ("Can't reach Zylod servers", HomeViewModel.kt L88–91) | correct | correct |
| →Profile→Home | Profile=WEBVIEW(auth): same OLD-regime failure → **Profile tab + Home content** | correct modulo RC2 | owned shell correct; guest→native login |
| Product Detail→Home | PDP native; back/Home fine | fine | fine |
| Rapid Home↔Categories↔Profile↔Hot Deals | each web tab does a full document load; last document wins; **pages and tabs desynchronise intermittently** | **worst case**: all four web destinations share the ONE `web/{pageId}` destination entry (launchSingleTop reuse, ZylodRoot L212–216) — WebScreen never disposes between web tabs, LaunchedEffect(pageId) re-keys over in-flight loads, handlers carry no generation guard → **visible page = whichever load finishes last, not the requested one** (§D-RC2) | owned shells per tab: correct |

Reproduction of the owner's exact primary failure with the CURRENT tree also requires only a stale bundle: loadUrl("?page=flash-deals") + AppEntry without the `?page=` handler (app-entry.tsx L187–208 is the current handler) → store default `'home'` (navigation-store.ts L50) → Home rendered → onPageFinished reveals it under the Hot Deals tab.

---

## D. ROOT CAUSES

### RC1 — The device executes a web bundle the repository does not control (PRIMARY)
**PROVEN mechanism; device instance NOT VERIFIABLE (N1).** Chain: debug-only CI (P1) → 5-endpoint discovery, any-HTTP-counts (P2/P3) → cache-first consumers (P4) → LAN/ngrok serve the dev machine's working tree, zylod.com serves a stub (P5/P6/P7). The installed runtime truth is therefore decoupled from the audited commit. Every observed failure class (stale content, tab/content desync, "old bundle" advisory paths silently degrading) is exactly the behaviour the shells implement *for old bundles by design*.

### RC2 — Android stale-generation load/ack race on the shared `web/{pageId}` destination
**PROVEN in the audited tree (present at HEAD).**
1. Web→web tab switches reuse the same Navigation entry (launchSingleTop on one generic route, ZylodRoot L209–217) — WebScreen is never disposed between Categories/Hot Deals/Profile; only `LaunchedEffect(pageId…)` re-keys (L176).
2. Coroutine cancellation does not abort WebView work: an in-flight fallback `loadUrl` or late `evaluateJavascript` callback from the cancelled effect still executes. `loadGen` exists (L160) but guards **only the watchdog** (L290–298) — `onPageFinished`/`onPageChanged`/`onMainFrameError` handlers (L205–220) carry **no generation check**.
3. `onPageFinished` lifts suppression + loading **unconditionally** (L205–210): a late document for page X reveals X's pixels while the native route is page Y.
4. Ack fan-out is process-global: `WebAppBridge.onPageChanged` delivers to `NativeWebRegistry.webView` — "the pooled shell that is checked out last wins" (L53–56; WebAppBridge L110–116) — not to the shell that emitted the ack.

**Exact divergence point (Regime NEW):** `native destination` is updated synchronously by `navController.navigate` (ZylodRoot L212); the WebView's visible document is updated **asynchronously and unguarded**; the reveal is gated by whichever of {ack, softNav-ok, onPageFinished} lands first — two of the three are not bound to the requested generation.

### RC3 — "Home cannot reliably be reached" — perceptual + endpoint mechanisms
- **INFERRED (high confidence):** in the RC1/OLD regime the user is already looking at Home content (stale SPA home under a web tab). Tapping Home swaps stale-web-Home for native-Home — visually the same screen → the tap *appears* dead. Consistent with "cannot **reliably** be reached" (it works whenever content is correct).
- **PROVEN code path, conditional on endpoint state:** native Home fetches 5 parallel API calls from the SAME resolved base (HomeViewModel L62–111); both `categories`+`products` failing → `error="Can't reach Zylod servers"` (L88–91). With zylod.com winning the probe (stub answers — P3/P5), native Home is a guaranteed error screen while the probe still reports "alive".
- No Compose-level dead-tap was provable in the audited tap path (single resolver, direct `navigate`).

### RC4 — Soft-navigate "ok" is a near-tautology and the ack is only advisory
**PROVEN.** The script validates `history.state.page === pageId` **after its own pushState** wrote it (WebShellScripts.kt L181–189) — it proves pushState, not that the SPA will render the page; and the ack that would correct it is documented advisory with three fallback lift paths, one of which (onPageFinished) is unconditional. Round-4 built the right contract and then **left every door open for it not to matter**.

### iOS residuals (structurally cleaner; no pooled-tab collision surface)
- Same OLD-regime exposure (advisory ack + unconditional didFinish lift, WebViewScreen L89–93, L187–193).
- INFERRED: `ShellWebViewCenter.bridge` is a singleton attaching "the last-attached view" (L385–387, L417–418) — with owned tab shells + pooled pushes coexisting, background shells share one evaluation target; needs `ZylodNativeBridge.swift` confirmation before any fix.
- INFERRED: `.task(id: navKey)` cancellation does not abort in-flight `evaluateJavaScript`/`load` (ResumeOnce keeps `drive()` running to its fallback load, L303–319); exposure is retry-only (pageId is fixed per screen instance).

---

## E. PERFORMANCE EVIDENCE (native Home vs WebView Home)

- **Instrumentation ships in the audited build** (PROVEN): `JankProfiler` FrameMetrics/Choreographer pipeline, DEBUG-only, surfaces tagged `native:home` (HomeScreen L115) and `web:<pageId>` (WebScreen L142) through the **same window pipeline, same device, same session**; `TimedAsyncImage` logs >64 ms image loads. Protocol: `docs/PERFORMANCE-PROFILE.md` §2 (~5 min, `adb logcat -s ZylodPerf`).
- **Measured numbers: NOT VERIFIABLE (N4)** — no device in this sandbox. Per the owner's rule, no performance claim is made without them.
- **Static findings (PROVEN, from code):** S1 no Baseline Profile (Compose first-run JIT — the single most plausible "WebView feels smoother" cause); S2 app-wide `crossfade(200)` on grid images (RenderThread cost during fling); S3 first-frame composition (~40 composables + 5 API calls); S4 minor row-key allocation (mitigated round-3); S5 Coil sized decode OK; S6 the WebView path's advantages are real and expected to be documented, not argued away.
- **Home list hygiene verified this round** (PROVEN): stable keys on every list (`HomeScreen.kt` L177 row keys, L298 categories, L450/453 quick links, L529 deals), `derivedStateOf` for the sticky-search swap (L138), grid chunking outside composition (L144), opaque WebView background + `offscreenPreRaster=false` for the web path (NativeWebViewPool L224–227, L254–258).
- **Category scrolling is a WEB surface on both platforms** (category-browser = WEBVIEW) — it is a separate investigation as ordered; its known shell-side costs (transparency, pre-raster) were already removed in round 4; its remaining costs live in the served SPA bundle, which is RC1's territory. No fix may be proposed until N4 numbers exist.

---

## F. REMEDIATION PLAN (implementation ONLY after owner approval)

Each item cites the root cause it kills. **Nothing here repeats round-4**: round-4 built the contract + probes + pool but (a) left the content source unpinned, (b) left acks advisory with an unconditional fallback lift, (c) left async load/ack races unguarded, (d) left the soft-navigate check tautological.

| # | Change | Kills | Notes |
|---|---|---|---|
| F1 | **Pin the content source.** Preferred: bundle the SPA build into the APK/IPA (WebViewAssetLoader / WKURLSchemeHandler) with the version handshake `/api/app/version` returning the bundle commit; shell refuses a mismatched bundle with a visible error. Minimal alternative: shell requires the probe response to match an expected build marker before use, else falls through to the next candidate **and surfaces the reason**. | RC1, RC4(Endpoint) | Owner decision required: artifact size vs strictness. Debug builds may keep dev-list discovery but MUST display the resolved base + bundle commit in Settings. |
| F2 | **Generation-guard every shell callback.** Thread `loadGen` into onPageFinished/onPageChanged/onMainFrameError; ignore stale-generation events; `stopLoading()` when an effect re-keys. | RC2 | Small, mechanical, Android-first. |
| F3 | **Per-shell ack delivery.** Bind `WebAppBridge` to its owning WebView at construction (it already wraps one host); delete the `NativeWebRegistry` global lookup from the ack path. | RC2.4 | Removes the "last checked-out wins" fan-out. |
| F4 | **Make the ack authoritative when the bundle declares the contract.** Soft-navigate "ok" additionally requires `__zylodCurrentPage === pageId` (store truth, not history-state tautology); when the bundle emits acks, onPageFinished may NOT lift suppression before the matching ack. Bundles without the contract still take the loadUrl fallback — but F1 ensures such bundles are never served in audits. | RC4 | Closes the tautology; keeps a deterministic failure state. |
| F5 | **Bundle provenance stamp.** Build injects `__ZYL_BUNDLE_COMMIT` into the SPA; shell logs it at boot and shows it in Settings → diagnostics. | makes N1 permanently answerable | Required for every future audit. |
| F6 | **Performance:** owner runs PERFORMANCE-PROFILE §2; then (in order) S1 baseline profile CI job, S2 crossfade counterfactual behind a debug flag; re-measure after each. Category gets its own §2 run. **No tier decision until numbers exist.** | E | Evidence-based, per owner's mandate. |
| F7 | **iOS:** confirm `ZylodNativeBridge` attach routing; add generation checks mirroring F2 for pooled pushes; verify `drive()` retry path cannot land a stale document. | iOS residuals | After ZylodNativeBridge.swift read (flagged inspection item). |

**Answers to the owner's six questions, in one line each:**
1. *Why does Hot Deals show Home?* The web tab's document never became flash-deals: a stale bundle ignores the `?page=` deep link (RC1), or a stale-generation document load/`onPageFinished` reveal wins over the requested navigation (RC2) — while the native tab state, derived only from the back stack, correctly shows Hot Deals.
2. *Why can Home not be reached from another tab?* The tap navigates natively every time; it *appears* dead because the previous screen was already painting (stale) Home content (RC3), or because native Home itself renders its bounded error state when the discovered endpoint is wrong-but-alive (RC1/RC4-endpoint).
3. *Which state diverges from which?* The native back stack (synchronous, authoritative) vs the WebView's visible document (asynchronous, unguarded, revealed by whichever of {advisory ack, tautological soft-nav ok, unconditional onPageFinished} lands first) — divergence point: WebScreen's lift paths, WebScreen.kt L205–220 / WebViewScreen.swift L89–93.
4. *Which bundle does the device execute?* Whatever `192.168.43.79:3000` / ngrok / zylod.com answered first on the device at resolve time — cached in SharedPreferences — which this repository cannot prove from here (N1; one owner command settles it). `zylod.com` (final fallback) provably serves a 114-byte redirect stub from this network.
5. *Why is native Home slower?* Not yet measurable here (N4). Static analysis puts the no-Baseline-Profile JIT cost (S1) and per-image crossfade (S2) as the leading candidates; the same-session JankProfiler harness ships in the installed debug build and settles it in one `adb logcat -s ZylodPerf` session.
6. *Exact remediation?* F1–F7 above — pin the bundle, generation-guard the shell callbacks, per-shell acks, authoritative ack + non-tautological soft-nav verification, bundle provenance stamp, then evidence-driven perf work.

**STOP.** Per the owner's directive this report is delivered uncommitted; no implementation, CI, push, or APK production begins until explicit approval. PHASE 1 remains FAILED; PHASE 2 remains LOCKED.
