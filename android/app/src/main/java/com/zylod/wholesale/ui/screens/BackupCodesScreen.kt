package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.account.BackupCodesScreen as SharedBackupCodesScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "backup-codes"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t280 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/account implementation (the backup-codes port: POST api/auth/backup-codes generation, copy/share affordances). The meta object below and the
 * NativePageRegistry composable signature are unchanged (the t264/t279
 * delegate pattern).
 */
data object BackupCodesPageMeta : NativePageMeta() {
    override val pageId = "backup-codes"
    override val title = "Backup Codes"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Backup Recovery Codes — ten single-use codes for account recovery, shown once."
    override val tabHint = ""
    override val bullets = listOf(
        "Typed native screen — live data from the account settings API family.",
        "Honest states: loading, retry, signed-out wall — never fabricated data.",
        "Native ownership: this Kotlin screen owns the backup-codes pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("two-factor-auth", "Two-Factor Authentication"),
        NativePageLink("account-settings", "Account Settings"),
        NativePageLink("profile", "Profile"),
    )
}

/**
 * Delegation only — the shared [SharedBackupCodesScreen] owns the rendering and the
 * wire calls; this file keeps the registry-facing signature (the aliased
 * import is what makes the delegation land on ui/account, not on this
 * file's own same-named composable).
 */
@Composable
fun BackupCodesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedBackupCodesScreen(onBack = onBack, openPage = openPage)
}
