package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.content.PressReleaseDetailScreen as SharedPressReleaseDetailScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "press-release-detail"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Press Release Detail — the company, content and legal pages of Zylod. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object PressReleaseDetailPageMeta : NativePageMeta() {
    override val pageId = "press-release-detail"
    override val title = "Press Release Detail"
    override val category = "Company & Legal"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Press Release"
    override val tabHint = ""
    override val bullets = listOf(
        "Press Release",
        "Related Releases",
    )
    override val related = listOf(
        NativePageLink("press-media", "Press Media"),
    )
}

/**
 * t263 — the curated-metadata body is GONE: this pageId is now owned by
 * the typed ui/content implementation. The body is a thin delegation to
 * the shared press-release detail (pageId-keyed so it keeps its own
 * PressReleaseDetailViewModel) — the REAL GET api/press/{slug} read: the
 * "slug=" pair (or the web's verbatim default release) seeds the fetch,
 * contentEn renders as the web's one pre-wrapped plain-text block, the
 * live views counter and the Related Releases rows re-enter this same
 * pageId. The meta object above and the NativePageRegistry composable
 * signature are unchanged.
 */
@Composable
fun PressReleaseDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedPressReleaseDetailScreen(pageId = "press-release-detail", onBack = onBack, openPage = openPage, query = query)
}
