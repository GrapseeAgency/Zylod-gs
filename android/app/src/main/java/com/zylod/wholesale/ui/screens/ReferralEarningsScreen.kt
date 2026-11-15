package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.rewards.ReferralScreen as SharedReferralScreen

data object ReferralEarningsPageMeta : NativePageMeta() {
    override val pageId = "referral-earnings"
    override val title = "Referral Earnings"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Referral earnings ledger — the real referral bonus rows."
    override val tabHint = ""
    override val bullets = listOf(
        "Invited merchants render with their role and status from the referral API; load failures show the verbatim error.",
    )

        override val related = listOf(
        NativePageLink("referral-program", "Referral Program"),
    )
}

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "referral-earnings".
 *
 * t259 API-backed referral earnings ledger (GET api/referrals). The body is a thin delegation to the shared ui/rewards screen (pageId-keyed
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
fun ReferralEarningsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedReferralScreen(pageId = "referral-earnings", onBack = onBack, openPage = openPage, query = query)
}
