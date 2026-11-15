package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.support.DocsScreen as SharedDocsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "docs-page"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t255 — the curated-metadata body is GONE: the web SPA serves this
 * pageId from docs-browser-page.tsx, and this pageId is now owned by the
 * typed ui/support implementation. The body is a thin delegation to the
 * shared docs screen — the REAL sidebar TOC (GET api/support/policies)
 * and the article pane (GET api/support/articles/{slug}, the entry
 * query's "slug=" pair seeds the open article, default 'how-it-works'),
 * with the EN⇄BN toggle and the one-shot article-feedback POST. The meta
 * object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object DocsPagePageMeta : NativePageMeta() {
    override val pageId = "docs-page"
    override val title = "Docs Page"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = "api/support/policies"
    override val summary = "Docs Page — the documentation browser with the real table of contents and per-slug article detail, streaming from the Zylod support API."
    override val tabHint = ""
    override val bullets = listOf(
        "Live product grid fetched from api/support/policies — the same catalog call the web page makes.",
        "Cards render real price, MOQ badge, supplier and category from the response.",
        "Offline: the last-saved grid renders first; the Room offline catalog fills in before curated content.",
    )
    override val related = listOf(
        NativePageLink("helpdesk", "Help & Support Center"),
        NativePageLink("docs-search-results", "Docs Search Results"),
        NativePageLink("contact-page", "Contact Page"),
    )
}

/**
 * Delegation only — the shared [SharedDocsScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/support, not on
 * a same-named local composable).
 */
@Composable
fun DocsPageScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedDocsScreen(pageId = "docs-page", onBack = onBack, openPage = openPage, query = query)
}
