package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.complaints.RaiseComplaintScreen as SharedRaiseComplaintScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "raise-complaint"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Raise Complaint — help, policies and buyer/seller protection on Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 *
 * t261 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/complaints implementation. The body is a thin delegation to the
 * shared raise-complaint screen (pageId-keyed so it keeps its own
 * ViewModel) — the web raise-complaint-page.tsx mirror whose REAL POST is
 * api/support/report-problem. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object RaiseComplaintPageMeta : NativePageMeta() {
    override val pageId = "raise-complaint"
    override val title = "Raise Complaint"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = ". : ’’} Your complaint has been saved to our inbox for review by the Zylod team — we reply by email when action is needed. Zylod does not hold funds in escrow; approved refunds go back to your original payment method."
    override val tabHint = ""
    override val bullets = listOf(
        "Complaint Saved",
        ". : ’Photo or video evidence cannot be uploaded here yet — share it with the Zylod team through the Help Center afterwards.’}",
        "Raise Complaint",
        "Zylod does not hold payments in escrow. Your complaint is reviewed by the Zylod team and the outcome is documented — nothing is decided automatically.",
    )
    override val related = listOf(
        NativePageLink("help-center", "Help Center"),
    )
}

/**
 * Delegation only — the shared [SharedRaiseComplaintScreen] owns the
 * rendering and the wire call; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/complaints, not on this file's own same-named composable).
 */
@Composable
fun RaiseComplaintScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedRaiseComplaintScreen(pageId = "raise-complaint", onBack = onBack, openPage = openPage, query = query)
}
