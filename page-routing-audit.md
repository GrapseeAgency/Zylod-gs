# Page Routing Audit — Prefixed Page IDs (40 ids)

**Date:** 2026-08-07
**Scope:** Runtime resolution of all `admin-*`, `buyer-*`, `seller-*`, `supplier-*` page IDs.
**Status: IMPLEMENTED** — Option 1 broadened: all prefixed ids route to `GenericInfoPage`; sub-view configs render where they exist, a titled fallback otherwise. Dashboards unaffected.

## Routing Chain (verified end-to-end)

```
AppEntry
  └─ PageRenderer                       src/components/app-entry.tsx:28
      └─ loadPage(pageId)               src/lib/page-loader.ts:57
          ├─ CHUNK_CORE    → loadCore()
          ├─ REAL_PAGES    → chunk path (CHUNK_MISC/CHUNK_SELLER) — 3 dashboards
          ├─ genericType   → { component: null, needsPageId: true, genericType }
          └─ else          → same as REAL_PAGES
      └─ getGenericType(pageId)         src/lib/page-loader.ts:36  (exact order, APPLIED)
          CATEGORY_IDS                     → 'category'
          DEAL_IDS                         → 'deals'
          startsWith(admin-/supplier-/seller-/buyer-)  → 'info'   ← THE FIX
          finance keywords*                → 'finance'
          else                             → 'info'
      └─ GenericPageRenderer              src/components/app-entry.tsx:142
          └─ loadGenericComponent         src/lib/chunk-loader.ts:72 (type → component map)
              'category'  → GenericCategoryPage
              'deals'     → GenericDealsPage
              'info'      → GenericInfoPage   ← all prefixed ids land here
              'finance'   → GenericFinancePage
              'supplier'  → SupplierDashboardPage (unreachable for prefixed ids now)
              'admin'     → AdminDashboardPage   (unreachable for prefixed ids now)
              'buyer'     → BuyerDashboardPage   (unreachable for prefixed ids now)
          └─ <Comp key={pageId} pageId={pageId} pageParams={pageParams} />  app-entry.tsx:178
```

*finance keywords: payment, wallet, invoice, transaction, billing, escrow, credit,
earnings, finance, bank, withdraw, refund, balance, card, commission, revenue, payout.
Note: prefixed ids hit the `'info'` branch BEFORE the finance keywords, so e.g.
`buyer-credit`, `supplier-earnings`, `supplier-finance` render GenericInfoPage (with
their INFO_CONFIGS sub-views), not GenericFinancePage.

The 3 dashboards (`admin-dashboard`, `buyer-dashboard`, `supplier-dashboard`) are in
`REAL_PAGES` → chunk path → their dashboard components. `loadPage`'s REAL_PAGES check
(page-loader.ts:64) runs before `getGenericType`, so they are unaffected by the fix.

## How GenericInfoPage resolves sub-views

- `getInfoConfig(pageId)` (generic-info-page.tsx:671) is called inline during render —
  no memoization, so prop changes re-resolve correctly.
- `INFO_CONFIGS` (generic-info-page.tsx:~80-720) holds 17 prefixed `specialType` keys
  (16 supplier/buyer/admin/seller configs added 2026-08-07 + `supplier-verification-status`).
- Ids with a config → dedicated sub-view; ids without → titled fallback page
  ("N/A — pageId not configured", list of configs), so **every prefixed id still has
  an intended view**. Only 3 remaining fallbacks (`buyer-terms`, `supplier-data-sharing`,
  `supplier-verification`) have zero UI links.
- `key={pageId}` on the renderer (app-entry.tsx:178) remounts GenericInfoPage per id,
  guaranteeing fresh state when navigating between prefixed ids.

## Mapping (40 ids)

Legend: `✓` = intended sub-view renders · `~` = titled fallback (no INFO_CONFIGS entry) ·
dashboards render via REAL_PAGES chunk path.

### admin-* (10) → GenericInfoPage

| pageId | Renders |
|--------|---------|
| admin-dashboard | ✓ AdminDashboardPage (REAL_PAGES) |
| admin-users | ✓ AdminUsersPage |
| admin-products | ✓ AdminProductsPage |
| admin-complaints | ✓ AdminComplaintsPage |
| admin-reports | ✓ AdminReportsPage |
| admin-analytics | ✓ AdminAnalyticsPage |
| admin-categories | ✓ AdminCategoriesPage |
| admin-settings | ✓ AdminSettingsPage |
| admin-suppliers | ✓ SuppliersPage ('suppliers') |
| admin-orders | ✓ INFO_CONFIGS entry |

### buyer-* (14) → GenericInfoPage

| pageId | Renders |
|--------|---------|
| buyer-dashboard | ✓ BuyerDashboardPage (REAL_PAGES) |
| buyer-complaints | ✓ BuyerComplaintsPage |
| buyer-returns | ✓ BuyerReturnsPage |
| buyer-settings | ✓ BuyerSettingsPage |
| buyer-level | ✓ BuyerLevelPage |
| buyer-favorites | ✓ BuyerFavoritesPage |
| buyer-orders | ✓ INFO_CONFIGS entry |
| buyer-profile | ✓ INFO_CONFIGS entry |
| buyer-rewards | ✓ INFO_CONFIGS entry |
| buyer-credit | ✓ INFO_CONFIGS entry |
| buyer-protection | ✓ INFO_CONFIGS entry |
| buyer-qr-scan | ✓ INFO_CONFIGS entry |
| buyer-wishlist | ✓ INFO_CONFIGS entry |
| buyer-terms | ~ titled fallback (no UI links) |

### seller-* (1) → GenericInfoPage

The other 20 `seller-*` ids were removed from `CHUNK_SELLER` (chunk-seller.ts) — they
never resolved (genericType catches prefixed ids before chunk load) and have no UI
links. `seller-storefront` is retained and configured:

| pageId | Renders |
|--------|---------|
| seller-storefront | ✓ INFO_CONFIGS entry |

### supplier-* (15) → GenericInfoPage

| pageId | Renders |
|--------|---------|
| supplier-dashboard | ✓ SupplierDashboardPage (REAL_PAGES) |
| supplier-analytics | ✓ SupplierAnalyticsPage |
| supplier-warehouse | ✓ SupplierWarehousePage |
| supplier-insights | ✓ SupplierInsightsPage |
| supplier-profile | ✓ SupplierProfilePage |
| supplier-add-product | ✓ INFO_CONFIGS entry |
| supplier-agreement | ✓ INFO_CONFIGS entry |
| supplier-catalog | ✓ INFO_CONFIGS entry |
| supplier-data-sharing | ~ titled fallback (no UI links) |
| supplier-earnings | ✓ INFO_CONFIGS entry |
| supplier-finance | ✓ INFO_CONFIGS entry |
| supplier-orders | ✓ INFO_CONFIGS entry |
| supplier-products | ✓ INFO_CONFIGS entry |
| supplier-verification | ~ titled fallback (no UI links — footer/dashboard repointed to `supplier-verification-status`) |
| supplier-verification-status | ✓ INFO_CONFIGS entry |

## Summary

| Family | Count | Correct sub-view | Titled fallback | Dashboard (REAL_PAGES) |
|--------|-------|------------------|-----------------|------------------------|
| admin-* | 10 | 9 | 0 | 1 |
| buyer-* | 14 | 12 | 1 | 1 |
| seller-* | 1 | 1 | 0 | 0 |
| supplier-* | 15 | 12 | 2 | 1 |
| **Total** | **40** | **34** | **3** | **3** |

## Verification

- `npx tsc --noEmit`: pre-existing errors only (API routes, prisma, socket.io). The
  files touched in this pass — `generic-info-page.tsx`, `chunk-seller.ts`, `footer.tsx`,
  `supplier-dashboard-page.tsx`, `app-shell.tsx` — are type-clean.
- `getGenericType` branches for `'admin'`/`'supplier'`/`'buyer'` are now unreachable for
  prefixed ids; `'finance'` remains reachable only via unprefixed finance-keyword ids.
- `GenericPageRenderer` useEffect deps stay `[genericType]` — correct: all prefixed ids
  share `'info'`, so the component stays mounted and only props change.
- Removed 20 dead `seller-*` ids from `CHUNK_SELLER` (chunk-seller.ts) — no functional
  change (prefixed ids never reach the chunk), `seller-storefront` retained.
- `supplier-verification` navigate calls in `footer.tsx` and `supplier-dashboard-page.tsx`
  repointed to `supplier-verification-status` (configured); `supplier-verification` itself
  now has no UI links and remains an unconfigured fallback.
- `seller-` added to the role-shell prefix check in `app-shell.tsx` (`isCustomHeaderPage`),
  matching `supplier-`/`buyer-`/`admin-`.

## Closed Gap

The ~40 titled-fallback ids are resolved: 17 prefixed INFO_CONFIGS entries now render
dedicated sub-views, 20 dead `seller-*` ids deleted, and all UI-reachable ids point to
configured pages. The 3 remaining titled fallbacks (`buyer-terms`, `supplier-data-sharing`,
`supplier-verification`) are unreachable from the UI — config them if they ever gain links.
