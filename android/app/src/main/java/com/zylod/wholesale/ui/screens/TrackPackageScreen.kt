package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.logistics.TrackOrderScreen as SharedTrackOrderScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "track-package"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t252 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/logistics implementation. The body is a thin delegation to the
 * shared order-tracking screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL GET api/orders/{orderId} payload with the derived
 * badge/stage progress rail, per-shipment rows and the tracking timeline.
 * The meta object below and the NativePageRegistry composable signature
 * are unchanged.
 */
data object TrackPackagePageMeta : NativePageMeta() {
    override val pageId = "track-package"
    override val title = "Track Package"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Open one of your orders and choose the tracking action there — this screen tracks a specific order."
    override val tabHint = ""
    override val bullets = listOf(
        "No order selected",
        "This order doesn&apos;t exist or the link you followed is incorrect.",
        "Track Order",
        "Updates appear here once the supplier ships your order.",
        "Shipment Tracking",
        "Sign in required",
    )
    override val related = listOf(
        NativePageLink("my-orders", "My Orders"),
    )
}

/**
 * Delegation only — the shared [SharedTrackOrderScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/logistics, not on
 * this file's own same-named composable).
 */
@Composable
fun TrackPackageScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedTrackOrderScreen(pageId = "track-package", onBack = onBack, openPage = openPage, query = query)
}
