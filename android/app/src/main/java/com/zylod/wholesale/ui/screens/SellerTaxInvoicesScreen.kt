package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.InvoicesScreen as SharedInvoicesScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "seller-tax-invoices"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * SHARED commercial-invoices screen ("Tax Invoices" flavor — the web page
 * consumes the SAME GET api/invoices list; one shared screen for invoice /
 * invoice-management / seller-tax-invoices, pageId-keyed so each keeps its
 * own ViewModel). The meta object below and the NativePageRegistry
 * composable signature are unchanged.
 */
data object SellerTaxInvoicesPageMeta : NativePageMeta() {
    override val pageId = "seller-tax-invoices"
    override val title = "Seller Tax Invoices"
    override val category = "Search & Navigation"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Seller Tax Invoices — find anything across the Zylod wholesale marketplace. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the seller-tax-invoices pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("search-results", "Search Results"),
        NativePageLink("category-browser", "Category Browser"),
        NativePageLink("all-products", "All Products"),
    )
}

/**
 * Delegation only — the shared [SharedInvoicesScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun SellerTaxInvoicesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedInvoicesScreen(pageId = "seller-tax-invoices", onBack = onBack, openPage = openPage, query = query)
}
