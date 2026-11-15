package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.AddMoneyScreen as SharedAddMoneyScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "add-money"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t258 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared add-money screen (pageId-keyed so it keeps its own ViewModel)
 * — the REAL money rails: the manual top-up claim form (POST
 * api/wallet/topup — a PENDING walletTopups row and the route's verbatim
 * "admin verification" message; the wallet NEVER moves on submission), the
 * gateway initiate tab (POST api/wallet/topup/initiate with the honest 503
 * gateway-missing verdict or an "Open secure payment page" ACTION_VIEW
 * handoff), and the caller's claim ledger (GET api/wallet/topup) with
 * honest status chips. The meta object below and the NativePageRegistry
 * composable signature are unchanged.
 */
data object AddMoneyPageMeta : NativePageMeta() {
    override val pageId = "add-money"
    override val title = "Add Money"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Funding claims are tied to your Zylod account — sign in or create one to submit one."
    override val tabHint = ""
    override val bullets = listOf(
        "Sign in to add funds",
        "Send money to the Zylod company account, then submit the transaction reference here.",
        "Add Funds to Wallet",
        "Verification doctrine: your claim stays PENDING and your balance does NOT change until a Zylod finance admin confirms the money arrived — the same rule as order payments. Fake or duplicate…",
        "Payment verification pending",
        "Your claim for (ref ) is recorded and queued for the finance team. Your wallet balance is unchanged until an admin verifies the payment. You will be notified the moment it is decided.",
    )
    override val related = listOf(
        NativePageLink("my-wallet", "My Wallet"),
    )
}

/**
 * Delegation only — the shared [SharedAddMoneyScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun AddMoneyScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAddMoneyScreen(pageId = "add-money", onBack = onBack, openPage = openPage, query = query)
}
