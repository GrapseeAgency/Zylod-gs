# API Auth-Coverage Audit — Phase 0

**Method:** static scan of all 249 `src/app/api/**/route.ts` files. A route counts as "auth-protected" if it calls `authenticateRequest()` or `requireUserType()` (the two helpers in `src/lib/auth.ts`); mutation = any exported `POST/PUT/PATCH/DELETE`.

**Totals:** 249 routes · 144 auth-protected · 105 unprotected · of the unprotected, **50 expose mutating methods**, 55 are GET-only.

Scope rule: many unprotected routes are legitimately public. The risk is *mutating or business-data* endpoints with no session gate. Severity assumes the native client widens usage; fix before Phase 2 (buyer core) ships.

---

## CRITICAL — unauthenticated mutations on privileged objects (fix now)

| Endpoint | Methods | Why it's critical |
|---|---|---|
| `api/admin/users` | GET, PATCH | anyone can PATCH admin-managed users; GET leaks user table |
| `api/admin/products` | GET, PATCH | unauthenticated product moderation |
| `api/admin/reports/[id]` | GET, PATCH | unauthenticated report resolution |
| `api/suppliers/[id]/verify` | POST | anyone can verify/reject a supplier |
| `api/wallet/topup` | (POST) | see checkout-payment-audit.md — credits balance with zero payment verification |
| `api/orders/create-direct` | (POST) | trusts client `unitPrice`, marks paid without payment (see checkout audit) |

## HIGH — unauthenticated mutations / IDOR surface

| Endpoint | Methods | Concern |
|---|---|---|
| `api/profile/addresses/[id]` | PUT, DELETE | no `authenticateRequest` found — verify per-row owner check, else IDOR |
| `api/cart/[itemId]` | PUT, DELETE | same — verify ownership via session |
| `api/profile/linked-accounts/[id]/connect·disconnect` | POST, DELETE | account-linking without auth gate |
| `api/uploads/kyc` | POST | KYC document upload open to anonymous callers |
| `api/chat/upload` | POST | file upload open to anonymous callers |
| `api/reviews/upload` | POST | review media upload open |
| `api/supplier/verification` | GET, POST | verification submission w/o auth |
| `api/supplier/bulk-upload` | GET, POST | bulk product upload w/o auth |
| `api/supplier/payouts` | GET, POST | payout requests w/o auth |
| `api/supplier/promotions` | GET, POST | w/o auth |
| `api/supplier/shipping`, `return-policies`, `support`, `queries`, `customization`, `reviews` | GET, POST | supplier config mutations w/o auth |

## HIGH — public GETs exposing business/sensitive data

| Endpoint | Concern |
|---|---|
| `api/supplier/orders` (GET) | order data public |
| `api/supplier/analytics`, `supplier/revenue`, `supplier/performance`, `supplier/rankings` (GET) | per-supplier revenue/analytics public |
| `api/admin/reports` (GET) | report queue public |
| `api/wallet/callback/bkash` (GET) | callback readable — verify it only processes signed gateway payloads |

## EXPECTED PUBLIC (no action) — mutating

`auth/*` (login, register, refresh, logout, otp send/verify, forgot/reset, verify-email, phone-verify, recover, 2fa/verify, facebook), `app/telemetry` (crash logs), `app/settings` (POST documented as config write-back), `legal/cookie-consent`, `careers/apply`, `investor/contact`, `support/chatbot/query`, `support/faqs` + vote, `coupons/validate` (pre-auth cart use), `search/barcode`, `search/image`, `search/popular`, `products/compare`, `notifications/evaluate-alerts` (likely cron-triggered — confirm it validates a cron secret), `wallet/callback/sslcommerz`, `wallet/ipn/sslcommerz` (server-to-server; validation happens inside — confirm signature checks, see checkout audit).

## EXPECTED PUBLIC (no action) — GET-only

`products*` (catalog, detail, tiers, variants, similar, specs, bulk-pricing, frequently-bought, size-guide), `categories*` (tree, browse), `brands`, `deals*`, `suppliers*` (public storefronts), `search` + `suggestions`, `currency/rates`, `legal*`, `support/*` (articles, policies, status, safety-tips), `about*`, `careers*`, `press*`, `investor*`, `live-shopping/[id]`, `app/*` (version, maintenance, deep-links, diagnostics), `auth/account-status`, `sitemap-data`, `wishlist/shared` (share-link by design).

## Fix plan (backend-first, in order)

1. Add `requireUserType(request, ['admin'])` to `admin/users`, `admin/products`, `admin/reports`, `admin/reports/[id]`; gate `suppliers/[id]/verify` to admin.
2. Add owner/session checks to `profile/addresses/[id]`, `cart/[itemId]`, `profile/linked-accounts/*` (authenticate + row-ownership where).
3. Require buyer/supplier session on `uploads/kyc`, `chat/upload`, `reviews/upload`, and all `supplier/*` mutation + analytics GET routes.
4. Confirm `notifications/evaluate-alerts` rejects non-cron callers (shared secret header).
5. Re-run this scan (script is one `node -e` pass over `route.ts` files grepping `authenticateRequest|requireUserType`) as a Phase 2 exit gate; target: zero CRITICAL/HIGH.
