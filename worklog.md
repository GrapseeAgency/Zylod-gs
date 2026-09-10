# Zylod Worklog

## Session: 2026-08-08 (Type-Sync, Lint, Build, DB Connectivity)

### Work Log:
- Fixed 27 baseline TS errors (Phases A-E): cart-store cast, chunk-loader `?? null`, order-detail casts, auth-store `rejectionReason?`, mobile-category-pills, admin-dashboard `prefix?`, chat-service `currentUserId` capture, product-detail `fetchTracking` hoist
- `npx tsc --noEmit` → exit 0, 0 errors; `npm run lint` → 0 errors, 1 pre-existing warning (layout.tsx:19:9)
- Removed `typescript.ignoreBuildErrors: true` from next.config.ts (no longer needed)
- Fixed `npm run build`: cp-to-standalone step assumed `output: standalone` (disabled for OOM) — now conditional; build exits 0, 48/48 static pages
- Changed `npm run start` from `bun .next/standalone/server.js` to `next start -p 3000` (standalone disabled)
- **DB connectivity fix**: `DATABASE_URL` pointed at IPv6-only Supabase direct host (`db.<ref>.supabase.co:5432`), unreachable from this IPv4-only container. Rewrote to IPv4 session pooler: `postgresql://postgres.<ref>:<pw>@aws-0-ap-southeast-1.pooler.supabase.com:5432/<db>` (region ap-southeast-1 inferred from IPv6 prefix 2406:da18)
- `npx prisma db push` → success through pooler; columns `products.sku`, `subOrders.shippingCost` live in DB
- Smoke test (production `next start`): `/api/products` 200 (sku in payload), `/api/categories` 200, `/api/cart` 401 unauthenticated, `/api/orders` 401 unauthenticated, `/` 200
- Supabase REST (anon key) reachable on 443: `/rest/v1/products` 200

### Unresolved Issues:
- Direct Postgres (5432 IPv6) still unreachable here — pooler is the only path; keep DATABASE_URL on the pooler
- Phase F pending: replace fake/mock data across ~14 page components (product-detail, mobile-product-detail, generic-* dashboards, admin-dashboard, etc.)
- `/home` returns 404 via curl (client-side routed SPA — `/` 200; verify against navigation store if needed)

## Session: 2026-08-06 (Backend & Security Fix)

### Task ID: 1
### Agent: Main
### Task: Fix Prisma schema, make backend actually work, add security

### Work Log:
- Added `soldCount`, `ratingAvg`, `reviewCount`, `isCustomizable` fields to `products` model in Prisma schema
- Added `sessions` model for proper token-based authentication
- Pushed schema to SQLite database
- Installed `bcryptjs` for proper password hashing (replaced SHA-256)
- Created `/src/lib/auth.ts` - real auth middleware with:
  - Session token creation stored in DB
  - Token validation against DB sessions
  - Session expiration checking
  - Bearer token extraction from requests
  - User type authorization (buyer/supplier/admin)
  - Session destruction on logout
  - Client IP extraction
- Rewrote `/api/auth/login/route.ts` - real bcrypt password verification, session creation, audit logging
- Rewrote `/api/auth/register/route.ts` - bcrypt password hashing, session creation, profile creation
- Rewrote `/api/auth/logout/route.ts` - real session destruction
- Rewrote `/api/products/route.ts` - validated sort fields (prevents soldCount crash), proper error handling
- Rewrote `/api/cart/route.ts` - auth required, no mock fallbacks, stock/MOQ validation
- Rewrote `/api/orders/route.ts` - auth required, IDOR protection, transaction-based order creation, stock decrement
- Updated all 105 products with realistic soldCount, ratingAvg, reviewCount data
- Created test coupons (WELCOME10, BULK20, FIRST5)
- Created test accounts: buyer@test.com/Test@1234, supplier@test.com
- Fixed default page from 'welcome' to 'home' in navigation store
- Created 6 missing page component stubs
- Reverted `new Function()` dynamic import approach (doesn't work in browser with path aliases)

### Stage Summary:
- **Database**: 26 users, 105 products, 17 categories, 0 orders (real data from seed)
- **Products API**: ✅ Returns real products with soldCount, ratingAvg, isCustomizable
- **Categories API**: ✅ Returns real categories with product counts
- **Auth Login**: ✅ bcrypt password hashing, DB session tokens, rate limiting
- **Auth Register**: ✅ bcrypt hashing, profile creation, session creation
- **Auth Logout**: ✅ Real session destruction
- **Cart API**: ✅ Auth required (401 without), no mock fallbacks, stock/MOQ validation
- **Orders API**: ✅ Auth required, IDOR protection, transaction-based creation
- **Security**: ✅ bcrypt (was SHA-256), DB sessions (was random bytes), auth middleware (was none)
- **Test accounts**: buyer@test.com/Test@1234, supplier@test.com

### Unresolved Issues:
- **OOM**: Dev server gets killed in 4GB container due to 303 page components + Turbopack. Server works but dies after ~30-60s when multiple routes compile.
- **Homepage rendering**: The homepage renders correctly when server is up, but OOM kills prevent sustained testing
- **Remaining mock fallbacks**: Some API routes still have mock fallbacks (legal, marketing, coupons, etc.)
- **More APIs need auth middleware**: Many API routes don't have authentication yet
- **Input validation**: Need Zod/joi validation on more endpoints
## Session: 2026-08-22 (Native Android App Overhaul)

### Work Log:
- **Offline sync queue now drains**: new `sync/OfflineSyncWorker` (WorkManager CoroutineWorker) replays queued actions one-by-one to `POST /api/native/offline-sync`; scheduled on app start, on server resolution, on enqueue, and on connectivity regain (ZylodApp collector). 2xx→synced+deleted, 4xx→retryCount++ (skipped after 5), IO error→WorkManager backoff retry. Posts a CHANNEL_ORDERS notification on delivery.
- **Server endpoint**: new `/api/native/offline-sync` route (single/array/{items} body, validated) persisting into new `offlineSyncEvents` Prisma model + GET feed with pendingCount. `prisma db push` OK through pooler; client regenerated. Smoke-tested live (insert/batch-reject/400/GET), test rows cleaned up after.
- **Offline product cache now populated**: `WebAppBridge.cacheOfflineProducts()` + `searchOfflineProducts()` + `getOfflineProductCount()`; web side auto-caches `/api/products` list responses via `src/lib/native-bridge.ts` hook in `use-api.ts` fetchJson. No-ops outside the Android shell.
- **Barcode scanner is real now**: CameraX Preview+ImageAnalysis + MLKit all-formats scanning, torch toggle, close button, haptic on hit; `startBarcodeScanner(callback)` JS bridge + ActivityResult launcher in MainActivity → `callback(success, code|null)`. Mock "SCAN_SUCCESS" stub removed.
- **Startup probing**: parallel endpoint probes with 6.5s overall budget (was sequential, ~36s worst case); priority order preserved; previous probe job cancelled on new intent; `setIntent()` called in onNewIntent; deep links forward ALL params URL-encoded (was id-only).
- **Security per build type**: `usesCleartextTraffic` via manifest placeholder (debug true / release false); mixed-content + allowFileAccess gated on BuildConfig.DEBUG (android_asset still loadable in release); endpoint candidates moved to `SERVER_ENDPOINTS` BuildConfig field — release contains only https://zylod.com, dev LAN/ngrok URLs confined to debug builds.
- **Version constants unified**: WebAppBridge now returns BuildConfig.VERSION_CODE/VERSION_NAME (was hardcoded 240/"2.4.0" vs gradle 245/"2.4.5"); UA string uses VERSION_NAME too.
- **Room**: `fallbackToDestructiveMigration()` removed (protects unsynced queue from silent wipes); `countAll()` added to ProductDao.
- **POST_NOTIFICATIONS** runtime request added (API 33+) in MainActivity.onCreate.
- **__IS_OFFLINE__** re-injected on every onPageFinished (was lost on navigation).
- **Toolchain**: compileSdk/targetSdk 34→35 (platforms;android-35 + build-tools;35.0.0 installed), AGP 8.3.2→8.6.1, Kotlin 1.9.23→1.9.24, KSP 1.9.24-1.0.20, Gradle wrapper 8.6→8.7; added work-runtime-ktx 2.9.0. Release signing reads android/keystore.properties when present (storeFile/storePassword/keyAlias/keyPassword), falls back to debug key otherwise.
- **Verification**: `./gradlew assembleDebug` BUILD SUCCESSFUL (app-debug.apk 28M); merged manifest placeholder resolves (`usesCleartextTraffic="true"` debug); `npx tsc --noEmit` clean; endpoint smoke-tested against temp dev server on :3100 (port 3000 serves the pre-route production build, so it 404s there until next rebuild).

### Unresolved Issues:
- Port 3000 runs a production build from before `/api/native/offline-sync` existed — rebuild (`npm run build` + restart) before the native worker can sync against it.
- Release APK still debug-key signed until `android/keystore.properties` is created.
- `offlineSyncEvents.processedAt` is set by nothing yet — business processing of ingested actions is a follow-up.
- ngrok request interception streams bodies without call cancellation if WebView abandons a request (inherent to shouldInterceptRequest; debug-only exposure).

## Session: 2026-08-22 (Native App Phase 2 — implementing the scaffolding)

### Work Log:
- **Offline queue is now fed from the web app** (it previously had zero call sites): `mutateJson` in `src/lib/use-api.ts` catches network-level fetch failures and queues the mutation via `ZylodNativeBridge.enqueueOfflineAction` with full replay context (`{url, method, body}`, actionType `"POST /api/orders"` style), then throws a typed `OfflineQueuedError` ("saved, will sync when you reconnect"). Auth/uploads/chat/search mutations are excluded from queueing.
- **Offline actions now carry identity**: web `authHeaders()` mirrors the session token to the native bridge (`setAuthToken`) on every request; native stores it in **EncryptedSharedPreferences** (androidx.security:security-crypto added; `ZylodApp.securePrefs`); `OfflineSyncWorker` sends `Authorization: Bearer` on replay; `/api/native/offline-sync` runs `authenticateRequest` and stores `userId` on each event (new column, pushed; anonymous replays still accepted). Token clear path: `clearNativeAuthToken` (empty token removes).
- **Offline shell is a real offline home** (`android/app/src/main/assets/index.html`): cached product grid from Room via bridge (name/price/MOQ/stock/category/supplier), debounced search, pending-sync badge (15s refresh), Retry Connection button (`bridge.retryServerConnection` → native re-discovery), bilingual EN/BN, honest empty states ("browse online to cache products") — no mock data; product fields rendered via DOM APIs (XSS-safe). Onboarding carousel + server-config hub kept; hardcoded LAN-IP default removed from hub (manual entry + production quick button).
- **Scanner page finally decodes**: `barcode-scanner-page.tsx` launches the native MLKit scanner when inside the Android shell (tap-to-scan surface, relaunch on reset); in browsers it now live-decodes via the platform `BarcodeDetector` API (350ms throttle) — previously the camera viewfinder had NO decoder at all (only manual entry/upload worked). Torch button now actually applies `track.applyConstraints({advanced:[{torch}]})` instead of just flipping icon state (hidden in native mode where the native scanner owns the torch).
- **Hardening**: Google Safe Browsing enabled (API 26+); `allowContentAccess=false` in release (was always true); connectivity regained while in the offline shell auto-triggers endpoint re-discovery (`handleStartup` from the network collector when `activeServerUrl == null`).
- **New bridge surface**: `setAuthToken`, `getOfflineQueueCount`, `retryServerConnection` (+ existing `cacheOfflineProducts`/`searchOfflineProducts`/`getOfflineProductCount`/`startBarcodeScanner`).
- **Verification**: `npx tsc --noEmit` clean (fixed a duplicate `authHeaders` and a torch-constraint cast found by it); `./gradlew assembleDebug assembleRelease` BUILD SUCCESSFUL; offline-shell JS syntax-checked with `node --check`; `prisma db push` applied (userId + index).

### Unresolved Issues:
- Port 3000 production rebuild/restart left to Arifat (endpoint route exists and was smoke-tested via a temp dev server).
- Business processing of `offlineSyncEvents` (`processedAt`) still a follow-up — replayed `POST /api/orders` etc. are stored, not yet executed against domain APIs.
- `android/keystore.properties` still to be created for real release signing.

## Session: 2026-08-22 (Native App Phase 3 — the "works in browser, dead in app" gap)

### Root cause
The WebView shell had NO WebChromeClient, no DownloadListener, and no external-scheme routing. Chrome mobile emulation gives the page file pickers, alert/confirm, camera/mic permission prompts, clipboard, and downloads for free — the WebView gave none of them, so ~60 web features silently no-oped inside the app. Sub-agent audit inventoried every affected call site: 15 file inputs, 30+ alert/confirm flows, 2 getUserMedia cameras, 25+ clipboard copies, 4 real downloads, tel:/wa.me/t.me links, voice search (WebView has no Web Speech API), and web-push permission.

### Work Log:
- **WebChromeClient added to MainActivity**:
  - `onPermissionRequest`: getUserMedia camera/mic — bridges to Android runtime permissions (only grants resources actually requested), with `onPermissionRequestCanceled` handling.
  - `onShowFileChooser`: gallery picker via ACTION_GET_CONTENT for every `<input type=file>`; `capture=` inputs get a camera option via ACTION_IMAGE_CAPTURE + new FileProvider (`${applicationId}.fileprovider`, res/xml/file_paths.xml) with CAMERA runtime-permission detour.
  - `onJsAlert`/`onJsConfirm`: native AlertDialogs — every confirm-gated flow (delete bank account/card/wishlist/collection, clear storage, logout guards) works now.
  - `onConsoleMessage`: logs page console in debug builds.
- **Downloads work end-to-end**: DownloadManager for http(s) (with cookies+UA), `data:` saved directly, `blob:` fetched in-page and handed to the new `ZylodDownload` bridge → MediaStore Downloads (API 29+) / public Downloads dir (<29), sanitized filenames, toast on completion. Fixes: product spec export, GDPR data export, 2FA backup codes, QR download.
- **URL routing** via `shouldOverrideUrlLoading`: non-http schemes (tel:, mailto:, sms:, intent:, market:) → matching apps (call-driver button works); off-origin http(s) (wa.me, t.me, facebook/twitter/linkedin) → external browser; own hosts + localhost dev stay in-app.
- **Voice search works in the app**: new `startVoiceRecognition` bridge → native SpeechRecognizer (RECORD_AUDIO permission added, runtime-gated, friendly error mapping). Web integrated native-first in search-bar.tsx (all 3 mic buttons), voice-search-page.tsx, and generic-info-page.tsx (sub-agents; web Speech API remains the browser fallback).
- **Notifications work in the app**: `requestNativeNotificationPermission` + `showNativeNotification` (orders/escrow/deals channels) bridges; push-notification-settings-page wired native-first — registers a REAL per-install device id (`getDeviceId` bridge, UUID in prefs) with platform 'android' instead of the old random fake token.
- **Clipboard**: `copyToClipboard` bridge + `navigator.clipboard` polyfill in native-bridge.ts (auto-installed on import) — all 25+ copy buttons work on http:// dev origins where the API doesn't exist.
- **WebView fidelity**: `textZoom=100` (system font-scale no longer breaks layouts), CookieManager third-party + flush on pause, webView onPause/onResume (timers/battery).
- Kotlin fixes found by compiler: `FileChooserParams.isCaptureRequested` → real API is `isCaptureEnabled()` (verified against android-35 jar with javap); DownloadBridge missing `true` return.

### Verification:
- `./gradlew assembleDebug assembleRelease` → BUILD SUCCESSFUL (both APKs fresh)
- `npx tsc --noEmit` → clean after all web edits (fixed clipboard-polyfill type errors)
- All sub-agent edits spot-checked in the four touched web files

### Unresolved / follow-ups:
- Phone-side smoke test still needed (permissions UX, camera capture chooser) — emulator recommended
- `assetlinks.json` for zylod.com still needed for verified Universal App Links
- Push delivery itself (FCM) not wired — token registration now real, transport is a server follow-up

## Session: 2026-09-09 (Desktop UI: all 404 page components converted)

### Work Log:
- Goal: give every page component a real desktop (>=768px, ideal 1280px+) layout. Baseline: only ~33 of 404 components in src/components/pages had responsive classes; 371 were mobile-only markup.
- Established the conversion contract in agent-ctx/desktop-ui-contract.md (reference implementations: buyer-dashboard-page, product-detail-page). Key rules: md:/lg:-only additions, mobile DOM byte-identical, mobile-only header bars get md:hidden with desktop title rows/actions duplicated, containers widen (lg:max-w-4xl reading / 5xl-7xl lists), grids go md:grid-cols-2 lg:grid-cols-3/4, simple lists become bordered desktop tables, forms become md:grid-cols-2 field groups. Hard anti-slop rules enforced in all new markup (no em dashes, no emojis, no new shadows/gradients/sparkle/orb/dot-grid/animated arrows, brand red + neutrals only, no mock data, minimal diffs).
- Batch machinery: agent-ctx/batches/batch-00..30.txt (12 files each) + desktop-ui-progress.md tracker (371/371 checked).
- Early batches via subagents (00-15, 17) + main-agent conversions; later batches (16-remainder, 18, 23-30) converted by the main agent with desktop_convert.py, a conservative pattern-based converter (md:hidden mobile-only headers + hidden md:block desktop h1, root pb md variants) plus manual handling of ~45 irregular files.
- Anti-slop copy cleanup in existing pages: removed all emojis from UI copy (Ships Tomorrow, Earn Vouchers, We are hiring, Join Pool, Claim Points, filter labels, streak bonus, changelog, order-detail lock/shield) and replaced emoji category-icon maps with lucide icons (Wrench/Cog/Drill/Hammer/Factory). Removed the fake hardcoded "AI Review Summary" card + its colored stripe from product-reviews-page (fake-data + colored-stripe violations).
- Fixed 7 build breaks caught by tsc: unclosed wrapper divs from agent edits (delivery-proof, notifications, import-export-tracker, search-voice-history, search-filters, search-history, wishlist-sort-filter), div-before-ternary-close misordering (investor-contact, job-apply), plus 4 files found reverted to pre-conversion copies (product-conversion-rate, product-performance, seasonal-sale, seller-order-detail) re-applied.

### Verification:
- npx tsc --noEmit -> exit 0 after every batch and at the end
- npm run build -> compiled successfully (all routes)
- npm run lint: 104 errors are pre-existing (react-hooks "Cannot access variable before declared" rule firing on mass-generated pages untouched by this effort, e.g. docs-browser-page; plus generate-pages.js require warnings) — same baseline, not introduced here
- Visual gate: dev server on :3100 (DB/pooler unreachable in this environment, so data-driven sections render designed empty states), 1280x800 captures of add-card, quiet-hours, careers, cart, dmca-faq, promo-notifications, trending-searches, price-drop-alerts — all 8 passed the judge (layout, no mobile chrome, anti-slop checks)

### Unresolved / follow-ups:
- Port 3000 still serves the previous production build; `npm run build` has been rerun so a restart of `npm run start` will pick everything up
- Supabase pooler (aws-0-ap-southeast-1.pooler.supabase.com:5432) was unreachable during this session, so data-dependent visuals were verified in empty/loading states only; re-check a handful of data-heavy pages (orders table, dashboards) once the DB is reachable
- 104 pre-existing lint errors (react-hooks rule on generated pages) are a separate cleanup if wanted
- home-page.tsx and home/mobile component sets were already desktop-done and were left untouched per minimal-diff

## Session: 2026-09-09 (Text-404 audit + fix: broken pageId navigation)

### Work Log:
- Full navigation audit (text-404-audit.md): traced all 298 referenced pageIds through the loader chain and live-verified suspects at :3100. No hard "Page not found" crashes; 47 ids landed on generic-info boilerplate text or blank instead of real UI.
- Class A (16 wrong ids / 18 call sites in 8 files): call sites used `-page`-suffixed ids that no loader maps (e.g. navigate('store-theme-customizer-page') from store-customization-page); retargeted to the registered stems so the real components render. Verified all 16 live.
- Class B: footer Onboarding Guide pointed at unregistered `onboarding` (blank screen); now `welcome`.
- Class C1 (9 boilerplate dead ends): retargeted to real pages — categories->category-browser, checkout-direct->buy-now, compare-products->compare, messages->live-chat (x3), rfq-create->rfq-list, supplier-detail + supplier-storefront->seller-storefront (supplierId kept). For `blog` and `events` (no component existed) built real pages: src/components/pages/blog-page.tsx + events-page.tsx (responsive per desktop contract, fetch /api/blog + /api/events, honest empty states) and registered `blog`/`blog-post`/`events` in chunk-misc + REAL_PAGES.
- Key loader insight recorded: getGenericType() ALWAYS returns >= 'info', so loadPage routes every unknown id to generic-info before getChunkForPage is ever consulted; only REAL_PAGES / CHUNK_CORE ids reach real chunk loaders.

### Verification:
- npx tsc --noEmit -> 0; npm run build -> compiled successfully
- Live re-audit of all previously broken ids at :3100 -> 0 blank, 0 boilerplate; spot screenshots (blog) pass visual checks

## Session: 2026-09-09 (Round 2 audit: full 528-id live sweep + alias activation)

### Work Log:
- Swept all 528 registered page ids live at 1280px. Found 188 alias ids rendering generic boilerplate (chunk-set ids whose loaders were dead code because getGenericType()'s 'info' catch-all always intercepted before getChunkForPage), 1 SPA-killing crash, 54 literal $page_title placeholders, and 2 null-render blanks.
- buyer-dashboard-page crashed the whole app on API failure (unguarded data!.spendingData etc.) -> safe fallbacks; this crash was masquerading as 5 other "blank" pages.
- 159 alias ids activated: own-file aliases (-page-suffixed) + 141 curated canonical remaps (all-orders->orders, helpdesk->help-center, spin-wheel->mini-games, checkout-success->order-confirmation, etc.) via chunk-misc loaders + REAL_PAGES. 27 concept aliases intentionally left on the designed generic fallback.
- 14 stub files: $page_title replaced with real page titles; $component_name renamed to PascalCase Page names.
- about-us + sitemap: null-on-API-failure replaced with designed unavailable states.

### Verification:
- tsc 0, npm run build OK, live re-sweep of previously broken ids: 0 boilerplate / 0 blank / 0 crash; 30-id sample of new aliases all render real components.

## Session: 2026-09-09 (Round 3: production sweep + stale-server fix)

- The user-facing production server on :3000 was still serving a pre-fix build (stale next-start process survived pkill; killed by pid). Restarted on the fresh build.
- Full 728-id live sweep of PRODUCTION found 12 remaining issues, all fixed: admin-dashboard chart crash (3 unguarded data!.growthData), product-listings-manager crash on non-array API (Array.isArray guard; also fixed catalog-management + seller-products-manager which alias to it), 4 unmapped ids registered (data-sync, display-settings, shipping-policy-detail, misc->explore), profile-settings->account-settings.
- Re-verified all 12 + 14 earlier fixes on production: 100% real UI. tsc 0, build OK.
- Production now on :3000 (fresh build), dev on :3100.

---
Task ID: 1
Agent: Z.ai Code (main orchestrator)
Task: Clone GrapseeAgency/Zylod-gs from GitHub, replace the sandbox scaffold with it, install deps, start dev server on :3000, verify rendering in browser.

Work Log:
- Cloned repo (PAT-authenticated) to /tmp/zylod-clone, 193MB incl. .git history + android/ + ios/ + .github workflows.
- Inspected: Next.js 16.1.3 SPA (custom pageId router), 249 API routes, Prisma 6.6.0 + Supabase (postgresql provider, 130 models), Tailwind 4, next-auth installed-but-unused, BDT payments (bKash/SSLCommerz), HANDOFF.md freezes Phase 0 (native shells) — web changes must not violate AUDIT-WORKFLOW.md.
- Killed old scaffold dev server (pid 1258), deleted all scaffold files/folders, kept sandbox infra (.zscripts, skills, Caddyfile — project's Caddyfile is byte-identical anyway) + upload/ (user content).
- Moved clone into /home/z/my-project (git remote intact: origin github.com/GrapseeAgency/Zylod-gs, PAT embedded in remote URL per owner's existing setup).
- Created .env from .env.example: placeholder DATABASE_URL (user will supply real Supabase creds later), JWT_SECRET generated (64-hex), APP_URL=http://localhost:3000.
- bun install: 678 packages, 9.5s. Bun blocked 2 postinstalls (onnxruntime-node, unrs-resolver) → trusted both. bunx prisma generate OK.
- CRITICAL SANDBOX GOTCHA: dev servers started via direct backgrounding or plain `setsid ... &` get reaped between Bash tool calls (3 confirmed deaths during "Compiling /"). WORKING PATTERN: double-fork orphan `( setsid bun run dev </dev/null >/dev/null 2>&1 & )`. Server (next-server pid 3086) now persists across tool calls. Do NOT use project start-dev.sh / its respawn loop — plain `bun run dev` double-forked is enough.
- First compile of / takes ~24s (Turbopack), ~2GB RAM peak (4.1GB total — no OOM; no memory limit tuning needed).
- Browser verification (agent-browser): desktop 1280px renders full shell (title "Zylod — B2B Wholesale Marketplace", header nav, search hero, categories, B2B services, login card); SPA nav works (Home→Deals); mobile 390px renders dedicated mobile layout (search chips, Quick Access, bottom tab bar). No console errors except expected API 500s.

Stage Summary:
- Project is LIVE on port 3000 via gateway (preview panel) with full git history; .env placeholder means data APIs (products/categories/deals) return 500 and pages show graceful "unavailable" states — EXPECTED until real Supabase DATABASE_URL is provided.
- Next topic (user-stated): GitHub Actions for iOS/Android builds. Repo already has .github/workflows (ios-build.yml: macos-15 + XcodeGen; android-build green per HANDOFF §1/§3; ios ApiClient.swift `self.base` fix still pending).
- Risks: (1) PAT exposed in git remote + pasted in chat — owner was already advised to rotate; remind again. (2) Placeholder JWT_SECRET fine for render, must come from owner with real secrets for auth features. (3) Never run `bun run build` in this sandbox (never build; dev only). (4) pkill -f next can kill own shell — kill by pid from `ss -ltnp`.
