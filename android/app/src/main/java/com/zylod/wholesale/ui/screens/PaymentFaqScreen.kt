package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.PaymentFaqScreen as SharedPaymentFaqScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "payment-faq"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. MIRROR NOTE: the web page is NOT purely
 * static copy — it fetches GET api/legal/faq?docType=payment_terms — so the
 * delegation lands on the shared screen that composes the SAME public
 * endpoint (accordion cards over the live legalFaqs rows, the web page's
 * own empty/error copy). The meta object below and the NativePageRegistry
 * composable signature are unchanged.
 */
data object PaymentFaqPageMeta : NativePageMeta() {
    override val pageId = "payment-faq"
    override val title = "Payment FAQ"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Bank transfers & mobile banking (bKash / Nagad)"
    override val tabHint = ""
    override val bullets = listOf(
        "Payment FAQ",
        "No Payment FAQs have been published yet.",
    )
    override val related = listOf(
        NativePageLink("payment-terms", "Payment Terms"),
    )
}

/**
 * Delegation only — the shared [SharedPaymentFaqScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun PaymentFaqScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedPaymentFaqScreen(pageId = "payment-faq", onBack = onBack, openPage = openPage, query = query)
}
