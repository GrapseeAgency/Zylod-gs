package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.RefundToWalletScreen as SharedRefundToWalletScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "refund-to-wallet"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t258 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared refund-to-wallet screen (pageId-keyed so it keeps its own
 * ViewModel) — the web page's faithful mirror: the buyer's REAL
 * processed-refund ledger (GET api/wallet/refund, the admin-rail rows with
 * their real UTR / TxnID references), the "How refunds reach you" doctrine
 * banner and the "The refund path" steps, and the honest empty state —
 * there is NO self-service refund form (that channel is retired
 * server-side). The meta object below and the NativePageRegistry
 * composable signature are unchanged.
 */
data object RefundToWalletPageMeta : NativePageMeta() {
    override val pageId = "refund-to-wallet"
    override val title = "Refund To Wallet"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "If something went wrong with an order, request a return from your order history. Once the platform approves and processes it, the refund — with its transaction reference — appears here."
    override val tabHint = ""
    override val bullets = listOf(
        "How refunds reach you",
        "When a return is approved, the platform processes your refund through the channel you arranged — bank transfer, mobile banking, or cash. Every completed refund is documented below with its…",
        "Processed refunds",
        "The refund path",
        "Request a return from the order in your purchase history.",
        "The platform reviews and approves (or rejects) the request.",
    )
    override val related = listOf(
        NativePageLink("my-wallet", "My Wallet"),
        NativePageLink("purchase-history", "Purchase History"),
    )
}

/**
 * Delegation only — the shared [SharedRefundToWalletScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/finance, not on this file's own same-named composable).
 */
@Composable
fun RefundToWalletScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedRefundToWalletScreen(pageId = "refund-to-wallet", onBack = onBack, openPage = openPage, query = query)
}
