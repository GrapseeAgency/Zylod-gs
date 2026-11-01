package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.complaints.CustomerQueriesScreen as SharedCustomerQueriesScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "customer-query-detail"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Customer Query Detail — a Zylod marketplace surface. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 *
 * t261 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/complaints implementation. The body is a thin delegation to the
 * shared query-thread screen (pageId-keyed so it keeps its own ViewModel) —
 * the web customer-query-detail-page.tsx mirror: GET
 * api/supplier/queries/[id] for the query id in the entry query, the real
 * reply composer + status transitions (PATCH), the honest
 * buyer-session/404/no-query states. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object CustomerQueryDetailPageMeta : NativePageMeta() {
    override val pageId = "customer-query-detail"
    override val title = "Customer Query Detail"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Customer Query Detail — a Zylod marketplace surface. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the customer-query-detail pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("home", "Home"),
        NativePageLink("category-browser", "Category Browser"),
        NativePageLink("help-center", "Help Center"),
    )
}

/**
 * Delegation only — the shared [SharedCustomerQueriesScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/complaints, not on this file's own same-named composable).
 */
@Composable
fun CustomerQueryDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCustomerQueriesScreen(pageId = "customer-query-detail", onBack = onBack, openPage = openPage, query = query)
}
