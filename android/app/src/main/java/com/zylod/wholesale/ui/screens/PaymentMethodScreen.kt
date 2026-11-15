package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.PaymentMethodsScreen as SharedPaymentMethodsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "payment-method"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t256 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared payment-methods screen (pageId-keyed so it keeps its own
 * PaymentMethodsViewModel) — the REAL GET api/payment-methods raw rows in
 * two honest sections (Mobile Wallets: bKash/Nagad/Upay/Rocket; Cards:
 * debit/credit with the tokenized last4), the Default badge, the real
 * DELETE affordance, detail jumps and the Add Payment Method jump. The
 * meta object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object PaymentMethodPageMeta : NativePageMeta() {
    override val pageId = "payment-method"
    override val title = "Payment Method"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Link a wallet, tokenize a card (last 4 only), or add a bank account — every entry is a real database row with a financial-audit trail. Payments themselves are made per order below."
    override val tabHint = ""
    override val bullets = listOf(
        "My Payment Methods",
    )
    override val related = listOf(
        NativePageLink("add-payment-method", "Add Payment Method"),
        NativePageLink("payment-terms", "Payment Terms"),
    )
}

/**
 * Delegation only — the shared [SharedPaymentMethodsScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/finance, not on this file's own same-named composable).
 */
@Composable
fun PaymentMethodScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedPaymentMethodsScreen(pageId = "payment-method", onBack = onBack, openPage = openPage, query = query)
}
