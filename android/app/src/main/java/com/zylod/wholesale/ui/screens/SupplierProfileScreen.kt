package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.suppliercore.SupplierProfileScreen as SharedSupplierProfileScreen
import com.zylod.wholesale.ui.web.WebScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "supplier-profile"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/suppliers?limit=20 through NativePageRepository, cached on-device for offline.
"Supplier Profile — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
 *
 * t268 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/suppliercore implementation. The body is a thin delegation to
 * the shared supplier-profile screen (pageId-keyed so it keeps its own
 * ViewModel) — the PROFILE LENS on the REAL GET api/supplier/dashboard
 * payload (the t267 shared-endpoint two-lens design): identity card,
 * product performance, customer insights and store stats. The meta object
 * below and the NativePageRegistry composable signature are unchanged.
 */
data object SupplierProfilePageMeta : NativePageMeta() {
    override val pageId = "supplier-profile"
    override val title = "Supplier Profile"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/suppliers?limit=20"
    override val summary = "Supplier Profile — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the supplier-profile pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("seller-dashboard", "Seller Dashboard"),
        NativePageLink("supplier-center", "Supplier Center"),
        NativePageLink("product-upload", "Product Upload"),
    )
}

/**
 * Delegation only — the shared [SharedSupplierProfileScreen] owns the
 * rendering and the wire calls (GET api/supplier/dashboard, profile lens);
 * this file keeps the registry-facing signature (the aliased import is
 * what makes the delegation land on ui/suppliercore, not on this file's
 * own same-named composable).
 */
@Composable
fun SupplierProfileScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    // t280 4-b#3: a supplierId param means PUBLIC profile — PDP "Visit Store"
    // (ProductDetailScreen, supplierId=<id>) and favorite-supplier taps. The
    // typed screen is the signed-in supplier's OWN profile lens (it gates
    // buyers); the SPA's seller-storefront page (which web maps this pageId
    // to) renders ANY supplier's public store from the param. No param → the
    // typed own-profile (the seller-session captures ride this branch).
    if (hasSupplierParam(query)) {
        WebScreen(pageId = "supplier-profile", query = query)
        return
    }
    SharedSupplierProfileScreen(pageId = "supplier-profile", onBack = onBack, openPage = openPage, query = query)
}

/** t280 4-b#3 — true when the navigation targets a SPECIFIC supplier. */
private fun hasSupplierParam(query: String): Boolean =
    query.split('&').any { pair ->
        val name = pair.substringBefore('=')
        name == "supplierId" || name == "supplier" || name == "supplierUserId" || name == "id"
    }
