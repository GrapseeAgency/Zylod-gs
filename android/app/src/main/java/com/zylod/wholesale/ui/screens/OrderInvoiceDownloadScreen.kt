package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.InvoiceDetailScreen as SharedInvoiceDetailScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "order-invoice-download"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. MIRROR NOTE: on the web this pageId is
 * an honest thin ALIAS of the order-invoice page (the old fake "1.2 MB
 * PDF" version was replaced by a delegation), so the body delegates to the
 * SAME shared invoice-detail screen (GET api/orders/{orderId}/invoice) under
 * the download pageId, which additionally renders the honest download label:
 * the web's Save PDF is a window.print() action — no real PDF endpoint
 * exists — so the build says so instead of pretending. The meta object
 * below and the NativePageRegistry composable signature are unchanged.
 */
data object OrderInvoiceDownloadPageMeta : NativePageMeta() {
    override val pageId = "order-invoice-download"
    override val title = "Order Invoice Download"
    override val category = "Search & Navigation"
    override val kind = NativePageKind.ORDERS
    override val endpoint: String? = "api/orders/my-orders"
    override val summary = "Order Invoice Download — find anything across the Zylod wholesale marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the order-invoice-download pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("search-results", "Search Results"),
        NativePageLink("category-browser", "Category Browser"),
        NativePageLink("all-products", "All Products"),
    )
}

/**
 * Delegation only — the shared [SharedInvoiceDetailScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/finance, not on this file's own same-named composable).
 */
@Composable
fun OrderInvoiceDownloadScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedInvoiceDetailScreen(pageId = "order-invoice-download", onBack = onBack, openPage = openPage, query = query)
}
