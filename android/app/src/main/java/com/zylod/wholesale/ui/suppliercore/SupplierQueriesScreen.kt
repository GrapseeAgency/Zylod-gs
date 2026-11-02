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
import com.zylod.wholesale.data.api.SupplierCoreQueryRow
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * t268 — SHARED typed Supplier Queries screen (pageId "supplier-queries" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * SupplierQueriesViewModel). Real data only, from GET api/supplier/queries:
 * the derived stats strip (total / open / replied / resolved from the
 * CURRENT rows), the status filter chip row (ONLY the schema's real tokens
 * — the server does not validate the param), and one elevated card per
 * buyer query (subject + queryType tag + buyer + product line + message +
 * the success-tinted Reply block when the supplier answered + status badge
 * + date). Honest loading / not-seller / offline / empty states; theme
 * colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SupplierQueriesScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierQueriesViewModel = viewModel(key = "native-supplier-core-$pageId") {
        SupplierQueriesViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SupplierCorePageScaffold(title = "Customer Queries", onBack = onBack) {
        when {
            state.loading -> SupplierCoreCenterSpinner()
            state.notSeller -> SupplierCoreGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SupplierCoreOfflineEmpty(
                message = "No queries saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> QueriesList(state = state, onFilter = vm::setStatusFilter)
        }
    }
}

/**
 * Status chips — "" = all, else ONLY the schema's real sellerCustomerQueries
 * status tokens (the ?status param has no server validation, so nothing
 * outside this vocabulary is ever sent).
 */
private val QUERY_STATUS_FILTERS = listOf(
    "" to "All",
    "open" to "Open",
    "replied" to "Replied",
    "resolved" to "Resolved",
    "closed" to "Closed",
)

@Composable
private fun QueriesList(state: SupplierQueriesUiState, onFilter: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "squer-stats", contentType = "stats") {
            val open = state.rows.count { it.status == "open" }
            val replied = state.rows.count { it.status == "replied" }
            val resolved = state.rows.count { it.status == "resolved" }
            SupplierCoreStatsStrip(
                stats = listOf(
                    "Total" to supplierCoreCount(state.rows.size),
                    "Open" to supplierCoreCount(open),
                    "Replied" to supplierCoreCount(replied),
                    "Resolved" to supplierCoreCount(resolved),
                ),
            )
        }
        item(key = "squer-filters", contentType = "filter") {
            SupplierCoreChipRow(QUERY_STATUS_FILTERS, state.statusFilter, onSelect = onFilter)
        }
        when {
            state.offline -> item(key = "squer-offline", contentType = "banner") {
                SupplierCoreBanner("Connection lost — showing the last loaded queries")
            }
            state.offlineFromCache -> item(key = "squer-cache", contentType = "banner") {
                SupplierCoreBanner("Offline — showing saved queries")
            }
        }
        if (state.refreshing) {
            item(key = "squer-refreshing", contentType = "progress") { SupplierCoreRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "squer-empty", contentType = "empty") {
                SupplierCoreEmptyState(
                    if (state.statusFilter.isNotBlank()) {
                        "No queries match this status filter."
                    } else {
                        "No queries yet — buyer questions on your products land here."
                    },
                )
            }
        } else {
            items(
                state.rows,
                key = { "squer-${it.id ?: it.hashCode()}" },
                contentType = { "squer-row" },
            ) { row ->
                QueryCard(row)
            }
        }
        item(key = "squer-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One buyer query: subject + type tag + buyer + product + reply + badge. */
@Composable
private fun QueryCard(row: SupplierCoreQueryRow) {
    val dateLabel = remember(row) { supplierCoreDate(row.createdAt) }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.subject ?: "Query",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                QueryTypeTag(row.queryType)
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 4.dp),
            ) {
                SupplierCoreStatusBadge(row.status ?: "unknown", row.status.orEmpty())
                Spacer(Modifier.width(8.dp))
                Text(
                    dateLabel,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                row.buyerName ?: "Anonymous buyer",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 6.dp),
            )
            row.productName?.takeIf(String::isNotBlank)?.let { product ->
                Text(
                    product,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            row.lastMessage?.takeIf(String::isNotBlank)?.let { message ->
                Text(
                    message,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            row.replyMessage?.takeIf(String::isNotBlank)?.let { reply ->
                Surface(
                    color = LocalZylodExtra.current.success.copy(alpha = 0.08f),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                ) {
                    Text(
                        "Reply: $reply",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(8.dp),
                    )
                }
            }
        }
    }
}

/** Small queryType tag — raw schema token on an onSurfaceVariant container. */
@Composable
private fun QueryTypeTag(queryType: String?) {
    Surface(
        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.12f),
        shape = RoundedCornerShape(50),
    ) {
        Text(
            queryType ?: "unknown",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}
