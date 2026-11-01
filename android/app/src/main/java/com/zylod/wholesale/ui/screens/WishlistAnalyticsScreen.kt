package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.material3.ExperimentalMaterial3Api
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.wishlist.WishlistAnalyticsScreen as TypedWishlistAnalyticsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "wishlist-analytics"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t262 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/wishlist implementation. The body is a thin delegation to the
 * shared [TypedWishlistAnalyticsScreen] — the REAL tabbed stock book
 * (chunk-misc.ts:184 maps this pageId onto the SAME wishlist-page.tsx the
 * "wishlist" pageId uses): All Items / In Stock / Price Drop tabs, the
 * four-way sort, the honest stock badges and the per-row trash through
 * DELETE api/wishlist/{itemId}. No metrics are invented — the web page has
 * none. The meta object below and the NativePageRegistry composable
 * signature are unchanged.
 */
data object WishlistAnalyticsPageMeta : NativePageMeta() {
    override val pageId = "wishlist-analytics"
    override val title = "Wishlist Analytics"
    override val category = "Dashboards & Analytics"
    override val kind = NativePageKind.WISHLIST
    override val endpoint: String? = "api/wishlist?limit=50"
    override val summary = "Wishlist Analytics — operational dashboards and analytics surfaces. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the wishlist-analytics pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("dashboard", "Dashboard"),
        NativePageLink("analytics-dashboard", "Analytics Dashboard"),
        NativePageLink("store-analytics", "Store Analytics"),
    )
}

/**
 * Delegation only — the shared [TypedWishlistAnalyticsScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/wishlist, not on this file's own same-named composable).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WishlistAnalyticsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedWishlistAnalyticsScreen(pageId = "wishlist-analytics", onBack = onBack, openPage = openPage, query = query)
}
