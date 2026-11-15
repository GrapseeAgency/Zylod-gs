package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.rewards.CheckinScreen as SharedCheckinScreen

data object DailyCheckinPageMeta : NativePageMeta() {
    override val pageId = "daily-checkin"
    override val title = "Daily Checkin"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Check in every consecutive day to multiply your wholesale point rewards up to 500 points on Day 7."
    override val tabHint = ""
    override val bullets = listOf(
        "Daily Check-in",
        "Points can be converted into discount vouchers or wallet funds in the Redeem center.",
        "Days In A Row",
        "7-Day Reward Ladder",
    )
    override val related = listOf(
        NativePageLink("checkin-streak", "Checkin Streak"),
    )
}

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "daily-checkin".
 *
 * t260 API-backed daily check-in (GET api/rewards/checkin status — streak hero, the server's own 7-day ladder grid, ledger; POST claim with the verbatim 201/409/429 texts). The body is a thin delegation to the shared
 * screen (pageId-keyed so it keeps its own ViewModel) — the REAL wire
 * calls live there, honest empty/401 handling included. The meta object
 * above and the NativePageRegistry composable signature are unchanged
 * (AddressBookScreen thin-delegate pattern, t253).
 */

/**
 * Delegation only — the shared screen owns the rendering and the wire
 * calls; this file keeps the registry-facing signature (the aliased import
 * is what makes the delegation land on ui/rewards, not on a same-named
 * composable here).
 */
@Composable
fun DailyCheckinScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCheckinScreen(pageId = "daily-checkin", onBack = onBack, openPage = openPage, query = query)
}
