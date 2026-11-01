package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.careers.CareerSectionScreen as SharedCareerSectionScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "career-internships"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Career Internships — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object CareerInternshipsPageMeta : NativePageMeta() {
    override val pageId = "career-internships"
    override val title = "Career Internships"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Career Internships — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the career-internships pageId via RouteOwnership.",
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
 * CareerSectionViewModel) — chunk-misc.ts:442 maps career-internships onto
 * the SAME career-culture-page component as career-culture (the web has NO
 * internships-specific endpoint or copy), so the composition is that
 * page's VERBATIM static copy (intro + four numbered pillars + "Join the
 * Team"). The meta object above and the NativePageRegistry composable
 * signature are unchanged.
 */
@Composable
fun CareerInternshipsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCareerSectionScreen(pageId = "career-internships", title = "Career Internships", onBack = onBack, openPage = openPage, query = query)
}
