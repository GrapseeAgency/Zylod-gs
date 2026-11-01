package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.rewards.SpinScreen as SharedSpinScreen

data object SpinWinPageMeta : NativePageMeta() {
    override val pageId = "spin-win"
    override val title = "Spin Win"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Spin Win — promotions, rewards and membership programs on Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the spin-win pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("coupons", "Coupons"),
        NativePageLink("vip-club", "VIP Club"),
        NativePageLink("referral-program", "Referral Program"),
    )
}

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "spin-win".
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
fun SpinWinScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSpinScreen(pageId = "spin-win", onBack = onBack, openPage = openPage, query = query)
}
