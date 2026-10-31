package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.chat.ChatbotScreen as SharedChatbotScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "chatbot"
 * (src/lib/page-loader.ts registry entry, owned by Compose — the WebView is
 * fallback-only for unregistered ids).
 *
 * t251 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/chat implementation. The body is a thin delegation to the shared
 * chatbot (pageId-keyed so it keeps its own ViewModel) — the REAL PUBLIC
 * api/support/chatbot/query endpoint with the EN/BN toggle, the five
 * suggested-inquiry chips, the typing indicator and the article link row.
 * The meta object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object ChatbotPageMeta : NativePageMeta() {
    override val pageId = "chatbot"
    override val title = "Chatbot"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Chatbot — help, policies and buyer/seller protection on Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the chatbot pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("help-center", "Help Center"),
        NativePageLink("support-tickets", "Support Tickets"),
        NativePageLink("contact-us", "Contact Us"),
    )
}

/**
 * Delegation only — the shared [SharedChatbotScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature (the aliased
 * import is what makes the delegation land on ui/chat, not on this file's
 * own same-named composable).
 */
@Composable
fun ChatbotScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedChatbotScreen(pageId = "chatbot", onBack = onBack, openPage = openPage, query = query)
}
