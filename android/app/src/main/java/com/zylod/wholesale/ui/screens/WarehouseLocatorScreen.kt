package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.logistics.WarehouseLocatorScreen as SharedWarehouseLocatorScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "warehouse-locator"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t252 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/logistics implementation. The body is a thin delegation to the
 * shared warehouse directory (pageId-keyed so it keeps its own ViewModel)
 * — the REAL PUBLIC api/warehouses rows with the debounced q= search, the
 * district chips, the VERIFIED accents, the honest empty state and the
 * offline directory cache. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object WarehouseLocatorPageMeta : NativePageMeta() {
    override val pageId = "warehouse-locator"
    override val title = "Warehouse Locator"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Warehouse Locator — order, shipping and delivery operations for Zylod buyers. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the warehouse-locator pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedWarehouseLocatorScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/logistics, not on this file's own same-named composable).
 */
@Composable
fun WarehouseLocatorScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedWarehouseLocatorScreen(pageId = "warehouse-locator", onBack = onBack, openPage = openPage, query = query)
}
