package com.zylod.wholesale.ui.suppliercore

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
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
import com.zylod.wholesale.data.api.SupplierCoreDashboardData
import com.zylod.wholesale.data.api.SupplierCoreInventoryAlertRow
import com.zylod.wholesale.data.api.SupplierCoreMonthRevenue
import com.zylod.wholesale.data.api.SupplierCorePendingVerification
import com.zylod.wholesale.data.api.SupplierCoreRecentSubOrder
import com.zylod.wholesale.data.api.SupplierCoreRegionRow
import com.zylod.wholesale.data.api.SupplierCoreTopProductRow
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import kotlin.math.roundToLong

/**
 * t268 — SHARED typed Supplier Dashboard screen (pageId
 * "supplier-dashboard" — the ui/screens delegate calls THIS, so the page
 * keeps its own SupplierDashboardViewModel). Real data only, from GET api/
 * supplier/dashboard (401 is the only not-seller code — the route never
 * 403s): the identity strip (company + verification badge + star rating),
 * the counts strip, the money strip (revenue / pending pay / this month /
 * low stock), the six-month revenue mini-bars (plain Boxes, theme colors,
 * no chart library), inventory alerts with severity badges, recent orders,
 * top products, pending verifications (only when present), customer
 * insights and the store-stats row. Every section renders an honest empty
 * line when its list is empty — never hidden, never fabricated. Theme
 * colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SupplierDashboardScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierDashboardViewModel = viewModel(key = "native-supplier-core-$pageId") {
        SupplierDashboardViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SupplierCorePageScaffold(title = "Supplier Dashboard", onBack = onBack) {
        when {
            state.loading -> SupplierCoreCenterSpinner()
            state.notSeller -> SupplierCoreGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SupplierCoreOfflineEmpty(
                message = "No dashboard saved yet — connect once to save it",
                onRetry = vm::retry,
            )
            else -> {
                val data = state.data
                if (data == null) {
                    SupplierCoreOfflineEmpty(
                        message = "No dashboard saved yet — connect once to save it",
                        onRetry = vm::retry,
                    )
                } else {
                    DashboardList(state = state, data = data)
                }
            }
        }
    }
}

@Composable
private fun DashboardList(state: SupplierDashboardUiState, data: SupplierCoreDashboardData) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when {
            state.offline -> item(key = "sdash-offline", contentType = "banner") {
                SupplierCoreBanner("Connection lost — showing the last loaded dashboard")
            }
            state.offlineFromCache -> item(key = "sdash-cache", contentType = "banner") {
                SupplierCoreBanner("Offline — showing saved dashboard")
            }
        }
        if (state.refreshing) {
            item(key = "sdash-refreshing", contentType = "progress") { SupplierCoreRefreshingBar() }
        }
        item(key = "sdash-identity", contentType = "identity") {
            IdentityCard(data)
        }
        item(key = "sdash-stats", contentType = "stats") {
            data.stats?.let { s ->
                SupplierCoreStatsStrip(
                    stats = listOf(
                        "Products" to supplierCoreCount(s.totalProducts),
                        "Orders" to supplierCoreCount(s.totalOrders),
                        "Pending" to supplierCoreCount(s.pendingOrders),
                        "Buyers" to supplierCoreCount(s.totalBuyers),
                    ),
                )
            }
        }
        item(key = "sdash-money", contentType = "stats") {
            data.stats?.let { s ->
                SupplierCoreStatsStrip(
                    stats = listOf(
                        "Revenue" to supplierCoreMoney(s.totalRevenueBDT),
                        "Pending pay" to supplierCoreMoney(s.pendingPaymentBDT),
                        "This month" to supplierCoreMoney(s.thisMonthRevenue),
                        "Low stock" to supplierCoreCount(s.lowStockCount),
                    ),
                )
            }
        }
        item(key = "sdash-revenue", contentType = "section") {
            SectionCard(title = "Last 6 months") {
                if (data.monthlyRevenue.isEmpty()) {
                    SupplierCoreEmptyState("No revenue months reported yet.")
                } else {
                    RevenueBars(data.monthlyRevenue)
                }
            }
        }
        item(key = "sdash-alerts", contentType = "section") {
            SectionCard(title = "Inventory alerts") {
                if (data.inventoryAlerts.isEmpty()) {
                    SupplierCoreEmptyState("No low-stock alerts right now.")
                } else {
                    Column {
                        data.inventoryAlerts.forEach { alert -> InventoryAlertRow(alert) }
                    }
                }
            }
        }
        item(key = "sdash-orders", contentType = "section") {
            SectionCard(title = "Recent orders") {
                if (data.recentSubOrders.isEmpty()) {
                    SupplierCoreEmptyState("No recent orders yet.")
                } else {
                    Column {
                        data.recentSubOrders.forEach { row -> RecentOrderRow(row) }
                    }
                }
            }
        }
        item(key = "sdash-top", contentType = "section") {
            SectionCard(title = "Top products") {
                if (data.topProducts.isEmpty()) {
                    SupplierCoreEmptyState("No products to rank yet.")
                } else {
                    Column {
                        data.topProducts.forEach { row -> TopProductLine(row) }
                    }
                }
            }
        }
        if (data.pendingVerifications.isNotEmpty()) {
            item(key = "sdash-verifications", contentType = "section") {
                SectionCard(title = "Pending verifications") {
                    Column {
                        data.pendingVerifications.forEach { row -> VerificationRow(row) }
                    }
                }
            }
        }
        item(key = "sdash-insights", contentType = "section") {
            data.customerInsights?.let { insights ->
                SectionCard(title = "Customer insights") {
                    Text(
                        "${supplierCoreCount(insights.newBuyers)} new · " +
                            "${supplierCoreCount(insights.repeatBuyers)} repeat buyers",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.height(4.dp))
                    if (insights.topRegions.isEmpty()) {
                        SupplierCoreEmptyState("No buyer regions to rank yet.")
                    } else {
                        Column {
                            insights.topRegions.forEach { row -> RegionLine(row) }
                        }
                    }
                }
            }
        }
        item(key = "sdash-store", contentType = "section") {
            data.storeStats?.let { store ->
                SectionCard(title = "Store stats") {
                    Text(
                        "${supplierCoreCount(store.messages)} unread messages · " +
                            "${supplierCoreCount(store.quotes)} quoted RFQs",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
        item(key = "sdash-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** Identity strip: company (bold) + verification badge + star rating. */
@Composable
private fun IdentityCard(data: SupplierCoreDashboardData) {
    val supplier = data.supplier
    val ratingLabel = remember(supplier) { "★ ${supplierCoreRating(supplier?.ratingAvg)}" }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(
                supplier?.companyName ?: "Your Store",
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 6.dp),
            ) {
                SupplierCoreStatusBadge(
                    supplier?.verificationStatus ?: "unknown",
                    supplier?.verificationStatus.orEmpty(),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    ratingLabel,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** One titled card — every dashboard section renders as exactly one. */
@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(
                title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(6.dp))
            content()
        }
    }
}

/**
 * The six-month revenue mini-bars: plain Boxes, height proportional to the
 * month's share of the max (4.dp floor for non-zero months, a 2.dp baseline
 * stub for zero months), the rounded ৳ value above when > 0 and the month
 * label below. All-zero months degrade to a flat row of baseline stubs —
 * divide-by-zero guarded. Theme colors only, no chart library, no gradients.
 */
@Composable
private fun RevenueBars(months: List<SupplierCoreMonthRevenue>) {
    val maxRevenue = months.maxOfOrNull { it.revenue } ?: 0.0
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        months.forEach { month ->
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.weight(1f),
            ) {
                // Fixed value slot keeps the baselines aligned; the rounded
                // ৳ figure renders only when the month earned something.
                Box(Modifier.fillMaxWidth().height(14.dp), contentAlignment = Alignment.Center) {
                    if (month.revenue > 0.0) {
                        Text(
                            // t277-1d: shared grouped formatter — the raw
                            // roundToLong rendered "৳1250000" (no grouping).
                            formatBdt(month.revenue),
                            fontSize = 9.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                        )
                    }
                }
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(96.dp),
                    contentAlignment = Alignment.BottomCenter,
                ) {
                    val barHeight = when {
                        month.revenue <= 0.0 -> 2.dp
                        maxRevenue <= 0.0 -> 4.dp
                        else -> maxOf(4.dp, 96.dp * (month.revenue / maxRevenue).toFloat())
                    }
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(barHeight)
                            .background(
                                MaterialTheme.colorScheme.primary,
                                RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp),
                            ),
                    )
                }
                Text(
                    month.month ?: "—",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/** One alert: name + "stock / threshold" + severity badge (red/orange/gray). */
@Composable
private fun InventoryAlertRow(alert: SupplierCoreInventoryAlertRow) {
    // 'critical' → error red, 'warning' → warning orange, anything else →
    // honest gray (never invents a classification for an unknown severity).
    val tint = when (alert.severity) {
        "critical" -> MaterialTheme.colorScheme.error
        "warning" -> LocalZylodExtra.current.warning
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    val stockLine = remember(alert) {
        "stock ${supplierCoreQty(alert.currentStock)} / threshold ${supplierCoreQty(alert.threshold)}"
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(top = 4.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                alert.name ?: "Product",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                stockLine,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.width(8.dp))
        Surface(
            color = tint.copy(alpha = 0.12f),
            shape = RoundedCornerShape(50),
        ) {
            Text(
                alert.severity ?: "unknown",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = tint,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
            )
        }
    }
}

/** One recent order: number + date + status badge + count + item + total. */
@Composable
private fun RecentOrderRow(row: SupplierCoreRecentSubOrder) {
    val dateLabel = remember(row) { supplierCoreDate(row.date) }
    val totalLabel = remember(row) { supplierCoreMoney(row.totalAmount) }
    val itemLine = remember(row) {
        "${supplierCoreCount(row.itemCount)} items · ${row.primaryItemName ?: "Products"}"
    }
    Column(Modifier.padding(top = 4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                row.orderNumber ?: "Unknown order",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            SupplierCoreStatusBadge(row.status ?: "unknown", row.status.orEmpty())
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 2.dp),
        ) {
            Text(
                itemLine,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(
                totalLabel,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        if (dateLabel.isNotBlank()) {
            Text(
                dateLabel,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** One top product: name + category + sold + price + stock. */
@Composable
private fun TopProductLine(row: SupplierCoreTopProductRow) {
    val line = remember(row) {
        "sold ${supplierCoreQty(row.soldCount)} · ${supplierCoreMoney(row.basePrice)} · " +
            "stock ${supplierCoreQty(row.stockQuantity)}"
    }
    Column(Modifier.padding(top = 4.dp)) {
        Text(
            row.name ?: "Product",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            "${row.category ?: "General"} · $line",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** One pending verification document: type + status badge + day key. */
@Composable
private fun VerificationRow(row: SupplierCorePendingVerification) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(top = 4.dp),
    ) {
        Text(
            row.type ?: "document",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            row.date ?: "—",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(8.dp))
        SupplierCoreStatusBadge(row.status ?: "unknown", row.status.orEmpty())
    }
}

/** One buyer-region row: city + orders + share percentage. */
@Composable
private fun RegionLine(row: SupplierCoreRegionRow) {
    Text(
        "${row.region ?: "Unknown"} — ${supplierCoreCount(row.orders)} orders · ${row.percentage}%",
        fontSize = 11.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(top = 2.dp),
    )
}
