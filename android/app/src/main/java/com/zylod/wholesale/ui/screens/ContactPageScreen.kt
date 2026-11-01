package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.support.ContactScreen as SharedContactScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "contact-page"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t255 — the curated-metadata body is GONE: the web SPA serves this
 * pageId from contact-us-page.tsx, and this pageId is now owned by the
 * typed ui/support implementation. The body is a thin delegation to the
 * shared contact screen — the email card rendering ONLY the
 * owner-published support.email (GET api/settings/public), the REAL POST
 * api/support/contact inquiry form with the route's 400 gate, the
 * submitting guard and the 201 "Inquiry Received" view. The meta object
 * below and the NativePageRegistry composable signature are unchanged.
 */
data object ContactPagePageMeta : NativePageMeta() {
    override val pageId = "contact-page"
    override val title = "Contact Page"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = "api/support/contact"
    override val summary = "Contact Page — the real support inquiry form plus the owner-published support email, streaming from the Zylod support API through the shared native contact screen."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the contact-page pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("helpdesk", "Help & Support Center"),
        NativePageLink("faq-page", "FAQ Page"),
        NativePageLink("live-chat", "Live Chat"),
    )
}

/**
 * Delegation only — the shared [SharedContactScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/support, not on
 * a same-named local composable).
 */
@Composable
fun ContactPageScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedContactScreen(pageId = "contact-page", onBack = onBack, openPage = openPage, query = query)
}
