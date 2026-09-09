# Zylod "Text-404" Audit (2026-09-09)

> **STATUS: FIXED (2026-09-09).** All Class A/B/C1 items below have been fixed and
> live-verified at :3100 (tsc 0, build OK). The tables are kept as the record of
> what was wrong and where each id belonged.


Pages that navigate to an id which never reaches a real component, so the user
lands on the generic-info boilerplate text page (or blank) instead of actual UI.
Found by static call-site audit + live browser verification at :3100.

## Class A - real component EXISTS and IS registered, but call sites use the wrong id
(the `-page`-suffixed id). Every one of these currently renders pure boilerplate text.
Fix: point the call sites at the stem id (component shown).

| Wrong id used at call sites | Referenced from | Belongs to (registered id / component) |
|---|---|---|
| `bulk-price-update-page` | src/components/pages/bulk-upload-products-page.tsx | `bulk-price-update` / `src/components/pages/bulk-price-update-page.tsx` |
| `bulk-upload-history-page` | src/components/pages/bulk-upload-products-page.tsx | `bulk-upload-history` / `src/components/pages/bulk-upload-history-page.tsx` |
| `bulk-upload-template-page` | src/components/pages/bulk-upload-products-page.tsx | `bulk-upload-template` / `src/components/pages/bulk-upload-template-page.tsx` |
| `create-promotion-page` | src/components/pages/seller-promotions-page.tsx | `create-promotion` / `src/components/pages/create-promotion-page.tsx` |
| `customer-query-detail-page` | src/components/pages/customer-queries-page.tsx | `customer-query-detail` / `src/components/pages/customer-query-detail-page.tsx` |
| `customer-rfq-inbox-page` | src/components/pages/customer-queries-page.tsx | `customer-rfq-inbox` / `src/components/pages/customer-rfq-inbox-page.tsx` |
| `promotion-analytics-page` | src/components/pages/seller-promotions-page.tsx | `promotion-analytics` / `src/components/pages/promotion-analytics-page.tsx` |
| `seller-create-ticket-page` | src/components/pages/seller-support-page.tsx | `seller-create-ticket` / `src/components/pages/seller-create-ticket-page.tsx` |
| `seller-review-reply-page` | src/components/pages/seller-reviews-page.tsx | `seller-review-reply` / `src/components/pages/seller-review-reply-page.tsx` |
| `seller-storefront-page` | src/components/pages/seller-dashboard-page.tsx | `seller-storefront` / `src/components/pages/seller-storefront-page.tsx` |
| `seller-ticket-detail-page` | src/components/pages/seller-support-page.tsx | `seller-ticket-detail` / `src/components/pages/seller-ticket-detail-page.tsx` |
| `seller-verification-page` | src/components/pages/seller-dashboard-page.tsx | `seller-verification` / `src/components/pages/seller-verification-page.tsx` |
| `store-banner-editor-page` | src/components/pages/seller-storefront-page.tsx | `store-banner-editor` / `src/components/pages/store-banner-editor-page.tsx` |
| `store-featured-products-page` | src/components/pages/seller-storefront-page.tsx | `store-featured-products` / `src/components/pages/store-featured-products-page.tsx` |
| `store-story-about-page` | src/components/pages/seller-storefront-page.tsx | `store-story-about` / `src/components/pages/store-story-about-page.tsx` |
| `store-theme-customizer-page` | src/components/pages/store-customization-page.tsx | `store-theme-customizer` / `src/components/pages/store-theme-customizer-page.tsx` |

## Class B - blank page

| Wrong id | Referenced from | Belongs to |
|---|---|---|
| `onboarding` (renders completely blank) | src/components/layout/footer.tsx | `welcome` / `src/components/pages/welcome-page.tsx` (same screen AppEntry uses for first-run onboarding) |

## Class C - no dedicated component exists; falls to generic fallback

### C1: pure boilerplate text (reads like a 404, needs either a real page or a designed generic section)

| id | Referenced from | Suggested real home |
|---|---|---|
| `blog` | src/components/layout/footer.tsx | blog-page.tsx / blog-post-page.tsx exist but "blog" itself is not registered |
| `categories` | src/components/pages/favorite-categories-page.tsx | category-browser (registered) or category-navigation |
| `checkout-direct` | src/components/pages/exclusive-deal-detail-page.tsx | checkout (registered) or buy-now |
| `compare-products` | src/components/pages/favorite-products-page.tsx | compare / product-comparison (both registered) |
| `events` | src/components/layout/footer.tsx | no component exists; footer link |
| `messages` | src/components/pages/orders-page.tsx, src/components/pages/supplier-products-page.tsx | live-chat (registered) or chat-list generic section |
| `rfq-create` | src/components/pages/buyer-dashboard-page.tsx | rfq-list (registered); no RFQ form component exists |
| `supplier-detail` | src/components/pages/buyer-dashboard-page.tsx | supplier-storefront (registered) with supplierId param |
| `supplier-storefront` | src/components/pages/explore-page.tsx, src/components/pages/suppliers-directory-page.tsx | seller-storefront (registered) |

### C2: generic fallback with DESIGNED content (intentional, no action needed)

about, admin-analytics, admin-categories, admin-products, admin-suppliers, admin-users,
buyer-credit, buyer-favorites, buyer-orders, buyer-settings, buyer-wishlist, chat-detail,
chat-list, partner-program, press, quote-request, supplier-analytics, supplier-insights,
supplier-profile, supplier-verification-status, supplier-warehouse

## Totals
- Class A (wrong-id call sites): 16 - highest priority, real UI is one rename away
- Class B (blank page): 1 (onboarding)
- Class C1 (boilerplate-text dead ends): 9
- Class C2 (designed fallbacks, OK): 21
- Grand total audited: 298 referenced page ids, 47 broken-ish, 0 hard "Page not found" crashes


## Fix log (2026-09-09)
- Class A: 18 navigate() call sites across 8 files retargeted from the `-page`-suffixed ids to their registered stems. Live-verified: all 16 pages now render their real components.
- Class B: footer Onboarding Guide link now navigates to `welcome` (real onboarding screen, verified non-blank).
- Class C1: `categories` -> category-browser, `checkout-direct` -> buy-now, `compare-products` -> compare, `messages` -> live-chat (x3), `rfq-create` -> rfq-list, `supplier-detail`/`supplier-storefront` -> seller-storefront (with supplierId param). `blog` and `events` got brand-new real components (src/components/pages/blog-page.tsx, events-page.tsx, contract-compliant responsive layouts, /api/blog + /api/events fetches with honest empty states) registered in chunk-misc and REAL_PAGES.
- Re-audit after fixes: 0 blank, 0 boilerplate among all previously broken ids.

## Round 2 audit (same day): full 528-id live sweep

Swept every registered page id at 1280px in the browser. Found and fixed:

1. **188 alias ids rendering boilerplate text.** The chunk SETS listed hundreds of
   alias/deep-link ids, but loadPage's getGenericType() catch-all ('info') meant the
   chunk loaders were never consulted for any id outside CHUNK_CORE/REAL_PAGES.
   Fix: 159 alias ids now resolve to real components (18 to their own `-page` files,
   141 curated canonical remaps like all-orders->orders, helpdesk->help-center,
   spin-wheel->mini-games) via chunk-misc loader entries + REAL_PAGES registration.
   27 concept aliases with no sensible target stay on the designed generic fallback.
2. **buyer-dashboard crashed** ("Cannot read properties of null (reading 'spendingData')")
   whenever its API failed, killing the whole SPA behind the error boundary.
   Unguarded `data!.` derefs replaced with safe fallbacks. This crash was also what
   made five other pages measure "blank" during the sweep (the boundary killed the app).
3. **54 literal `$page_title` placeholders** visible in stub-page headings (14 seller/
   finance stub files) replaced with real titles; 14 `$component_name` function
   identifiers renamed to proper PascalCase names.
4. **Null-render blanks:** about-us and sitemap rendered `null` when their API failed;
   now render designed unavailable states.

Post-fix verification: re-swept the previously broken ids -> 0 boilerplate, 0 blank,
0 crash (buyer-dashboard renders its full dashboard shell). tsc 0, build OK.
