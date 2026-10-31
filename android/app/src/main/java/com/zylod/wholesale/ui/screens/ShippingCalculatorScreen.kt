package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.logistics.ShippingCalculatorScreen as SharedShippingCalculatorScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "shipping-calculator"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t252 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/logistics implementation. The body is a thin delegation to the
 * shared freight-calculator screen — the REAL PUBLIC api/shipping/quote
 * zone-book engine (district/weight/subtotal inputs, the volumetric
 * helper, FREE-with-waiver option cards, the honest 400/empty answers and
 * the offline quote cache). The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object ShippingCalculatorPageMeta : NativePageMeta() {
    override val pageId = "shipping-calculator"
    override val title = "Shipping Calculator"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Shipping Calculator — order, shipping and delivery operations for Zylod buyers. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the shipping-calculator pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedShippingCalculatorScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/logistics, not on this file's own same-named composable).
 */
@Composable
fun ShippingCalculatorScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedShippingCalculatorScreen(pageId = "shipping-calculator", onBack = onBack, openPage = openPage, query = query)
}
