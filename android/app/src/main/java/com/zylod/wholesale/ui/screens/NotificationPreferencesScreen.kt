package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.account.NotificationPreferencesScreen as SharedNotificationPreferencesScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "notification-preferences"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t280 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/account implementation (the advanced notification-preferences port: 14 category cards with honest persistence markers + quiet hours). The meta object below and the
 * NativePageRegistry composable signature are unchanged (the t264/t279
 * delegate pattern).
 */
data object NotificationPreferencesPageMeta : NativePageMeta() {
    override val pageId = "notification-preferences"
    override val title = "Notification Preferences"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Notification Preferences — per-category channels and quiet hours, saved to your account."
    override val tabHint = ""
    override val bullets = listOf(
        "Typed native screen — live data from the account settings API family.",
        "Honest states: loading, retry, signed-out wall — never fabricated data.",
        "Native ownership: this Kotlin screen owns the notification-preferences pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("account-settings", "Account Settings"),
        NativePageLink("notifications", "Notifications"),
        NativePageLink("profile", "Profile"),
    )
}

/**
 * Delegation only — the shared [SharedNotificationPreferencesScreen] owns the rendering and the
 * wire calls; this file keeps the registry-facing signature (the aliased
 * import is what makes the delegation land on ui/account, not on this
 * file's own same-named composable).
 */
@Composable
fun NotificationPreferencesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedNotificationPreferencesScreen(onBack = onBack, openPage = openPage)
}
