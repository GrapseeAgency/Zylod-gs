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
import com.zylod.wholesale.data.api.SellerOpsRevenueLedgerRow

/**
 * t266 — SHARED typed Seller Revenue screen (pageId "seller-revenue" — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * SellerRevenueViewModel). Real data only, from GET api/supplier/revenue:
 * the summary strip (gross + recognized — the wire's commission/net numbers
 * are honest nulls and render as an explicit "not tracked yet" line), the
 * daily gross series, and one elevated card per ledger line (order +
 * payment status badge + fulfillment status + product line math). Honest
 * loading / not-seller / offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SellerRevenueScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SellerRevenueViewModel = viewModel(key = "native-seller-ops-$pageId") {
        SellerRevenueViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SellerOpsPageScaffold(title = "Seller Revenue", onBack = onBack) {
        when {
            state.loading -> SellerOpsCenterSpinner()
            state.notSeller -> SellerOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SellerOpsOfflineEmpty(
                message = "No revenue saved yet — connect once to save it",
                onRetry = vm::retry,
            )
            else -> RevenueList(state)
        }
    }
}

@Composable
private fun RevenueList(state: SellerRevenueUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "rev-stats", contentType = "stats") {
            state.summary?.let { s ->
                SellerOpsStatsStrip(
                    stats = listOf(
                        "Gross" to sellerOpsMoney(s.gross),
                        "Recognized" to sellerOpsMoney(s.recognized),
                        "Lines" to sellerOpsCount(state.ledger.size),
                        "Days" to sellerOpsCount(state.dailySeries.size),
                    ),
                )
            }
        }
        item(key = "rev-nulls", contentType = "note") {
            val hasNulls = state.summary?.let {
                it.commissionFees == null || it.deliveryDeductions == null ||
                    it.netRevenue == null || it.availableForPayout == null
            } == true
            if (hasNulls) {
                Text(
                    "Commission, delivery deductions, net revenue and payout availability are not tracked by the platform yet — no numbers are invented here.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        when {
            state.offline -> item(key = "rev-offline", contentType = "banner") {
                SellerOpsBanner("Connection lost — showing the last loaded revenue")
            }
            state.offlineFromCache -> item(key = "rev-cache", contentType = "banner") {
                SellerOpsBanner("Offline — showing saved revenue")
            }
        }
        if (state.refreshing) {
            item(key = "rev-refreshing", contentType = "progress") { SellerOpsRefreshingBar() }
        }
        if (state.dailySeries.isNotEmpty()) {
            item(key = "rev-daily-header", contentType = "header") {
                SellerOpsSectionHeader(
                    "Daily gross",
                    "${state.dailySeries.size} day${if (state.dailySeries.size != 1) "s" else ""} with recorded order lines",
                )
            }
            items(
                state.dailySeries,
                key = { "day-${it.date ?: it.hashCode()}" },
                contentType = { "day-row" },
            ) { day ->
                DailyGrossRow(day.date, day.gross)
            }
        }
        item(key = "rev-ledger-header", contentType = "header") {
            SellerOpsSectionHeader(
                "Ledger",
                if (state.ledger.isEmpty()) {
                    "No sales yet — order lines on your products land here"
                } else {
                    "${state.ledger.size} line${if (state.ledger.size != 1) "s" else ""} · newest first"
                },
            )
        }
        items(
            state.ledger,
            key = { "ledger-${it.id ?: it.hashCode()}" },
            contentType = { "ledger-row" },
        ) { row ->
            LedgerCard(row)
        }
        item(key = "rev-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * One daily-gross line: "Jan 5 · ৳1,234.00" in a bordered row. Internal (not
 * private) because the analytics screen reuses the exact same row for its
 * 30-day sales-performance buckets.
 */
@Composable
internal fun DailyGrossRow(day: String?, gross: Double) {
    val dayLabel = remember(day) { sellerOpsDayLabel(day) }
    val grossLabel = remember(gross) { sellerOpsMoney(gross) }
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
                dayLabel,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.weight(1f))
            Text(
                grossLabel,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/** One ledger line: order + payment badge + fulfillment + product math. */
@Composable
private fun LedgerCard(row: SellerOpsRevenueLedgerRow) {
    val grossLabel = remember(row) { sellerOpsMoney(row.gross) }
    val unitLabel = remember(row) { sellerOpsMoney(row.unitPrice) }
    val qtyLabel = remember(row) { sellerOpsQty(row.quantity) }
    val dateLabel = remember(row) { sellerOpsDateOrDash(row.date) }

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
                        grossLabel,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                SellerOpsStatusBadge(
                    row.paymentStatus ?: "unknown",
                    row.paymentStatus.orEmpty(),
                )
            }
            row.productName?.let { SellerOpsKeyValue("Product:", it) }
            SellerOpsKeyValue("Line:", "$qtyLabel × $unitLabel")
            SellerOpsKeyValue("Fulfillment:", row.fulfillmentStatus?.replace('_', ' ') ?: "—")
            SellerOpsKeyValue("Date:", dateLabel)
        }
    }
}
