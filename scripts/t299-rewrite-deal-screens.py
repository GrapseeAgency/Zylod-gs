#!/usr/bin/env python3
"""t299 — rewrite the 14 DEAL_IDS thin screens as delegations to the shared
ui/deals/DealBrowseScreen. Each file keeps its meta data object VERBATIM
(registry imports the metas); only the composable body changes and the
meta's endpoint states the row's REAL data source (api/deals?limit=20 — the
web's GenericDealsPage call). Several old endpoints were actively wrong
(pre-order/sample-orders/cross-border fetched api/orders/my-orders — the
buyer's ORDER LIST under a deal banner)."""
import re, sys

ROOT = "/home/z/my-project/android/app/src/main/java/com/zylod/wholesale/ui/screens"

SCREENS = [
    ("mega-sale", "MegaSaleScreen", "MegaSalePageMeta", "MegaSale"),
    ("bulk-discounts", "BulkDiscountsScreen", "BulkDiscountsPageMeta", "Bulk Discounts"),
    ("top-deals", "TopDealsScreen", "TopDealsPageMeta", "Top Deals"),
    ("week-special", "WeekSpecialScreen", "WeekSpecialPageMeta", "Week Special"),
    ("pre-order", "PreOrderScreen", "PreOrderPageMeta", "Pre Order"),
    ("sample-orders", "SampleOrdersScreen", "SampleOrdersPageMeta", "Sample Orders"),
    ("factory-direct", "FactoryDirectScreen", "FactoryDirectPageMeta", "Factory Direct"),
    ("cross-border", "CrossBorderScreen", "CrossBorderPageMeta", "Cross Border"),
    ("flash-sale", "FlashSaleScreen", "FlashSalePageMeta", "Flash Sale"),
    ("clearance", "ClearanceScreen", "ClearancePageMeta", "Clearance"),
    ("seasonal-offers", "SeasonalOffersScreen", "SeasonalOffersPageMeta", "Seasonal Offers"),
    ("new-arrivals", "NewArrivalsScreen", "NewArrivalsPageMeta", "New Arrivals"),
    ("recommended", "RecommendedScreen", "RecommendedPageMeta", "Recommended"),
    ("trending-products", "TrendingProductsScreen", "TrendingProductsPageMeta", "Trending Products"),
]

TEMPLATE = '''package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.deals.DealBrowseScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "{pid}".
 *
 * t299 — DEAL BROWSE parity: the body is a thin delegation to the shared
 * [DealBrowseScreen] (pageId-keyed ViewModel) — the REAL merged flash+daily
 * deals the web's GenericDealsPage renders for every DEAL_IDS id:
 * GET api/deals?limit=20 with the web's own merge + dedupe by productId,
 * the DEAL_META banner copy + gradients verbatim, the deal card with the
 * -N% badge, the t285 nowrap MOQ/claimed row and the 1..50 stock urgency
 * gate, hearts via ApiClient.wishlistApi, and the web's honest empty state.
 * The old body rendered the generic pipeline — several rows actively
 * fetched the WRONG surface (pre-order/sample-orders/cross-border pulled
 * api/orders/my-orders, the buyer's ORDER LIST, under a deal banner;
 * clearance/seasonal-offers invented query params the route ignores; five
 * fetched nothing). The meta object below keeps its registry identity
 * (title/kind/related unchanged; endpoint + summary now state the row's
 * REAL data source) and the NativePageRegistry composable signature is
 * unchanged.
 */
{meta}

@Composable
fun {screen}(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {{
    DealBrowseScreen(
        pageId = "{pid}",
        title = "{title}",
        onBack = onBack,
        openPage = openPage,
        query = query,
    )
}}
'''

for pid, screen, meta_name, label in SCREENS:
    path = f"{ROOT}/{screen}.kt"
    src = open(path).read()
    m = re.search(r'(data object ' + meta_name + r' : NativePageMeta\(\) \{.*?\n\})', src, re.S)
    if not m:
        print(f"FAIL: meta block not found in {screen}.kt", file=sys.stderr)
        sys.exit(1)
    meta = m.group(1)
    meta = re.sub(
        r'override val endpoint: String\? = [^\n]+\n',
        'override val endpoint: String? = "api/deals?limit=20"\n',
        meta,
    )
    # Honest summary for the deal rows.
    summary = (
        f"{label} — the native deal browse: the grid streams the REAL merged "
        f"flash + daily deals from the Zylod API (api/deals?limit=20), the "
        f"same data the web's deals page renders for this id."
    )
    meta, n1 = re.subn(
        r'override val summary = "[^"]*"',
        'override val summary = ' + '"' + summary + '"',
        meta,
    )
    # First bullet honesty pass (same as the t298 category pass).
    meta, n2 = re.subn(
        r'"Curated native content — no fabricated server data, ever\.",',
        '"Live deals grid — the server\'s own merged rows, never fabricated.",',
        meta,
    )
    tm = re.search(r'override val title = "([^"]+)"', meta)
    if not tm:
        print(f"FAIL: title not found in {meta_name}", file=sys.stderr)
        sys.exit(1)
    title = tm.group(1)
    if n1 != 1 or n2 != 1:
        print(f"WARN {screen}: summary x{n1} bullet x{n2}", file=sys.stderr)
    out = TEMPLATE.format(pid=pid, screen=screen, meta=meta, title=title)
    open(path, "w").write(out)
    print(f"rewrote {screen}.kt ({pid})")

print("done")
