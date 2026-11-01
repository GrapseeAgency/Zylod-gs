package com.zylod.wholesale.ui.sellerops

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.SellerOpsReviewRow
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * t266 — SHARED typed Seller Reviews screen (pageId "seller-reviews" — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * SellerReviewsViewModel). Real data only, from GET api/supplier/reviews:
 * the route's per-kind aggregates (product rating is the headline, the
 * store rail carries its own pair) and one elevated card per review (kind
 * badge, stars, comment, buyer, verified-purchase state, product context,
 * date). The route takes NO status/rating query param (verified in the
 * handler), so there is NO chip row here. Honest loading / not-seller /
 * offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SellerReviewsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SellerReviewsViewModel = viewModel(key = "native-seller-ops-$pageId") {
        SellerReviewsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SellerOpsPageScaffold(title = "Seller Reviews", onBack = onBack) {
        when {
            state.loading -> SellerOpsCenterSpinner()
            state.notSeller -> SellerOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SellerOpsOfflineEmpty(
                message = "No reviews saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> ReviewsList(state)
        }
    }
}

@Composable
private fun ReviewsList(state: SellerReviewsUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "revr-stats", contentType = "stats") {
            state.data?.let { d ->
                SellerOpsStatsStrip(
                    stats = listOf(
                        "Product ★" to sellerOpsRating(d.averageRating),
                        "Reviews" to sellerOpsCount(d.totalReviews),
                        "Store ★" to sellerOpsRating(d.storeAverageRating),
                        "Store" to sellerOpsCount(d.storeTotalReviews),
                    ),
                )
            }
        }
        when {
            state.offline -> item(key = "revr-offline", contentType = "banner") {
                SellerOpsBanner("Connection lost — showing the last loaded reviews")
            }
            state.offlineFromCache -> item(key = "revr-cache", contentType = "banner") {
                SellerOpsBanner("Offline — showing saved reviews")
            }
        }
        if (state.refreshing) {
            item(key = "revr-refreshing", contentType = "progress") { SellerOpsRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "revr-empty", contentType = "empty") {
                Text(
                    "No reviews yet — buyer product reviews and store reviews land here, newest first.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "review-${it.id ?: it.hashCode()}" },
                contentType = { "review-row" },
            ) { row ->
                ReviewCard(row)
            }
        }
        item(key = "revr-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One review row: kind badge, stars, comment, buyer, product context. */
@Composable
private fun ReviewCard(row: SellerOpsReviewRow) {
    val stars = remember(row) { "★".repeat(row.rating.coerceIn(0, 5)) }
    val dateLabel = remember(row) { sellerOpsDateOrDash(row.createdAt) }
    val isStore = row.kind == "store"

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        row.buyerName ?: "Anonymous buyer",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        stars,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = LocalZylodExtra.current.warning,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                SellerOpsStatusBadge(
                    if (isStore) "Store" else "Product",
                    if (isStore) "active" else "pending",
                )
            }
            row.comment?.takeIf(String::isNotBlank)?.let {
                Text(
                    it,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (!isStore) {
                row.productName?.let { SellerOpsKeyValue("Product:", it) }
            }
            SellerOpsKeyValue(
                "Verified purchase:",
                if (row.verifiedPurchase) "Yes" else "No",
            )
            SellerOpsKeyValue("Date:", dateLabel)
        }
    }
}
