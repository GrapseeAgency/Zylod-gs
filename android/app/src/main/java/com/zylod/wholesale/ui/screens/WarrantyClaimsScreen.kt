package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.returns.ReturnRequestScreen as SharedReturnRequestScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "warranty-claims"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t253 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/returns implementation. The body is a thin delegation to the
 * shared return-request screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL GET api/orders/{orderId} item picker with the
 * quantity steppers, per-item reasons, shared comments, estimated-refund
 * summary and the POST api/orders/{orderId}/return submit guard (the web
 * maps defect/warranty claims onto the same return-request flow — the
 * honest "No order selected" state routes buyers to their orders). The
 * meta object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object WarrantyClaimsPageMeta : NativePageMeta() {
    override val pageId = "warranty-claims"
    override val title = "Warranty Claims"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Warranty Claims — help, policies and buyer/seller protection on Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the warranty-claims pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("help-center", "Help Center"),
        NativePageLink("support-tickets", "Support Tickets"),
        NativePageLink("contact-us", "Contact Us"),
    )
}

/**
 * Delegation only — the shared [SharedReturnRequestScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/returns, not on this file's own same-named composable).
 */
@Composable
fun WarrantyClaimsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedReturnRequestScreen(pageId = "warranty-claims", onBack = onBack, openPage = openPage, query = query)
}
