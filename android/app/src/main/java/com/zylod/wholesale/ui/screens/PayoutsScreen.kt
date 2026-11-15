package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.sellerops.SellerPayoutsScreen as TypedSellerPayoutsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "payouts"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t302 — the curated-metadata body is GONE: the WEB serves this id with the
 * SAME seller-payouts-page component as "seller-payouts"
 * (chunk-seller.ts maps both ids to seller-payouts-page.tsx), so the native
 * row is a thin delegation to the EXISTING typed
 * [TypedSellerPayoutsScreen] (pageId-keyed) — the REAL payouts list from
 * SellerOpsApi (amount + status badge + method + destination + admin
 * reference + fee + timestamps, with honest loading/not-seller/offline/
 * empty states). The meta object below keeps its registry identity and the
 * NativePageRegistry composable signature is unchanged.
 */
data object PayoutsPageMeta : NativePageMeta() {
    override val pageId = "payouts"
    override val title = "Payouts"
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
 * Delegation only — the shared [TypedSellerPayoutsScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/sellerops, not on this file's own same-named composable).
 */
@Composable
fun PayoutsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedSellerPayoutsScreen(pageId = "payouts", onBack = onBack, openPage = openPage, query = query)
}
