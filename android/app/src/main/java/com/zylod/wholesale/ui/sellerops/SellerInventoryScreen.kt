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
import com.zylod.wholesale.data.api.SellerOpsInventoryItem

/**
 * t266 — SHARED typed Seller Inventory screen (pageId "seller-inventory" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * SellerInventoryViewModel). Real data only, from GET api/supplier/
 * inventory: the route's own summary strip (SKU counts, low-stock with the
 * seller-tuned threshold honored, out-of-stock, total units) and one
 * elevated card per product (stock badge, sku/unit/MOQ, category,
 * active/approved state, alert threshold, and the variant rows nested).
 * READ-ONLY: stock edits are the PATCH route and stay a web-console action
 * this round. Honest loading / not-seller / offline / empty states; theme
 * colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SellerInventoryScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SellerInventoryViewModel = viewModel(key = "native-seller-ops-$pageId") {
        SellerInventoryViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SellerOpsPageScaffold(title = "Seller Inventory", onBack = onBack) {
        when {
            state.loading -> SellerOpsCenterSpinner()
            state.notSeller -> SellerOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SellerOpsOfflineEmpty(
                message = "No inventory saved yet — connect once to save it",
                onRetry = vm::retry,
            )
            else -> InventoryList(state)
        }
    }
}

@Composable
private fun InventoryList(state: SellerInventoryUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "inv-stats", contentType = "stats") {
            state.summary?.let { s ->
                SellerOpsStatsStrip(
                    stats = listOf(
                        "SKUs" to sellerOpsCount(s.totalSkus),
                        "Variants" to sellerOpsCount(s.totalVariantSkus),
                        "Low" to sellerOpsCount(s.lowStockCount),
                        "Out" to sellerOpsCount(s.outOfStockCount),
                        "Units" to sellerOpsQty(s.totalInventoryUnits),
                    ),
                )
            }
        }
        when {
            state.offline -> item(key = "inv-offline", contentType = "banner") {
                SellerOpsBanner("Connection lost — showing the last loaded inventory")
            }
            state.offlineFromCache -> item(key = "inv-cache", contentType = "banner") {
                SellerOpsBanner("Offline — showing saved inventory")
            }
        }
        if (state.refreshing) {
            item(key = "inv-refreshing", contentType = "progress") { SellerOpsRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "inv-empty", contentType = "empty") {
                Text(
                    "No products in your inventory yet — upload a product and its stock lands here.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "inv-${it.id ?: it.hashCode()}" },
                contentType = { "inv-row" },
            ) { row ->
                InventoryCard(row)
            }
        }
        item(key = "inv-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * Stock state — the route's OWN summary math mirrored per row: out when
 * quantity ≤ 0 (red), low when ≤ the seller-tuned threshold with the
 * platform fallback 20 (orange), otherwise in stock (green).
 */
private const val LOW_STOCK_FALLBACK = 20.0

private fun stockStateOf(row: SellerOpsInventoryItem): Triple<String, String, Boolean> {
    // (badge text, wire status color key, isBad)
    return when {
        row.stockQuantity <= 0.0 -> Triple("Out of stock", "failed", true)
        row.stockQuantity <= (row.stockAlertThreshold ?: LOW_STOCK_FALLBACK) ->
            Triple("Low stock", "pending", true)
        else -> Triple("In stock", "completed", false)
    }
}

/** One product stock row: badge + identity + listing state + variants. */
@Composable
private fun InventoryCard(row: SellerOpsInventoryItem) {
    val stockState = remember(row) { stockStateOf(row) }
    val qtyLabel = remember(row) { sellerOpsQty(row.stockQuantity) }
    val moqLabel = remember(row) { sellerOpsQty(row.moq) }
    val thresholdLabel = remember(row) {
        row.stockAlertThreshold?.let { "seller-tuned: ${sellerOpsQty(it)}" } ?: "platform default: 20"
    }
    val updatedLabel = remember(row) { sellerOpsDateOrDash(row.updatedAt) }

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
                        row.name ?: "Unknown product",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        "$qtyLabel ${row.unit ?: "pcs"} in stock",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                SellerOpsStatusBadge(stockState.first, stockState.second)
            }
            row.sku?.takeIf(String::isNotBlank)?.let { SellerOpsKeyValue("SKU:", it) }
            row.category?.name?.let { SellerOpsKeyValue("Category:", it) }
            SellerOpsKeyValue("MOQ:", moqLabel)
            SellerOpsKeyValue(
                "Listing:",
                listOfNotNull(
                    if (row.isActive) "Active" else "Inactive",
                    if (row.isApproved) null else "Not approved",
                ).joinToString(" · "),
            )
            SellerOpsKeyValue("Low-stock alert:", thresholdLabel)
            SellerOpsKeyValue("Updated:", updatedLabel)
            if (row.variants.isNotEmpty()) {
                Text(
                    "Variants",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp),
                )
                row.variants.forEach { variant ->
                    val line = buildString {
                        append(variant.variantName?.replace('_', ' ') ?: "Variant")
                        variant.variantValue?.let { append(" · ").append(it) }
                        append(" — ")
                        append(sellerOpsQty(variant.stockQuantity))
                        append(" in stock")
                        variant.sku?.takeIf(String::isNotBlank)?.let { append(" · ").append(it) }
                        variant.priceOverride?.let {
                            append(" · ").append(sellerOpsMoney(it))
                        }
                    }
                    SellerOpsKeyValue("•", line)
                }
            }
        }
    }
}
