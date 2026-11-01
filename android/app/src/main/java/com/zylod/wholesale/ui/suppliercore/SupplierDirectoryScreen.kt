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
import com.zylod.wholesale.data.api.SupplierCoreSupplierRow

/**
 * t267 — SHARED typed Suppliers Directory screen (pageId "suppliers" — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * SupplierDirectoryViewModel). Real data only, from the PUBLIC GET api/
 * suppliers: the pagination stats strip (wire total / page / on-page), the
 * sort chip row (the handler's exact three tokens), one elevated card per
 * supplier (company + verification badge + star rating + product count +
 * city/district + the suspended-account badge) and the Prev/Next row
 * bounded by the wire pagination. No not-seller gate — the route is public
 * and renders signed-out. Honest loading / offline / empty states; theme
 * colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SupplierDirectoryScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierDirectoryViewModel = viewModel(key = "native-supplier-core-$pageId") {
        SupplierDirectoryViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SupplierCorePageScaffold(title = "Suppliers", onBack = onBack) {
        when {
            state.loading -> SupplierCoreCenterSpinner()
            state.error != null -> SupplierCoreOfflineEmpty(
                message = "No suppliers saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> DirectoryList(state = state, onSort = vm::setSort, onGoToPage = vm::goToPage)
        }
    }
}

/** Sort chips — the handler's exact three sort tokens. */
private val SUPPLIER_SORT_OPTIONS = listOf(
    "newest" to "Newest",
    "rating" to "Top rated",
    "products" to "Most products",
)

@Composable
private fun DirectoryList(
    state: SupplierDirectoryUiState,
    onSort: (String) -> Unit,
    onGoToPage: (Int) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "sdir-stats", contentType = "stats") {
            val pagination = state.pagination
            val pageValue = if (pagination != null) {
                "${pagination.page} of ${pagination.totalPages}"
            } else {
                supplierCoreCount(null)
            }
            SupplierCoreStatsStrip(
                stats = listOf(
                    "Suppliers" to supplierCoreCount(pagination?.total),
                    "Page" to pageValue,
                    "On page" to supplierCoreCount(state.rows.size),
                ),
            )
        }
        item(key = "sdir-sort", contentType = "filter") {
            SupplierCoreChipRow(SUPPLIER_SORT_OPTIONS, state.sort, onSelect = onSort)
        }
        when {
            state.offline -> item(key = "sdir-offline", contentType = "banner") {
                SupplierCoreBanner("Connection lost — showing the last loaded suppliers")
            }
            state.offlineFromCache -> item(key = "sdir-cache", contentType = "banner") {
                SupplierCoreBanner("Offline — showing saved suppliers")
            }
        }
        if (state.refreshing) {
            item(key = "sdir-refreshing", contentType = "progress") { SupplierCoreRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "sdir-empty", contentType = "empty") {
                SupplierCoreEmptyState("No suppliers match yet — check back soon.")
            }
        } else {
            items(
                state.rows,
                key = { "sdir-${it.id ?: it.hashCode()}" },
                contentType = { "sdir-row" },
            ) { row ->
                SupplierCard(row)
            }
        }
        val pagination = state.pagination
        if (pagination != null && pagination.totalPages > 0) {
            item(key = "sdir-pager", contentType = "pager") {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    TextButton(
                        onClick = { onGoToPage(state.page - 1) },
                        enabled = state.page > 1,
                    ) {
                        Text("Prev", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.weight(1f))
                    Text(
                        "Page ${state.page} of ${pagination.totalPages}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.weight(1f))
                    TextButton(
                        onClick = { onGoToPage(state.page + 1) },
                        enabled = state.page < pagination.totalPages,
                    ) {
                        Text("Next", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        item(key = "sdir-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One supplier: company + verification badge, rating, catalog, location. */
@Composable
private fun SupplierCard(row: SupplierCoreSupplierRow) {
    val ratingLine = remember(row) {
        "★ ${supplierCoreRating(row.ratingAvg)} (${row.ratingCount} reviews)"
    }
    val productsLine = remember(row) { "${row.productCount} products" }
    val placeLine = remember(row) {
        listOfNotNull(
            row.city?.takeIf(String::isNotBlank),
            row.district?.takeIf(String::isNotBlank),
        ).joinToString(", ").ifBlank { null }
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
                    row.companyName ?: "Unnamed supplier",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                SupplierCoreStatusBadge(
                    row.verificationStatus ?: "unknown",
                    row.verificationStatus.orEmpty(),
                )
            }
            Text(
                ratingLine,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(
                productsLine,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
            placeLine?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            // The owner account's real status — only suspended gets a badge
            // (the route ships accountStatus verbatim; anything else stays
            // unbadge-ed rather than guessed).
            if (row.accountStatus?.trim()?.lowercase() == "suspended") {
                Row(modifier = Modifier.padding(top = 4.dp)) {
                    SupplierCoreStatusBadge("suspended", "suspended")
                }
            }
        }
    }
}
