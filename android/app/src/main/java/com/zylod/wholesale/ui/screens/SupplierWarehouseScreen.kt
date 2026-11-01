package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.suppliercore.SupplierWarehouseScreen as SharedSupplierWarehouseScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "supplier-warehouse"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/suppliers?limit=20 through NativePageRepository, cached on-device for offline.
"Supplier Warehouse — order, shipping and delivery operations for Zylod buyers. Content streams live from the Zylod API and renders through the shared native page model."
 *
 * t267 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/suppliercore implementation. The body is a thin delegation to
 * the shared supplier-warehouse screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL GET api/supplier/warehouses book: the stats strip
 * and one card per warehouseLocations row. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object SupplierWarehousePageMeta : NativePageMeta() {
    override val pageId = "supplier-warehouse"
    override val title = "Supplier Warehouse"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/suppliers?limit=20"
    override val summary = "Supplier Warehouse — order, shipping and delivery operations for Zylod buyers. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the supplier-warehouse pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedSupplierWarehouseScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/suppliercore, not on this file's own same-named composable).
 */
@Composable
fun SupplierWarehouseScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSupplierWarehouseScreen(pageId = "supplier-warehouse", onBack = onBack, openPage = openPage, query = query)
}
