package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.CreditLimitScreen as SharedCreditLimitScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "buyer-credit"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * SHARED trade-credit screen under the "buyer-credit" pageId (pageId-keyed
 * so it keeps its OWN ViewModel, the TrackOrderViewModel convention — the
 * same GET api/credits/limit + POST request flow as credit-limit, its own
 * instance). The meta object below and the NativePageRegistry composable
 * signature are unchanged.
 */
data object BuyerCreditPageMeta : NativePageMeta() {
    override val pageId = "buyer-credit"
    override val title = "Buyer Credit"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Terms &amp; Settlement SLA"
    override val tabHint = ""
    override val bullets = listOf(
        "Request Credit Limit Increase",
    )
    override val related = listOf(
        NativePageLink("credit-score", "Credit Score"),
    )
}

/**
 * Delegation only — the shared [SharedCreditLimitScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun BuyerCreditScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCreditLimitScreen(pageId = "buyer-credit", onBack = onBack, openPage = openPage, query = query)
}
