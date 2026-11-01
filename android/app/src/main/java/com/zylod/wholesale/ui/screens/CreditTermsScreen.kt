package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.CreditTermsScreen as SharedCreditTermsScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "credit-terms"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared credit-terms screen — the web page is PURELY static copy (no
 * endpoint exists for it on the web either), so the shared screen
 * replicates that copy VERBATIM as Kotlin constants (hero, the three
 * Net-15/30/60 credit tiers, the VIP-membership CTA — policy copy, not
 * fabricated data). The meta object below and the NativePageRegistry
 * composable signature are unchanged.
 */
data object CreditTermsPageMeta : NativePageMeta() {
    override val pageId = "credit-terms"
    override val title = "Credit Terms"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Credit Terms — help, policies and buyer/seller protection on Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the credit-terms pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("help-center", "Help Center"),
        NativePageLink("support-tickets", "Support Tickets"),
        NativePageLink("contact-us", "Contact Us"),
    )
}

/**
 * Delegation only — the shared [SharedCreditTermsScreen] owns the rendering
 * (the verbatim static copy); this file keeps the registry-facing signature
 * (the aliased import is what makes the delegation land on ui/finance, not
 * on this file's own same-named composable).
 */
@Composable
fun CreditTermsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCreditTermsScreen(pageId = "credit-terms", onBack = onBack, openPage = openPage, query = query)
}
