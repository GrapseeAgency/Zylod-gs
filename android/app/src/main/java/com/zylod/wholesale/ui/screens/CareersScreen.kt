package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.careers.CareersScreen as SharedCareersScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "careers"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Careers — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object CareersPageMeta : NativePageMeta() {
    override val pageId = "careers"
    override val title = "Careers"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Join a fast-growing team of engineers, designers, and supply chain operators digitizing Bangladesh’s 40B wholesale ecosystem."
    override val tabHint = ""
    override val bullets = listOf(
        "Careers at Zylod",
        "Build the Future of South Asian B2B Wholesale Commerce",
        "Culture & Benefits",
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
 * the shared careers board (pageId-keyed so it keeps its own
 * CareersViewModel) — the REAL GET api/careers board: the "We are hiring!"
 * hero, the Culture & Benefits quick-nav grid, the department chips and
 * the job rows (tap → job-detail, Apply → the inline api/careers/apply
 * card). The meta object above and the NativePageRegistry composable
 * signature are unchanged.
 */
@Composable
fun CareersScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCareersScreen(pageId = "careers", title = "Careers", onBack = onBack, openPage = openPage, query = query)
}
