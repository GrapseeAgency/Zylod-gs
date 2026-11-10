package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.search.SearchHistoryScreen as TypedSearchHistoryScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "search-history"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t301 — the curated-metadata body is GONE: this pageId is now owned by the
 * NEW typed ui/search implementation. The body is a thin delegation to the
 * shared [TypedSearchHistoryScreen] (pageId-keyed VM, History mode) — the
 * REAL rows the web's SearchHistoryPage renders: GET api/search/history
 * with per-row DELETE api/search/history?term= and Clear All, tap →
 * search-results, and the web page's own device-local fallback for guests.
 * The meta object below keeps its registry identity and the
 * NativePageRegistry composable signature is unchanged.
 */
data object SearchHistoryPageMeta : NativePageMeta() {
    override val pageId = "search-history"
    override val title = "Search History"
    override val category = "Search & Navigation"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Search History — the real rows (GET api/search/history) with per-row delete (DELETE ?term=) and Clear All, tap → search-results; guests get the web page's own device-local fallback. Same data the web's SearchHistoryPage renders."
    override val tabHint = "search"
    override val bullets = listOf(
        "Real history — the caller's own rows from the Zylod API, never fabricated.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the search-history pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("search", "Search"),
        NativePageLink("trending-searches", "Trending Searches"),
        NativePageLink("saved-searches", "Saved Searches"),
    )
}

/**
 * Delegation only — the shared [TypedSearchHistoryScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/search, not on this file's own same-named composable).
 */
@Composable
fun SearchHistoryScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedSearchHistoryScreen(pageId = "search-history", onBack = onBack, openPage = openPage, query = query)
}
