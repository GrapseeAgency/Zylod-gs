package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.complaints.ComplaintDetailScreen as SharedComplaintDetailScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "dispute-detail"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Dispute Detail — order, shipping and delivery operations for Zylod buyers. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 *
 * t261 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/complaints implementation. The body is a thin delegation to the
 * shared complaint-detail screen (pageId-keyed so it keeps its own
 * ViewModel) — GET api/complaints/[id] for a complaint reference in the
 * entry query (with the owner-only withdraw action), the web page's own
 * static copy for the id-less case. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object DisputeDetailPageMeta : NativePageMeta() {
    override val pageId = "dispute-detail"
    override val title = "Dispute Detail"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Dispute Detail — order, shipping and delivery operations for Zylod buyers. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the dispute-detail pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedComplaintDetailScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/complaints, not on this file's own same-named composable).
 */
@Composable
fun DisputeDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedComplaintDetailScreen(pageId = "dispute-detail", onBack = onBack, openPage = openPage, query = query)
}
