package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.suppliercore.SupplierRegisterScreen as SharedSupplierRegisterScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "supplier-resources"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/suppliers?limit=20 through NativePageRepository, cached on-device for offline.
"Supplier Resources — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
 */
data object SupplierResourcesPageMeta : NativePageMeta() {
    override val pageId = "supplier-resources"
    override val title = "Supplier Resources"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/suppliers?limit=20"
    override val summary = "Supplier Resources — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the supplier-resources pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("seller-dashboard", "Seller Dashboard"),
        NativePageLink("supplier-center", "Supplier Center"),
        NativePageLink("product-upload", "Product Upload"),
    )
}

/**
 * t270 — curated body replaced by typed ui/suppliercore implementation; meta unchanged.
 *
 * Delegation only — the shared [SharedSupplierRegisterScreen] owns the
 * rendering: the 4-step supplier register wizard (company info, NID upload,
 * trade license & TIN, bank details) ported 1:1 from
 * src/components/pages/register-supplier-page.tsx, with the multipart
 * api/uploads/kyc document upload, the api/auth/register POST and the
 * SessionManager handoff into seller-verification. The web renders this
 * identical component for BOTH supplier-onboarding and supplier-resources,
 * so this delegate passes its own pageId literal and the shared screen
 * renders the same form. The aliased import is what makes the delegation
 * land on ui/suppliercore, not on this file's own same-named composable.
 */
@Composable
fun SupplierResourcesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSupplierRegisterScreen(pageId = "supplier-resources", onBack = onBack, openPage = openPage, query = query)
}
