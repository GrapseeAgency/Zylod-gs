package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.coupons.CouponsScreen as TypedCouponsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "coupons-offers"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t300 — the curated-metadata body is GONE: this pageId is now owned by the
 * EXISTING typed ui/coupons implementation. The WEB serves this id with the
 * SAME CouponsPage component as "coupons" (page-chunks/chunk-misc.ts maps
 * both ids to coupons-page.tsx) — so the native row is a thin delegation to
 * the same shared [TypedCouponsScreen]: the buyer's voucher vault (GET
 * api/coupons/my), the public campaign claim rail (GET api/coupons + POST
 * api/coupons/claim) and the loyalty-points rail (GET api/rewards). The
 * meta object below keeps its registry identity and the
 * NativePageRegistry composable signature is unchanged.
 */
data object CouponsOffersPageMeta : NativePageMeta() {
    override val pageId = "coupons-offers"
    override val title = "Coupons Offers"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Coupons Offers — the web serves this id with the SAME CouponsPage as \"coupons\" (chunk-misc.ts maps both ids to coupons-page.tsx), so the native row delegates to the same real surface: vault (GET api/coupons/my), claim rail (GET api/coupons + POST api/coupons/claim) and points (GET api/rewards)."
    override val tabHint = ""
    override val bullets = listOf(
        "Real coupons — vault, campaigns and points stream from the Zylod API, never fabricated.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the coupons-offers pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("coupons", "Coupons"),
        NativePageLink("my-coupons", "My Coupons"),
        NativePageLink("coupon-promo", "Coupons & Promo Codes"),
    )
}

/**
 * Delegation only — the shared [TypedCouponsScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature.
 */
@Composable
fun CouponsOffersScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedCouponsScreen(onBack = onBack, openPage = openPage, query = query)
}
