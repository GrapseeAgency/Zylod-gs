package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.reviews.ReviewsListScreen as SharedReviewsListScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "product-reviews-list"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t254 — the NativePage PRODUCTS body is GONE: the web SPA serves this
 * pageId from the SAME product-reviews-page.tsx component as all-reviews,
 * and this pageId is now owned by the typed ui/reviews implementation.
 * The body is a thin delegation to the shared reviews-list screen
 * (pageId-keyed so it keeps its own ViewModel) — the REAL GET
 * api/reviews?productId= payload with the product header card, filter
 * pills, verified badges and the honest empty/error states. The meta
 * object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object ProductReviewsListPageMeta : NativePageMeta() {
    override val pageId = "product-reviews-list"
    override val title = "Product Reviews List"
    override val category = "Shopping & Products"
    override val kind = NativePageKind.PRODUCTS
    override val endpoint: String? = "api/products?limit=20&page=1"
    override val summary = "Product Reviews List — product discovery and buying on the Zylod marketplace. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the product-reviews-list pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("all-products", "All Products"),
        NativePageLink("flash-deals", "Flash Deals"),
        NativePageLink("category-browser", "Category Browser"),
    )
}

/**
 * Delegation only — the shared [SharedReviewsListScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/reviews, not on
 * this file's own same-named composable).
 */
@Composable
fun ProductReviewsListScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedReviewsListScreen(pageId = "product-reviews-list", onBack = onBack, openPage = openPage, query = query)
}
