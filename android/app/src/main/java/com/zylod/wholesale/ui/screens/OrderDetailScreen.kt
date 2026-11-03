package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.orderdetail.OrderDetailScreen as TypedOrderDetailScreen
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "order-detail"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t274 — the shared page-model stub renderer (NativePageBody over
 * api/orders/my-orders rows) is REPLACED by the typed buyer order-detail
 * port of order-detail-page.tsx (ui/orderdetail/): the real status stepper,
 * per-supplier shipments with line items + tracking timelines, the payment
 * summary with the manual-payment leg, self-service cancellation and the
 * receipt — against the full GET api/orders/{id} projection. The meta
 * object stays the registry's identity anchor.
 */
data object OrderDetailPageMeta : NativePageMeta() {
    override val pageId = "order-detail"
    override val title = "Order Detail"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.ORDERS
    override val endpoint: String? = null
    override val summary = "Order Detail — the buyer's real order: shipments, line items, tracking timeline, payment summary and the self-service cancel / manual-payment legs."
    override val tabHint = ""
    override val bullets = listOf(
        "Typed screen: GET api/orders/{id} renders the real order — items, payments, tracking.",
        "Submit payment, cancel pending shipments and open the receipt — the honest money legs.",
        "Native ownership: this Kotlin screen owns the order-detail pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * t274 thin delegate — the registry entry keeps its signature
 * (onBack/openPage/query) and the typed screen resolves the order from the
 * query itself (orderIdFromQuery: "orderId=x", an "id=x" pair, or a bare
 * token — zylod://orders/<id> parity).
 */
@Composable
fun OrderDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedOrderDetailScreen(onBack = onBack, openPage = openPage, query = query)
}
