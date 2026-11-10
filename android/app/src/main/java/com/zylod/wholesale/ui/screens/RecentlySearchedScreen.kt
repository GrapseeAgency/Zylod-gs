package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.search.SearchHistoryScreen as TypedSearchHistoryScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "recently-searched"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t301 — the curated-metadata body is GONE: this pageId is now owned by the
 * NEW typed ui/search implementation. The body is a thin delegation to the
 * shared [TypedSearchHistoryScreen] (pageId-keyed VM, History mode) — the
 * web's RecentlySearchedPage serves the SAME api/search/history rows with
 * the same per-row deletes, so the native row does exactly that. The meta
 * object below keeps its registry identity and the NativePageRegistry
 * composable signature is unchanged.
 */
data object RecentlySearchedPageMeta : NativePageMeta() {
    override val pageId = "recently-searched"
    override val title = "Recently Searched"
    override val category = "Search & Navigation"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Recently Searched — the same api/search/history rows the web's RecentlySearchedPage serves (GET api/search/history, per-row DELETE ?term=), tap → search-results, guests on the device-local fallback."
    override val tabHint = "search"
    override val bullets = listOf(
        "Real history — the caller's own rows from the Zylod API, never fabricated.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the recently-searched pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("search", "Search"),
        NativePageLink("search-history", "Search History"),
        NativePageLink("recently-viewed", "Recently Viewed"),
    )
}

/**
 * Delegation only — the shared [TypedSearchHistoryScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature.
 */
@Composable
fun RecentlySearchedScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedSearchHistoryScreen(pageId = "recently-searched", onBack = onBack, openPage = openPage, query = query)
}
