package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.AddCardScreen as SharedAddCardScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "add-card"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t256 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared add-card screen (pageId-keyed so it keeps its own
 * AddCardViewModel) — the REAL POST api/cards form (digit-grouped number
 * sent IN FULL — the server tokenizes to last4, required holder + MM/YY
 * expiry, Debit/Credit toggle, Visa/Mastercard/Amex brand picker,
 * set-as-default), the route's real 400 text surfaced verbatim, and the
 * double-submit guard. The meta object below and the NativePageRegistry
 * composable signature are unchanged.
 */
data object AddCardPageMeta : NativePageMeta() {
    override val pageId = "add-card"
    override val title = "Add Card"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Saved card references belong to your Zylod account — sign in or create one to continue."
    override val tabHint = ""
    override val bullets = listOf(
        "Sign in to add a card",
        "Card references only. Zylod saves the brand, last 4 digits, holder and expiry — never the full number or CVV. Cards on file are for reconciliation display; they cannot be charged . Checkout…",
        "No card can be charged on Zylod. Orders are paid from your wallet balance (debited in real time) or by a bank / mobile transfer that a finance admin verifies against the real receipt.",
    )
    override val related = listOf(
        NativePageLink("credit-debit-cards", "Credit Debit Cards"),
    )
}

/**
 * Delegation only — the shared [SharedAddCardScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun AddCardScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAddCardScreen(pageId = "add-card", onBack = onBack, openPage = openPage, query = query)
}
