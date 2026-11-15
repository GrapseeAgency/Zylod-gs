package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.returns.RefundStatusScreen as TypedRefundDetailScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "refund-detail".
 *
 * t305 — the t281 WebScreen forward is RETIRED: this pageId is now owned by
 * the typed ui/returns implementation (GET api/returns). The body is a thin
 * delegation — the REAL wire the web page renders, with the same honesty
 * contract. The meta keeps its registry identity; the registry signature is
 * unchanged.
 */
data object RefundDetailPageMeta : NativePageMeta() {
    override val pageId = "refund-detail"
    override val title = "Refund Detail"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Refund Detail — the honest alias of the refund status page: GET api/returns/[id] with the real refunds ledger and receipts. The old hardcoded credit-note page is gone on the web; the native row never brings it back."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — GET api/returns, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the refund-detail pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("refund-status", "Refund Status"),
        NativePageLink("buyer-orders", "My Orders"),
        NativePageLink("return-detail", "Return Details"),
    )
}

/** Delegation only — the shared typed screen owns the rendering and the wire. */
@Composable
fun RefundDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    com.zylod.wholesale.ui.returns.RefundStatusScreen(onBack = onBack, openPage = openPage, query = query)
}
