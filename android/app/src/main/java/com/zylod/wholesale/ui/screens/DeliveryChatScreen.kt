package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.chat.DeliveryChatScreen as SharedDeliveryChatScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "delivery-chat"
 * (src/lib/page-loader.ts registry entry, owned by Compose — the WebView is
 * fallback-only for unregistered ids).
 *
 * t251 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/chat implementation. The body is a thin delegation to the shared
 * delivery chat — the HONEST port of the web delivery-chat-page (no
 * delivery-messaging backend exists, on web either): neutral participant
 * avatar, the exact not-connected copy, a send that NEVER fakes a message,
 * and the shipping-tracker link. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object DeliveryChatPageMeta : NativePageMeta() {
    override val pageId = "delivery-chat"
    override val title = "Delivery Chat"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Live delivery chat requires a messaging backend, which is not available yet."
    override val tabHint = ""
    override val bullets = listOf(
        "Delivery Chat",
        "Not connected to a delivery conversation",
        "No messages yet",
        "This conversation has no messages. Live chat with your delivery partner will appear here once a shipment with real-time tracking is active.",
    )
    override val related = listOf(
        NativePageLink("notifications", "Notifications"),
        NativePageLink("shipping-tracker", "Shipping Tracker"),
    )
}

/**
 * Delegation only — the shared [SharedDeliveryChatScreen] owns the
 * rendering; this file keeps the registry-facing signature (the aliased
 * import is what makes the delegation land on ui/chat, not on this file's
 * own same-named composable).
 */
@Composable
fun DeliveryChatScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedDeliveryChatScreen(pageId = "delivery-chat", onBack = onBack, openPage = openPage, query = query)
}
