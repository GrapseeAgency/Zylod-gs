package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.sellerops.SellerVerificationStatusScreen as SharedSellerVerificationStatusScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "supplier-verification-status"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/suppliers?limit=20 through NativePageRepository, cached on-device for offline.
"Supplier Verification Status — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
 *
 * t267 — the curated-metadata body is GONE: this pageId now rides the SAME
 * typed ui/sellerops implementation as its t266 seller twin
 * ("seller-verification-status") — both pageIds sit on GET api/supplier/
 * verification, so the body is a thin delegation to the shared
 * verification-status screen (pageId-keyed so each page keeps its own
 * ViewModel). The meta object below and the NativePageRegistry composable
 * signature are unchanged.
 */
data object SupplierVerificationStatusPageMeta : NativePageMeta() {
    override val pageId = "supplier-verification-status"
    override val title = "Supplier Verification Status"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/suppliers?limit=20"
    override val summary = "Supplier Verification Status — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the supplier-verification-status pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("seller-dashboard", "Seller Dashboard"),
        NativePageLink("supplier-center", "Supplier Center"),
        NativePageLink("product-upload", "Product Upload"),
    )
}

/**
 * Delegation only — the shared [SharedSellerVerificationStatusScreen] owns
 * the rendering and the wire calls (GET api/supplier/verification); this
 * file keeps the registry-facing signature (the aliased import is what
 * makes the delegation land on ui/sellerops, not on this file's own
 * same-named composable).
 */
@Composable
fun SupplierVerificationStatusScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSellerVerificationStatusScreen(pageId = "supplier-verification-status", onBack = onBack, openPage = openPage, query = query)
}
