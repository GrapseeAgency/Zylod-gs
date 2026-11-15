package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.chat.ConversationsScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "messaging-center"
 * (src/lib/page-loader.ts registry entry, owned by Compose — the WebView is
 * fallback-only for unregistered ids).
 *
 * t278 — WRONG-RECIPIENT FIX: this pageId previously delegated to the
 * live-SUPPORT chat (api/support/chat/sessions). The web registers
 * messaging-center as a chat-list specialType — the buyer↔supplier DM
 * conversation LIST — which the native now does too. live-chat / instant-chat
 * KEEP the support family.
 */
data object MessagingCenterPageMeta : NativePageMeta() {
    override val pageId = "messaging-center"
    override val title = "Messaging Center"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary =
        "Your buyer↔supplier conversation list — the real api/chat/conversations backend " +
            "with unread badges, last-message previews and search."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Account preferences are not available yet",
        "Your return requests",
        "No suppliers found matching your criteria",
        "Returns are submitted per order. Open the order in your order history and choose the items to return — the request goes to the Zylod team for review.",
        "Buyer levels are not available yet",
    )
    override val related = listOf(
        NativePageLink("chat-detail", "Chat Detail"),
        NativePageLink("supplier-profile", "Supplier Profile"),
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("wishlist", "Wishlist"),
    )
}

/**
 * Delegation only — the shared [ConversationsScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature.
 */
@Composable
fun MessagingCenterScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    ConversationsScreen(pageId = "messaging-center", onBack = onBack, openPage = openPage)
}
