package com.zylod.wholesale.ui.adminops

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.zylod.wholesale.data.api.AdminOpsPaymentRow

/**
 * t265 — SHARED typed Admin Payments screen (pageId "admin-payments" — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * AdminPaymentsOpsViewModel). Real data only, from GET api/admin/payments:
 * the platform-wide status strip, the status filter chip row, page meta, and
 * one elevated card per payment (order + amount + status badge + method/
 * brand + buyer display name + supplier names + transaction/timestamps).
 * Honest loading / not-admin / offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun AdminPaymentsOpsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AdminPaymentsOpsViewModel = viewModel(key = "native-admin-ops-$pageId") {
        AdminPaymentsOpsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    AdminOpsPageScaffold(title = "Admin Payments", onBack = onBack) {
        when {
            state.loading -> AdminOpsCenterSpinner()
            state.notAdmin -> AdminOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> AdminOpsOfflineEmpty(
                message = "No payments saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> PaymentsList(
                state = state,
                onLoadMore = vm::loadMore,
                onFilter = vm::setStatusFilter,
            )
        }
    }
}

/** Status chips — "" = all, else the handler's exact payment statuses. */
private val STATUS_FILTERS = listOf(
    "" to "All",
    "pending" to "Pending",
    "success" to "Success",
    "failed" to "Failed",
    "refunded" to "Refunded",
)

@Composable
private fun PaymentsList(
    state: AdminPaymentsOpsUiState,
    onLoadMore: () -> Unit,
    onFilter: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "pay-stats", contentType = "stats") {
            state.stats?.let { s ->
                AdminOpsStatsStrip(
                    stats = listOf(
                        "Total" to adminOpsCount(s.total),
                        "Pending" to adminOpsCount(s.pending),
                        "Success" to adminOpsCount(s.success),
                        "Failed" to adminOpsCount(s.failed),
                        "Refunded" to adminOpsCount(s.refunded),
                    ),
                )
            }
        }
        item(key = "pay-filters", contentType = "filter") {
            AdminOpsChipRow(STATUS_FILTERS, state.statusFilter, onSelect = onFilter)
        }
        when {
            state.offline -> item(key = "pay-offline", contentType = "banner") {
                AdminOpsBanner("Connection lost — showing the last loaded payments")
            }
            state.offlineFromCache -> item(key = "pay-cache", contentType = "banner") {
                AdminOpsBanner("Offline — showing saved payments")
            }
        }
        if (state.refreshing) {
            item(key = "pay-refreshing", contentType = "progress") { AdminOpsRefreshingBar() }
        }
        item(key = "pay-meta", contentType = "meta") {
            Text(
                "Page ${state.page} of ${state.totalPages} · " +
                    "${state.total} payment${if (state.total != 1) "s" else ""}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state.rows.isEmpty()) {
            item(key = "pay-empty", contentType = "empty") {
                Text(
                    if (state.statusFilter.isNotBlank()) {
                        "No payments match this status filter."
                    } else {
                        "No payments yet — buyer submissions land here."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "pay-${it.id ?: it.hashCode()}" },
                contentType = { "pay-row" },
            ) { row ->
                PaymentCard(row)
            }
            if (state.page < state.totalPages) {
                item(key = "pay-load-more", contentType = "load-more") {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                    ) {
                        TextButton(onClick = onLoadMore, enabled = !state.loadingMore) {
                            Text(
                                if (state.loadingMore) "Loading…" else "Load more",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
        }
        item(key = "pay-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One payment row: order + amount, status badge, method, parties, trail. */
@Composable
private fun PaymentCard(row: AdminOpsPaymentRow) {
    val amountLabel = remember(row) { adminOpsMoney(row.amount) }
    val methodLine = remember(row) {
        listOfNotNull(
            row.method?.replace('_', ' '),
            row.brand,
        ).joinToString(" · ").ifBlank { "Unknown method" }
    }
    val supplierLine = remember(row) {
        row.suppliers.joinToString(", ").ifBlank { null }
    }
    val paidLabel = remember(row) { adminOpsDateOrDash(row.paidAt) }

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
                        row.orderNumber ?: row.orderId?.let { "Order …${it.takeLast(10)}" } ?: "Unknown order",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        amountLabel,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                AdminOpsStatusBadge(
                    row.status ?: "unknown",
                    row.status.orEmpty(),
                )
            }
            AdminOpsKeyValue("Method:", methodLine)
            row.buyer?.displayName?.let { AdminOpsKeyValue("Buyer:", it) }
            supplierLine?.let { AdminOpsKeyValue("Suppliers:", it) }
            row.transactionId?.takeIf(String::isNotBlank)?.let { tx ->
                AdminOpsKeyValue("Transaction:", tx)
            }
            AdminOpsKeyValue("Order total:", adminOpsMoney(row.orderTotal))
            AdminOpsKeyValue("Paid at:", paidLabel)
        }
    }
}
