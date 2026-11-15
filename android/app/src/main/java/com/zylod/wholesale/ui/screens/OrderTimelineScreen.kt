package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.orderdetail.OrderTimelineScreen as TypedOrderTimelineScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "order-timeline".
 *
 * t304 — the t281 WebScreen forward is RETIRED: this pageId is now owned by
 * the typed implementation. The body is a thin delegation — the REAL wire
 * the web page renders, with the same honesty contract. The meta keeps its
 * registry identity; the NativePageRegistry composable signature is unchanged.
 */
data object OrderTimelinePageMeta : NativePageMeta() {{
    override val pageId = "order-timeline"
    override val title = "Order Timeline"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Order Timeline — GET api/orders/[id] rendered as the tracking timeline: the real orderTracking rows (seller transitions + driver-GPS milestones) per shipment, newest first. Never fabricated events."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the order-timeline pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("order-detail", "Order Detail"),
        NativePageLink("track-order", "Track Order"),
        NativePageLink("buyer-orders", "My Orders"),
    )
}}

/** Delegation only — the shared typed screen owns the rendering and the wire. */
@Composable
fun OrderTimelineScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {{
    com.zylod.wholesale.ui.orderdetail.OrderTimelineScreen(onBack = onBack, openPage = openPage, query = query)
}}
