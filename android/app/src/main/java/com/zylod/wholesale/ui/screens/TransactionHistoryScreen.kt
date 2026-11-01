package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.WalletTransactionsScreen as SharedWalletTransactionsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "transaction-history"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t256 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared wallet-transactions screen (pageId-keyed so it keeps its own
 * WalletTransactionsViewModel) — the REAL paged GET api/wallet/transactions
 * history through the EXISTING WalletApi (type chips on the route's exact
 * wire values, signed+formatted amounts, load-more, detail jumps). The
 * meta object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object TransactionHistoryPageMeta : NativePageMeta() {
    override val pageId = "transaction-history"
    override val title = "Transaction History"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Transaction History — a Zylod marketplace surface. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the transaction-history pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("home", "Home"),
        NativePageLink("category-browser", "Category Browser"),
        NativePageLink("help-center", "Help Center"),
    )
}

/**
 * Delegation only — the shared [SharedWalletTransactionsScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/finance, not on this file's own same-named composable).
 */
@Composable
fun TransactionHistoryScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedWalletTransactionsScreen(pageId = "transaction-history", onBack = onBack, openPage = openPage, query = query)
}
