package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.content.NewsletterScreen as SharedNewsletterScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "newsletter"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Newsletter — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object NewsletterPageMeta : NativePageMeta() {
    override val pageId = "newsletter"
    override val title = "Newsletter"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Verified manufacturers offering limited-time tiered rate discounts for bulk buyers."
    override val tabHint = ""
    override val bullets = listOf(
        "Promotions &amp; Deals",
        "New volume discount deals, supplier promotions, and flash sales will be announced here.",
        "Factory Direct &amp; Volume Campaigns",
        "Could not load promotions",
        "No active promotions right now",
    )
    override val related = listOf(
        NativePageLink("promo-preferences", "Promo Preferences"),
        NativePageLink("category-browser", "Category Browser"),
        NativePageLink("promo-detail", "Promo Detail"),
    )
}

/**
 * t263 — the curated-metadata body is GONE: this pageId is now owned by
 * the typed ui/content implementation. The body is a thin delegation to
 * the shared newsletter screen (pageId-keyed so it keeps its own
 * NewsletterViewModel) — the REAL POST api/newsletter subscribe surface
 * (the web footer bar's verbatim copy, the route's own EMAIL_RE client
 * gate, and the already-subscribed / success / error texts verbatim;
 * POST-only — the route has no GET). The meta object above and the
 * NativePageRegistry composable signature are unchanged.
 */
@Composable
fun NewsletterScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedNewsletterScreen(pageId = "newsletter", onBack = onBack, openPage = openPage, query = query)
}
