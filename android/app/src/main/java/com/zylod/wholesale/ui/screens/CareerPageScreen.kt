package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.careers.CareersScreen as SharedCareersScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "career-page"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Career Page — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object CareerPagePageMeta : NativePageMeta() {
    override val pageId = "career-page"
    override val title = "Career Page"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Career Page — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the career-page pageId via RouteOwnership.",
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
 * CareersViewModel) — the REAL GET api/careers board. The web's
 * career-page chunk entry (chunk-misc.ts:290) maps onto the SAME
 * careers-page component as careers/careers-page, so this native pageId
 * renders the identical composition under its own top-bar title. The meta
 * object above and the NativePageRegistry composable signature are
 * unchanged.
 */
@Composable
fun CareerPageScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCareersScreen(pageId = "career-page", title = "Career Page", onBack = onBack, openPage = openPage, query = query)
}
