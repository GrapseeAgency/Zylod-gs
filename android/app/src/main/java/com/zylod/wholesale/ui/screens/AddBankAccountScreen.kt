package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.AddBankAccountScreen as SharedAddBankAccountScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "add-bank-account"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t256 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared add-bank-account screen (pageId-keyed so it keeps its own
 * AddBankAccountViewModel) — the REAL POST api/bank-accounts form (the
 * required bankName/accountNumber/accountHolderName trio, optional branch/
 * routing, set-as-default), the route's real 400 text surfaced verbatim,
 * and the double-submit guard. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object AddBankAccountPageMeta : NativePageMeta() {
    override val pageId = "add-bank-account"
    override val title = "Add Bank Account"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Authorized for EFTN and RTGS automated bulk wholesale settlements."
    override val tabHint = ""
    override val bullets = listOf(
        "Link Commercial Bank",
    )
    override val related = listOf(
        NativePageLink("bank-accounts", "Bank Accounts"),
    )
}

/**
 * Delegation only — the shared [SharedAddBankAccountScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/finance, not on this file's own same-named composable).
 */
@Composable
fun AddBankAccountScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAddBankAccountScreen(pageId = "add-bank-account", onBack = onBack, openPage = openPage, query = query)
}
