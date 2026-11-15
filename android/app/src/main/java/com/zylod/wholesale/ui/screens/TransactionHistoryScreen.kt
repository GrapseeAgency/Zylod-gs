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
    override val summary = "Try adjusting your search or category filter."
    override val tabHint = ""
    override val bullets = listOf(
        "Search by transaction reference or keyword...",
    )
    override val related = listOf(
        NativePageLink("transaction-detail", "Transaction Detail"),
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
