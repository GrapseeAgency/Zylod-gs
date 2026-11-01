package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.suppliercore.SupplierDirectoryScreen as SharedSupplierDirectoryScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "suppliers"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/suppliers?limit=20 through NativePageRepository, cached on-device for offline.
"Suppliers — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
 *
 * t267 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/suppliercore implementation. The body is a thin delegation to
 * the shared suppliers directory screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL PUBLIC GET api/suppliers book: the pagination
 * stats strip, the sort chips, one card per supplier and the Prev/Next
 * row. The meta object below and the NativePageRegistry composable
 * signature are unchanged.
 */
data object SuppliersPageMeta : NativePageMeta() {
    override val pageId = "suppliers"
    override val title = "Suppliers"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/suppliers?limit=20"
    override val summary = "Suppliers — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the suppliers pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("seller-dashboard", "Seller Dashboard"),
        NativePageLink("supplier-center", "Supplier Center"),
        NativePageLink("product-upload", "Product Upload"),
    )
}

/**
 * Delegation only — the shared [SharedSupplierDirectoryScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/suppliercore, not on this file's own same-named composable).
 */
@Composable
fun SuppliersScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSupplierDirectoryScreen(pageId = "suppliers", onBack = onBack, openPage = openPage, query = query)
}
