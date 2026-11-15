package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.account.AccountSettingsScreen as SharedAccountSettingsScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "account-settings"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t280 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/account implementation (the account-settings port: section pills, GET/PATCH settings, notifications, privacy and theme contracts). The meta object below and the
 * NativePageRegistry composable signature are unchanged (the t264/t279
 * delegate pattern).
 */
data object AccountSettingsPageMeta : NativePageMeta() {
    override val pageId = "account-settings"
    override val title = "Account Settings"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Manage your credentials, alerts, privacy, and account security."
    override val tabHint = ""
    override val bullets = listOf(
        "Account Settings",
        "Sign out of your active session or manage account termination.",
        "Account Credentials",
        "Display Theme",
        "Account Management &amp; Sign Out",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
        NativePageLink("two-factor-auth", "Two Factor Auth"),
        NativePageLink("edit-profile", "Edit Profile"),
        NativePageLink("notification-preferences", "Notification Preferences"),
    )
}

/**
 * Delegation only — the shared [SharedAccountSettingsScreen] owns the rendering and the
 * wire calls; this file keeps the registry-facing signature (the aliased
 * import is what makes the delegation land on ui/account, not on this
 * file's own same-named composable).
 */
@Composable
fun AccountSettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAccountSettingsScreen(onBack = onBack, openPage = openPage)
}
