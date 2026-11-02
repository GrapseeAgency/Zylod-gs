package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.suppliercore.SupplierAgreementScreen as SharedSupplierAgreementScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "supplier-agreement"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/suppliers?limit=20 through NativePageRepository, cached on-device for offline.
"Supplier Agreement — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
 *
 * t269 — static curated content ported 1:1 from the web page
 * (src/components/pages/community-guidelines-page.tsx) — no network, honest
 * by construction. The NativePageBody rendering is GONE: this pageId is now
 * owned by the typed ui/suppliercore implementation and the body is a thin
 * delegation to the shared supplier-agreement screen (code-of-conduct
 * intro, five B2B guideline cards, prohibited-items link row, DNCRP
 * footnote). The meta object below and the NativePageRegistry composable
 * signature are unchanged.
 */
data object SupplierAgreementPageMeta : NativePageMeta() {
    override val pageId = "supplier-agreement"
    override val title = "Supplier Agreement"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/suppliers?limit=20"
    override val summary = "Supplier Agreement — the seller and supplier toolchain on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the supplier-agreement pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("seller-dashboard", "Seller Dashboard"),
        NativePageLink("supplier-center", "Supplier Center"),
        NativePageLink("product-upload", "Product Upload"),
    )
}

/**
 * Delegation only — the shared [SharedSupplierAgreementScreen] owns the
 * rendering (static curated code of conduct, no network); this file keeps
 * the registry-facing signature (the aliased import is what makes the
 * delegation land on ui/suppliercore, not on this file's own same-named
 * composable).
 */
@Composable
fun SupplierAgreementScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSupplierAgreementScreen(pageId = "supplier-agreement", onBack = onBack, openPage = openPage, query = query)
}
