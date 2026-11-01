package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.investor.InvestorContactScreen as SharedInvestorContactScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "investor-contact"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Investor Contact — help, policies and buyer/seller protection on Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object InvestorContactPageMeta : NativePageMeta() {
    override val pageId = "investor-contact"
    override val title = "Investor Contact"
    override val category = "Support & Help"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Investor Contact — help, policies and buyer/seller protection on Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the investor-contact pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("help-center", "Help Center"),
        NativePageLink("support-tickets", "Support Tickets"),
        NativePageLink("contact-us", "Contact Us"),
    )
}

/**
 * t264 — the curated-metadata body is GONE: this pageId is now owned by
 * the typed ui/investor implementation. The body is a thin delegation to
 * the shared investor-contact screen (pageId-keyed so it keeps its own
 * InvestorContactViewModel) — the REAL POST api/investor/contact inquiry
 * form: the "Institutional Representative" fields, the six-value Nature of
 * Inquiry select and the verbatim "Inquiry Received" success card. The
 * meta object above and the NativePageRegistry composable signature are
 * unchanged.
 */
@Composable
fun InvestorContactScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedInvestorContactScreen(pageId = "investor-contact", title = "Investor Contact", onBack = onBack, openPage = openPage, query = query)
}
