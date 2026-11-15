package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.account.DeleteAccountScreen as TypedDeleteAccountScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "delete-account"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t303 — the WebScreen forward is RETIRED: this pageId is now owned by the
 * typed ui/account implementation. The body is a thin delegation to the
 * shared [TypedDeleteAccountScreen] — the REAL wire the web page renders, with the
 * same honesty contract. The meta object keeps its registry identity and the
 * NativePageRegistry composable signature is unchanged.
 */
data object DeleteAccountPageMeta : NativePageMeta() {{
    override val pageId = "delete-account"
    override val title = "Delete Account"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Delete Account — GET/DELETE api/profile/account with the typed DELETE confirmation; the real orders/products summary shows honest dashes when unavailable, and success signs the session out."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the delete-account pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("account-settings", "Account Settings"),
        NativePageLink("privacy-settings", "Privacy Settings"),
        NativePageLink("support-center", "Support Center"),
    )
}}

/**
 * Delegation only — the shared typed screen owns the rendering and the wire
 * calls; this file keeps the registry-facing signature (the aliased import
 * is what makes the delegation land on ui.account.DeleteAccountScreen, not on this file's own
 * same-named composable).
 */
@Composable
fun DeleteAccountScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {{
    com.zylod.wholesale.ui.account.DeleteAccountScreen(onBack = onBack, openPage = openPage, onDeleted = { com.zylod.wholesale.data.session.SessionManager.clear(); openPage("login", "") })
}}
