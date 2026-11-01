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
import com.zylod.wholesale.data.api.SupplierCorePriceTier
import com.zylod.wholesale.data.api.SupplierCoreProductRow

/**
 * t267 — SHARED typed Supplier Products screen (pageId "supplier-products"
 * — the ui/screens delegate calls THIS, so the page keeps its own
 * SupplierProductsViewModel). Real data only, from GET api/supplier/products:
 * the pagination stats strip (wire total / shown / out-of-stock / pages),
 * the status filter chip row (the handler's exact five tokens), and one
 * elevated card per product (name + category + ৳ base price per unit + MOQ
 * + stock + moderation/listing badges + wholesale price tiers + variant
 * count). No images here — the sellerops chrome this batch mirrors renders
 * text-only cards. Honest loading / not-seller / offline / empty states;
 * theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SupplierProductsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierProductsViewModel = viewModel(key = "native-supplier-core-$pageId") {
        SupplierProductsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SupplierCorePageScaffold(title = "Supplier Products", onBack = onBack) {
        when {
            state.loading -> SupplierCoreCenterSpinner()
            state.notSeller -> SupplierCoreGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SupplierCoreOfflineEmpty(
                message = "No products saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> ProductsList(state = state, onFilter = vm::setStatusFilter, onLoadMore = vm::loadMore)
        }
    }
}

/** Status chips — "" = all, else the handler's exact five tokens. */
private val PRODUCT_STATUS_FILTERS = listOf(
    "" to "All",
    "active" to "active",
    "inactive" to "inactive",
    "pending" to "pending",
    "approved" to "approved",
    "out_of_stock" to "out_of_stock",
)

@Composable
private fun ProductsList(
    state: SupplierProductsUiState,
    onFilter: (String) -> Unit,
    onLoadMore: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "sprod-stats", contentType = "stats") {
            val outOfStock = state.rows.count { it.stockQuantity <= 0.0 }
            SupplierCoreStatsStrip(
                stats = listOf(
                    "Total" to supplierCoreCount(state.total),
                    "Shown" to supplierCoreCount(state.rows.size),
                    "Out of stock" to supplierCoreCount(outOfStock),
                    "Pages" to supplierCoreCount(state.totalPages),
                ),
            )
        }
        item(key = "sprod-filters", contentType = "filter") {
            SupplierCoreChipRow(PRODUCT_STATUS_FILTERS, state.statusFilter, onSelect = onFilter)
        }
        when {
            state.offline -> item(key = "sprod-offline", contentType = "banner") {
                SupplierCoreBanner("Connection lost — showing the last loaded products")
            }
            state.offlineFromCache -> item(key = "sprod-cache", contentType = "banner") {
                SupplierCoreBanner("Offline — showing saved products")
            }
        }
        if (state.refreshing) {
            item(key = "sprod-refreshing", contentType = "progress") { SupplierCoreRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "sprod-empty", contentType = "empty") {
                SupplierCoreEmptyState(
                    if (state.statusFilter.isNotBlank()) {
                        "No products match this status filter."
                    } else {
                        "No products yet — supplier-add-product creates your first listing."
                    },
                )
            }
        } else {
            items(
                state.rows,
                key = { "sprod-${it.id ?: it.hashCode()}" },
                contentType = { "sprod-row" },
            ) { row ->
                ProductCard(row)
            }
        }
        if (state.page < state.totalPages) {
            item(key = "sprod-load-more", contentType = "load-more") {
                TextButton(
                    onClick = onLoadMore,
                    enabled = !state.loadingMore,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        if (state.loadingMore) "Loading…" else "Load more",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
        item(key = "sprod-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One product: name/price header, badges, MOQ/stock, tiers, variants. */
@Composable
private fun ProductCard(row: SupplierCoreProductRow) {
    val priceLine = remember(row) {
        val perUnit = row.unit?.takeIf(String::isNotBlank)?.let { " / $it" } ?: ""
        "${supplierCoreMoney(row.basePrice)}$perUnit"
    }
    val moqLabel = remember(row) { supplierCoreQty(row.moq) }
    val stockLabel = remember(row) { supplierCoreQty(row.stockQuantity) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        row.name ?: "Untitled product",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        priceLine,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    SupplierCoreStatusBadge(
                        if (row.isApproved) "approved" else "pending review",
                        if (row.isApproved) "approved" else "pending",
                    )
                    SupplierCoreStatusBadge(
                        if (row.isActive) "active" else "inactive",
                        if (row.isActive) "active" else "inactive",
                    )
                }
            }
            row.category?.name?.takeIf(String::isNotBlank)?.let {
                SupplierCoreKeyValue("Category:", it)
            }
            SupplierCoreKeyValue("MOQ:", moqLabel)
            SupplierCoreKeyValue("Stock:", stockLabel)
            row.priceTiers.forEach { tier -> TierLine(tier) }
            if (row.variants.isNotEmpty()) {
                SupplierCoreKeyValue("Variants:", row.variants.size.toString())
            }
        }
    }
}

/** "minQty+ → ৳pricePerUnit" — the real wholesale ladder line. */
@Composable
private fun TierLine(tier: SupplierCorePriceTier) {
    val line = remember(tier) {
        "${supplierCoreQty(tier.minQty)}+ → ${supplierCoreMoney(tier.pricePerUnit)}"
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
