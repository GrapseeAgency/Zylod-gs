package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.returns.RefundStatusScreen as TypedRefundStatusScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "refund-status".
 *
 * t305 — the t281 WebScreen forward is RETIRED: this pageId is now owned by
 * the typed ui/returns implementation (GET api/returns). The body is a thin
 * delegation — the REAL wire the web page renders, with the same honesty
 * contract. The meta keeps its registry identity; the registry signature is
 * unchanged.
 */
data object RefundStatusPageMeta : NativePageMeta() {{
    override val pageId = "refund-status"
    override val title = "Refund Status"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Refund Status — GET api/returns/[id]: the real return request, the real refunds[] ledger (money that actually moved), the real seller receipts and a timeline DERIVED from those fields — never a fabricated Bank Processing step. The refund-detail pageId aliases this page."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — GET api/returns, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the refund-status pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("return-detail", "Return Details"),
        NativePageLink("buyer-orders", "My Orders"),
        NativePageLink("order-detail", "Order Detail"),
    )
}}

/** Delegation only — the shared typed screen owns the rendering and the wire. */
@Composable
fun RefundStatusScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {{
    com.zylod.wholesale.ui.returns.RefundStatusScreen(onBack = onBack, openPage = openPage, query = query)
}}
