package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.coupons.CouponsScreen as TypedCouponsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "coupons"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t300 — the curated-metadata body is GONE: this pageId is now owned by the
 * EXISTING typed ui/coupons implementation. The body is a thin delegation
 * to the shared [TypedCouponsScreen] — the REAL My Coupons surface the web's
 * CouponsPage renders for this id (public campaign claim rail via
 * GET api/coupons + POST api/coupons/claim, the buyer's voucher vault via
 * GET api/coupons/my, and the loyalty-points rail via GET api/rewards),
 * with its honest loading/sign-in/offline/empty states. The meta object
 * below keeps its registry identity (title/kind/related unchanged) and the
 * NativePageRegistry composable signature is unchanged.
 */
data object CouponsPageMeta : NativePageMeta() {
    override val pageId = "coupons"
    override val title = "Coupons"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Apply these codes at checkout to reduce unit prices or get free cargo transit across Bangladesh."
    override val tabHint = ""
    override val bullets = listOf(
        "Wholesale Coupons",
        "Check back soon or earn vouchers by completing tasks.",
        "Collect Discounts for Your Purchase Orders",
        "or more : ’Valid on all wholesale purchases’}",
    )
    override val related = listOf(
        NativePageLink("earn-coupons", "Earn Coupons"),
        NativePageLink("my-coupons", "My Coupons"),
    )
}

/**
 * Delegation only — the shared [TypedCouponsScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/coupons, not on
 * this file's own same-named composable).
 */
@Composable
fun CouponsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedCouponsScreen(onBack = onBack, openPage = openPage, query = query)
}
