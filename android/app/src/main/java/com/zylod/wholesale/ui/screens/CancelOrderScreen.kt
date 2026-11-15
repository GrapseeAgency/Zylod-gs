package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.orderdetail.CancelOrderScreen as TypedCancelOrderScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "cancel-order".
 *
 * t304 — the t281 WebScreen forward is RETIRED: this pageId is now owned by
 * the typed implementation. The body is a thin delegation — the REAL wire
 * the web page renders, with the same honesty contract. The meta keeps its
 * registry identity; the NativePageRegistry composable signature is unchanged.
 */
data object CancelOrderPageMeta : NativePageMeta() {{
    override val pageId = "cancel-order"
    override val title = "Cancel Order"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Cancel Order — GET api/orders/[id] fills the real items; submission POSTs api/orders/[id]/cancel with the selected real shipment ids; 409s render the server's verbatim guard, never a fake success."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the cancel-order pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("order-detail", "Order Detail"),
        NativePageLink("buyer-orders", "My Orders"),
        NativePageLink("return-request", "Return Request"),
    )
}}

/** Delegation only — the shared typed screen owns the rendering and the wire. */
@Composable
fun CancelOrderScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {{
    com.zylod.wholesale.ui.orderdetail.CancelOrderScreen(onBack = onBack, openPage = openPage, query = query)
}}
