package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.rewards.AffiliateScreen as SharedAffiliateScreen

data object AffiliateDashboardPageMeta : NativePageMeta() {
    override val pageId = "affiliate-dashboard"
    override val title = "Affiliate Dashboard"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "No attributed conversions recorded yet. Orders placed through your tracking link will appear here."
    override val tabHint = ""
    override val bullets = listOf(
        "Affiliate Partner Analytics",
        "Attributed Purchase Order Conversions",
    )
    override val related = listOf(
        NativePageLink("affiliate-program", "Affiliate Program"),
    )
}

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "affiliate-dashboard".
 *
 * t259 API-backed affiliate analytics (GET api/affiliate/dashboard). The body is a thin delegation to the shared ui/rewards screen (pageId-keyed
 * so it keeps its own ViewModel) — the REAL wire calls live there, honest
 * 401/403/400/409/empty handling included. The meta object above and the
 * NativePageRegistry composable signature are unchanged (AddressBookScreen
 * thin-delegate pattern, t253).
 */

/**
 * Delegation only — the shared screen owns the rendering and the wire
 * calls; this file keeps the registry-facing signature (the aliased import
 * is what makes the delegation land on ui/rewards, not on a same-named
 * composable here).
 */
@Composable
fun AffiliateDashboardScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAffiliateScreen(pageId = "affiliate-dashboard", onBack = onBack, openPage = openPage, query = query)
}
