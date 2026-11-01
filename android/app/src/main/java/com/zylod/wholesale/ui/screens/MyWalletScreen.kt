package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.wallet.WalletScreen as TypedWalletScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "my-wallet"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t256 — the curated-metadata body is GONE: this pageId is now owned by the
 * EXISTING typed ui/wallet implementation. The body is a thin delegation
 * to the shared [TypedWalletScreen] — the REAL GET api/wallet/balance +
 * GET api/wallet/transactions wallet (balance card, quick actions, paged
 * history) with its honest loading/sign-in/offline/empty states. The
 * shared screen's signature has no pageId parameter (its VM lives on the
 * NavHost entry's own store), so the delegation passes the registry-facing
 * arguments through unchanged. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object MyWalletPageMeta : NativePageMeta() {
    override val pageId = "my-wallet"
    override val title = "My Wallet"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "My Wallet — account, identity and money surfaces for the signed-in user. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the my-wallet pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("account-settings", "Account Settings"),
    )
}

/**
 * Delegation only — the shared [TypedWalletScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/wallet, not on
 * this file's own same-named composable).
 */
@Composable
fun MyWalletScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedWalletScreen(onBack = onBack, openPage = openPage, query = query)
}
