package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.sellerops.SellerRevenueScreen as SharedSellerRevenueScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "seller-revenue"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t266 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/sellerops implementation. The body is a thin delegation to the
 * shared seller-revenue screen (pageId-keyed so it keeps its own ViewModel)
 * — the REAL GET api/supplier/revenue book: the summary strip, the daily
 * gross series and the orderItem ledger. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object SellerRevenuePageMeta : NativePageMeta() {
    override val pageId = "seller-revenue"
    override val title = "Seller Revenue"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "When buyers place orders on your products, the platform-fee breakdown per order will appear here."
    override val tabHint = ""
    override val bullets = listOf(
        "Revenue Reports",
        "Sign in with a supplier account to view your revenue reports.",
        "Seller sign-in required",
        "No sales yet — your recent sales totals will appear here.",
        "Recent Sales",
        "Earnings are settled by the finance team. Commission is the standard B2B wholesale rate applied to gross GMV. Money only leaves your wallet when a payout is completed with a reference — a…",
    )
    override val related = listOf(
        NativePageLink("withdraw-money", "Withdraw Money"),
    )
}

/**
 * Delegation only — the shared [SharedSellerRevenueScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/sellerops, not on
 * this file's own same-named composable).
 */
@Composable
fun SellerRevenueScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSellerRevenueScreen(pageId = "seller-revenue", onBack = onBack, openPage = openPage, query = query)
}
