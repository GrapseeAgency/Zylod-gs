package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.logistics.TrackOrderScreen as SharedTrackOrderScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "order-tracking"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t252 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/logistics implementation. The body is a thin delegation to the
 * shared order-tracking screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL GET api/orders/{orderId} payload with the derived
 * badge/stage progress rail, per-shipment rows, the tracking timeline, the
 * offline snapshot cache and the honest sign-in gate. The meta object below
 * and the NativePageRegistry composable signature are unchanged.
 */
data object OrderTrackingPageMeta : NativePageMeta() {
    override val pageId = "order-tracking"
    override val title = "Order Tracking"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.ORDERS
    override val endpoint: String? = "api/orders/my-orders"
    override val summary = "Order Tracking — order, shipping and delivery operations for Zylod buyers. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the order-tracking pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedTrackOrderScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/logistics, not on
 * a same-named local composable).
 */
@Composable
fun OrderTrackingScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedTrackOrderScreen(pageId = "order-tracking", onBack = onBack, openPage = openPage, query = query)
}
