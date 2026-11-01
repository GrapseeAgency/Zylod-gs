package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.content.BlogPostScreen as SharedBlogPostScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "blog-post"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Blog Post — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object BlogPostPageMeta : NativePageMeta() {
    override val pageId = "blog-post"
    override val title = "Blog Post"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Blog Post — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the blog-post pageId via RouteOwnership.",
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
 * the shared blog-post detail (pageId-keyed so it keeps its own
 * BlogPostViewModel) — the REAL GET api/blog/{slug} read: the "slug="
 * query pair seeds the fetch, the plain-text body renders as the web's
 * blank-line paragraphs, and 404 shows the verbatim "This article does
 * not exist" card. The meta object above and the NativePageRegistry
 * composable signature are unchanged.
 */
@Composable
fun BlogPostScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedBlogPostScreen(pageId = "blog-post", onBack = onBack, openPage = openPage, query = query)
}
