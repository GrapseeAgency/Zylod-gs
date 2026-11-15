package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.rewards.AffiliateScreen as SharedAffiliateScreen

data object AffiliateProgramPageMeta : NativePageMeta() {
    override val pageId = "affiliate-program"
    override val title = "Affiliate Program"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Earn continuous 5% cash commissions on every completed purchase order placed by manufacturers and retailers you introduce."
    override val tabHint = ""
    override val bullets = listOf(
        "Affiliate Partner Program",
        "Earn 5% commission on every wholesale order you refer",
        "Monetize Your B2B Industry Network",
        "Get instant access to tracked wholesale referral links, real-time commission analytics, and monthly bKash/bank account settlements.",
        "Become a Certified Wholesale Affiliate",
        "Earn % of every completed wholesale order placed through your link.",
    )
    override val related = listOf(
        NativePageLink("affiliate-dashboard", "Affiliate Dashboard"),
    )
}

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "affiliate-program".
 *
 * t259 API-backed affiliate program (GET/POST api/affiliate). The body is a thin delegation to the shared ui/rewards screen (pageId-keyed
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
fun AffiliateProgramScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAffiliateScreen(pageId = "affiliate-program", onBack = onBack, openPage = openPage, query = query)
}
