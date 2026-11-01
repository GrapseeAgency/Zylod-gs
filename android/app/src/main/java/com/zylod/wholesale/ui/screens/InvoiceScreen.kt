package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.InvoicesScreen as SharedInvoicesScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "invoice"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * SHARED commercial-invoices screen under the "invoice" pageId (one shared
 * screen for invoice / invoice-management / seller-tax-invoices, pageId-
 * keyed so each keeps its own ViewModel) — the REAL GET api/invoices list
 * with the paymentStatus chips and the Mushak 6.3 document dialog. The
 * meta object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object InvoicePageMeta : NativePageMeta() {
    override val pageId = "invoice"
    override val title = "Invoice"
    override val category = "Search & Navigation"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Invoice — find anything across the Zylod wholesale marketplace. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the invoice pageId via RouteOwnership.",
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
fun InvoiceScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedInvoicesScreen(pageId = "invoice", onBack = onBack, openPage = openPage, query = query)
}
