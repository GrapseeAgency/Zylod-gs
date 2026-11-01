package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.adminops.AdminReportsScreen as SharedAdminReportsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "admin-reports"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t265 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/adminops implementation. The body is a thin delegation to the
 * shared reports screen (pageId-keyed so it keeps its own ViewModel) — the
 * REAL GET api/admin/reports moderation queue: the metrics strip, the
 * status filter chips, and one card per reportedUsers row with reporter and
 * reported entity. The meta object below and the NativePageRegistry
 * composable signature are unchanged.
 */
data object AdminReportsPageMeta : NativePageMeta() {
    override val pageId = "admin-reports"
    override val title = "Admin Reports"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Admin Reports — help, policies and buyer/seller protection on Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the admin-reports pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("help-center", "Help Center"),
        NativePageLink("support-tickets", "Support Tickets"),
        NativePageLink("contact-us", "Contact Us"),
    )
}

/**
 * Delegation only — the shared [SharedAdminReportsScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/adminops, not on
 * this file's own same-named composable).
 */
@Composable
fun AdminReportsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAdminReportsScreen(pageId = "admin-reports", onBack = onBack, openPage = openPage, query = query)
}
