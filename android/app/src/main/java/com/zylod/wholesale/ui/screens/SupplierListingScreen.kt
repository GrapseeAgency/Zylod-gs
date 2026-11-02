package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.suppliercore.SupplierListingScreen as SharedSupplierListingScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "supplier-listing"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/suppliers?limit=20 through NativePageRepository, cached on-device for offline.
"Supplier Listing — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
 *
 * t269 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/suppliercore implementation. The body is a thin delegation to
 * the shared supplier-listing screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL public book: GET api/suppliers/{id} profile card +
 * GET api/products?supplierId= paginated listings, supplierId parsed from
 * the query (supplierId= || id=, web parity) with a supplier-keyed offline
 * cache. The meta object below and the NativePageRegistry composable
 * signature are unchanged.
 */
data object SupplierListingPageMeta : NativePageMeta() {
    override val pageId = "supplier-listing"
    override val title = "Supplier Listing"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/suppliers?limit=20"
    override val summary = "Supplier Listing — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the supplier-listing pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("seller-dashboard", "Seller Dashboard"),
        NativePageLink("supplier-center", "Supplier Center"),
        NativePageLink("product-upload", "Product Upload"),
    )
}

/**
 * Delegation only — the shared [SharedSupplierListingScreen] owns the
 * rendering and the wire calls (GET api/suppliers/{id} + GET
 * api/products?supplierId=); this file keeps the registry-facing signature
 * and FORWARDS the query (the supplierId rides inside it — the shared
 * screen parses it). The aliased import is what makes the delegation land
 * on ui/suppliercore, not on this file's own same-named composable.
 */
@Composable
fun SupplierListingScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSupplierListingScreen(pageId = "supplier-listing", onBack = onBack, openPage = openPage, query = query)
}
