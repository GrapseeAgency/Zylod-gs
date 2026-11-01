package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.support.HelpCenterScreen as SharedHelpCenterScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "helpdesk"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t255 — the curated-metadata body is GONE: the web SPA serves this
 * pageId from help-center-page.tsx, and this pageId is now owned by the
 * typed ui/support implementation. The body is a thin delegation to the
 * shared help-center screen — the hero search into docs-search-results,
 * the AI/Live-Chat quick banners, the "Reach the Team" card rendering ONLY
 * the owner-published support.email / support.phone from
 * GET api/settings/public, the Browse-Help-Topics cards, the Top FAQs
 * card (REAL GET api/support/faqs rows) and the System Status banner
 * (REAL GET api/support/status). The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object HelpdeskPageMeta : NativePageMeta() {
    override val pageId = "helpdesk"
    override val title = "Helpdesk"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = "api/support/faqs"
    override val summary = "Helpdesk — the help & support center with live FAQs, owner-published contacts and the real system-status banner, streaming from the Zylod support API."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the helpdesk pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("faq-page", "FAQ Page"),
        NativePageLink("docs-page", "Docs Page"),
        NativePageLink("contact-page", "Contact Page"),
    )
}

/**
 * Delegation only — the shared [SharedHelpCenterScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/support, not on
 * a same-named local composable).
 */
@Composable
fun HelpdeskScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedHelpCenterScreen(pageId = "helpdesk", onBack = onBack, openPage = openPage, query = query)
}
