package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.material3.ExperimentalMaterial3Api
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.wishlist.SharedWishlistViewScreen as TypedSharedWishlistViewScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "shared-wishlist-detail"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t262 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/wishlist implementation. The body is a thin delegation to the
 * shared [TypedSharedWishlistViewScreen] — the PUBLIC token read (GET
 * api/wishlist/shared?token=) with the centered owner banner, the item
 * count and the "Wishlist Unavailable" failure card (the web detail
 * component's own interface expects fields the route never sends — see the
 * VM's documented deviation; the native renders the ROUTE's real payload).
 * The meta object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object SharedWishlistDetailPageMeta : NativePageMeta() {
    override val pageId = "shared-wishlist-detail"
    override val title = "Shared Wishlist Detail"
    override val category = "Shopping & Products"
    override val kind = NativePageKind.WISHLIST
    override val endpoint: String? = "api/wishlist?limit=50"
    override val summary = "Shared Wishlist Detail — product discovery and buying on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the shared-wishlist-detail pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("all-products", "All Products"),
        NativePageLink("flash-deals", "Flash Deals"),
        NativePageLink("category-browser", "Category Browser"),
    )
}

/**
 * Delegation only — the shared [TypedSharedWishlistViewScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/wishlist, not on this file's own same-named composable).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SharedWishlistDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedSharedWishlistViewScreen(pageId = "shared-wishlist-detail", onBack = onBack, openPage = openPage, query = query)
}
