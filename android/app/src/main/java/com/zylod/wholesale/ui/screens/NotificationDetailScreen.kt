package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.notifications.NotificationDetailScreen as TypedNotificationDetailScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "notification-detail".
 *
 * t306 — the t280 WebScreen forward is RETIRED: this pageId is now owned by
 * the typed implementation (GET api/notifications/[id]). The body is a thin delegation — the
 * REAL wire the web page renders. The meta keeps its registry identity; the
 * registry signature is unchanged.
 */
data object NotificationDetailPageMeta : NativePageMeta() {{
    override val pageId = "notification-detail"
    override val title = "Notification Detail"
    override val category = "Notifications & Alerts"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Notification Detail — GET/DELETE api/notifications/[id]: opening auto-marks the row read (the route contract); delete removes it and pops back; the real relatedId opens the actual order/product/ticket through RouteOwnership."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — GET api/notifications/[id], rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the notification-detail pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("notifications", "Notifications"),
        NativePageLink("order-detail", "Order Detail"),
        NativePageLink("track-order", "Track Order"),
    )
}}

/** Delegation only — the shared typed screen owns the rendering and the wire. */
@Composable
fun NotificationDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {{
    com.zylod.wholesale.ui.notifications.NotificationDetailScreen(onBack = onBack, openPage = openPage, query = query)
}}
