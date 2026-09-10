# Zylod Platform Contracts — Android / iOS (Phase 0 freeze)

Both native apps implement the same product through their platform languages.
This file is the shared contract; platform details live in
`android/ARCHITECTURE.md` (Android) and `ios/` (iOS, generated with XcodeGen —
see `ios/project.yml`).

## 1. Product architecture (identical on both platforms)

- **Hybrid shell:** native screens for Tier 1 core surfaces; embedded WebView
  rendering the Next.js SPA via deep-link URLs (`https://<server>/?page=<pageId>&<params>`)
  for the Tier 3 long tail. Frozen tier list: `android/ARCHITECTURE.md` §3.
- **Entry screen:** Home (reference surface, Phase 0) — sections, order, and
  visual spec ported from `src/components/mobile/mobile-home-page.tsx`.
- **Navigation shell:** 5 tabs — Home · Categories (`category-browser`) ·
  Hot Deals (`flash-deals`) · Cart (`cart`) · Profile (`profile`).
- Native → web hand-off carries `pageId` + query so SPA state and analytics
  stay uniform.

## 2. Server discovery (identical list & rules)

Debug builds probe (in order, parallel, any HTTP response counts as alive):
`http://192.168.43.79:3000` · `http://10.0.2.2:3000` · `http://localhost:3000`
· `https://jugular-winnings-backfield.ngrok-free.dev` · `https://zylod.com`.
Release builds: `https://zylod.com` only. Winner cached
(Android: `SharedPreferences("zylod_config")/native_base_url`; iOS:
`UserDefaults/native_base_url`).

## 3. Auth contract

- `POST /api/auth/login` → Bearer token (48-byte random, server stores SHA-256
  hash, 7-day expiry). Refresh: `POST /api/auth/refresh` (rotate).
- Transport: `Authorization: Bearer <token>` header on every request.
- Intermediate challenges: 2FA (`requires2FA: true, userId`) and OTP flows must
  be handled by the login UI (Phase 1 both platforms).
- Token store: Android — encrypted prefs key `auth_token` (shared with the
  WebView bridge mirror); iOS — Keychain (service `com.zylod.wholesale`,
  account `auth_token`). Cross-shell token mirroring with embedded WebViews is
  Phase 2 on both platforms.

## 4. API conventions (both clients implement these exactly)

- Envelope `{ success: Bool, data: T?, pagination?, error? }`; 242/249 routes.
- Errors: `{ error, code? }` + proper HTTP status; rate limit = 429
  `code: 'RATE_LIMITED'`. Non-2xx throws → section-level failure (never fatal).
- Pagination: `?page=&limit=` → `pagination: { page, limit, total, totalPages }`.
- `/api/products?sortBy=soldCount&sortOrder=desc&limit=&page=` — list items:
  `images: [{ imageUrl, sortOrder }]` (objects, relative paths), `thumbnailUrl`
  relative; first image = lowest sortOrder else thumbnailUrl; relative paths
  resolve against the active server base.
- `/api/deals?type=flash&limit=` — `data: { flashDeals: [...], dailyDeals: [...] }`
  (NOT a flat array). Deal fields: `productId/productName/dealPrice/productThumbnail`
  with `product` fallbacks.
- Stats: read `pagination.total` from `/api/products?limit=1` and
  `/api/suppliers?limit=1`.
- Failure isolation: section calls must never crash the host — a failed section
  renders the error state ("Can't reach Zylod servers" if core calls
  unreachable / "Server error — the backend is unhealthy" if non-success).

## 5. Design system

Single source of truth: `/design-tokens.md` (mirrors `src/app/globals.css`,
including the resolved dark remap). Compose (`android ui/theme`) and SwiftUI
(`ios/Zylod/Theme/ZylodTheme.swift`) both consume these values only:
light/dark dynamic palettes, brand reds (#C90019 light / #C8102E dark),
Quick-Access chip gradients kept verbatim in both themes, radius 6/8/10/14,
64dp/+safe-area bottom nav, system font (web font vars are broken).

## 6. Phase discipline

Both platforms move through the same phases with the same gates
(`AUDIT-WORKFLOW.md`). No platform starts Phase 1 until BOTH Phase 0
foundations are owner-audited. Phase 1 scope applies to both platforms:
auth flows, product-detail, cart.
