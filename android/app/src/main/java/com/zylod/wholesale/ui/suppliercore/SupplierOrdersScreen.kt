package com.zylod.wholesale.ui.suppliercore

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
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
import com.zylod.wholesale.data.api.SupplierCoreOrderItem
import com.zylod.wholesale.data.api.SupplierCoreOrderRow

/**
 * t267 — SHARED typed Supplier Orders screen (pageId "supplier-orders" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * SupplierOrdersViewModel). Real data only, from GET api/supplier/orders:
 * the derived stats strip (total / delivered / open / value), the status
 * filter chip row (the handler's exact seven subOrder statuses), and one
 * elevated card per subOrder (order number + status badge + payment badge +
 * buyer + pack count + ৳ total + item lines). Honest loading / not-seller
 * / offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SupplierOrdersScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierOrdersViewModel = viewModel(key = "native-supplier-core-$pageId") {
        SupplierOrdersViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SupplierCorePageScaffold(title = "Supplier Orders", onBack = onBack) {
        when {
            state.loading -> SupplierCoreCenterSpinner()
            state.notSeller -> SupplierCoreGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SupplierCoreOfflineEmpty(
                message = "No orders saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> OrdersList(state = state, onFilter = vm::setStatusFilter)
        }
    }
}

/** Status chips — "" = all, else the handler's exact subOrder statuses. */
private val ORDER_STATUS_FILTERS = listOf(
    "" to "All",
    "pending" to "pending",
    "confirmed" to "confirmed",
    "packed" to "packed",
    "shipped" to "shipped",
    "delivered" to "delivered",
    "cancelled" to "cancelled",
    "returned" to "returned",
)

@Composable
private fun OrdersList(state: SupplierOrdersUiState, onFilter: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "sord-stats", contentType = "stats") {
            val delivered = state.rows.count { it.status == "delivered" }
            val open = state.rows.count {
                it.status == "pending" || it.status == "confirmed" ||
                    it.status == "packed" || it.status == "shipped"
            }
            val value = state.rows.sumOf { it.totalAmount }
            SupplierCoreStatsStrip(
                stats = listOf(
                    "Total" to supplierCoreCount(state.rows.size),
                    "Delivered" to supplierCoreCount(delivered),
                    "Open" to supplierCoreCount(open),
                    "Value" to supplierCoreMoney(value),
                ),
            )
        }
        item(key = "sord-filters", contentType = "filter") {
            SupplierCoreChipRow(ORDER_STATUS_FILTERS, state.statusFilter, onSelect = onFilter)
        }
        when {
            state.offline -> item(key = "sord-offline", contentType = "banner") {
                SupplierCoreBanner("Connection lost — showing the last loaded orders")
            }
            state.offlineFromCache -> item(key = "sord-cache", contentType = "banner") {
                SupplierCoreBanner("Offline — showing saved orders")
            }
        }
        if (state.refreshing) {
            item(key = "sord-refreshing", contentType = "progress") { SupplierCoreRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "sord-empty", contentType = "empty") {
                SupplierCoreEmptyState(
                    if (state.statusFilter.isNotBlank()) {
                        "No orders match this status filter."
                    } else {
                        "No orders yet — buyer orders on your products land here."
                    },
                )
            }
        } else {
            items(
                state.rows,
                key = { "sord-${it.id ?: it.hashCode()}" },
                contentType = { "sord-row" },
            ) { row ->
                OrderCard(row)
            }
        }
        item(key = "sord-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One subOrder: number + badges + buyer + pack/total math + item lines. */
@Composable
private fun OrderCard(row: SupplierCoreOrderRow) {
    val totalLabel = remember(row) { supplierCoreMoney(row.totalAmount) }
    val packsLabel = remember(row) { "${supplierCoreQty(row.moqPackCount)} packs" }
    val dateLabel = remember(row) { supplierCoreDateOrDash(row.createdAt) }

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
                        row.orderNumber ?: "Unknown order",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        totalLabel,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                SupplierCoreStatusBadge(
                    row.status ?: "unknown",
                    row.status.orEmpty(),
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 4.dp),
            ) {
                SupplierCoreStatusBadge(
                    row.paymentStatus ?: "unknown",
                    row.paymentStatus.orEmpty(),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    dateLabel,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            SupplierCoreKeyValue("Buyer:", row.buyerCompanyName ?: "—")
            row.buyerName?.takeIf(String::isNotBlank)?.let { SupplierCoreKeyValue("Contact:", it) }
            SupplierCoreKeyValue("Packs:", packsLabel)
            if (row.items.isNotEmpty()) {
                row.items.forEach { item ->
                    ItemLine(item)
                }
            }
        }
    }
}

/** "name × qty unit — ৳price" — the route's own "Product" fallback. */
@Composable
private fun ItemLine(item: SupplierCoreOrderItem) {
    val line = remember(item) {
        val unitPart = item.unit?.takeIf(String::isNotBlank)?.let { " $it" } ?: ""
        "${item.name ?: "Product"} × ${supplierCoreQty(item.quantity)}$unitPart — ${supplierCoreMoney(item.price)}"
    }
    Text(
        line,
        fontSize = 11.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(top = 2.dp),
    )
}
