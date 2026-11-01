package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.InvoiceDetailScreen as SharedInvoiceDetailScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "order-invoice"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. ROUTE NOTE: the web order-invoice page
 * consumes GET api/orders/{orderId}/invoice — the purpose-built TAX INVOICE
 * document — NOT api/invoices/{id} (that is the Mushak 6.3 dialog document
 * on the invoice-management page). The body is a thin delegation to the
 * shared invoice-detail screen (pageId-keyed so it keeps its own
 * ViewModel), which fetches exactly that route with the query's orderId
 * and renders the server-computed sheet with the honest 401/403/404 guards.
 * The meta object below and the NativePageRegistry composable signature
 * are unchanged.
 */
data object OrderInvoicePageMeta : NativePageMeta() {
    override val pageId = "order-invoice"
    override val title = "Order Invoice"
    override val category = "Search & Navigation"
    override val kind = NativePageKind.ORDERS
    override val endpoint: String? = "api/orders/my-orders"
    override val summary = "Order Invoice — find anything across the Zylod wholesale marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the order-invoice pageId via RouteOwnership.",
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
fun OrderInvoiceScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedInvoiceDetailScreen(pageId = "order-invoice", onBack = onBack, openPage = openPage, query = query)
}
