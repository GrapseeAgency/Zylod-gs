package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.suppliercore.SupplierQueriesScreen as SharedSupplierQueriesScreen

/**
 * t268 — NATIVE Kotlin screen for the SPA pageId "supplier-queries" — the
 * registry-facing shell of the typed ui/suppliercore implementation (the
 * page keeps its own SupplierQueriesViewModel behind the shared screen's
 * pageId key).
 *
 * t268 — the REAL GET api/supplier/queries book: the derived stats strip,
 * the status filter chips (the schema's exact open | replied | resolved |
 * closed tokens) and one card per buyer query with the supplier's reply.
 *
 * REACHABILITY NOTE (honest): "supplier-queries" is not a row in
 * NativePageRegistry yet — t268 is directed to stay OUT of that file, and
 * this pid is not a src/lib/page-loader.ts id either. Until the registry
 * grows the row, RouteOwnership resolves the id through its last-resort
 * WebView path; the typed screen above is complete and wired the moment
 * the row lands.
 */
data object SupplierQueriesPageMeta : NativePageMeta() {
    override val pageId = "supplier-queries"
    override val title = "Supplier Queries"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.SUPPLIERS
    override val endpoint: String? = "api/supplier/queries"
    override val summary = "Supplier Queries — the buyer question inbox for your supplier account. Buyer questions on your products stream from the Zylod API through the typed shared screen this page delegates to."
    override val tabHint = ""
    override val bullets = listOf(
        "Typed screen: renders the REAL GET api/supplier/queries rows — never fabricated data.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Registry row pending: this pid resolves natively once NativePageRegistry grows the row.",
    )
    override val related = listOf(
        NativePageLink("supplier-orders", "Supplier Orders"),
        NativePageLink("supplier-center", "Supplier Center"),
        NativePageLink("seller-dashboard", "Seller Dashboard"),
    )
}

/**
 * Delegation only — the shared [SharedSupplierQueriesScreen] owns the
 * rendering and the wire calls (GET api/supplier/queries); this file keeps
 * the registry-facing signature (the aliased import is what makes the
 * delegation land on ui/suppliercore, not on this file's own same-named
 * composable).
 */
@Composable
fun SupplierQueriesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSupplierQueriesScreen(pageId = "supplier-queries", onBack = onBack, openPage = openPage, query = query)
}
