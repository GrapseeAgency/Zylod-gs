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
    override val summary = "Payouts — the web serves this id with the SAME seller-payouts-page component as \"seller-payouts\" (chunk-seller.ts), so the native row delegates to the same typed surface: the REAL payouts list from SellerOpsApi with honest loading/not-seller/offline/empty states."
    override val tabHint = ""
    override val bullets = listOf(
        "Real payouts — the seller's own rows from the Zylod API, never fabricated.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the payouts pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("seller-payouts", "Seller Payouts"),
        NativePageLink("seller-dashboard", "Seller Dashboard"),
        NativePageLink("earnings-dashboard", "Earnings Dashboard"),
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
