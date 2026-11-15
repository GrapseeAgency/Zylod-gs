package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.returns.ReturnDetailScreen as TypedReturnDetailScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "return-detail".
 *
 * t305 — the t281 WebScreen forward is RETIRED: this pageId is now owned by
 * the typed ui/returns implementation (GET api/returns). The body is a thin
 * delegation — the REAL wire the web page renders, with the same honesty
 * contract. The meta keeps its registry identity; the registry signature is
 * unchanged.
 */
data object ReturnDetailPageMeta : NativePageMeta() {{
    override val pageId = "return-detail"
    override val title = "Return Details"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Return Details — GET api/returns?orderId=<orderId>: the order's real return requests with their items and reasons; a returnId/returnNumber query narrows to one. Honest no-return-selected and no-returns states."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — GET api/returns, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the return-detail pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("refund-status", "Refund Status"),
        NativePageLink("return-request", "Return Request"),
        NativePageLink("buyer-orders", "My Orders"),
    )
}}

/** Delegation only — the shared typed screen owns the rendering and the wire. */
@Composable
fun ReturnDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {{
    com.zylod.wholesale.ui.returns.ReturnDetailScreen(onBack = onBack, openPage = openPage, query = query)
}}
