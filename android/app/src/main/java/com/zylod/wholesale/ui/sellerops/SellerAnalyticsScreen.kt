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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
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
import com.zylod.wholesale.data.api.SellerOpsRestockProduct
import com.zylod.wholesale.data.api.SellerOpsTopProduct

/**
 * t266 — SHARED typed Seller Analytics screen (pageId "seller-analytics" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * SellerAnalyticsViewModel). Real data only, from GET api/supplier/
 * analytics: the overview strip (gmv/orders/units/aov — conversionRate and
 * pageViews are honest nulls on the wire), the 30-day sales-performance
 * buckets, the top products by revenue, and the restock-watch demand from
 * active stockAlerts. The route's trafficSources is always an empty array
 * (no tracking source) and renders as an explicit honest note. Theme colors
 * only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SellerAnalyticsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SellerAnalyticsViewModel = viewModel(key = "native-seller-ops-$pageId") {
        SellerAnalyticsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SellerOpsPageScaffold(title = "Seller Analytics", onBack = onBack) {
        when {
            state.loading -> SellerOpsCenterSpinner()
            state.notSeller -> SellerOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SellerOpsOfflineEmpty(
                message = "No analytics saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> AnalyticsList(state)
        }
    }
}

@Composable
private fun AnalyticsList(state: SellerAnalyticsUiState) {
    val data = state.data ?: return
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "ana-stats", contentType = "stats") {
            data.overview?.let { o ->
                SellerOpsStatsStrip(
                    stats = listOf(
                        "GMV" to sellerOpsMoney(o.gmv),
                        "Orders" to sellerOpsCount(o.totalOrders),
                        "Units" to sellerOpsQty(o.unitsSold),
                        "AOV" to sellerOpsMoney(o.aov),
                    ),
                )
            }
        }
        item(key = "ana-nulls", contentType = "note") {
            Text(
                "Conversion rate and page views have no tracking source on the platform yet — no traffic numbers are invented here.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        when {
            state.offline -> item(key = "ana-offline", contentType = "banner") {
                SellerOpsBanner("Connection lost — showing the last loaded analytics")
            }
            state.offlineFromCache -> item(key = "ana-cache", contentType = "banner") {
                SellerOpsBanner("Offline — showing saved analytics")
            }
        }
        if (state.refreshing) {
            item(key = "ana-refreshing", contentType = "progress") { SellerOpsRefreshingBar() }
        }
        // Sales performance — the 30 fixed day buckets (real zeros included).
        if (data.salesPerformance.isNotEmpty()) {
            item(key = "ana-sales-header", contentType = "header") {
                SellerOpsSectionHeader(
                    "Sales performance",
                    "Last ${data.salesPerformance.size} days · gross per day",
                )
            }
            items(
                data.salesPerformance,
                key = { "sales-${it.date ?: it.hashCode()}" },
                contentType = { "sales-row" },
            ) { day ->
                DailyGrossRow(day.date, day.bdt)
            }
        }
        // Top products — the route's top-5 by revenue.
        if (data.topProducts.isNotEmpty()) {
            item(key = "ana-top-header", contentType = "header") {
                SellerOpsSectionHeader(
                    "Top products",
                    "By revenue · top ${data.topProducts.size}",
                )
            }
            itemsIndexedTop(data.topProducts)
        }
        // Restock demand — active watches on this supplier's products.
        data.restockDemand?.let { demand ->
            if (demand.products.isNotEmpty() || demand.totalWatchers > 0) {
                val watcherWord = if (demand.totalWatchers == 1) "watcher" else "watchers"
                item(key = "ana-restock-header", contentType = "header") {
                    SellerOpsSectionHeader(
                        "Restock demand",
                        "${sellerOpsCount(demand.totalWatchers)} active $watcherWord · buyers waiting for stock to return",
                    )
                }
                items(
                    demand.products,
                    key = { "restock-${it.productId ?: it.hashCode()}" },
                    contentType = { "restock-row" },
                ) { product ->
                    RestockCard(product)
                }
            }
        }
        // Honest empty-traffic note (the wire always sends [] here today).
        item(key = "ana-traffic", contentType = "note") {
            Text(
                if (data.trafficSources.isEmpty()) {
                    "Traffic sources: none recorded — the platform has no attribution source yet."
                } else {
                    "Traffic sources: ${data.trafficSources.size} entr${if (data.trafficSources.size == 1) "y" else "ies"}."
                },
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        item(key = "ana-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** Indexed top-product rows (rank badge + name + units + revenue). */
private fun LazyListScope.itemsIndexedTop(products: List<SellerOpsTopProduct>) {
    products.forEachIndexed { index, product ->
        item(key = "top-${product.id ?: product.hashCode()}", contentType = "top-row") {
            TopProductCard(index + 1, product)
        }
    }
}

/** One top-product row: rank, name, units sold, revenue. */
@Composable
private fun TopProductCard(rank: Int, product: SellerOpsTopProduct) {
    val revenueLabel = remember(product) { sellerOpsMoney(product.revenue) }
    val unitsLabel = remember(product) { sellerOpsQty(product.unitsSold) }
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            Text(
                rank.toString(),
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    product.name ?: "Unknown product",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "$unitsLabel unit${if (product.unitsSold == 1.0) "" else "s"} sold",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                revenueLabel,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/** One restock-demand row: watchers count, stock line, pinned variants. */
@Composable
private fun RestockCard(product: SellerOpsRestockProduct) {
    val stockLabel = remember(product) {
        "${sellerOpsQty(product.stockQuantity)} ${product.unit ?: "pcs"}"
    }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    product.productName ?: "Unknown product",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                SellerOpsStatusBadge(
                    "${product.watchers} waiting",
                    if (product.stockQuantity > 0.0) "pending" else "failed",
                )
            }
            SellerOpsKeyValue("In stock:", stockLabel)
            SellerOpsKeyValue(
                "Listing:",
                if (product.isActive) "Active" else "Inactive",
            )
            if (product.variantLabels.isNotEmpty()) {
                SellerOpsKeyValue("Watched variants:", product.variantLabels.joinToString(", "))
            }
        }
    }
}
