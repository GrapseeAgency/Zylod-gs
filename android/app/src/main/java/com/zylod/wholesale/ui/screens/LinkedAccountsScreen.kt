package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.account.LinkedAccountsScreen as TypedLinkedAccountsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "linked-accounts"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t303 — the WebScreen forward is RETIRED: this pageId is now owned by the
 * typed ui/account implementation. The body is a thin delegation to the
 * shared [TypedLinkedAccountsScreen] — the REAL wire the web page renders, with the
 * same honesty contract. The meta object keeps its registry identity and the
 * NativePageRegistry composable signature is unchanged.
 */
data object LinkedAccountsPageMeta : NativePageMeta() {{
    override val pageId = "linked-accounts"
    override val title = "Linked Accounts"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Linked Accounts — GET/POST/DELETE api/profile/linked-accounts (whatsapp/facebook/instagram/google handles, max 5 server-enforced); add/remove adopt the server-returned list on 2xx."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the linked-accounts pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("privacy-settings", "Privacy Settings"),
        NativePageLink("account-settings", "Account Settings"),
        NativePageLink("edit-profile", "Edit Profile"),
    )
}}

/**
 * Delegation only — the shared typed screen owns the rendering and the wire
 * calls; this file keeps the registry-facing signature (the aliased import
 * is what makes the delegation land on ui.account.LinkedAccountsScreen, not on this file's own
 * same-named composable).
 */
@Composable
fun LinkedAccountsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {{
    com.zylod.wholesale.ui.account.LinkedAccountsScreen(onBack = onBack, openPage = openPage)
}}
