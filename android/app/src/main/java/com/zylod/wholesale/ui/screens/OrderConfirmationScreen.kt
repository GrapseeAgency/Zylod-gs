package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.checkout.CheckoutSuccessScreen as TypedOrderConfirmationScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "order-confirmation".
 *
 * t304 — the t281 WebScreen forward is RETIRED: this pageId is now owned by
 * the typed implementation. The body is a thin delegation — the REAL wire
 * the web page renders, with the same honesty contract. The meta keeps its
 * registry identity; the NativePageRegistry composable signature is unchanged.
 */
data object OrderConfirmationPageMeta : NativePageMeta() {{
    override val pageId = "order-confirmation"
    override val title = "Order Confirmation"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Order Confirmation — the typed CheckoutSuccessScreen keyed to this pageId: the real order (GET api/orders/[id]) rendered as the Order Received view — real items, totals and honest payment state."
    override val tabHint = "cart"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the order-confirmation pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("checkout-success", "Checkout Success"),
        NativePageLink("buyer-orders", "My Orders"),
        NativePageLink("order-detail", "Order Detail"),
    )
}}

/** Delegation only — the shared typed screen owns the rendering and the wire. */
@Composable
fun OrderConfirmationScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {{
    com.zylod.wholesale.ui.checkout.CheckoutSuccessScreen(pageId = "order-confirmation", onBack = onBack, openPage = openPage, query = query)
}}
