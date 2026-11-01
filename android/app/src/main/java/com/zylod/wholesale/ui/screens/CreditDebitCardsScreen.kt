package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.CardsScreen as SharedCardsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "credit-debit-cards"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t256 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared cards screen (pageId-keyed so it keeps its own CardsViewModel) —
 * the REAL GET api/cards list (tokenized last4, the server's Debit/Credit
 * labels, brand badge, Default badge), the honest sign-in/empty/error/
 * offline states, the real DELETE affordance and the Add Card jump. The
 * meta object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object CreditDebitCardsPageMeta : NativePageMeta() {
    override val pageId = "credit-debit-cards"
    override val title = "Credit Debit Cards"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Credit Debit Cards — account, identity and money surfaces for the signed-in user. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the credit-debit-cards pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("account-settings", "Account Settings"),
    )
}

/**
 * Delegation only — the shared [SharedCardsScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun CreditDebitCardsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCardsScreen(pageId = "credit-debit-cards", onBack = onBack, openPage = openPage, query = query)
}
