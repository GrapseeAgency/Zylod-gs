package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.PaymentTermsScreen as SharedPaymentTermsScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "payment-terms"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. MIRROR NOTE: the web page is NOT purely
 * static copy — it composes GET api/legal/payment_terms + GET
 * api/legal/faq?docType=payment_terms — so the delegation lands on the
 * shared screen that composes the SAME two public endpoints plus the web
 * page's own static sections as verbatim copy (the honest two-route
 * payment-methods table, key rules, resource links). The meta object below
 * and the NativePageRegistry composable signature are unchanged.
 */
data object PaymentTermsPageMeta : NativePageMeta() {
    override val pageId = "payment-terms"
    override val title = "Payment Terms"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Pay via bank transfer or mobile banking (bKash/Nagad) using the details shown on your order. Orders stay UNPAID until Zylod verifies the payment."
    override val tabHint = ""
    override val bullets = listOf(
        "Payment Terms",
        "Payment Resources",
        "Accepted Payment Methods",
        "Key Payment Rules",
        "Full Payment Terms",
        "Payment FAQs",
    )
    override val related = listOf(
        NativePageLink("payment-method", "Payment Method"),
    )
}

/**
 * Delegation only — the shared [SharedPaymentTermsScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun PaymentTermsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedPaymentTermsScreen(pageId = "payment-terms", onBack = onBack, openPage = openPage, query = query)
}
