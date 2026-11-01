package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.careers.CareerSectionScreen as SharedCareerSectionScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "company-values"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Company Values — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object CompanyValuesPageMeta : NativePageMeta() {
    override val pageId = "company-values"
    override val title = "Company Values"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Company Values — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the company-values pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("about-us", "About Us"),
        NativePageLink("contact-us", "Contact Us"),
        NativePageLink("careers", "Careers"),
    )
}

/**
 * t264 — the curated-metadata body is GONE: this pageId is now owned by
 * the typed ui/careers implementation. The body is a thin delegation to
 * the shared career-section screen (pageId-keyed so it keeps its own
 * CareerSectionViewModel) — the web company-values-page's VERBATIM static
 * composition (the four value cards + the "Back to About Us" CTA; the web
 * component fetches nothing, so neither does this screen). The meta object
 * above and the NativePageRegistry composable signature are unchanged.
 */
@Composable
fun CompanyValuesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCareerSectionScreen(pageId = "company-values", title = "Company Values", onBack = onBack, openPage = openPage, query = query)
}
