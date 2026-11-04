package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.chat.ConversationsScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "chat-list"
 * (src/lib/page-loader.ts registry entry, owned by Compose — the WebView is
 * fallback-only for unregistered ids).
 *
 * t278 — WRONG-RECIPIENT FIX: this pageId previously delegated to the
 * live-SUPPORT chat (api/support/chat/sessions), so the "Messages" page
 * showed support sessions only — buyer↔supplier DM threads (unread badges,
 * product context, attachments) were invisible on native. The web's
 * chat-list specialType rides GET api/chat/conversations; the native now
 * does too (pageId-keyed ViewModel, search filter, load-more, offline
 * snapshot). live-chat / instant-chat KEEP the support family.
 */
data object ChatListPageMeta : NativePageMeta() {
    override val pageId = "chat-list"
    override val title = "Chat List"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary =
        "Your buyer↔supplier conversation list — the real api/chat/conversations backend " +
            "with unread badges, last-message previews and search."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Buyer↔supplier DMs — the same backend the web chat rides.",
        "Unread badges per thread; taps open the native DM thread.",
        "Offline-safe: the last-saved list renders first — never a white screen.",
    )
    override val related = listOf(
        NativePageLink("chat-detail", "Open a thread"),
        NativePageLink("suppliers", "Browse Suppliers"),
        NativePageLink("live-chat", "Zylod Live Support"),
    )
}

/**
 * Delegation only — the shared [ConversationsScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature.
 */
@Composable
fun ChatListScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    ConversationsScreen(pageId = "chat-list", onBack = onBack, openPage = openPage)
}
