package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.content.BlogScreen as SharedBlogScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "marketplace-news"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * Live data: GET api/products?limit=20&page=1 through NativePageRepository, cached on-device for offline.
"Marketplace News — the company, content and legal pages of Zylod. Content streams live from the Zylod API and renders through the shared native page model."
 */
data object MarketplaceNewsPageMeta : NativePageMeta() {
    override val pageId = "marketplace-news"
    override val title = "Marketplace News"
    override val category = "Company & Legal"
    override val kind = NativePageKind.PRODUCTS
    override val endpoint: String? = "api/products?limit=20&page=1"
    override val summary = "Marketplace News — the company, content and legal pages of Zylod. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the marketplace-news pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("about-us", "About Us"),
        NativePageLink("contact-us", "Contact Us"),
        NativePageLink("careers", "Careers"),
    )
}

/**
 * t263 — the shared NativePageBody is GONE: the web maps marketplace-news
 * onto the SAME blog-page component as blog (chunk-misc.ts:314), so this
 * pageId now delegates to the typed ui/content blog list under its OWN
 * pageId (pageId-keyed so it keeps its own BlogViewModel) — the REAL GET
 * api/blog cards with the identical "Insights for Wholesale Traders"
 * header copy the SPA renders for this id. The meta object above and the
 * NativePageRegistry composable signature are unchanged.
 */
@Composable
fun MarketplaceNewsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedBlogScreen(pageId = "marketplace-news", title = "Marketplace News", onBack = onBack, openPage = openPage, query = query)
}
