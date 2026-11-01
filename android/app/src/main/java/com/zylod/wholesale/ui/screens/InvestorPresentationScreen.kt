package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.investor.InvestorPresentationScreen as SharedInvestorPresentationScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "investor-presentation"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Investor Presentation — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object InvestorPresentationPageMeta : NativePageMeta() {
    override val pageId = "investor-presentation"
    override val title = "Investor Presentation"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Investor Presentation — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the investor-presentation pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("about-us", "About Us"),
        NativePageLink("contact-us", "Contact Us"),
        NativePageLink("careers", "Careers"),
    )
}

/**
 * t264 — the curated-metadata body is GONE: this pageId is now owned by
 * the typed ui/investor implementation. The body is a thin delegation to
 * the shared investor-presentation screen (pageId-keyed so it keeps its
 * own InvestorViewModel) — the REAL GET api/investor?docType=
 * investor_presentation deck list (the web's "Deck · YYYY" amber cards
 * with the ACTION_VIEW download affordance) and the "Back to Investor
 * Portal" footer. The meta object above and the NativePageRegistry
 * composable signature are unchanged.
 */
@Composable
fun InvestorPresentationScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedInvestorPresentationScreen(pageId = "investor-presentation", title = "Investor Presentation", onBack = onBack, openPage = openPage, query = query)
}
