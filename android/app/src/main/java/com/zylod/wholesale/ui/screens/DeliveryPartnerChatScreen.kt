package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.chat.DeliveryChatScreen as SharedDeliveryChatScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "delivery-partner-chat"
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
data object DeliveryPartnerChatPageMeta : NativePageMeta() {
    override val pageId = "delivery-partner-chat"
    override val title = "Delivery Partner Chat"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Delivery partner chat renders the typed chat rail when a delivery conversation is active."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated metadata for a page owned by a typed native screen — the screen itself renders live data.",
        "Delivery partner chat renders the typed chat rail when a delivery conversation is active.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedDeliveryChatScreen] owns the
 * rendering; this file keeps the registry-facing signature.
 */
@Composable
fun DeliveryPartnerChatScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedDeliveryChatScreen(pageId = "delivery-partner-chat", onBack = onBack, openPage = openPage, query = query)
}
