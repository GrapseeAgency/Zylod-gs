package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.sellerops.SellerShippingSettingsScreen as SharedSellerShippingSettingsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "seller-shipping-settings"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t266 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/sellerops implementation. The body is a thin delegation to the
 * shared shipping-settings screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL GET api/supplier/shipping book: one card per
 * configured sellerShippingConfigs zone plus the honest not-set zone list.
 * The meta object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object SellerShippingSettingsPageMeta : NativePageMeta() {
    override val pageId = "seller-shipping-settings"
    override val title = "Seller Shipping Settings"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Seller Shipping Settings — order, shipping and delivery operations for Zylod buyers. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the seller-shipping-settings pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedSellerShippingSettingsScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/sellerops, not on this file's own same-named composable).
 */
@Composable
fun SellerShippingSettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSellerShippingSettingsScreen(pageId = "seller-shipping-settings", onBack = onBack, openPage = openPage, query = query)
}
