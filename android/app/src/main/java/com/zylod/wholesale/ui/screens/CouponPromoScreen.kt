package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.coupons.CouponPromoScreen as TypedCouponPromoScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "coupon-promo"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t300 — the curated-metadata body is GONE: this pageId is now owned by the
 * NEW typed ui/coupons promo implementation. The body is a thin delegation
 * to the shared [TypedCouponPromoScreen] — the REAL promo surface the web's
 * CouponPromoPage renders for this id: the typed-code box (POST
 * api/coupons/claim { code }; the server refuses expired, exhausted,
 * foreign or unknown codes with the real reason) and the live campaign rail
 * (GET api/coupons?limit=30 with per-row claim and copy-to-box). The meta
 * object below keeps its registry identity and the NativePageRegistry
 * composable signature is unchanged.
 */
data object CouponPromoPageMeta : NativePageMeta() {
    override val pageId = "coupon-promo"
    override val title = "Coupon Promo"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "The server checks the code against the live database — expired, exhausted, foreign, or unknown codes are refused with the real reason. Application to an order happens at checkout from your vault."
    override val tabHint = ""
    override val bullets = listOf(
        "Coupons &amp; Promo Codes",
        "Collect vouchers to your vault — codes are applied at checkout.",
        "Available B2B Offers",
        "New offers appear here the moment the platform publishes them — nothing is faked.",
    )
    override val related = listOf(
        NativePageLink("search-home", "Search Home"),
    )
}

/**
 * Delegation only — the shared [TypedCouponPromoScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/coupons, not on
 * this file's own same-named composable).
 */
@Composable
fun CouponPromoScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedCouponPromoScreen(onBack = onBack, openPage = openPage, query = query)
}
