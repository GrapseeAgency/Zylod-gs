package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.material3.ExperimentalMaterial3Api
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.wishlist.FavoritesScreen as TypedFavoritesScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "favorite-suppliers"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t262 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/wishlist implementation. The body is a thin delegation to the
 * pageId-keyed [TypedFavoritesScreen] supplier variant — the REAL followed
 * suppliers (GET api/buyer/favorite-suppliers, exactly what
 * favorite-suppliers-page.tsx fetches) with the sort tokens, the Verified
 * badge, the View Catalog row and the heart unfollow (DELETE
 * api/suppliers/{id}/favorite) with the web's verbatim result notes. The
 * meta object below and the NativePageRegistry composable signature are
 * unchanged (its historical "api/suppliers?limit=20" endpoint string is
 * kept byte-for-byte; the real feed is the favorite-suppliers route).
 */
data object FavoriteSuppliersPageMeta : NativePageMeta() {
    override val pageId = "favorite-suppliers"
    override val title = "Favorite Suppliers"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/suppliers?limit=20"
    override val summary = "Favorite Suppliers — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the favorite-suppliers pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("seller-dashboard", "Seller Dashboard"),
        NativePageLink("supplier-center", "Supplier Center"),
        NativePageLink("product-upload", "Product Upload"),
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
fun FavoriteSuppliersScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedFavoritesScreen(pageId = "favorite-suppliers", onBack = onBack, openPage = openPage, query = query)
}
