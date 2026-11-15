package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.chat.ChatThreadScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "chat-detail"
 * (src/lib/page-loader.ts registry entry, owned by Compose — the WebView is
 * fallback-only for unregistered ids).
 *
 * t278 — WRONG-RECIPIENT FIX: this pageId previously delegated to the
 * live-SUPPORT chat (api/support/chat/sessions), so a buyer tapping
 * "Contact Supplier" talked to the support team — the supplier never saw
 * the message. The web's chat-detail page rides the REAL buyer↔supplier DM
 * backend (api/chat/conversations), which the native now does too: the
 * delegation targets the typed DM thread (create-or-reuse from
 * supplierUserId=, load by conversationId=, optimistic send, offline
 * thread cache, honest gates). live-chat / instant-chat KEEP the support
 * family — that split is the web's own routing.
 */
data object ChatDetailPageMeta : NativePageMeta() {
    override val pageId = "chat-detail"
    override val title = "Chat Detail"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary =
        "Direct-message thread with a supplier or buyer — the real api/chat/conversations backend " +
            "(create-or-reuse on entry, optimistic send, read receipts)."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Account preferences are not available yet",
        "Your return requests",
        "No suppliers found matching your criteria",
        "Returns are submitted per order. Open the order in your order history and choose the items to return — the request goes to the Zylod team for review.",
        "Buyer levels are not available yet",
    )
    override val related = listOf(
        NativePageLink("supplier-profile", "Supplier Profile"),
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("wishlist", "Wishlist"),
        NativePageLink("suppliers", "Suppliers"),
    )
}

/**
 * Delegation only — the shared [ChatThreadScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature.
 */
@Composable
fun ChatDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    ChatThreadScreen(query = query, onBack = onBack, openPage = openPage)
}
