package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.material3.ExperimentalMaterial3Api
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.wishlist.SavedSearchesScreen as TypedSavedSearchesScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "saved-searches"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t262 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/wishlist implementation. The body is a thin delegation to the
 * shared [TypedSavedSearchesScreen] — the REAL saved-searches surface
 * (GET api/search/saved — auth-optional, so signed-out renders the public
 * default rows exactly like the web; DELETE api/search/saved/{id} for the
 * per-row trash) with the filterConfig pills, Search Now and the local
 * Alert confirmation. The meta object below and the NativePageRegistry
 * composable signature are unchanged.
 */
data object SavedSearchesPageMeta : NativePageMeta() {
    override val pageId = "saved-searches"
    override val title = "Saved Searches"
    override val category = "Search & Navigation"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Saved Searches — find anything across the Zylod wholesale marketplace. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the saved-searches pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("search-results", "Search Results"),
        NativePageLink("category-browser", "Category Browser"),
        NativePageLink("all-products", "All Products"),
    )
}

/**
 * Delegation only — the shared [TypedSavedSearchesScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/wishlist, not on this file's own same-named composable).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedSearchesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedSavedSearchesScreen(pageId = "saved-searches", onBack = onBack, openPage = openPage, query = query)
}
