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
    override val summary = "Add Money — a Zylod marketplace surface. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the add-money pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("home", "Home"),
        NativePageLink("category-browser", "Category Browser"),
        NativePageLink("help-center", "Help Center"),
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
