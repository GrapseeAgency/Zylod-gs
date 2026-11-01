package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.material3.ExperimentalMaterial3Api
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.wishlist.FavoritesScreen as TypedFavoritesScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "buyer-favorites"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t262 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/wishlist implementation. The body is a thin delegation to the
 * pageId-keyed [TypedFavoritesScreen] — and the web map is exact:
 * chunk-misc.ts:121 loads buyer-favorites onto the SAME
 * favorite-suppliers-page component, so this id renders the supplier
 * variant (GET api/buyer/favorite-suppliers, the sort chips, the heart
 * unfollow with the verbatim result notes). The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object BuyerFavoritesPageMeta : NativePageMeta() {
    override val pageId = "buyer-favorites"
    override val title = "Buyer Favorites"
    override val category = "Shopping & Products"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Buyer Favorites — product discovery and buying on the Zylod marketplace. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the buyer-favorites pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("all-products", "All Products"),
        NativePageLink("flash-deals", "Flash Deals"),
        NativePageLink("category-browser", "Category Browser"),
    )
}

/**
 * Delegation only — the shared [TypedFavoritesScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/wishlist, not on
 * this file's own same-named composable).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BuyerFavoritesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedFavoritesScreen(pageId = "buyer-favorites", onBack = onBack, openPage = openPage, query = query)
}
