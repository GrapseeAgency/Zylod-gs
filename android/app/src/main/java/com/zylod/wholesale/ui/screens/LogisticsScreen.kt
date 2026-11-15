package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.logistics.LogisticsScreen as SharedLogisticsScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "logistics"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t252 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/logistics implementation. The body is a thin delegation to the
 * shared Logistics & Freight hub — the parallel delivery-methods +
 * warehouses load (web Promise.allSettled semantics), the real quote
 * calculator section reusing api/shipping/quote, the debounced warehouse
 * search, the quick-tool links and the offline caches. The meta object
 * below and the NativePageRegistry composable signature are unchanged.
 */
data object LogisticsPageMeta : NativePageMeta() {
    override val pageId = "logistics"
    override val title = "Logistics"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Nationwide freight rates, live delivery methods, and the real ship-from warehouse directory — all sourced from the platform&apos;s live logistics configuration."
    override val tabHint = ""
    override val bullets = listOf(
        "Logistics &amp; Freight",
        "No delivery methods have been published yet. Check the shipping quote below — zone rates are configured separately and may still be available for your district.",
        "Delivery Methods",
        "Shipping zones are configured per district — this district has no active zone/rate combination for the given weight.",
        "Shipping Rate Calculator",
        "No warehouses match yet. Suppliers publish their ship-from locations as they are verified — new facilities appear here automatically.",
    )
    override val related = listOf(
        NativePageLink("supplier-storefront", "Supplier Storefront"),
    )
}

/**
 * Delegation only — the shared [SharedLogisticsScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/logistics, not on
 * this file's own same-named composable).
 */
@Composable
fun LogisticsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedLogisticsScreen(pageId = "logistics", onBack = onBack, openPage = openPage, query = query)
}
