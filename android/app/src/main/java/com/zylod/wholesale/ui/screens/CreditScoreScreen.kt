package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.CreditScoreScreen as SharedCreditScoreScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "credit-score"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared credit-score screen (pageId-keyed so it keeps its own ViewModel)
 * — the REAL GET api/credits/score rating (score dial toward the server's
 * maxScore 850, tier, risk rating, repayment %, trade history, utilization
 * and the 4 color-coded factor rows). The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object CreditScorePageMeta : NativePageMeta() {
    override val pageId = "credit-score"
    override val title = "Credit Score"
    override val category = "Dashboards & Analytics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Credit Score — operational dashboards and analytics surfaces. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the credit-score pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("dashboard", "Dashboard"),
        NativePageLink("analytics-dashboard", "Analytics Dashboard"),
        NativePageLink("store-analytics", "Store Analytics"),
    )
}

/**
 * Delegation only — the shared [SharedCreditScoreScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun CreditScoreScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCreditScoreScreen(pageId = "credit-score", onBack = onBack, openPage = openPage, query = query)
}
