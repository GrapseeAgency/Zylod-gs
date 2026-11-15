package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.sellerops.SellerReviewsScreen as SharedSellerReviewsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "seller-reviews"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t266 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/sellerops implementation. The body is a thin delegation to the
 * shared seller-reviews screen (pageId-keyed so it keeps its own ViewModel)
 * — the REAL GET api/supplier/reviews console: the per-kind aggregates and
 * the merged product+store review rail. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object SellerReviewsPageMeta : NativePageMeta() {
    override val pageId = "seller-reviews"
    override val title = "Seller Reviews"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Buyer reviews for your products will appear here once buyers start reviewing."
    override val tabHint = ""
    override val bullets = listOf(
        "Seller Reviews",
        "Rating Overview",
        "No reviews yet",
    )
    override val related = listOf(
        NativePageLink("seller-review-reply", "Seller Review Reply"),
    )
}

/**
 * Delegation only — the shared [SharedSellerReviewsScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/sellerops, not on this file's own same-named composable).
 */
@Composable
fun SellerReviewsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSellerReviewsScreen(pageId = "seller-reviews", onBack = onBack, openPage = openPage, query = query)
}
