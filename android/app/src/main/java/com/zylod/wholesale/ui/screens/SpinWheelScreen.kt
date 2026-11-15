package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.rewards.SpinScreen as SharedSpinScreen

data object SpinWheelPageMeta : NativePageMeta() {
    override val pageId = "spin-wheel"
    override val title = "Spin Wheel"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Every score is earned against the server — questions are graded, sequences are dealt, crates are sealed before you open them. Points redeem for real order discounts."
    override val tabHint = ""
    override val bullets = listOf(
        "Gamified Rewards",
        "Real Games, Real Grading, Real Points",
        "B2B Wholesale Master Quiz",
        "Factory Cargo Matcher",
        "Available Games",
    )
    override val related = listOf(
        NativePageLink("game-history", "Game History"),
    )
}

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "spin-wheel".
 *
 * t260 API-backed lucky wheel (GET api/rewards/spin-history status + POST api/rewards/spin — the server's real prize verbatim, no fake animation, verbatim daily-cap 429). The body is a thin delegation to the shared
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
fun SpinWheelScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSpinScreen(pageId = "spin-wheel", onBack = onBack, openPage = openPage, query = query)
}
