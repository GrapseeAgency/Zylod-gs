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
import com.zylod.wholesale.data.api.SellerOpsCustomerRow

/**
 * t266 — SHARED typed Seller Customer Insights screen (pageId
 * "seller-customer-insights" — the ui/screens delegate calls THIS, so the
 * page keeps its own SellerCustomerInsightsViewModel). Real data only, from
 * GET api/supplier/customers: the route's honest summary strip (customers,
 * repeat customers, real average orders, lifetime value) and one elevated
 * card per buyer (display name + repeat badge, email, order counts by
 * state, spend, first/last order dates). No demographics or loyalty scores
 * — the platform does not track them. Honest loading / not-seller /
 * offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SellerCustomerInsightsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SellerCustomerInsightsViewModel = viewModel(key = "native-seller-ops-$pageId") {
        SellerCustomerInsightsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SellerOpsPageScaffold(title = "Seller Customer Insights", onBack = onBack) {
        when {
            state.loading -> SellerOpsCenterSpinner()
            state.notSeller -> SellerOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SellerOpsOfflineEmpty(
                message = "No customer insights saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> CustomersList(state)
        }
    }
}

@Composable
private fun CustomersList(state: SellerCustomerInsightsUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "cus-stats", contentType = "stats") {
            state.summary?.let { s ->
                SellerOpsStatsStrip(
                    stats = listOf(
                        "Customers" to sellerOpsCount(s.totalCustomers),
                        "Repeat" to sellerOpsCount(s.repeatCustomers),
                        "Avg orders" to (s.avgOrdersPerCustomer?.let { sellerOpsQty(it) } ?: "—"),
                        "Lifetime" to sellerOpsMoney(s.lifetimeValue),
                    ),
                )
            }
        }
        when {
            state.offline -> item(key = "cus-offline", contentType = "banner") {
                SellerOpsBanner("Connection lost — showing the last loaded customers")
            }
            state.offlineFromCache -> item(key = "cus-cache", contentType = "banner") {
                SellerOpsBanner("Offline — showing saved customers")
            }
        }
        if (state.refreshing) {
            item(key = "cus-refreshing", contentType = "progress") { SellerOpsRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "cus-empty", contentType = "empty") {
                Text(
                    "No customers yet — buyers who order your products appear here, top spenders first.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "cus-${it.buyerId ?: it.hashCode()}" },
                contentType = { "cus-row" },
            ) { row ->
                CustomerCard(row)
            }
        }
        item(key = "cus-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One customer row: name + repeat badge, spend, order-state counts, dates. */
@Composable
private fun CustomerCard(row: SellerOpsCustomerRow) {
    val spentLabel = remember(row) { sellerOpsMoney(row.totalSpent) }
    val firstLabel = remember(row) { sellerOpsDateOrDash(row.firstOrderAt) }
    val lastLabel = remember(row) { sellerOpsDateOrDash(row.lastOrderAt) }

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
                        row.displayName ?: "Unknown buyer",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        spentLabel,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                SellerOpsStatusBadge(
                    if (row.repeat) "Repeat buyer" else "New buyer",
                    if (row.repeat) "completed" else "pending",
                )
            }
            row.email?.takeIf(String::isNotBlank)?.let { SellerOpsKeyValue("Email:", it) }
            SellerOpsKeyValue("Orders:", sellerOpsCount(row.ordersCount))
            SellerOpsKeyValue("Delivered:", sellerOpsCount(row.deliveredCount))
            SellerOpsKeyValue("Open:", sellerOpsCount(row.openCount))
            SellerOpsKeyValue("First order:", firstLabel)
            SellerOpsKeyValue("Last order:", lastLabel)
        }
    }
}
