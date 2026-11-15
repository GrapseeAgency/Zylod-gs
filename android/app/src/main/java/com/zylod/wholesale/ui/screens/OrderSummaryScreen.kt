package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.checkout.CheckoutScreen as TypedOrderSummaryScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "order-summary".
 *
 * t304 — the t281 WebScreen forward is RETIRED: this pageId is now owned by
 * the typed implementation. The body is a thin delegation — the REAL wire
 * the web page renders, with the same honesty contract. The meta keeps its
 * registry identity; the NativePageRegistry composable signature is unchanged.
 */
data object OrderSummaryPageMeta : NativePageMeta() {{
    override val pageId = "order-summary"
    override val title = "Order Summary"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Order Summary — the typed CheckoutScreen keyed to this pageId: the same addresses + delivery options + place-order rail the checkout page renders (POST api/orders re-prices everything server-side)."
    override val tabHint = "cart"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the order-summary pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("checkout", "Checkout"),
        NativePageLink("cart", "Cart"),
        NativePageLink("delivery-method", "Delivery Methods"),
    )
}}

/** Delegation only — the shared typed screen owns the rendering and the wire. */
@Composable
fun OrderSummaryScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {{
    com.zylod.wholesale.ui.checkout.CheckoutScreen(pageId = "order-summary", onBack = onBack, openPage = openPage, query = query)
}}
