package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.reviews.ReviewsListScreen as SharedReviewsListScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "all-reviews"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t254 — the curated-metadata body is GONE: this pageId is now owned by
 * the typed ui/reviews implementation. The body is a thin delegation to
 * the shared reviews-list screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL GET api/reviews?productId= payload with the
 * product header card, filter pills, verified badges and the honest
 * empty/error states. The meta object below and the NativePageRegistry
 * composable signature are unchanged.
 */
data object AllReviewsPageMeta : NativePageMeta() {
    override val pageId = "all-reviews"
    override val title = "All Reviews"
    override val category = "Shopping & Products"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Be the first to share your experience with this product."
    override val tabHint = ""
    override val bullets = listOf(
        "Try a different filter to see more reviews.",
        "Our team will review this submission. Thanks for keeping Zylod safe.",
    )
    override val related = listOf(
        NativePageLink("notifications", "Notifications"),
        NativePageLink("write-review", "Write Review"),
    )
}

/**
 * Delegation only — the shared [SharedReviewsListScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/reviews, not on
 * this file's own same-named composable).
 */
@Composable
fun AllReviewsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedReviewsListScreen(pageId = "all-reviews", onBack = onBack, openPage = openPage, query = query)
}
