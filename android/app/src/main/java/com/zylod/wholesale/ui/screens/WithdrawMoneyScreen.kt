package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.WithdrawScreen as SharedWithdrawScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "withdraw-money"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t258 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation (shared with "withdraw", one supplier
 * payout rail, pageId-keyed ViewModels). The body is a thin delegation to
 * the shared withdraw screen (pageId-keyed so it keeps its own ViewModel)
 * — the REAL GET/POST api/wallet/withdraw rail: the honest balance /
 * onHold / available split, the payout ledger with status chips, the
 * request form with the verbatim 400/403/404 surfaces, and the supplier
 * gate for a buyer session (never zero-shaped balance data). The meta
 * object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object WithdrawMoneyPageMeta : NativePageMeta() {
    override val pageId = "withdraw-money"
    override val title = "Withdraw Money"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Withdraw Money — a Zylod marketplace surface. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the withdraw-money pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("home", "Home"),
        NativePageLink("category-browser", "Category Browser"),
        NativePageLink("help-center", "Help Center"),
    )
}

/**
 * Delegation only — the shared [SharedWithdrawScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun WithdrawMoneyScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedWithdrawScreen(pageId = "withdraw-money", onBack = onBack, openPage = openPage, query = query)
}
