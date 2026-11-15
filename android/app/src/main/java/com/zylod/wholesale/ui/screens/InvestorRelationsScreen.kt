package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.investor.InvestorRelationsScreen as SharedInvestorRelationsScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "investor-relations"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Investor Relations — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object InvestorRelationsPageMeta : NativePageMeta() {
    override val pageId = "investor-relations"
    override val title = "Investor Relations"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Investor relations materials — audited financials, filings, funding information — have not been released. They will appear on this page as they are published. . : ’ In the meantime, reach us through the Help Center.’}"
    override val tabHint = ""
    override val bullets = listOf(
        "Investor Relations",
        "Financial Reports, Filings & Corporate Governance",
        "Nothing Published Yet",
        "Investor relations materials are not published yet. Nothing is listed here because nothing has been released — reports and filings will appear on this page as they are published. with any…",
        "Investor Resources",
        "Recent Publications & Filings",
    )
    override val related = listOf(
        NativePageLink("investor-contact", "Investor Contact"),
    )
}

/**
 * t264 — the curated-metadata body is GONE: this pageId is now owned by
 * the typed ui/investor implementation. The body is a thin delegation to
 * the shared investor portal (pageId-keyed so it keeps its own
 * InvestorViewModel) — the REAL GET api/investor portal: the hero, the
 * Investor Resources quick-nav grid and the published document cards with
 * the ACTION_VIEW download affordance on the REAL fileUrls. The meta
 * object above and the NativePageRegistry composable signature are
 * unchanged.
 */
@Composable
fun InvestorRelationsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedInvestorRelationsScreen(pageId = "investor-relations", title = "Investor Relations", onBack = onBack, openPage = openPage, query = query)
}
