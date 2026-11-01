package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.complaints.DisputeGuidesScreen as SharedDisputeGuidesScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "dispute-resolution"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Dispute Resolution — order, shipping and delivery operations for Zylod buyers. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 *
 * t261 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/complaints implementation. The body is a thin delegation to the
 * shared dispute-guide screen (pageId-keyed) — the web maps
 * dispute-resolution onto the SAME dispute-resolution-guide-page.tsx
 * component as the other three guide ids (chunk-support.ts:99), so the
 * native variant renders that page's static guide copy verbatim. The meta
 * object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object DisputeResolutionPageMeta : NativePageMeta() {
    override val pageId = "dispute-resolution"
    override val title = "Dispute Resolution"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Dispute Resolution — order, shipping and delivery operations for Zylod buyers. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the dispute-resolution pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedDisputeGuidesScreen] owns the
 * rendering (static web copy + the public-settings support email); this
 * file keeps the registry-facing signature (the aliased import is what
 * makes the delegation land on ui/complaints, not on this file's own
 * same-named composable).
 */
@Composable
fun DisputeResolutionScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedDisputeGuidesScreen(pageId = "dispute-resolution", onBack = onBack, openPage = openPage, query = query)
}
