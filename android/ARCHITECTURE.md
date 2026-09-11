# Zylod Android — Frozen Hybrid Architecture (Phase 0)

**Status: FROZEN 2026-09-09.** Changes require revisiting this file first. No broad page conversion begins until Phase 1/2 foundations are signed off.

## 1. One app, one navigation authority (amended round-4, 2026-09-11)

`android/` (`com.zylod.wholesale`) stays the single app with **ONE activity**:

```
NativeMainActivity (LAUNCHER + ALL deep links, Compose)
 └─ ZylodTheme + ZylodRoot (Compose NavHost + native bottom bar)
     ├─ Tier 1 pages  → native Compose screens
     ├─ Auth suite    → native fullscreen screens
     └─ Tier 3 pages  → WebScreen (embedded WebView, ?page=<id>)
```

**The legacy View-based WebView activity was deleted in round 4** (owner
audit: "the native application shell and the WebView application are not
operating as one coherent navigation system"). It rendered the raw SPA with
its own bottom bar and loading spinners in a SECOND task — two apps in one
package. All `zylod://` / `https://zylod.com` intent filters now live on
`NativeMainActivity`; deep links enter via `DeepLinkBus` and are routed by
the same resolver as every other entry point.

### 1.1 The route-ownership table (`ui/nav/RouteOwnership.kt`)

**One resolver, every entry point.** The bottom bar, web-initiated
`openPage` (`NativeNavBus`), Home quick-access tiles, Cart links, PDP links
and deep links ALL funnel through `RouteOwnership.resolve(pageId, query,
isAuthenticated)`. Per-screen special cases ("if pageId == x, open y") are
forbidden outside this table. PageId ownership:

- **NATIVE:** `home`, `cart`, `product-detail`, auth suite entry points
  (`login`, `register-buyer`, `register-supplier`, `forgot-password`).
  Guest `profile` resolves to native login (web-bar parity).
- **WEBVIEW:** everything else (the Tier-3 long tail; unknown pageIds
  default to WEBVIEW, matching the SPA's own registry).

The tab-alias map (which bottom tab highlights for a pageId) lives ONLY
here (`activeTabFor`) — the web bundle's `getActiveId` and iOS
`RouteOwnership.swift` must mirror it. `NATIVE_PRODUCT_SPECIFICATION.md`
remains the authoritative native roadmap; the WEBVIEW rows are Phase 1
scope, not a permanent reduction.

### 1.2 Loading ownership (one owner per surface)

- **Native screens** (Home/Cart/PDP/auth): the Compose state machine owns
  loading — skeleton → success / error + retry. Never a web spinner.
- **WebView surfaces** (`WebScreen`): the SPA's own loading UI is the ONLY
  loading owner once a shell is attached. The shell paints NO native
  spinner over it; the sole native loading surface is the pre-web bootstrap
  (server discovery / first checkout). During a route change the shell
  suppresses the previous page's pixels (alpha 0) until the SPA confirms
  the new page — via the `onPageChanged` ack (`WebAppBridge.onPageChanged`
  ← `window.__zylodCurrentPage` store mirror), the soft-navigate result, or
  `onPageFinished`. A 20 s watchdog terminates every load in
  success / error + retry — never an indefinite spinner.
- **State truth:** `WebScreen` restore-in-place decisions probe the SPA's
  LIVE state (`window.__zylodCurrentPage` + params), never remembered
  "last requested" values — drifted bookkeeping is what previously painted
  Home under the Profile route.

## 2. Contracts between shells

| Contract | Rule |
|---|---|
| PageId routing | Every screen (native or web) corresponds 1:1 to a web pageId. Native routes use the pageId as route name; WebView loads `https://<active-server>/?page=<id>&<params>` so deep links, `/api/app/deep-links`, and analytics stay uniform. |
| Server discovery | Both shells resolve the backend from `BuildConfig.SERVER_ENDPOINTS` (debug probes local/emulator/ngrok/prod; release = prod only). Active URL cached in `SharedPreferences("zylod_config")`. |
| Session | Bearer token from `POST /api/auth/login` (custom auth, `src/lib/auth.ts`; refresh via `/api/auth/refresh`). Native: OkHttp interceptor + 401→refresh-once. WebView keeps its own mirrored token (existing `security-crypto` store). Cross-shell SSO via token mirror is Phase 2 work. |
| Offline | Room cache + `OfflineSyncWorker` and the `/api/native/offline-sync` event contract are shared infrastructure; Compose screens may read the same Room DB. |
| Native capabilities | Barcode scan (ML Kit), notifications, haptics keep going through `WebAppBridge` for web pages; native screens call them directly. |
| API envelope | `{ success, data, pagination? }`; errors `{ error, code? }`; pagination `{page,limit,total,totalPages}`; rate limit = 429 `code:'RATE_LIMITED'`. |

## 3. Frozen scope

**Tier 1 — native Compose (Phase 1-2), in build order:**
1. Foundation (Phase 1): theme, network stack, session, navigation, bottom nav — Home · Categories · Hot Deals · Cart · Profile tabs.
2. Buyer core (Phase 2): `login`, `register-buyer`, `register-supplier`, `otp-verification`, `welcome`, `home`, `product-detail`, `category-products` (+20 category ids), `search-results`, `search-home`, `cart`, `checkout`, `orders`, `order-detail`, `profile`, `notifications`, `buyer-orders`.
3. Supplier core (Phase 3): `supplier-dashboard`, `supplier-products`, `supplier-orders`, `supplier-add-product`, `supplier-verification-status`.

**Tier 3 — everything else stays WebView**, including: all legal/support/company pages, settings/app-level pages, engagement (games/VIP/live/affiliate/group-buy), the seller long tail, and all 34 `GenericInfoPage` prefixed sub-views.

**Checkout gate:** `checkout` goes native only after `checkout-payment-audit.md` items 1-3 are implemented and integration-tested. Never ship a mock.

## 4. Package layout (app module)

```
com.zylod.wholesale/
  MainActivity.kt              # legacy WebView shell (unchanged in Phase 0)
  NativeMainActivity.kt        # Compose entry (launcher)
  ui/theme/                    # Color.kt Type.kt Shape.kt Theme.kt  ← from design-tokens.md ONLY
  ui/nav/                      # ZylodRoot.kt: Scaffold + NavigationBar + NavHost
  ui/home/                     # HomeScreen, HomeViewModel  (reference screen)
  ui/web/                      # WebScreen: Compose-hosted WebView (?page=<id>)
  data/api/                    # ApiClient (Retrofit + kotlinx.serialization), ZylodApi, DTOs
  data/session/                # SessionManager (token store + interceptor support)
  bridge/ sync/ data/db/ …     # existing shell infrastructure (shared)
```

Network stack: Retrofit 2.11 + OkHttp 4.12 (shared client patterns) + kotlinx.serialization. Images: Coil.

## 5. Theme rules

- Compose colors come **only** from `../design-tokens.md` (which mirrors `src/app/globals.css` exactly, including the resolved dark remap). Never sample hexes from page components.
- Quick-Access chips keep their per-item pastel gradients in both themes (documented web artifact).
- System font (Roboto). Web's font vars are broken — this is a deliberate fix, revisit if web ships a webfont.
- Light/dark follow system (`isSystemInDarkTheme()`), matching next-themes `enableSystem`.

## 6. Phase gates

| Gate | Exit criteria |
|---|---|
| Phase 0 (this) | Tokens frozen · auth + checkout audits written · Compose builds · Home renders live API data on emulator |
| Phase 1 | Auth flows + product-detail + cart native, WebView handoff seamless (token parity) |
| Phase 2 | Checkout real (backend fixes merged), orders native, auth-audit CRITICAL/HIGH items closed |
| Phase 3 | Supplier core native |
