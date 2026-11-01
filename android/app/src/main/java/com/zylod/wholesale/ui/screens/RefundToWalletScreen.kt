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
    override val summary = "Refund To Wallet — order, shipping and delivery operations for Zylod buyers. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the refund-to-wallet pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
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
