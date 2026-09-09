# Zylod (WholeSale) — Native Android Migration Analysis

**Date:** 2026-09-05 · **Scope:** Full-project analysis to decide Kotlin/Compose vs WebView per page.
**Verdict up front:** Hybrid confirmed as the right call — but the project is *already* a hybrid. A hand-rolled Kotlin WebView shell exists at `android/` (no Capacitor), the backend is already a token API, and there are ~569 addressable pageIds of which only ~22 deserve native Compose rebuilds in phase 1.

---

## 1. Architecture reality (what this project actually is)

Not a classic Next.js multi-route site. It is a **single-entry SPA with a custom pageId router**:

- `src/app/page.tsx` → `AppEntry` (`src/components/app-entry.tsx`) → `PageRenderer` → `loadPage(pageId)` (`src/lib/page-loader.ts`) → lazy chunk import from `src/lib/page-chunks/*` → one of **404 page components** in `src/components/pages/`.
- Routing state is a zustand store (`src/store/navigation-store.ts`: `currentPage`, `pageParams`, `navigate/goBack`, synced to History API). Deep links already work as `?page=<pageId>&...` (`app-entry.tsx:187-208`) and are mirrored by a native `DeepLinkParser.kt` + `/api/app/deep-links`.
- Backend: **249 API route files** under `src/app/api/*`. Prisma + Supabase Postgres, **130 models**. B2B wholesale domain: tier pricing (`productPriceTiers`), MOQ, RFQ, escrow, wallet, group-buy, live-shopping, affiliate, credit lines. Single currency (BDT).
- **react-query and socket.io are installed but completely unused.** No websockets anywhere — chat/notifications are HTTP polling.

Page-implementation depth (404 component files): **~100 full**, **~207 medium** (mass-generated template: header + `fetch('/api/...')` + framer-motion — see `generate-pages.js`), **~101 stubs** (<100 lines). A large share of the "enormous frontend" is scaffolding — the genuinely valuable part is the core shopping + supplier flows.

## 2. The existing Android app (already built, don't start greenfield)

`android/` (`com.zylod.wholesale`) is a **hand-rolled Kotlin WebView shell** — View-based (AppCompat), not Compose:

| Already native | Files |
|---|---|
| WebView host + JS bridge (`ZylodNativeBridge` ↔ `src/lib/native-bridge.ts`, 271-line typed API) | `MainActivity.kt`, `bridge/WebAppBridge.kt`, `bridge/DownloadBridge.kt` |
| Offline cache (Room) + background replay | `data/db/*`, `sync/OfflineSyncWorker.kt`, `POST /api/native/offline-sync` |
| Encrypted session-token mirroring (web → native store) | `androidx.security:security-crypto` |
| Barcode scanner (ML Kit + CameraX), biometric unlock, network monitor | `ui/BarcodeScannerActivity.kt`, biometric dep, `network/NetworkMonitor.kt` |
| Deep links (`zylod://` + `?page=`), version/update check, telemetry, APK hosting | `util/DeepLinkParser.kt`, `/api/app/version`, `/api/app/telemetry`, `public/downloads/*.apk` (v2.4.x shipped) |

**Missing from the shell:** Jetpack Compose (zero), Firebase/FCM (a `pushTokens` model + `/api/notifications/push-token` endpoint exist, but no Firebase dependency in the shell — push is designed, not wired).

## 3. Theme system — findings (separate workstream: document first, port second)

Source of truth is `src/app/globals.css` (Tailwind v4 CSS-first `@theme inline`); `tailwind.config.ts` is stale shadcn legacy that mostly doesn't apply.

- Light tokens in oklch (~40 vars: surfaces, `primary` ≈ #E53935 red, success/warning, chart-1..5, 12 `sidebar-*`, radius 0.625rem).
- Dark = class-based `.dark` (next-themes, `attribute="class"`) with a hex "Hot Deals" palette: `#121212` bg, `#1E1E1E` cards, `#2E2E2E` borders, `#C8102E` primary.
- Mobile-only token `--bottom-nav-h` (64px + safe-area) — direct spec for the Compose bottom nav.

**Documented inconsistencies (do not port blindly — fix at the token level):**
1. **Global `.dark` remap hack** (`globals.css:199-247`): because ~1,800 hardcoded hex values are scattered across 87 `.tsx` files (`#C8102E` ×480, `#6B7280` ×199, `#1A1A1A` ×130…), dark mode is enforced by CSS rules rewriting light utility classes site-wide. The de facto dark spec = tokens + these remap rules.
2. **Two brand reds:** `#E53935` (light tokens, ×65 hardcoded) vs `#C8102E` (dark + hardcoded ×480). Pick one.
3. **Font bug:** `--font-sans: var(--font-geist-sans)` references variables defined nowhere (`globals.css:10-11`) — no `next/font` import, no geist package → the whole site runs on browser default fonts.
4. **"OLED Obsidian" theme doesn't exist** — `theme-settings-page.tsx` advertises 4 themes, server maps `'obsidian' → 'dark'` silently.
5. `dark:` variants barely used (88 occurrences) — not the mechanism; only `dark:`-clean pages would port 1:1 to Compose.
6. Theme-settings page itself is hardcoded light (`bg-slate-50`, `bg-white`).

**Action:** produce a single `design-tokens.md` (light + dark values, resolved *after* the remap layer) as the shared spec for web cleanup and Compose `Color.kt`/`Theme.kt`.

## 4. Auth — already mobile-native by design

- **No next-auth in practice** (imported nowhere). Custom Bearer system: `POST /api/auth/login` → 48-byte token, stored SHA-256-hashed in `sessions` (7-day), transport via `Authorization: Bearer` **or** `auth-token` cookie. Rotation endpoint `POST /api/auth/refresh` (destroys old, issues new).
- Roles: exactly 3 — `buyer | supplier | admin` (no separate seller role; seller* features are supplier sub-features). Gate helper: `requireUserType(request, [...])` in `src/lib/auth.ts`, used in 144/249 routes.
- Full flow set exists: register, OTP send/verify, forgot/reset, verify-email, 2FA (TOTP + backup codes), Google/Facebook social auth, account recovery. **2FA/OTP return intermediate challenges** (`requires2FA: true, userId`) — the Kotlin login flow must handle these states.
- Client: zustand `auth-store` (localStorage) → Kotlin equivalent: encrypted DataStore + OkHttp `AuthInterceptor` with 401→refresh-retry.
- ⚠️ ~105 routes never call `authenticateRequest` (many legitimately public, some possibly unintentionally open) — audit before the native client widens usage.

## 5. API contract & conventions (what Kotlin must model)

- Envelope: `{ success: true, data: ... }` (242/249 routes); errors `{ error, code? }` with proper HTTP status; rate-limited endpoints return `429 { code: 'RATE_LIMITED' }`.
- Pagination: `?page=&limit=` (≤100) → `{ success, data, pagination: { page, limit, total, totalPages } }`.
- No zod, no typed schemas — response shapes are implicit per-route; Kotlin DTOs must be written per endpoint (spot-check against the component code that consumes them).
- Money: bKash Tokenized Checkout (`src/lib/payments/bkash.ts`) + SSLCommerz as card/Nagad/Rocket aggregator; idempotent wallet crediting via `walletTopups.reference`; escrow tables exist. All BDT.
- Uploads: multipart to local disk (`/api/uploads/kyc`, 8MB, field `file` + `kind`) — not Supabase Storage.
- Offline contract already defined: `offlineSyncEvents` shape `{ actionType, entityType, payloadJson, clientCreatedAt, retryCount }` — reuse it in the Compose app, don't reinvent.
- Real-time: none. Poll with `pollMs`-equivalent (or add WS later server-side).

## 6. Client data layer (spec for the Kotlin equivalent)

- `src/lib/use-api.ts`: `useApi<T>(url, deps, { pollMs })` + `api.post/patch/put/del`; auto-attaches Bearer, unwraps envelope, queues failed mutations into the offline queue (`OfflineQueuedError`).
- Zustand stores = the state spec: `auth-store`, `cart-store`, `currency-store`, `navigation-store` (the router), `notification-store`, `product-store`, `wishlist-store`.
- 404 page components fetch directly with `fetch()` (264 files) — no shared repository layer; the Kotlin app should define a proper Retrofit API surface per domain instead.

## 7. Page surface & tier classification

Registry: `src/lib/page-loader.ts` → **529 unprefixed ids** (+20 category, +17 deals already inside) **+ 40 prefixed (`admin-/buyer-/supplier-/seller-*`) ≈ 569 addressable**; **282 unique pageIds actually navigated** from UI. Top: `product-detail` (×72 links), `home` (×45), `help-center` (×29), `category-products` (×24), `search-results` (×17), `login`, `order-detail`, `orders`, `cart`.

Domain breakdown (of 529 + prefixed): core shopping/discovery ~81 · orders/shipping/returns 65 · supplier/seller tooling 72+15 · support/legal/docs 67 · app-level/settings 54 · finance 33 · engagement (games/VIP/live/affiliate/group-buy) 24 · notifications 20 · wishlist 19 · company 19 · auth 14 · admin 3+10 · misc ~52.

### Tier 1 — rebuild in Compose (daily use, ~22 pageIds)
`welcome`, `home`, `login`, `register-buyer`, `register-supplier`, `otp-verification`, `product-detail` (1,678 ln — the richest page), `category-products` + 20 category ids, `search-results`, `search-home`, `cart`, `checkout`, `orders`, `order-detail`, `profile`, `notifications`, `supplier-dashboard`, `supplier-products`, `supplier-orders`, `supplier-add-product`, `supplier-verification-status`, `buyer-orders`.
Note: `src/components/mobile/*` (18 files: own home, top nav, bottom nav, product card/grid, mobile PDP, search bar) is already a **dedicated mobile spec** — the Compose screens can be a faithful port of these, not the desktop pages.

### Tier 2 — native only if time permits (weekly use)
`wishlist`/`favorites`, `flash-deals`/`daily-deals`, `coupons`, `my-wallet`, `transaction-history`, `bank-accounts`, `add-card`, `track-order`, `buy-now`, `rfq-list`, `quote-request`, `account-settings`, `buyer-dashboard`, `admin-dashboard`, `suppliers`, `brand-showcase`, `chat-list`/`chat-detail`.

### Tier 3 — stay WebView (~450+ ids)
All 67 support/legal/policy/docs · 19 company/careers/investor · 54 settings/app-level (cache, storage, offline, errors, apk-download) · 24 engagement/mini-games/VIP/live-shopping/affiliate · 20 notification sub-pages · the ~60-page seller/order/shipping long tail · all 34 GenericInfoPage prefixed sub-views (a 5,474-line config-driven renderer — a native rewrite of this alone would be a project) · 3 unconfigured fallbacks + 3 broken ids (`shipping-policy-detail`, `display-settings`, `data-sync`).

**Practical ratio: ~5% native Tier 1, ~95% WebView** — and the WebView side is already production-tuned inside the Kotlin shell.

## 8. Widget hotspots (port pain points)

| Widget | Where | Native plan |
|---|---|---|
| recharts | `admin-dashboard`, `buyer-dashboard`, `supplier-dashboard` | Vico for Compose — only needed in Tier 2 |
| QR codes | `product-detail`, `two-factor-auth` | `zxing-android-embedded` or ML Kit |
| Barcode scan | shell (ML Kit, done), `buyer-qr-scan` INFO sub-view | already native in shell |
| OTP input | `otp-verification`, `two-factor-auth` | trivial in Compose |
| Markdown | `policy-detail`, `docs-browser` | stays WebView (Tier 3) |
| Leaflet map | `shared/live-tracking-map.tsx` — **currently unwired**, no importer | skip |
| dnd-kit | zero usage | skip |
| framer-motion | 280/404 page files | re-express in Compose animations for Tier 1 only |
| @huggingface/transformers | visual search dep | keep server-side or WebView; do not port |

## 9. Recommended target architecture

1. **Keep `android/` as the single app.** Add Compose incrementally *inside* it (add `compose-bom` alongside AppCompat; keep `MainActivity` WebView as fallback container).
2. **Dual-shell navigation:** `MainNavigationActivity` (Compose) owns auth-gated flows; a `WebViewActivity`/`ComposeWebViewScreen` handles pageIds that map to Tier 3, receiving the mirrored auth token (already implemented) and rendering `https://<host>/?page=<id>`. Native↔web transitions reuse the existing deep-link scheme so state (cart, session) stays coherent.
3. **Kotlin layers:** Retrofit + OkHttp (Bearer interceptor + 401→`/api/auth/refresh` retry) · kotlinx.serialization DTOs per Tier-1 endpoint · Encrypted DataStore for session · Room (already present) for offline · Compose Navigation mirroring pageIds 1:1 so `/api/app/deep-links` keeps working for both shells · WorkManager reuse for offline sync.
4. **Reuse, don't rebuild:** offline-sync contract, `WebAppBridge` capabilities (scanner, notifications, haptics), version/update check, telemetry.
5. **Add:** FCM (register token at `/api/notifications/push-token`), edge-to-edge + predictive back in Compose screens, biometric login gate (library already present).

## 10. Phased roadmap (solo-dev, rough)

| Phase | Work | Est. |
|---|---|---|
| 0 | `design-tokens.md` (light+dark resolved) · auth-coverage audit of the 105 unauthenticated routes · compose-bom into `android/` | 2–4 d |
| 1 | Compose foundation: theme port, Retrofit stack, session store, Navigation with pageId parity, bottom nav (Home · Categories · Hot Deals · Cart · Profile — same 5 tabs) | 1–2 wk |
| 2 | Buyer core native: auth flows (incl. 2FA/OTP challenges), home, category/browse, product-detail, search, cart, checkout, orders + order-detail, profile, notifications | 3–5 wk |
| 3 | Supplier core native: dashboard (native charts), products, add-product (multipart upload), orders, verification-status | 2–3 wk |
| 4 | FCM push, offline sync upgrade, Tier-2 picks (wallet, wishlist, track-order, chat) | 1–2 wk |
| 5 | Polish: predictive back, haptics, skeletons, error states; Play Store release path (existing version/APK infra) | 1 wk |

## 11. Risks

- **Checkout gap:** web cart/checkout currently manage client store state without hitting payment APIs end-to-end — payment integration is backend work regardless of shell; do it once in the API layer.
- **No typed API contract** — every Kotlin DTO is hand-modeled; regression risk when API shapes drift. Mitigate: add zod/OpenAPI export later, or lock Tier-1 endpoints with tests.
- **Theme truth is split** (tokens + remap layer + hexes) — port only from `design-tokens.md`, never from page hexes.
- **In-memory rate limiting/caching** assumes single-instance deployment (fine now; revisit before scaling).
- **~105 unauthenticated endpoints** — audit before the native client becomes a wider attack surface.
