package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.account.TwoFactorSetupScreen as SharedTwoFactorSetupScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "two-factor-auth"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t280 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/account implementation (the 2FA enrollment port: setup (QR + manual key) and verify against api/auth/2fa — the login challenge stays in ui/auth). The meta object below and the
 * NativePageRegistry composable signature are unchanged (the t264/t279
 * delegate pattern).
 */
data object TwoFactorAuthPageMeta : NativePageMeta() {
    override val pageId = "two-factor-auth"
    override val title = "Two-Factor Authentication"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Two-Factor Authentication — protect your account with an authenticator app or SMS codes."
    override val tabHint = ""
    override val bullets = listOf(
        "Typed native screen — live data from the account settings API family.",
        "Honest states: loading, retry, signed-out wall — never fabricated data.",
        "Native ownership: this Kotlin screen owns the two-factor-auth pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("account-settings", "Account Settings"),
        NativePageLink("backup-codes", "Backup Codes"),
        NativePageLink("edit-profile", "Edit Profile"),
    )
}

/**
 * Delegation only — the shared [SharedTwoFactorSetupScreen] owns the rendering and the
 * wire calls; this file keeps the registry-facing signature (the aliased
 * import is what makes the delegation land on ui/account, not on this
 * file's own same-named composable).
 */
@Composable
fun TwoFactorAuthScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedTwoFactorSetupScreen(onBack = onBack, openPage = openPage)
}
