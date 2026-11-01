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
    override val summary = "Payment FAQ — help, policies and buyer/seller protection on Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the payment-faq pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("help-center", "Help Center"),
        NativePageLink("support-tickets", "Support Tickets"),
        NativePageLink("contact-us", "Contact Us"),
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
