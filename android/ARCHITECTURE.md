# Zylod Android — Frozen Hybrid Architecture (Phase 0)

**Status: FROZEN 2026-09-09.** Changes require revisiting this file first. No broad page conversion begins until Phase 1/2 foundations are signed off.

## 1. One app, two rendering shells

`android/` (`com.zylod.wholesale`) stays the single app. Two UI shells live side by side:

```
NativeMainActivity (LAUNCHER, Compose)          MainActivity (WebView shell, View-based)
 └─ ZylodTheme + Compose NavHost                 └─ WebView → SPA (?page=<id>)
     ├─ Tier 1 pages  → native Compose screens       ├─ WebAppBridge (scanner, voice, offline, token mirror)
     └─ Tier 3 pages  → WebScreen (embedded          ├─ Room offline cache + OfflineSyncWorker
        WebView loading https://host/?page=<id>)      └─ biometric, deep links, version check
```

- **Phase 0:** NativeMainActivity is launcher + hosts Compose. Deep-link intent filters (`zylod://`, `https://zylod.com`) remain on MainActivity — unchanged behavior. Phase 2 unifies deep links into the native root.
- A page is either native or WebView — **never both**, decided by the frozen tier list (§3).

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
