package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.support.FeedbackScreen as SharedFeedbackScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "feedback-page"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t255 — the curated-metadata body is GONE: the web SPA serves this
 * pageId from feedback-suggestions-page.tsx, and this pageId is now owned
 * by the typed ui/support implementation. The body is a thin delegation
 * to the shared feedback screen — the community wall (REAL GET
 * api/support/feedback with the filter pills) and the Share Idea modal
 * (REAL POST api/support/feedback with the route's 400 gate, the verbatim
 * 401/403 line and the submitting guard). The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object FeedbackPagePageMeta : NativePageMeta() {
    override val pageId = "feedback-page"
    override val title = "Feedback Page"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = "api/support/feedback"
    override val summary = "Feedback Page — the live community suggestions wall and the real Share Idea form, streaming from the Zylod support API through the shared native feedback screen."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the feedback-page pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("helpdesk", "Help & Support Center"),
        NativePageLink("contact-page", "Contact Page"),
        NativePageLink("faq-page", "FAQ Page"),
    )
}

/**
 * Delegation only — the shared [SharedFeedbackScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/support, not on
 * a same-named local composable).
 */
@Composable
fun FeedbackPageScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedFeedbackScreen(pageId = "feedback-page", onBack = onBack, openPage = openPage, query = query)
}
