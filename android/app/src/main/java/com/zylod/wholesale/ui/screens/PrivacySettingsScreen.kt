package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.account.PrivacySettingsScreen as TypedPrivacySettingsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "privacy-settings"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t303 — the WebScreen forward is RETIRED: this pageId is now owned by the
 * typed ui/account implementation. The body is a thin delegation to the
 * shared [TypedPrivacySettingsScreen] — the REAL wire the web page renders, with the
 * same honesty contract. The meta object keeps its registry identity and the
 * NativePageRegistry composable signature is unchanged.
 */
data object PrivacySettingsPageMeta : NativePageMeta() {{
    override val pageId = "privacy-settings"
    override val title = "Privacy Settings"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Privacy Settings — GET/PATCH api/profile/privacy (profileVisibility public/buyers/private + showEmail/showPhone); the UI adopts the server-confirmed state on 2xx, never optimistic."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the privacy-settings pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("account-settings", "Account Settings"),
        NativePageLink("theme-settings", "Theme Settings"),
        NativePageLink("push-notification-settings", "Push Notifications"),
    )
}}

/**
 * Delegation only — the shared typed screen owns the rendering and the wire
 * calls; this file keeps the registry-facing signature (the aliased import
 * is what makes the delegation land on ui.account.PrivacySettingsScreen, not on this file's own
 * same-named composable).
 */
@Composable
fun PrivacySettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {{
    com.zylod.wholesale.ui.account.PrivacySettingsScreen(onBack = onBack, openPage = openPage)
}}
