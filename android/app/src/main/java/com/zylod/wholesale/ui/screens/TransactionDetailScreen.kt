package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.TransactionDetailScreen as SharedTransactionDetailScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "transaction-detail"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t256 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared transaction-detail screen (pageId-keyed so it keeps its own
 * TransactionDetailViewModel) — the REAL GET api/wallet/transactions/{id}
 * detail through the EXISTING WalletApi (pinned "id=" query, signed
 * amount header, honest type/status/reference/method/fee/balance rows,
 * the 404 card and the per-id offline snapshot). The meta object below and
 * the NativePageRegistry composable signature are unchanged.
 */
data object TransactionDetailPageMeta : NativePageMeta() {
    override val pageId = "transaction-detail"
    override val title = "Transaction Detail"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Could not load this transaction. Please try again later."
    override val tabHint = ""
    override val bullets = listOf(
        "Your session has expired. Sign in again to view this transaction.",
        "Transaction receipts show real movements from your Zylod wallet. Sign in to continue.",
        "This transaction could not be found in your wallet history.",
    )
    override val related = listOf(
        NativePageLink("transaction-history", "Transaction History"),
    )
}

/**
 * Delegation only — the shared [SharedTransactionDetailScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/finance, not on this file's own same-named composable).
 */
@Composable
fun TransactionDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedTransactionDetailScreen(pageId = "transaction-detail", onBack = onBack, openPage = openPage, query = query)
}
