package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.suppliercore.SupplierAddProductFormScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "supplier-add-product"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/suppliers?limit=20 through NativePageRepository, cached on-device for offline.
"Supplier Add Product — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
 */
data object SupplierAddProductPageMeta : NativePageMeta() {
    override val pageId = "supplier-add-product"
    override val title = "Supplier Add Product"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/suppliers?limit=20"
    override val summary = "Supplier Add Product — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the supplier-add-product pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("seller-dashboard", "Seller Dashboard"),
        NativePageLink("supplier-center", "Supplier Center"),
        NativePageLink("product-upload", "Product Upload"),
    )
}

/**
 * t271 — the curated shared-renderer body is GONE: this pageId is now owned
 * by the typed product-creation form. The body is a thin delegation to
 * [SupplierAddProductFormScreen] — the seller-add-product-page.tsx port
 * (AccountGate semantics, the live category picker fed by the public GET
 * api/categories, real multipart image uploads, tier/variant editors and
 * the canonical POST api/supplier/products). Its ViewModel is acquired
 * inside the shared screen under the fixed key "supplier-add-product-form".
 * The meta object above and the NativePageRegistry composable signature
 * (NativePageRegistry.kt) are unchanged.
 */
@Suppress("UNUSED_PARAMETER") // the form needs no deep-link query — accepted for the Registry contract
@Composable
fun SupplierAddProductScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SupplierAddProductFormScreen(onBack = onBack, openPage = openPage)
}
