package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.vip.VipScreen as SharedVipScreen

data object VipClubPageMeta : NativePageMeta() {
    override val pageId = "vip-club"
    override val title = "VIP Club"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Cumulative purchase turnover recorded on Zylod"
    override val tabHint = ""
    override val bullets = listOf(
        "VIP Wholesale Club",
        "Your VIP Enterprise Privileges",
    )
    override val related = listOf(
        NativePageLink("membership-tiers", "Membership Tiers"),
        NativePageLink("exclusive-deals", "Exclusive Deals"),
    )
}

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "vip-club".
 *
 * t260 API-backed VIP tier ladder + privilege matrix (GET api/vip — the route's real tiers, badges, benefit bullets and the caller's lifetime paid spend; the club pageIds add the amber status hero). The body is a thin delegation to the shared
 * screen (pageId-keyed so it keeps its own ViewModel) — the REAL wire
 * calls live there, honest empty/401 handling included. The meta object
 * above and the NativePageRegistry composable signature are unchanged
 * (AddressBookScreen thin-delegate pattern, t253).
 */

/**
 * Delegation only — the shared screen owns the rendering and the wire
 * calls; this file keeps the registry-facing signature (the aliased import
 * is what makes the delegation land on ui/vip, not on a same-named
 * composable here).
 */
@Composable
fun VipClubScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedVipScreen(pageId = "vip-club", onBack = onBack, openPage = openPage, query = query)
}
