package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.support.FaqScreen as SharedFaqScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "faq-page"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t255 — the curated-metadata body is GONE: the web SPA serves this
 * pageId from faq-page.tsx, and this pageId is now owned by the typed
 * ui/support implementation. The body is a thin delegation to the shared
 * FAQ screen — the REAL GET api/support/faqs list with the category
 * refetch, the EN⇄BN toggle, the client-side search and the REAL
 * POST api/support/faqs/{id}/vote helpful buttons, plus the honest
 * empty/error/offline states (no static fallback dataset exists natively).
 * The meta object below and the NativePageRegistry composable signature
 * are unchanged.
 */
data object FaqPagePageMeta : NativePageMeta() {
    override val pageId = "faq-page"
    override val title = "FAQ Page"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = "api/support/faqs"
    override val summary = "FAQ Page — the live categorized FAQs with helpful votes, streaming from the Zylod support API through the shared native FAQ screen."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the faq-page pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("helpdesk", "Help & Support Center"),
        NativePageLink("support-tickets", "Support Tickets"),
        NativePageLink("contact-page", "Contact Page"),
    )
}

/**
 * Delegation only — the shared [SharedFaqScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/support, not on
 * a same-named local composable).
 */
@Composable
fun FaqPageScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedFaqScreen(pageId = "faq-page", onBack = onBack, openPage = openPage, query = query)
}
