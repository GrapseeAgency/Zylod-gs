package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.BankAccountsScreen as SharedBankAccountsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "bank-accounts"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t256 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared bank-accounts screen (pageId-keyed so it keeps its own
 * BankAccountsViewModel) — the REAL GET api/bank-accounts book with masked
 * account numbers, the Default badge, the honest sign-in/empty/error/
 * offline states, the real DELETE affordance and the Add Bank Account
 * jump. The meta object below and the NativePageRegistry composable
 * signature are unchanged.
 */
data object BankAccountsPageMeta : NativePageMeta() {
    override val pageId = "bank-accounts"
    override val title = "Bank Accounts"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Verified commercial bank routing for high-volume wholesale settlements."
    override val tabHint = ""
    override val bullets = listOf(
        "Commercial Bank Accounts",
        "Add a corporate bank account to enable direct wholesale withdrawals.",
        "Corporate Bank Payouts",
    )
    override val related = listOf(
        NativePageLink("add-bank-account", "Add Bank Account"),
    )
}

/**
 * Delegation only — the shared [SharedBankAccountsScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/finance, not on this file's own same-named composable).
 */
@Composable
fun BankAccountsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedBankAccountsScreen(pageId = "bank-accounts", onBack = onBack, openPage = openPage, query = query)
}
