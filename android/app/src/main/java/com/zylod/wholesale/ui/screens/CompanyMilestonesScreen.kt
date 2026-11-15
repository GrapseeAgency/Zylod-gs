package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.careers.CareerSectionScreen as SharedCareerSectionScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "company-milestones"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Company Milestones — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object CompanyMilestonesPageMeta : NativePageMeta() {
    override val pageId = "company-milestones"
    override val title = "Company Milestones"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Milestones will be posted here as the platform grows — only real, verifiable ones. Zylod does not invent dates or achievements to look established."
    override val tabHint = ""
    override val bullets = listOf(
        "Zylod Journey &amp; Milestones",
        "Real Milestones, Published As They Happen",
        "No milestones published yet",
    )
    override val related = listOf(
        NativePageLink("about-us", "About Us"),
    )
}

/**
 * t264 — the curated-metadata body is GONE: this pageId is now owned by
 * the typed ui/careers implementation. The body is a thin delegation to
 * the shared career-section screen (pageId-keyed so it keeps its own
 * CareerSectionViewModel) — the REAL GET api/about/milestones timeline:
 * the published rows with their iconType glyphs and month/year badges, the
 * web's verbatim "No milestones published yet" empty card and the "Back to
 * About Zylod" footer. The meta object above and the NativePageRegistry
 * composable signature are unchanged.
 */
@Composable
fun CompanyMilestonesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCareerSectionScreen(pageId = "company-milestones", title = "Company Milestones", onBack = onBack, openPage = openPage, query = query)
}
