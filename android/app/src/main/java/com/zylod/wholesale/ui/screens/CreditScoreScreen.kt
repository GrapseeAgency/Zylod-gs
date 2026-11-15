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
    override val summary = "Credit Rating Evaluation Factors"
    override val tabHint = ""
    override val bullets = listOf(
        "No trade credit score is available for your account yet.",
        "Could not load your trade credit score (HTTP ).",
        "Network error while loading your trade credit score. Check your connection and retry.",
        "Your session has ended. Sign in again to view your trade credit score.",
        "Your credit score is computed from your real repayment and order history. Sign in to continue.",
    )
    override val related = listOf(
        NativePageLink("credit-limit", "Credit Limit"),
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
