package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.account.ThemeSettingsScreen as TypedThemeSettingsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "theme-settings"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t303 — the WebScreen forward is RETIRED: this pageId is now owned by the
 * typed ui/account implementation. The body is a thin delegation to the
 * shared [TypedThemeSettingsScreen] — the REAL wire the web page renders, with the
 * same honesty contract. The meta object keeps its registry identity and the
 * NativePageRegistry composable signature is unchanged.
 */
data object ThemeSettingsPageMeta : NativePageMeta() {{
    override val pageId = "theme-settings"
    override val title = "Theme & Appearance"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Theme & Appearance — GET/PATCH api/profile/theme (system/light/dark are the only persisted modes); the choice applies app-wide only after the server confirms, through the t280 ThemeController."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the theme-settings pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("language-settings", "Language & Currency"),
        NativePageLink("privacy-settings", "Privacy Settings"),
        NativePageLink("account-settings", "Account Settings"),
    )
}}

/**
 * Delegation only — the shared typed screen owns the rendering and the wire
 * calls; this file keeps the registry-facing signature (the aliased import
 * is what makes the delegation land on ui.account.ThemeSettingsScreen, not on this file's own
 * same-named composable).
 */
@Composable
fun ThemeSettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {{
    com.zylod.wholesale.ui.account.ThemeSettingsScreen(onBack = onBack, openPage = openPage)
}}
