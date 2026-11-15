package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.rewards.RewardsScreen as SharedRewardsScreen

data object BuyerRewardsPageMeta : NativePageMeta() {
    override val pageId = "buyer-rewards"
    override val title = "Buyer Rewards"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Could not load loyalty points"
    override val tabHint = ""
    override val bullets = listOf(
        "Loyalty Points",
        "Quick Ways to Earn Points",
    )
    override val related = listOf(
        NativePageLink("points-history", "Points History"),
        NativePageLink("redeem-points", "Redeem Points"),
        NativePageLink("membership-tiers", "Membership Tiers"),
    )
}

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "buyer-rewards".
 *
 * t259 API-backed rewards book (GET api/rewards + POST redeem). The body is a thin delegation to the shared ui/rewards screen (pageId-keyed
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
fun BuyerRewardsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedRewardsScreen(pageId = "buyer-rewards", onBack = onBack, openPage = openPage, query = query)
}
