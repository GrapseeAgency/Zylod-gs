package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.chat.LiveChatScreen as SharedLiveChatScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "chat-list"
 * (src/lib/page-loader.ts registry entry, owned by Compose — the WebView is
 * fallback-only for unregistered ids).
 *
 * t251 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/chat implementation. The body is a thin delegation to the shared
 * live-support chat (pageId-keyed so it keeps its own ViewModel) — the REAL
 * api/support/chat/sessions thread with optimistic send, end-chat, the
 * offline thread cache and the honest sign-in gate. The meta object below
 * and the NativePageRegistry composable signature are unchanged.
 */
data object ChatListPageMeta : NativePageMeta() {
    override val pageId = "chat-list"
    override val title = "Chat List"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Chat List — help, policies and buyer/seller protection on Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the chat-list pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("help-center", "Help Center"),
        NativePageLink("support-tickets", "Support Tickets"),
        NativePageLink("contact-us", "Contact Us"),
    )
}

/**
 * Delegation only — the shared [SharedLiveChatScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature.
 */
@Composable
fun ChatListScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedLiveChatScreen(pageId = "chat-list", onBack = onBack, openPage = openPage, query = query)
}
