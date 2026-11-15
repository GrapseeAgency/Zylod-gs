package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.account.PushNotificationSettingsScreen as TypedPushNotificationSettingsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "push-notification-settings"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t303 — the WebScreen forward is RETIRED: this pageId is now owned by the
 * typed ui/account implementation. The body is a thin delegation to the
 * shared [TypedPushNotificationSettingsScreen] — the REAL wire the web page renders, with the
 * same honesty contract. The meta object keeps its registry identity and the
 * NativePageRegistry composable signature is unchanged.
 */
data object PushNotificationSettingsPageMeta : NativePageMeta() {{
    override val pageId = "push-notification-settings"
    override val title = "Push & Channel Notifications"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Push & Channel Notifications — GET/PATCH api/notifications/preferences (the per-channel surface: push/email booleans, quiet hours, digest, mentions) — a different wire from the 14-category preferences screen."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the push-notification-settings pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("notification-preferences", "Notification Preferences"),
        NativePageLink("account-settings", "Account Settings"),
        NativePageLink("privacy-settings", "Privacy Settings"),
    )
}}

/**
 * Delegation only — the shared typed screen owns the rendering and the wire
 * calls; this file keeps the registry-facing signature (the aliased import
 * is what makes the delegation land on ui.account.PushNotificationSettingsScreen, not on this file's own
 * same-named composable).
 */
@Composable
fun PushNotificationSettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {{
    com.zylod.wholesale.ui.account.PushNotificationSettingsScreen(onBack = onBack, openPage = openPage)
}}
