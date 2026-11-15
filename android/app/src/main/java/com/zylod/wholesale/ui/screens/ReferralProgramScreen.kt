package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.rewards.ReferralScreen as SharedReferralScreen

data object ReferralProgramPageMeta : NativePageMeta() {
    override val pageId = "referral-program"
    override val title = "Referral Program"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Invite fellow wholesale retailers and factory buyers. They get ৳200 voucher + 300 points, and you receive 500 points per registered business!"
    override val tabHint = ""
    override val bullets = listOf(
        "Refer &amp; Earn",
        "Enter a colleague&apos;s code below to claim your ৳200 welcome voucher and 300 bonus points.",
        "Give ৳200, Get 500 Points",
        "Your Unique Invite Code",
        "Have an Invite Code?",
    )
    override val related = listOf(
        NativePageLink("referral-earnings", "Referral Earnings"),
    )
}

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "referral-program".
 *
 * t259 API-backed referral program (GET api/referrals + POST claim). The body is a thin delegation to the shared ui/rewards screen (pageId-keyed
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
fun ReferralProgramScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedReferralScreen(pageId = "referral-program", onBack = onBack, openPage = openPage, query = query)
}
