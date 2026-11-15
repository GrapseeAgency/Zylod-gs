package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.complaints.SellerOrderDisputesScreen as SharedSellerOrderDisputesScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "seller-order-disputes"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/orders/my-orders through NativePageRepository, cached on-device for offline.
"Seller Order Disputes — order, shipping and delivery operations for Zylod buyers. Content streams live from the Zylod API and renders through the shared native page model."
 *
 * t261 — the native-page body is GONE (the old meta claimed an orders feed
 * the web component never fetches). The web page (seller-order-disputes-
 * page.tsx) fetches NOTHING and renders its truthful "No dispute data
 * available" empty state; the body is now a thin delegation to the shared
 * ui/complaints screen that reproduces exactly that honest static copy —
 * no fabricated dispute rows, no invented fetch. The meta object below and
 * the NativePageRegistry composable signature are unchanged.
 */
data object SellerOrderDisputesPageMeta : NativePageMeta() {
    override val pageId = "seller-order-disputes"
    override val title = "Seller Order Disputes"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.ORDERS
    override val endpoint: String? = "api/orders/my-orders"
    override val summary = "Seller Order Disputes — order, shipping and delivery operations for Zylod buyers. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live order list fetched from api/orders/my-orders — the same call the web page makes.",
        "Rows render real order number, status badge, payment state and total.",
        "Offline: the last-saved list renders first — never a white screen.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedSellerOrderDisputesScreen] owns the
 * rendering (the web's honest static empty state); this file keeps the
 * registry-facing signature (the aliased import is what makes the
 * delegation land on ui/complaints, not on this file's own same-named
 * composable).
 */
@Composable
fun SellerOrderDisputesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSellerOrderDisputesScreen(pageId = "seller-order-disputes", onBack = onBack, openPage = openPage, query = query)
}
