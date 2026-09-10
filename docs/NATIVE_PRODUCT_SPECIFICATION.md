# Zylod Native Product Specification

**Version:** 1.0 — FOR OWNER REVIEW (STOP point: no Phase 1 implementation has started)
**Evidence basis:** `main` @ `10778512714d706df9edaff6ff69ff4f4469f56d` (v2.4.5-1077851), read directly from the working tree
**Method:** 4 parallel forensic passes over the actual code — (1) page/pageId inventory, (2) design-system/UX, (3) API/data/auth, (4) native shells/tiering/performance — cross-checked against the frozen docs (`HANDOFF.md`, `android/ARCHITECTURE.md`, `native-android-migration-analysis.md`, `platform-contracts.md`, `design-tokens.md`, `AUDIT-WORKFLOW.md`). Every claim carries `file:line` evidence. **No web source file was modified.**

---

## §0 Executive Summary

| # | Finding | Evidence |
|---|---|---|
| 1 | The web product is **one Next.js route** (`src/app/page.tsx`) driving a custom SPA of **729 unique pageIds** resolved through **402 distinct components** (265 fetch-backed, 115 static, 307 alias entries, 4 generic renderers). | `src/app/page.tsx:9-19`, `src/lib/page-loader.ts:9-170`, task-1-a sweep |
| 2 | **Native today = Home screen only**, on both platforms. Every other pageId — including 4 of the 5 bottom tabs — renders a WebView at `https://<server>/?page=<pageId>&<params>`. | `android/.../ui/nav/ZylodRoot.kt:103-123`, `ios/Zylod/Nav/RootView.swift:27-51` |
| 3 | The frozen plan (3 docs agree) is **Tier 1 native ≈ 22 pageIds (~5%)**, Tier 3 WebView long tail (~95%), Tier 2 optional. **Phase 1 = auth + product-detail + cart, both platforms.** Checkout stays out until backend fixes. | `android/ARCHITECTURE.md:31-40`, `HANDOFF.md:115-121`, `platform-contracts.md:69-74` |
| 4 | **Biggest native gap: iOS implements 0 of the ~20 web-expected bridge capabilities.** Android implements all of them plus surplus. Without the iOS bridge every iOS WebView silently degrades to browser mode (no token mirror, scanner, voice, clipboard, downloads, offline queue). | task-1-d parity matrix; `ios/` grep: zero `WKScriptMessageHandler` |
| 5 | **C++/Rust verdict: NOT justified.** Every heavy workload is already on platform APIs (ML Kit, CameraX, BiometricPrompt, SpeechRecognizer, Keychain/EncryptedSharedPreferences, Coil) or server-side by design (CLIP, TOTP, bcrypt, search ranking). Worst client-side compute = filtering ≤100 rows. | §8 workload table |
| 6 | Backend facts a native port must respect: opaque 48-byte session token (Bearer, single-use refresh rotation), **3 different pagination shapes**, **no realtime anywhere (chat polls every 3 s)**, `/api/chat/upload` is called by the client but **does not exist server-side**, checkout is not gateway-connected (wallet top-ups are), uploads response puts `url` at top level. | `src/lib/auth.ts:7,26-50`, `src/app/api/wishlist/route.ts:17-64`, `src/lib/use-api.ts:228,244-259` |

---

## §1 Web Route/Page Inventory

### 1.1 Routing architecture (how the SPA actually works)

- **One route, one SPA.** `src/app/page.tsx:9-19` client-imports `AppEntry` with `ssr:false`. There is no other page and no `not-found.tsx`.
- **PageId is state, mirrored to History.** `navigate(page, params)` (`src/store/navigation-store.ts:54-73`) parses inline `?query`, pushes a real History entry (`pushState`, L61-65) with `{page, params}` — this is why Android hardware back works today. `setCurrentPage()` (L78-100) is the replace variant + scroll-to-top. Global `popstate` listener syncs store ⇄ History (L128-147); `scrollRestoration='manual'`.
- **Deep-link entry:** `AppEntry` mount effect reads `?page=<id>` + all other query params → `setCurrentPage` (replace) → scrubs `page` from the URL (`src/components/app-entry.tsx:187-208`). First-run mobile → `welcome` gated by `localStorage['zylod-onboarding-seen']` and viewport <768 (L210-216).
- **Resolution pipeline:** `PageRenderer` → `loadPage(pageId)` (`page-loader.ts:202-208`): `CHUNK_CORE.has` → direct import map; `REAL_PAGES.has` → `getChunkForPage()` (L219-376) names a lazy chunk (`src/lib/page-chunks/chunk-*.ts`, two-level `import()`); **anything else** hits `getGenericType()` (L186-200) which always returns ≥ `'info'` → a generic renderer. `isKnownPage()` returns `true` unconditionally (L210-217): **a registered pageId can never 404; an unregistered id always renders a generic page.**
- **Shell rules per pageId** (`src/components/layout/app-shell.tsx`): `FULLSCREEN_PAGES` (L13-18: 17 auth/onboarding/checkout ids) render with no chrome; mobile `home` renders bare (its component owns top+bottom nav, L50-56); "custom-header" ids (all `supplier-/buyer-/admin-/seller-*`, `*-products/-orders/-dashboard/-settings…`, plus cart/wishlist/etc., L24-31) get bottom-nav only; `DETAIL_PAGES` (`product-detail, order-detail, chat-detail, order-processing`, L20-22) get a back-bar + bottom nav; default = bottom nav (L105-112). Desktop = Header + VerificationBanner + Footer.
- **Page transitions are instant swaps** — no route-level AnimatePresence; a resolver spinner shows while the chunk loads (`app-entry.tsx:105-141`); pages self-animate on mount. Native must not invent route transitions if fidelity is the goal.

### 1.2 PageId space — verified numbers

| Metric | Value |
|---|---|
| Unique named pageIds in code | **729** (691 unique `REAL_PAGES` incl. 15 core + 20 category ids + 10 deal-only + 8 chunk-only ids) — matches the prior 728 live sweep ±1 |
| `REAL_PAGES` raw entries | 709 (18 duplicated lines) |
| Chunk loader keys | 707 → **402 distinct components**; 0 REAL id lacks a loader; 0 loader key is unroutable (full routing simulation, task 1-a) |
| Alias mappings | **307** entries over 143 components (400 canonical 1:1) |
| Fetch-backed components | 265 (214 distinct `/api/*` endpoints consumed) |
| Auth-aware components | 93 (86 send `Authorization` headers; explicit role checks in only 12 files) |
| Static components | 115; effect-only 19; client-store-driven 7 |
| Dedicated MOBILE page implementations | **2** (`home`, `product-detail`); the other 16 `src/components/mobile/*` files are shell chrome |

### 1.3 Genuine page inventory by domain

Tag legend: `[lines | data-class | flags]` — `F`=fetch-backed, `A`=auth-aware, `S`=static, `E`=effect-only, `C`=client-store, `P`=params.

**Core/auth (15 — all genuine):** `account-recovery[395,F]`, `account-suspended[384,F,P]`, `backup-codes[346,A,F,P]`, `email-verification[462,F,P]`, `forgot-password[504,F]`, `home[160,C]`, `login[686,A,F]`, `otp-verification[560,A,F,P]`, `phone-verification[427,F,P]`, `register[361,S]`, `register-buyer[322,F]`, `register-supplier[448,A,F]`, `reset-password[441,F,P]`, `two-factor-auth[695,A,F,P]`, `welcome[445,E]`.

**Product/browse (34 ids → 28 comps, genuine except 3 static utility pages):** `product-detail[1678,F,A?,P]` (fetches `/api/products/{id}` + `/specifications` + `/api/wishlist`), `category-products[758,A,F,P]`, `product-list[623,F]`, `explore[402,F]`, `bulk-pricing[356,F,P]`, `new-arrivals[369,F]`, `product-comparison[369,F,P]`, `search-results[366,F,P]`, `clearance-sale[342,F]`, `brand-showcase[281,F,P]`, `frequently-bought-together[295,F,P]`, `wholesale-catalog[304,F]`, `product-variants[348,F,P]`, `trending-products[266,F]`, `daily-deals[313,F]`, `flash-deals[298,F]`, `product-reviews[319,F,P]`, `similar-products[275,C,P]`, `supplier-products[282,F,P]`, `category-browser[224,F]`, `product-specifications[224,F,P]`, `write-review[190,A,F,P]`; static: `upload-review-photos[246]`, `product-qa[256]`, `size-guide[198]`. In-family aliases: compare, discover, trending, flash-sale, clearance(-sale), seasonal(-offers/sale), frequently-bought(-together).

**Cart/checkout/orders/logistics (52 ids → 49 comps; core commerce genuine, logistics sub-pages are static mockups):** genuine — `cart[358,C]`, `checkout[286,C]`, `orders[424,F]` (`/api/orders/my-orders`), `add-address[283,F]`, `edit-address[327,F,P]`, `shipping-address[235,F]`, `delivery-method[222,F]`, `quick-order[289,C]`, `bulk-order-form[307,C,P]`, `add-to-cart-confirmation[190,C,P]`; static step/detail pages (37): `order-detail[280,S,P]`, `dispute-center[335,S]`, `track-order[245,S,P]`, `shipping-calculator[230,S]`, `customs-clearance[231,S,P]`, `import-export-tracker[239,S,P]`, etc.

**Profile/account/wallet/finance (39 ids → 37 comps — all 37 genuine A+F):** `seller-profile[1296,A,F,P]`, `admin-profile[794]`, `buyer-profile[791]`, `staff-profile[713]`, `account-settings[559]`, `edit-profile[444]`, `notification-preferences[631]`, `withdraw-money[263]`, `credit-limit[261]`, `my-wallet[227]`, … `profile[80,A,P]` is a thin role dispatcher.

**Seller/supplier suite (85 ids → 69 comps; ~24 genuinely fetch-backed, ~16 derived 66-line mock pages, ~29 tiny static stubs):** genuine — `seller-registration[432]`, `store-story-about[391]`, `store-featured-products[351]`, `seller-order-management[189]`, `seller-order-detail[170,F,P]`, `inventory-management[220]`, `seller-shipping-settings[193]`, `seller-verification[214]`, `seller-verification-upload[127]`, `store-banner-editor[259]`, `seller-edit-product[238,F,P]`, `seller-add-product[266]`, `product-listings-manager[192,F]`, `seller-analytics[207]`, `seller-dashboard[145,F]`, `seller-storefront[137,F]`, `supplier-dashboard[446,F]`, etc.; derived mock (E): revenue-reports, revenue-breakdown, seller-payouts(+methods/request), sales-funnel, traffic-sources, customer-insights, financial-statements, tax-invoices, tier-benefits, rankings, product-performance, conversion-rate; static stubs (15-26 ln): bulk-price-update, bulk-upload-template, create-promotion, promotion-analytics, seller-create-ticket, customer-rfq-inbox, seller-flash-sale-nomination, seller-quick-actions, store-theme-customizer, seller-notifications-center, …

**Search (29 ids → 20 comps — all fetch-backed):** `barcode-scanner[403,F]` (native-first), `search-suggestions[328,F,P]`, `image-search[274,F]`, `voice-search[287,F]`, `search-home[299,F]`, `search-filters[212,F,P]` + 14 history/suggestion pages.

**Support/policy/docs (62 ids → 23 comps):** fetch-backed — `ticket-detail[318,F,P]`, `report-user[345]`, `docs-browser[315]`, `chatbot[226]`, `live-chat[269]`, `help-center[259]`, `faq[273]`, `submit-ticket[215]`, `policy-detail[157]`; static policy one-pagers (9).

**Wishlist/collections (19 ids → 20 comps — all fetch-backed except `wishlist-sort-filter[242,S]`).**

**Misc (356 ids → 141 comps), 6 real domains:**
- Dashboards: `admin-dashboard[383,F]`, `admin-reports[342,F]`, `buyer-dashboard[428,F]`, `supplier-dashboard[446,F]`.
- Notifications (30 ids, nearly all A+F): `notifications[330]`, `push-notification-settings[407]`, `order-updates[325]`, `delivery-updates[336]`, + 26 sub-pages.
- Marketing/loyalty (39 ids, A+F): coupons, checkin, spin-win, referral, affiliate, vip/points, group-buy, live-shopping, mini-games.
- Legal (42 ids): mostly F against `/api/legal/*`, ~8 static.
- Company/careers/investor (25 ids): mostly F.
- **App-level/native-android engine (48 ids):** `app-settings[239,F]`, `deep-link-handler[195,F]`, `offline-mode[164,F]`, `storage-management[195,F]`, `service-status[87,F]`, `error-404[124,F]`, + cache/offline/deep-link sub-pages — these exist to drive the native shell.
- Alias block: 159 deep-link-compat aliases → canonical components.

**Generic renderers (4):** `generic-info-page[5474 ln — config-driven host with 41 genuinely-built embedded sub-components incl. SellerStorefrontPage]`, `generic-category[253,F]`, `generic-deals[195,F]`, `generic-finance[640,A,F]`.

### 1.4 Alias/duplicate map (headline clusters)

| Component | Aliases pointing at it |
|---|---|
| `product-listings-manager-page` | canonical + `seller-products-manager`, `catalog-management`, (dead `supplier-products` key) |
| `account-settings-page` | `profile-settings`, `account-overview`, `seller-store-settings` |
| `explore-page` | `misc`, `discover`, `b2b-services` |
| `register-supplier-page` | 9 aliases (`become-a-seller`, `sell-with-us`, …) |
| `orders-page` | 8 aliases (`my-orders`, `reorder`, `purchase-history`, …) |
| `help-center-page` | 9 aliases (`support`, `helpdesk`, …) |
| `seller-dashboard-page` | `merchant-dashboard`, `seller-center`, `seller-home` (+ `supplier-dashboard` maps to a *different* 446-ln file) |
| legal family | `terms-of-service`/`privacy`/`cookies` exist in BOTH chunk-support and chunk-misc (misc precedence wins) |

### 1.5 Generated/wildcard families

| Family | Rule | Count | Renderer |
|---|---|---|---|
| Categories | `CATEGORY_IDS` exact set (`page-loader.ts:172-177`) | 20 | `GenericCategoryPage` (fetch `/api/products?limit=24`) |
| Deals | `DEAL_IDS` (L179-184), 10 net-new after REAL overlap | 10 | `GenericDealsPage` (fetch `/api/deals?limit=20`) |
| Role prefixes | any `admin-*`/`supplier-*`/`seller-*`/`buyer-*` (L189-190) | unbounded | `GenericInfoPage` — 170 `INFO_CONFIGS` keys, 42 dispatch to in-file custom components |
| Finance substrings | id contains `payment/wallet/invoice/transaction/billing/escrow/credit/…` (L191-198) | unbounded | `GenericFinancePage` (genuine: `/api/profile/credits`, top-up/withdraw) |
| Catch-all | everything else (L199) | unbounded | `GenericInfoPage` boilerplate |
| `generate-pages.js` | generated 20 seller-suite page files + 9 `/api/supplier/*` routes from one template | 20 files on disk | mixed (see 1.3 seller suite) |

### 1.6 Entry-point map

- **Mobile bottom nav** (`mobile-bottom-nav.tsx:16-20`): `home` · `category-browser` · `flash-deals` · `cart` · `profile` (→`login` if unauthenticated, L43-45). Cart badge = distinct item count, 99+ cap.
- **Desktop header**: logo→home; nav = home/cart/daily-deals/suppliers/flash-sale/coupons + "More" menu; account dropdown; notification panel mapper (L546-552).
- **Mobile Quick Access** (20 tiles, `mobile-promo-icon-grid.tsx:23-45`) and **Services drawer** (`mobile-top-nav.tsx:14-33`) — full id lists in task-1-a report.
- **Deep link**: `?page=<id>&<params>` (web) — same URL the Android `DeepLinkParser` produces; `/api/app/deep-links` is a DB slug resolver with analytics, **not** a tier registry.

### 1.7 Loading/empty/error/offline patterns

- **Loading:** resolver spinner → `Suspense` logo-pulse → 1:1 mirror skeleton system (`loading-skeletons.tsx`, 269 ln: `ProductCardSkeleton`, `HomeLoadingScreen`, `MobileHomeLoading`) + generic `Skeleton` ×83.
- **Empty:** mostly plain "No X found" text; no shared `<EmptyState>`.
- **Error:** root `ErrorBoundary` ("Try again"/"Go home", `error-boundary.tsx:29-87`); per-page fetch errors render inline "unavailable" cards.
- **Offline:** no `navigator.onLine`. Failed mutations → `OfflineQueuedError` + `queueOfflineAction` (excluded: `/api/auth/`, `/api/uploads/`, `/api/chat/`, `/api/search/`) (`use-api.ts:20-44,62-72`); products auto-mirrored to the native Room cache after every `/api/products` fetch (L68-70). Server-side stale-cache fallback in `api-cache.ts:48-92`.

### 1.8 Pages that REQUIRE native capabilities (web→native dependency list)

| pageId / component | Required native capability | Android today | iOS today |
|---|---|---|---|
| `barcode-scanner`, `qr-scanner`, `scan-barcode`, generic-info QR view | Camera + barcode decode | ✅ ML Kit (`BarcodeScannerActivity`) | ❌ |
| `voice-search`, header `search-bar` | Speech recognition | ✅ SpeechRecognizer | ❌ |
| `push-notification-settings` | Permission + local notifications + device id | ✅ POST_NOTIFICATIONS + channels | ❌ |
| `app-security-settings` | Biometrics | ✅ BiometricPrompt | ❌ |
| storage/cache pages (`clear-storage`, `purge-cache`, `cache-settings`) | `clearLocalAppCache` | ✅ Room+WebView cache | ❌ |
| every authed page | `setAuthToken` mirror (offline replay) | ✅ EncryptedSharedPreferences | ❌ (Keychain exists, no bridge) |
| blob/data downloads (order-invoice-download, backup-codes) | `ZylodDownload.save` | ✅ DownloadBridge→MediaStore | ❌ (WKWebView blobs die) |
| `image-search`, `register-supplier` KYC, chat attachments, review photos | File picker + multipart upload | ✅ (WebView file chooser) | ✅ (WKWebView default) |
| `live-tracking` | Map | WebView (react-leaflet) | WebView |
| clipboard (19 pages) | copy | ✅ polyfill | ❌ |
| sound effects + haptics | vibrate | ✅ Vibrator (bridge `triggerHaptic` — no web caller yet) | ❌ |

---

## §2 Tier Classification (frozen lists, reconciled with code evidence)

### 2.1 The frozen definitions (verbatim sources)

- **`android/ARCHITECTURE.md` §3 (L31-40)** — operative freeze: Tier 1 = Foundation (5 tabs) + Buyer core (`login`, `register-buyer`, `register-supplier`, `otp-verification`, `welcome`, `home`, `product-detail`, `category-products` +20 category ids, `search-results`, `search-home`, `cart`, `checkout`*, `orders`, `order-detail`, `profile`, `notifications`, `buyer-orders`) + Supplier core (`supplier-dashboard`, `supplier-products`, `supplier-orders`, `supplier-add-product`, `supplier-verification-status`). *"Tier 3 — everything else stays WebView."* (*checkout gated: "goes native only after checkout-payment-audit items 1-3 are implemented and integration-tested. Never ship a mock.")
- **`native-android-migration-analysis.md` §7 (L81-91)** — same Tier 1 (~22 ids), adds a **Tier 2** "native only if time permits": `wishlist/favorites`, `flash-deals/daily-deals`, `coupons`, `my-wallet`, `transaction-history`, `bank-accounts`, `add-card`, `track-order`, `buy-now`, `rfq-list`, `quote-request`, `account-settings`, `buyer-dashboard`, `admin-dashboard`, `suppliers`, `brand-showcase`, `chat-list/chat-detail`. *"Practical ratio: ~5% native Tier 1, ~95% WebView."*
- **`platform-contracts.md` §6 (L69-74)** — *"Both platforms move through the same phases with the same gates. No platform starts Phase 1 until BOTH Phase 0 foundations are owner-audited. Phase 1 scope applies to both platforms: auth flows, product-detail, cart."*
- **`HANDOFF.md` §7 (L115-121)** — *"Only the owner authorises Phase 1 (auth + product-detail + cart native, both platforms). checkout stays out of native until backend fixes (orders/[id]/pay + payment callbacks) are merged."*

### 2.2 Reconciled classification (evidence-based adjustments in notes)

| Tier | Surface | Disposition | Notes |
|---|---|---|---|
| **NATIVE Tier 1** | 5 tabs chrome (home · category-browser · flash-deals · cart · profile) | Native chrome immediately; tab **content** follows tier schedule | Tab alias highlight map already exists: `ZylodRoot.kt:57-74` |
| **NATIVE Tier 1 — Phase 1** | `welcome`, `login`, `register-buyer`, `register-supplier`, `otp-verification`, `two-factor-auth`(+`forgot-password`/`reset-password`), `product-detail`, `cart` | Native both platforms | Specified in §3; long-tail auth pages (`backup-codes`, `account-recovery`, `email/phone-verification`, `account-suspended`) may ship Phase 1 as compact native screens **or** remain WebView with tokenless access — documented in §10 |
| **NATIVE Tier 1 — Phase 2** | `home` (exists), `category-products`+20 category ids, `search-results`, `search-home`, `orders`, `order-detail`, `profile`, `notifications`, `checkout` (backend-gated) | Native both platforms | Token mirroring (web⇄native) formally Phase 2 per `platform-contracts.md:38-39`; deep-link unification into `NativeMainActivity` Phase 2 per `ARCHITECTURE.md:17` |
| **NATIVE Tier 1 — Phase 3** | supplier core 5 screens | Native both platforms | Dashboard charts → Vico (Compose) / Swift Charts |
| **Tier 2 (optional)** | the migration-analysis list above | Native only if time permits | `chat-list/chat-detail` caveat: backend `/api/chat/upload` does not exist (attachment 404) — text-only chat or backend fix first; `live-tracking` stays WebView (react-leaflet map) |
| **WEBVIEW Tier 3** | everything else (~650 ids): all 62 support/policy/docs, legal, company/careers/investor, 30 notification sub-pages, 39 engagement ids, seller long tail, all 48 app-engine pages, all GenericInfo/Category/Deals/Finance families | WebView at `?page=<id>` | Full native capability parity mandatory — see §7 (iOS bridge) |

### 2.3 Classification rules used (so future screens are decided, not guessed)

A page is a **native candidate** iff ≥2 of: (a) daily-use frequency (bottom tab or first-screen link), (b) non-trivial local state (store-backed cart/auth), (c) requires native capability, (d) data contract is stable and server-real (fetch-backed, not a static mock). Static policy/one-pager/generic-config pages are always WebView. This rule reproduces the frozen lists exactly.

---

## §3 Native Screen Specifications (Phase 1 in full detail; Phase 2/3 in outline)

> Port basis rule: the web's `src/components/mobile/*` set is already a dedicated mobile spec — native screens are faithful ports of the **mobile** implementations, not the desktop pages (per migration-analysis §7 note).

### 3.0 Foundation — App shell & navigation (both platforms)

- **Chrome:** 5-tab bottom bar, 64 dp height + navigationBarsPadding (Android, frozen token `ZylodRoot.kt:135`) / TabView 5 tabs (iOS `RootView.swift:34-41`); active tab = primary color + 16×2 dp top indicator; cart badge = distinct item count 99+ (`mobile-bottom-nav.tsx:52-88`).
- **Routing contract:** internal navigation = pageId + params map; every non-native destination opens WebView `https://<server>/?page=<pageId>&<encodedParams>` (parity with `WebScreen.kt:153-154`, `WebViewScreen.swift:53-57` — percent-encode pageId, encode values). Back button = history-aware (store trail → fallback home) to mirror `navigation-store.ts:102-121`.
- **Theme:** system dark mode with the frozen "Hot Deals" dark palette (§4); instant page swaps; per-screen entrance animation `opacity 0→1, y 20→0` (web canonical, 299 framer-motion files).
- **Session plumbing:** token in Keychain (iOS `SessionManager.swift:8-40`) / EncryptedSharedPreferences (`SessionManager.kt`); **Phase 1 handshake:** after native login, seed the WebView's `b2b-auth-storage` localStorage before first script run (Android: `androidx.webkit` `addDocumentStartJavaScript`; iOS: `WKUserScript(atDocumentStart:)`) so Tier 3 pages inherit the session; reverse direction already exists via `setAuthToken` bridge. Full bidirectional mirroring remains Phase 2 per `platform-contracts.md:38-39`.
- **States:** offline banner (NetworkMonitor/`NWPathMonitor`), server-unreachable error state with retry (exists on both: `WebScreen.kt:428-470`, `WebViewScreen.swift` error view), resolver loading state.

### 3.1 Welcome / first-run (`welcome`) — web `welcome-page.tsx` [445, E]

- Shown when: mobile form-factor AND `zylod-onboarding-seen` unset (web `app-entry.tsx:210-216`). Fullscreen (no chrome).
- Layout: brand hero, 2-3 value-prop slides, CTA pair → `register-buyer` / `login`; "Continue as guest" → `home`.
- Completion: set `zylod-onboarding-seen` (native SharedPreferences/UserDefaults — same key semantics).
- Acceptance: first launch shows once; never shows again; CTAs navigate correctly; skip lands on Home.

### 3.2 Login (`login`) — web `login-page.tsx` [686, A, F]

- **Endpoint:** `POST /api/auth/login` `{email?|phone?, password}` (`login/route.ts:75-182`).
- **Response branches:** OK `{success, token, user{id,userType,email,phone,authProvider,accountStatus,isEmailVerified,isPhoneVerified,requires2FA}}`; **2FA** `{requires2FA:true, userId, methods:['authenticator'], hasPhone, maskedPhone}` → route to 2FA screen; 401 `{code:'INVALID_CREDENTIALS', attemptsRemaining, accountLocked?}`; 403 `{code:'ACCOUNT_SUSPENDED', suspension{reason,reference,suspendedAt}}` → account-suspended state; 429 `{code:'RATE_LIMITED', lockedUntil}`.
- **UI:** email/phone toggle, password w/ show-hide, submit w/ spinner, error toasts (sonner-equivalent), links → forgot-password / register-buyer / register-supplier. Social buttons (Google/Facebook) → the web's **simulated** consent flow (`social-auth.ts:86-124` → `/api/auth/google|/api/auth/facebook`) — reproduce via native confirmation dialog, not real OAuth SDKs (parity).
- **Client rate-limit:** mirror `zylod-auth-ratelimit` behavior (`auth-security.ts:135-170`).
- **Success:** persist session (Keychain/EncryptedSharedPreferences), seed WebView `b2b-auth-storage` (§3.0), navigate to `home` (or back).
- **Acceptance:** all 5 response branches handled; token stored + WebView pages authenticated after native login; locked/suspended states show designed screens.

### 3.3 OTP verification (`otp-verification`) — web `otp-verification-page.tsx` [560, A, F, P]

- **Endpoints:** `POST /api/auth/otp/send` `{phoneOrEmail, purpose:'register'|'login'|'reset_password'}` → `{success, message, otpCode, devCode, expiresAt}` (dev-only plaintext — do not display in release); `POST /api/auth/otp/verify` `{phoneOrEmail, code}` → register: `{verified:true}` (continue registration); login: `{token, user}` (real session); reset: `{resetToken}` (15-min).
- **UI:** 6-box OTP input (web uses `input-otp`), countdown resend, purpose-aware copy, error on expired/invalid code.
- **Acceptance:** all three purposes verified against live responses; resend respects `expiresAt`.

### 3.4 Register buyer (`register-buyer`) — web `register-buyer-page.tsx` [322, F]

- **Flow:** phone OTP (purpose `register`) → `POST /api/auth/register` `{userType:'buyer', authProvider:'phone_otp', phone, fullName?, password?, email?…}` → 201 `{token, user}`; 409 `DUPLICATE_EMAIL|DUPLICATE_PHONE`; 400 `WEAK_PASSWORD` (`register/route.ts:31-152`).
- Multi-step resume: web persists draft in sessionStorage `zylod-pending-registration` (`pending-registration.ts:30-52`) — native: in-memory VM state + process-death save (SavedStateHandle/SceneStorage).
- Acceptance: full happy path + both duplicate errors + weak password.

### 3.5 Register supplier (`register-supplier`) — web `register-supplier-page.tsx` [448, A, F]

- **KYC upload:** `POST /api/uploads/kyc` multipart, fields **`file`** + **`kind`** ∈ `nid-front|nid-back|trade-license`, limits 8 MB jpeg/png/webp → **`{success, url (top-level), kind, size}`** (`uploads/kyc/route.ts:6-51`). Native camera/gallery picker (Android Photo Picker / FileProvider; iOS PHPicker + camera), upload progress, 3 images.
- **Register:** `POST /api/auth/register` with `{userType:'supplier', businessName, businessType, nidNumber, nidFrontImageUrl, nidBackImageUrl, tradeLicenseNumber, tradeLicenseImageUrl, tinNumber?, bank*?, city?}`.
- Acceptance: image picker → upload → URL wired into register; oversize/wrong-type rejected; success lands on supplier dashboard WebView or home.

### 3.6 Forgot / reset password (`forgot-password`, `reset-password`) — web [504 / 441, F, P]

- `POST /api/auth/forgot-password` `{email}`; reset via OTP purpose `reset_password` → `resetToken` → `POST /api/auth/reset-password` `{token, password, confirmPassword}` (`forgot-password/route.ts:7-43`, `reset-password/route.ts:8-56`).
- Acceptance: full loop incl. expired-token error.

### 3.7 Two-factor auth (`two-factor-auth`) — web [695, A, F, P]

- Login 2FA branch → `POST /api/auth/2fa/verify` `{userId, code, method}` → `{token, user}` (`2fa/verify/route.ts:82-94`); setup/backup codes remain WebView Tier 3 in Phase 1 (`backup-codes` Bearer-only pages).
- Acceptance: TOTP challenge completes login; wrong-code error; cancels back to login.

### 3.8 Home (`home`) — EXISTS natively on both platforms (parity deltas only)

- Android `HomeScreen/HomeViewModel` (520+147 ln) and iOS `HomeView/HomeViewModel` (425 ln) already port `mobile-home-page.tsx` (155 ln). **Parity backlog from the mobile spec:** category-pill **long-press 500 ms → subcategory drawer** (`mobile-category-pills.tsx:143-158`); sticky-search-bar swap animation y±48 0.2 s (`mobile-home-page.tsx:101-128`); 1:1 mirror skeletons (`loading-skeletons.tsx`); chip pastel palette already ported (Color.kt `QuickChipColors/Gradients`, ZylodChip).
- Data: 5 parallel calls (categories, products soldCount, deals flash limit 8, product count, supplier count) — implemented on both; `loadMore` pagination; CancellationException guards already fixed (Phase 0).
- Acceptance: parity checklist above closed; live data with real `DATABASE_URL`.

### 3.9 Product detail (`product-detail`) — web `product-detail-page.tsx` [1678] + `mobile-product-detail-page.tsx` [540] — **port basis: the mobile 540-ln spec**

- **Data:** `GET /api/products/[id]` → full row + `supplier{id,companyName,ratingAvg,ratingCount,verificationStatus}` + `category{id,name,slug}` + `images[]` (sortOrder) + `priceTiers[] {minQty,maxQty,pricePerUnit}` + `variants[]` + `reviews` (take 10, 5 replies each, `buyer.buyerProfile{fullName,businessName}`) (`products/[id]/route.ts:39-96`). Optional sub-fetches: `/similar`, `/frequently-bought`, `/specifications`, `/qa`.
- **Layout (mobile port):** image gallery (web: embla → native `HorizontalPager` / `TabView(.page)`), title 2-clamp, price + tier table, MOQ/unit/stock, supplier card → storefront (WebView Tier 3), variant selector, qty stepper with **tier-price highlighting**, tabs (Details/Specs/Reviews/QA) with underline indicator (web `layoutId` → `TabRow`/matched-geometry equivalent), reviews list w/ replies.
- **Actions:** Add-to-cart → cart store/API (§3.10) with MOQ/stock validation; **Buy-now** → `POST /api/orders/create-direct` `{productId, quantity, variantId?, unitPrice, supplierId, shippingAddressId?}` → `paymentStatus:'paid'` unless `cod` (`create-direct/route.ts:14-50`) → order confirmation (WebView `order-confirmation` or native summary sheet; orders screens are Phase 2); Wishlist toggle → `POST /api/wishlist {productId}` / `DELETE ?productId=`; Share dialog (constructed FB/X/WA/LinkedIn/Telegram URLs — web has no navigator.share; native MAY use system share sheet as the equivalent, documented deviation) + QR dialog (generate: `qrcode.react` → native QR generator).
- **Chrome:** sticky buy-bar appears when CTA scrolls off-viewport (web `product-detail-page.tsx:1628-1668`); back-bar shell (`DETAIL_PAGES`).
- **States:** skeleton mirror, error state w/ retry, out-of-stock, unverified-supplier badge.
- **Acceptance:** renders real product by id from deep link and from list taps; tier price updates with qty; add-to-cart + buy-now + wishlist verified end-to-end with live data; gallery swipes; deep link `zylod://product/<id>` lands here (Android already; iOS via new scheme §7).

### 3.10 Cart (`cart`) — web `cart-page.tsx` [358, C] + `cart-store.ts` — **buyer-only server-side**

- **Dual-source truth (mirror web semantics exactly):** local persisted store (`b2b-cart-storage`) merging by `productId::variantId` with tier-based `calculatePrice` (`cart-store.ts:43-52,241-249`); background sync `POST /api/cart {productId, variantId?, quantity, supplierId}`; authoritative server state `GET /api/cart` → `{cartId, totalItems, totalAmount, suppliers:[{supplierId, supplierName, items[], subtotal}]}` grouped by supplier (`cart/route.ts:54-79`); update `PUT /api/cart/[itemId] {quantity}`; delete; `POST /api/cart/bulk`. Server errors carry `{stockAvailable}` / `{moq}` (400) → surface as inline field errors.
- **Auth gate:** `requireUserType ['buyer']` — unauthenticated users get the soft login CTA (web `mobile-bottom-nav.tsx:43-45`), **not** a redirect.
- **Layout:** supplier-grouped sections, item cards (image, name 2-clamp, tier price, qty stepper, remove), summary (items/amount), coupon entry (visual only — web checkout owns coupon application server-side), sticky checkout CTA → **WebView `checkout`** (Tier 3 until Phase 2 backend gate) with token handoff §3.0.
- **Tab badge:** distinct item count, 99+ cap.
- **Acceptance:** offline add queues or errors per web rules (`/api/cart` is NOT in the offline exclusion list → queueable); qty below MOQ blocked; server grouping renders; badge updates; checkout handoff authenticated.

### 3.11 WebView tier contract (what makes ~95% WebView legitimate)

Every WebView surface MUST retain: cache-first server resolution + error/retry state; full `ZylodNativeBridge` capability parity (20 web-expected methods); `ZylodDownload`/download equivalent; percent-encoded `?page=` URL builder; offline mutation queue; token seeding (§3.0); external-scheme handling (tel:/mailto:/market: → OS; off-origin http(s) → external browser). Android has all of this today; **iOS has none of it — that is the §7 foundation item.**

### 3.12 Phase 2/3 outline (no implementation yet)

- **Phase 2 buyer core:** `category-products` (+20 `GenericCategoryPage` equivalents — the category metadata table lives in `generic-category-page.tsx:27-40`), `search-results`/`search-home` (endpoints `/api/search`, `/api/search/suggestions|history|popular`), `orders`/`order-detail` (`/api/orders/my-orders`, `[id]/{track,timeline,invoice,cancel,return,exchange,feedback}`), `profile` (role dispatcher → `/api/profile/me` + sub-resources), `notifications` (`/api/notifications` + preferences), `checkout` (gated: requires `orders/[id]/pay` + gateway callbacks merged server-side).
- **Phase 3 supplier core:** `supplier-dashboard` (charts → Vico/Swift Charts; payload `{stats, supplier, recentSubOrders, topProducts, productPerformance, inventoryAlerts, monthlyRevenue, customerInsights}` `supplier/dashboard/route.ts:163-215`), `supplier-products` (`/api/supplier/products` CRUD + multipart), `supplier-orders`, `supplier-add-product`, `supplier-verification-status`.
- **Phase 4:** FCM/APNs push, offline sync upgrade, Tier 2 picks. **Phase 5:** predictive back, haptics pass, skeletons polish, store release path.

---

## §4 Shared Component / Design-System Mapping

### 4.1 Tokens (frozen source: `globals.css` 65-144 + `design-tokens.md`)

| Token | Light | Dark | Compose (exists) | SwiftUI (exists) |
|---|---|---|---|---|
| background/foreground | `#FBFAF9` / `#1C130C` | `#121212` / `#F5F5F5` | `Color.kt` | `ZylodColor.dynamic` |
| primary | **`#C90019`** | **`#C8102E`** | same | same |
| destructive | `#E7000B` | ≈`#FF6467` | same | same |
| success / warning | `#008C41` / `#DFA11A` | oklch equivalents via `LocalZylodExtra` | ✅ | ⚠ add success/warning to `ZylodTheme` extras |
| card/popover | `#FEFDFC` | `#1E1E1E` | ✅ | ✅ |
| border/input | `#E6E0DB` | `#2E2E2E` | ✅ | ✅ |
| radius scale | 6/8/10/14 px | same | `Shape.kt` 6/8/10/14 dp | ⚠ add `ZylodShape` constants |
| bottom nav height | 64 px + safe-area | same | 64 dp + navigationBarsPadding | TabView default + safeAreaInset |
| Quick-Access chips | 19 hexes + 7 pastel 135° gradients (light-only on web — port as-is both themes) | — | `QuickChipColors/Gradients` | `ZylodChip` |
| Typography | system font (web font vars are **broken** — sanctioned native improvement); roles: top-bar 18 bold · section 12 semibold · title 10/13 2-clamp · price 11 bold primary · "N sold" 8 · nav label 10 | — | `Type.kt` (sp) | `ZylodFont.scaled` (UIFontMetrics) ✅ |

Known debts to port deliberately: **two brand reds coexist** (token `#C90019` vs hardcoded `#C8102E` ×481) — native uses the frozen two-mode values verbatim (`design-tokens.md:94-101`); web dark mode relies on a CSS remap layer (`globals.css:210-247`) — native uses the explicit dark palette instead.

### 4.2 Component mapping (web → Android Compose → iOS SwiftUI)

| Web component (usage) | Native Android | Native iOS |
|---|---|---|
| `button` (×309) + cva variants | Button + sealed ButtonStyles (primary/secondary/ghost/destructive) | Button + `ZylodButtonStyle` |
| `badge` (×124) | AssistChip/Box+clip | Capsule background view |
| `card` (×80) | ElevatedCard/Card | RoundedRectangle container |
| `skeleton` (×83) + mirror skeletons | shimmer Box set (1.6 s sweep parity) | redacted-style shimmer |
| `input/textarea/label/switch/checkbox/slider/select` | Material3 TextField/Switch/Checkbox/Slider/DropdownMenu | TextField/Toggle/Picker/Slider |
| `drawer` (vaul, ×5 mobile) | ModalBottomSheet (M3) | `.sheet` + `presentationDetents` |
| `dialog` (×4) | AlertDialog/Dialog | `.alert` / `.sheet` |
| `sheet` (desktop menu ×1) | ModalDrawer | `.sheet` |
| `carousel` (embla, PDP gallery) | HorizontalPager | TabView(.page) |
| sonner toasts (×43 call sites) | Snackbar/host Toast via bridge | custom toast overlay |
| `use-toast` legacy (2 files) | — (migrate to snackbar) | — |
| recharts (3 dashboards, Phase 3) | Vico | Swift Charts |
| react-leaflet map (live-tracking, Tier 3) | stays WebView | stays WebView |
| `qrcode.react` (QR dialog, 2FA) | ZXing-embedded generator or ML Kit companion | CoreImage CIQRCodeGenerator |
| Material Symbols ligatures (icons) | material-icons-extended (already a dep) | SF Symbols (documented per-icon mapping) |
| pull-to-refresh | **absent on web** — do NOT add in Phase 1 (fidelity); allowed in Phase 5 polish | same |
| infinite scroll (IntersectionObserver 400 px) | LazyColumn `onScrollEnd` / paging | LazyVStack `onAppear` sentinel |
| WebAudio sounds + `navigator.vibrate` (`sound-effects.ts:24-129`: default D5→A5, chime C5-E5-G5-C6, urgent sawtooth) | `ToneGenerator`/SoundPool + `VibrationEffect` waveform parity | AVAudioPlayer synth or SystemSoundID + `UIImpactFeedbackGenerator` |
| keyboard flows (Enter-to-search, arrow-selected suggestions) | KeyboardOptions + focusRequester | `.onSubmit` + focusState |

### 4.3 Design-system sources of truth

`design-tokens.md` (frozen) ← `globals.css` `@theme` (authority). `tailwind.config.ts` is stale/legacy and must NOT be ported. Compose + SwiftUI theme files already exist and pass the frozen-token audit (Phase 0 D-fixes).

---

## §5 API / Data-Flow Mapping

### 5.1 Global contract

- **Envelope:** success `{success:true, data:T, pagination?|meta?}`; failure `{error, code?, ...extras}` + proper HTTP status. Client throws unless `success` (`use-api.ts:62-72`). **Three pagination shapes exist:** top-level `pagination{page,limit,total,totalPages}` (products/search/orders), cursor `meta{count,hasMore,nextCursor}` (wishlist), and deals `{flashDeals[],dailyDeals[]}` + `{flash:{…},daily:{…}}` — native DTO layers must normalize (recommend: sealed `Page<T>`).
- **Auth:** opaque 48-byte hex token, SHA-256-hashed server-side in `sessions`, 7-day expiry (`auth.ts:7,26-50`); transport `Authorization: Bearer`; `auth-token` cookie is read-fallback only, never set. **Refresh = single-use rotation** (`refresh/route.ts:39-64`). Roles: `users.userType ∈ {buyer,supplier,admin}` via `requireUserType` (`auth.ts:135-153`); 144/247 routes guarded; no middleware file — every route guards itself. Client has **no 401 interceptor** today — native should add one (refresh → retry → logout).
- **Realtime: NONE.** Zero websocket/socket.io/supabase-channel usage in `src/`. Chat polls every 3 s (`use-api.ts:228`); everything else one-shot or `setInterval` in dashboards/deals countdowns. Native replicates polling; no socket service required.
- **Offline queue (native already implements):** failed mutations enqueue to Room/WorkManager drain via `POST /api/native/offline-sync`; exclusion list `/api/auth|uploads|chat|search` (`use-api.ts:29`).

### 5.2 Endpoint contracts for Phase 1 screens (verified against route.ts)

| Screen | Endpoints (method, path, key fields) |
|---|---|
| Login | POST `/api/auth/login` — branches §3.2; POST `/api/auth/google|/api/auth/facebook` `{googleId|facebookId, email, name}` |
| OTP | POST `/api/auth/otp/send` `{phoneOrEmail, purpose}` → `{otpCode, devCode, expiresAt}`; POST `/api/auth/otp/verify` `{phoneOrEmail, code}` → `{token|resetToken|verified}` |
| Register | POST `/api/auth/register` (field list §3.4/§3.5); errors 409 `DUPLICATE_EMAIL/PHONE`, 400 `WEAK_PASSWORD` |
| KYC upload | POST `/api/uploads/kyc` multipart `file`+`kind`, 8 MB, → `{success, url (top-level)}` |
| 2FA | POST `/api/auth/2fa/verify` `{userId, code, method}` → `{token,user}`; POST `/api/auth/2fa/setup` (TOTP secret + otpauth) |
| Password | POST `/api/auth/forgot-password` `{email}`; POST `/api/auth/reset-password` `{token, password, confirmPassword}` |
| Product detail | GET `/api/products/[id]`; GET `[id]/{reviews,qa,similar,specifications,frequently-bought}` |
| Cart | GET/POST `/api/cart`; PUT/DELETE `/api/cart/[itemId]`; POST `/api/cart/bulk` — buyer-only |
| Buy-now | POST `/api/orders/create-direct` `{productId, quantity, variantId?, unitPrice, supplierId, shippingAddressId?}` |
| Wishlist | POST `/api/wishlist` `{productId}`; DELETE `/api/wishlist?productId=` |
| Currency | GET `/api/currency/rates` → `{success, rates:[{code,rate,change24h,…}]}` (client reads top-level `rates`) |
| Session sync | POST `/api/auth/refresh` (rotation); GET `/api/profile/me` (post-login hydration) |
| Server probe | GET `/api/app/version` (any-HTTP-alive; UA `ZylodNative/2.5.0`) — both platforms implemented |

### 5.3 Client architecture (native)

- **Android (exists):** Retrofit 2.11 + kotlinx-serialization 1.6.3 (`ApiClient.kt:14-38`, `Dtos.kt`: `ApiEnvelope<T>`, `Pagination`, `CategoryDto`, `ProductDto` w/ `firstImage` lowest-sortOrder, `DealsData{flashDeals,dailyDeals}`, `DealDto` effective-fallbacks), Bearer interceptor from `SessionManager`. Phase 1 adds: AuthApi + ProductApi detail endpoints + CartApi DTOs (all keep `data.api` package for the existing R8 keep rule).
- **iOS (exists):** Codable mirror in `ApiClient.swift` (`ApiEnvelope<T>`, `Product` w/ `firstImage`, `DealsData`), Bearer from Keychain. Phase 1 adds the same endpoint families.
- **Stores:** auth (token+user), cart (local merge + server sync), currency (BDT base, `formatPrice` BDT → `৳` rounded `en-BD`; others 2-dp `en-US`), notification badge (unreadCount).
- **Images:** product URLs are **relative paths** (`/uploads/...`) — resolve against active server base (both DTO layers already do `firstImage`).
- **Known backend gaps to carry forward (do not paper over):** `/api/chat/upload` missing (chat attachments 404) — text-only chat or backend fix before any native chat; checkout not gateway-connected (wallet top-ups are: bKash tokenized + SSLCommerz, idempotent credit by `reference`); `/api/deals/exclusive` is synthetic; OTP `devCode` leaks in responses (dev-only); uploads response `url` is top-level (not `data.url`).

### 5.4 Screen → endpoint dependency map (top 20, from task 1-c §I)

Home → `/api/categories`, `/api/products?sortBy=soldCount`, `/api/suppliers?limit=1`, `/api/products?limit=1` · Deals → `/api/deals?type=flash|daily` · Category → `/api/products?category=<slug>` · PDP → §3.9 · Search → `/api/products?search=` / `/api/search?q=` · Cart → §3.10 · Orders → `/api/orders/my-orders`, `/api/orders/[id]/*` · Wishlist → `/api/wishlist` · Auth → `/api/auth/*` · Profile → `/api/profile/me` + sub-resources · Storefront → `/api/supplier|suppliers/storefront`, `/api/suppliers/[id]`, `/api/products?supplierId=` · Notifications → `/api/notifications*` · Supplier dash → `/api/supplier/dashboard` · Buyer dash → `/api/buyer/dashboard` · Admin dash → `/api/admin/dashboard` (403 unless admin) · Chat → `/api/chat/conversations*` (poll 3 s) · Support → `/api/support/*` · RFQ → `/api/rfq?role=` · Rewards → `/api/rewards/*` · Currency → `/api/currency/rates`.

---

## §6 Android-Specific Requirements (Phase 1 delta; foundation already owner-audited)

1. **Stack (frozen):** AGP 8.6.1 / Kotlin 1.9.24 / compose-bom 2024.09.03 / navigation-compose 2.7.7 / room 2.6.1 / retrofit 2.11 + kotlinx-serialization 1.6.3 / coil 2.6 / security-crypto / biometric / WorkManager; minSdk 24, target/compile 35, `versionName 2.4.5-<sha7>`.
2. **Navigation:** extend `ZylodRoot` NavHost with native routes (`login`, `register-buyer`, `register-supplier`, `otp-verification`, `two-factor-auth`, `forgot-password`, `reset-password`, `product-detail?id=`, `cart`) alongside the existing `home` + `web/{pageId}?params`; Tab bar rewires Cart tab → native `CartScreen`; all other pageIds still route to `WebScreen`.
3. **Auth plumbing:** `SessionManager` (EncryptedSharedPreferences `auth_token`) as single source; login success → seed WebView `b2b-auth-storage` via `androidx.webkit` `WebViewCompat.addDocumentStartJavaScript` on the WebScreen profile (graceful fallback: inject on `onPageStarted`); logout clears both sides; deep link + notification taps unchanged.
4. **Screens as faithful mobile-web ports** (§3) — Compose, frozen tokens, `sp` text (font-scale a11y), no hardcoded `Color.White` (Phase 0 rule), 64 dp nav, edge-to-edge preserved.
5. **Images:** Coil with disk cache + crossfade; relative-URL resolution against `ServerConfig`.
6. **Networking hardening:** add 401→refresh-rotation→retry→logout interceptor (server supports single-use rotation; web lacks it).
7. **R8/build:** new DTOs stay under `com.zylod.wholesale.data.api.**` (existing keep rule `proguard-rules.pro:15-20`); backup rules continue excluding `zylod_secure`.
8. **CI:** `android-build.yml` unchanged; artifact SHA-stamped; lint non-blocking.
9. **Explicitly unchanged (frozen):** deep-link intent filters stay on legacy `MainActivity` until Phase 2 (`ARCHITECTURE.md:17`); WebView tier untouched; no new permissions required by Phase 1 (camera for KYC picker uses existing CAMERA + Photo Picker).

## §7 iOS-Specific Requirements (foundation gaps are Phase 1-blocking)

1. **ZylodNativeBridge (NEW — prerequisite):** `WKScriptMessageHandler` named `ZylodNativeBridge` implementing the full web contract parity with Android's 24 methods (task 1-d matrix): `isNativeAndroid`, `isNetworkConnected` (`NWPathMonitor`), `getAppVersionName/Code`, `setAuthToken` (Keychain `SessionManager`), `cacheOfflineProducts/searchOfflineProducts/getOfflineProductCount/getOfflineQueueCount/enqueueOfflineAction` (backed by an on-disk JSON store + URLSession replay — Room parity), `startBarcodeScanner` (VisionKit `DataScannerViewController` on iOS 16, or AVFoundation + `VNDetectBarcodesRequest`; callback `window.__zylodBarcodeCallback(success, code)`), `startVoiceRecognition` (`SFSpeechRecognizer` + `AVAudioRecorder`; `__zylodVoiceCallback`), `copyToClipboard` (`UIPasteboard`), `getDeviceId` (`identifierForVendor`), `requestNativeNotificationPermission`/`showNativeNotification` (`UNUserNotificationCenter`, channels→thread identifiers), `requestBiometricAuth` (`LAContext`), `clearLocalAppCache`, `showToast`, `triggerHaptic` (`UIImpactFeedbackGenerator`), `retryServerConnection` (`ServerConfig.invalidateCache()`); **download parity:** `WKDownloadDelegate` (iOS 17) or blob-fetch+save for `ZylodDownload.save` — iOS 16 fallback: intercept blob/data URLs, fetch in Swift, write to Documents + `UIActivityViewController`. Callback convention must match web `native-bridge.ts:134-250` exactly (one-shot self-deleting `__zylod*Callback`).
2. **Deep links (NEW):** `CFBundleURLTypes` scheme `zylod` in `project.yml` + `.onOpenURL` → port `DeepLinkParser` mapping table verbatim (`DeepLinkParser.kt:20-56`: product/supplier/deal/cart/orders/live + https terms/privacy/about/careers). Associated domains (Universal Links) = Phase 2 with `assetlinks.json`/`apple-app-site-association`.
3. **Info.plist keys (NEW):** `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`, `NSFaceIDUsageDescription`; remove `NSAllowsLocalNetworking` before store submission (already flagged in `project.yml:24-37`).
4. **Auth plumbing:** Keychain `SessionManager` as source; login success → seed `b2b-auth-storage` via `WKUserScript(atDocumentStart:)` injected into `WebViewScreen`'s `WKWebViewConfiguration`; logout clears both.
5. **Navigation:** keep the existing 5-tab `TabView`; rewire Cart tab → native `CartScreen` (NavigationStack); add native routes for the Phase 1 auth suite; all other pageIds continue to `WebViewScreen` (which already has cache-first resolution + retry).
6. **Screen parity:** SwiftUI ports of the mobile-web specs (§3), frozen `ZylodColor/ZylodFont` tokens, Dynamic Type via `ZylodFont.scaled` (exists), SF Symbols mapping, haptics on add-to-cart/success per web vibrate patterns.
7. **Networking:** same 401→refresh→retry interceptor; `URLSession` timeouts parity with web 15 s (`use-live-data.ts`).
8. **CI:** `ios-build.yml` (XcodeGen + simulator build) unchanged; artifact SHA-stamped.

## §8 Performance-Sensitive Components — C++/Rust Verdict

| Workload | Evidence | Volume | Current | Native platform coverage | Verdict |
|---|---|---|---|---|---|
| Product list fetch + client filter/sort | `api/products/route.ts:24` (cap 100), `category-tabs-products.tsx:139` (limit 100), `.filter` L219-388 | ≤100 rows/page | plain JS | LazyColumn/LazyVGrid | No native-code needed |
| Virtualization | grep react-window/virtuoso = 0 | — | none | Lazy lists | None |
| Images | 158 raw `<img>` vs `next/image` ×5; no lazy loading | thumbnails | browser decode | Coil / native decode | Platform APIs only |
| Charts | recharts ×3 dashboards | small series | SVG | Vico / Swift Charts | None |
| Barcode/QR | native-first bridge; web fallback BarcodeDetector 350 ms rAF; zxing only in generic-info | 1 code/frame | ML Kit (Android) | ✅ already native | None |
| Canvas/WebGL/3D | grep = 0 | — | — | — | None |
| Sound | WebAudio oscillators, 3 chimes | trivial | Web Audio | ToneGenerator/AVFoundation | None |
| Crypto | TOTP server-side (`totp.ts`); client only SHA-256 (`social-auth.ts:38`) | 1 HMAC/login | server | Keystore/CommonCrypto | None |
| AI/ML | CLIP visual search is **server-side** (`clip.ts:1-14`) | 512-d vectors server | onnxruntime-node | n/a | None — deliberately off-device |
| Offline search/sync | Room LIKE search + WorkManager drain | small | native | ✅ | None |

**Verdict: C++/Rust is NOT justified** — not as a reaction, not preemptively. The performance story is WebView load time and image strategy (158 eager `<img>`), not compute; those are fixed by infrastructure (server cache already exists, Coil/`next/image`, CDN), not by a new language runtime.
**Revisit triggers (explicit):** on-device CLIP inference if visual search must go offline; >10k-product offline catalogue with fuzzy search (SQLite FTS5 — still native, not C++); real-time video/AR features; cryptographic wallet keys beyond Keystore/Keychain. None apply to Phase 1-3.

## §9 Migration Dependencies & Ordering

```
design-tokens.md (frozen) ──► Theme (Compose + SwiftUI) ──► Navigation shell (5 tabs)
        │                                                        │
        ▼                                                        ▼
Network stack (Retrofit/URLSession, envelope DTOs) ◄── ServerConfig probe ──► Session store (Keystore/EncryptedSharedPreferences)
        │
        ▼
iOS bridge + auth seeding (§7.1/7.4)  ◄── PREREQUISITE for Phase 1 gate "WebView handoff seamless (token parity)"
        │
        ▼
Phase 1: auth suite ─┬─► product-detail ──► cart ──► (tab rewire)          [BOTH platforms, same phase, same gates]
Phase 2: category-products(+20) · search ×2 · orders · order-detail · profile · notifications · token mirroring · deep-link unification
         checkout ONLY after backend: orders/[id]/pay + bKash/SSLCommerz callbacks merged (HANDOFF §7 gate — never a mock)
Phase 3: supplier core (dashboard w/ native charts · products · add-product multipart · orders · verification)
Phase 4: FCM/APNs push · offline sync upgrade · Tier-2 picks (wallet, wishlist, track-order, chat — chat needs /api/chat/upload backend fix)
Phase 5: predictive back · haptics pass · skeleton polish · Play Store / App Store release path
```

Hard prerequisites & ordering rules:
1. **Real `DATABASE_URL`** is required to verify every data-driven acceptance criterion in §3 against live data (sandbox currently runs a placeholder — all contracts above were verified statically against `route.ts` source).
2. **iOS bridge precedes Phase 1 screens** on iOS (the Phase 1 gate requires seamless WebView handoff + the Tier 3 long tail must not degrade).
3. Both platforms stay in the same phase at all times (`platform-contracts.md:69-74`); each phase closes with owner audit of SHA-stamped CI artifacts (`AUDIT-WORKFLOW.md`).
4. Backend fixes are tracked separately and block only their specific screens (checkout; chat upload), never the whole phase.
5. `assetlinks.json` (Android UAL) still missing — required before `https://zylod.com` app links verify; Phase 2 item with deep-link unification.

## §10 Exact Phase 1 Implementation Scope

**Definition (frozen):** auth flows + product-detail + cart, native on BOTH platforms (`HANDOFF.md:115-121`, `platform-contracts.md:69-74`, `ARCHITECTURE.md §6`). Nothing else.

**In scope — Android (Kotlin + Jetpack Compose):**
1. Nav routes + screens: `welcome`, `login`, `otp-verification`, `register-buyer`, `register-supplier`, `forgot-password`, `reset-password`, `two-factor-auth`, `product-detail`, `cart`.
2. AuthApi/RegisterApi/UploadApi/ProductDetailApi/CartApi DTOs + endpoints (under `data.api`, R8-keep preserved); 401→refresh interceptor.
3. Session wiring: SessionManager as source of truth + WebView `b2b-auth-storage` seeding + logout clearing both.
4. Cart tab → native `CartScreen`; cart badge; tier pricing; MOQ/stock errors; checkout CTA → WebView with token handoff.
5. PDP: gallery/tier stepper/tabs/reviews/wishlist/buy-now (`orders/create-direct`)/share+QR per §3.9.
6. Home parity backlog (§3.8 deltas).

**In scope — iOS (Swift + SwiftUI):** §7.1 bridge (all 24 methods + downloads) + §7.2 URL scheme/deep-link parser + §7.3 Info.plist keys + §7.4 auth seeding; then the SAME 10 screens as Android; Cart tab rewire; PDP; home parity deltas.

**Acceptance criteria (per screen, testable):** every §3 screen lists them; plus global: (a) contracts verified against **live** data once real `DATABASE_URL` is supplied; (b) Tier 3 WebView pages retain full capability parity on both platforms (bridge matrix green); (c) no regression in existing Home/screens; (d) CI green on both platforms with SHA-stamped artifacts; (e) owner audit pass per `AUDIT-WORKFLOW.md`.

**Out of scope (explicit):** checkout (backend-gated), orders/order-detail, search, category-products, profile, notifications (Phase 2); supplier core (Phase 3); push/offline upgrade/Tier 2 (Phase 4); any web application change; any backend change (bugs documented in §5.3 only); any C++/Rust introduction; no mock data ever ("Never ship a mock" — `ARCHITECTURE.md:39`).

**Phase-1 ship-shape decision recorded here:** long-tail auth pages `backup-codes`, `account-recovery`, `email-verification`, `phone-verification`, `account-suspended` may ship as compact native screens or remain WebView (tokenless) — owner's call at Phase 1 review; recommended: native `account-suspended` (login branch renders it), WebView for the rest until needed.

---

## §11 Honesty Notes / NOT VERIFIABLE (static analysis limits)

- All API contracts were verified **statically** against `route.ts`/hook/store source; **no live end-to-end data verification was possible in this environment** (placeholder `DATABASE_URL`). Acceptance testing against live data is a Phase 1 entry criterion (§9.1).
- `POST /api/auth/otp/send` returning `devCode` and `/api/deals/exclusive` synthetic deals are code facts, not live-behavior claims.
- Payment gateways (bKash/SSLCommerz) were analyzed from code only; no sandbox transaction was executed.
- Web app was **not modified**: the only working-tree changes accompanying this document are `worklog.md` and this file under `docs/`.

**END OF SPECIFICATION — STOP. Awaiting owner review before any Phase 1 implementation.**
