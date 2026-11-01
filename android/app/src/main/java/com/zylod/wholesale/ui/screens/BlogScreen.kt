package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.content.BlogScreen as SharedBlogScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "blog"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Blog — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object BlogPageMeta : NativePageMeta() {
    override val pageId = "blog"
    override val title = "Blog"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Blog — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the blog pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("about-us", "About Us"),
        NativePageLink("contact-us", "Contact Us"),
        NativePageLink("careers", "Careers"),
    )
}

/**
 * t263 — the curated-metadata body is GONE: this pageId is now owned by
 * the typed ui/content implementation. The body is a thin delegation to
 * the shared blog list (pageId-keyed so it keeps its own BlogViewModel)
 * — the REAL GET api/blog cards: cover image, category chip, excerpt and
 * the date + Read footer → openPage("blog-post") with the "slug=" pair.
 * The meta object above and the NativePageRegistry composable signature
 * are unchanged.
 */
@Composable
fun BlogScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedBlogScreen(pageId = "blog", title = "Blog", onBack = onBack, openPage = openPage, query = query)
}
