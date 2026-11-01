package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.suppliercore.SupplierOrdersScreen as SharedSupplierOrdersScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "supplier-orders"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/suppliers?limit=20 through NativePageRepository, cached on-device for offline.
"Supplier Orders — order, shipping and delivery operations for Zylod buyers. Content streams live from the Zylod API and renders through the shared native page model."
 *
 * t267 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/suppliercore implementation. The body is a thin delegation to
 * the shared supplier-orders screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL GET api/supplier/orders book: the stats strip, the
 * status chips and one card per subOrder. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object SupplierOrdersPageMeta : NativePageMeta() {
    override val pageId = "supplier-orders"
    override val title = "Supplier Orders"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/suppliers?limit=20"
    override val summary = "Supplier Orders — order, shipping and delivery operations for Zylod buyers. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the supplier-orders pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedSupplierOrdersScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/suppliercore, not on this file's own same-named composable).
 */
@Composable
fun SupplierOrdersScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSupplierOrdersScreen(pageId = "supplier-orders", onBack = onBack, openPage = openPage, query = query)
}
