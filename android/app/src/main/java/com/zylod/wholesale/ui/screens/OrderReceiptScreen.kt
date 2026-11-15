package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.orderdetail.OrderReceiptScreen as TypedOrderReceiptScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "order-receipt".
 *
 * t304 — the t281 WebScreen forward is RETIRED: this pageId is now owned by
 * the typed implementation. The body is a thin delegation — the REAL wire
 * the web page renders, with the same honesty contract. The meta keeps its
 * registry identity; the NativePageRegistry composable signature is unchanged.
 */
data object OrderReceiptPageMeta : NativePageMeta() {
    override val pageId = "order-receipt"
    override val title = "Order Receipt"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Order Receipt — GET api/orders/[orderId]/receipt: the money-moved snapshot with real items, totals, payment method and shipping address. Never hardcoded rows."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the order-receipt pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("order-detail", "Order Detail"),
        NativePageLink("buyer-orders", "My Orders"),
        NativePageLink("order-timeline", "Order Timeline"),
    )
}

/** Delegation only — the shared typed screen owns the rendering and the wire. */
@Composable
fun OrderReceiptScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    com.zylod.wholesale.ui.orderdetail.OrderReceiptScreen(onBack = onBack, openPage = openPage, query = query)
}
