package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.sellerops.SellerPayoutsScreen as SharedSellerPayoutsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "seller-payouts"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t266 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/sellerops implementation. The body is a thin delegation to the
 * shared seller-payouts screen (pageId-keyed so it keeps its own ViewModel)
 * — the REAL GET api/supplier/payouts book: the derived summary strip and
 * one elevated card per sellerPayouts row. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object SellerPayoutsPageMeta : NativePageMeta() {
    override val pageId = "seller-payouts"
    override val title = "Seller Payouts"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Payouts are settled by the finance team. Money only leaves your wallet when a payout is completed with a reference — a request alone never moves funds."
    override val tabHint = ""
    override val bullets = listOf(
        "Seller sign-in required",
        "Sign in with a supplier account to see your payouts.",
        "Payout history",
        "When the finance team settles a payout for your store, it will appear here with its reference.",
    )
    override val related = listOf(
        NativePageLink("withdraw-money", "Withdraw Money"),
    )
}

/**
 * Delegation only — the shared [SharedSellerPayoutsScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/sellerops, not on
 * this file's own same-named composable).
 */
@Composable
fun SellerPayoutsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSellerPayoutsScreen(pageId = "seller-payouts", onBack = onBack, openPage = openPage, query = query)
}
