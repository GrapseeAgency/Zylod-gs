package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.BalanceOverviewScreen as TypedBalanceOverviewScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "balance-overview"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t302 — the curated-metadata body is GONE: this pageId is now owned by the
 * NEW typed ui/finance implementation. The body is a thin delegation to the
 * shared [TypedBalanceOverviewScreen] — the REAL balance breakdown the
 * web's BalanceOverviewPage renders for this id: GET api/wallet/balance
 * through the EXISTING WalletApi (available liquid hero, escrow, inflow/
 * outflow cards and the cash-flow ledger), the web page's AccountGate as a
 * soft sign-in CTA for guests, the offline saved-breakdown banner and the
 * honest Retry state — never a fabricated ৳0. The meta object below keeps
 * its registry identity and the NativePageRegistry composable signature is
 * unchanged.
 */
data object BalanceOverviewPageMeta : NativePageMeta() {
    override val pageId = "balance-overview"
    override val title = "Balance Overview"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Balance Overview — the REAL balance breakdown (GET api/wallet/balance through the existing WalletApi): available liquid, escrow, inflow/outflow and the cash-flow ledger — the same data the web's BalanceOverviewPage renders, with the same guest gate."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real money — the server's own wallet aggregate, never a fabricated ৳0.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the balance-overview pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("my-wallet", "My Wallet"),
        NativePageLink("transaction-history", "Transaction History"),
        NativePageLink("add-money", "Add Money"),
    )
}

/**
 * Delegation only — the shared [TypedBalanceOverviewScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/finance, not on this file's own same-named composable).
 */
@Composable
fun BalanceOverviewScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedBalanceOverviewScreen(onBack = onBack, openPage = openPage, query = query)
}
