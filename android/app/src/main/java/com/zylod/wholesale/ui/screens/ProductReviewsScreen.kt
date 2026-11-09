package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.reviews.ReviewsListScreen as SharedReviewsListScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "product-reviews"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t282 — the wrong-data generic grid is GONE (this pageId previously
 * rendered GET api/products — a catalog feed with nothing to do with
 * reviews). The body is a thin delegation to the typed shared reviews
 * screen (pageId-keyed so it keeps its own ViewModel), which fetches the
 * REAL GET api/reviews?productId= feed with the product header resolved
 * exactly like product-reviews-page.tsx. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object ProductReviewsPageMeta : NativePageMeta() {
    override val pageId = "product-reviews"
    override val title = "Product Reviews"
    override val category = "Shopping & Products"
    override val kind = NativePageKind.PRODUCTS
    override val endpoint: String? = "api/reviews" // typed ReviewsViewModel owns the calls
    override val summary =
        "The real product reviews feed — GET api/reviews?productId= through the typed " +
            "reviews screen (the old generic api/products grid that ignored reviews is gone)."
    override val tabHint = ""
    override val bullets = listOf(
        "Reviews stream from the REAL GET api/reviews?productId= feed (createdAt DESC).",
        "Header card resolves the product exactly like product-reviews-page.tsx.",
        "Write-a-review deep-links to the typed review form (rate-products).",
    )
    override val related = listOf(
        NativePageLink("product-reviews-list", "Product Reviews List"),
        NativePageLink("rate-products", "Write a Review"),
        NativePageLink("product-detail", "Product Detail"),
    )
}

/**
 * Delegation only — the shared [SharedReviewsListScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/reviews, not on
 * this file's own same-named composable).
 */
@Composable
fun ProductReviewsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedReviewsListScreen(pageId = "product-reviews", onBack = onBack, openPage = openPage, query = query)
}
