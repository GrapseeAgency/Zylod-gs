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
import com.zylod.wholesale.data.api.SellerOpsPayoutRow

/**
 * t266 — SHARED typed Seller Payouts screen (pageId "seller-payouts" — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * SellerPayoutsViewModel). Real data only, from GET api/supplier/payouts:
 * the route's derived summary strip (totalPaid / pendingAmount / counts,
 * real zeros when the ledger is empty) and one elevated card per payout
 * (amount + status badge + method + destination + admin reference + fee +
 * timestamps). Honest loading / not-seller / offline / empty states; theme
 * colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SellerPayoutsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SellerPayoutsViewModel = viewModel(key = "native-seller-ops-$pageId") {
        SellerPayoutsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SellerOpsPageScaffold(title = "Seller Payouts", onBack = onBack) {
        when {
            state.loading -> SellerOpsCenterSpinner()
            state.notSeller -> SellerOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SellerOpsOfflineEmpty(
                message = "No payouts saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> PayoutsList(state)
        }
    }
}

@Composable
private fun PayoutsList(state: SellerPayoutsUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "pay-stats", contentType = "stats") {
            state.summary?.let { s ->
                SellerOpsStatsStrip(
                    stats = listOf(
                        "Paid out" to sellerOpsMoney(s.totalPaid),
                        "Pending" to sellerOpsMoney(s.pendingAmount),
                        "Completed" to sellerOpsCount(s.completedCount),
                        "Waiting" to sellerOpsCount(s.pendingCount),
                    ),
                )
            }
        }
        when {
            state.offline -> item(key = "pay-offline", contentType = "banner") {
                SellerOpsBanner("Connection lost — showing the last loaded payouts")
            }
            state.offlineFromCache -> item(key = "pay-cache", contentType = "banner") {
                SellerOpsBanner("Offline — showing saved payouts")
            }
        }
        if (state.refreshing) {
            item(key = "pay-refreshing", contentType = "progress") { SellerOpsRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "pay-empty", contentType = "empty") {
                Text(
                    "No payouts yet — completed order earnings appear here once finance releases them.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "payout-${it.id ?: it.hashCode()}" },
                contentType = { "payout-row" },
            ) { row ->
                PayoutCard(row)
            }
        }
        item(key = "pay-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One payout row: amount + status badge, method, destination, trail. */
@Composable
private fun PayoutCard(row: SellerOpsPayoutRow) {
    val amountLabel = remember(row) { sellerOpsMoney(row.amount) }
    val feeLabel = remember(row) { sellerOpsMoney(row.fee) }
    val processedLabel = remember(row) { sellerOpsDateOrDash(row.processedAt) }
    val createdLabel = remember(row) { sellerOpsDateOrDash(row.createdAt) }

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
                        amountLabel,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        row.id?.let { "Payout …${it.takeLast(10)}" } ?: "Payout",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                SellerOpsStatusBadge(
                    row.status ?: "unknown",
                    row.status.orEmpty(),
                )
            }
            SellerOpsKeyValue("Method:", row.method?.replace('_', ' ') ?: "—")
            row.destination?.takeIf(String::isNotBlank)?.let {
                SellerOpsKeyValue("Destination:", it)
            }
            row.reference?.takeIf(String::isNotBlank)?.let {
                SellerOpsKeyValue("Reference:", it)
            }
            SellerOpsKeyValue("Fee:", feeLabel)
            SellerOpsKeyValue("Processed at:", processedLabel)
            SellerOpsKeyValue("Requested:", createdLabel)
        }
    }
}
