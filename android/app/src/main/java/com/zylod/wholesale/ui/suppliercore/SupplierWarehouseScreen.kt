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
import com.zylod.wholesale.data.api.SupplierCoreWarehouseRow

/**
 * t267 — SHARED typed Supplier Warehouse screen (pageId
 * "supplier-warehouse" — the ui/screens delegate calls THIS, so the page
 * keeps its own SupplierWarehouseViewModel). Real data only, from GET api/
 * supplier/warehouses: the derived stats strip (locations / active /
 * districts), and one elevated card per warehouseLocations row (name +
 * active badge + address lines + city/district + the honest lat/lng line
 * when BOTH coordinates exist — plain numbers, no invented map). No chip
 * row — the route takes no params. Honest loading / not-seller / offline /
 * empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SupplierWarehouseScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierWarehouseViewModel = viewModel(key = "native-supplier-core-$pageId") {
        SupplierWarehouseViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SupplierCorePageScaffold(title = "Supplier Warehouse", onBack = onBack) {
        when {
            state.loading -> SupplierCoreCenterSpinner()
            state.notSeller -> SupplierCoreGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SupplierCoreOfflineEmpty(
                message = "No warehouse locations saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> WarehouseList(state)
        }
    }
}

@Composable
private fun WarehouseList(state: SupplierWarehouseUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "swh-stats", contentType = "stats") {
            val active = state.rows.count { it.isActive }
            val districts = state.rows
                .mapNotNull { it.district?.trim()?.takeIf(String::isNotEmpty) }
                .distinct()
                .size
            SupplierCoreStatsStrip(
                stats = listOf(
                    "Locations" to supplierCoreCount(state.rows.size),
                    "Active" to supplierCoreCount(active),
                    "Districts" to supplierCoreCount(districts),
                ),
            )
        }
        when {
            state.offline -> item(key = "swh-offline", contentType = "banner") {
                SupplierCoreBanner("Connection lost — showing the last loaded locations")
            }
            state.offlineFromCache -> item(key = "swh-cache", contentType = "banner") {
                SupplierCoreBanner("Offline — showing saved locations")
            }
        }
        if (state.refreshing) {
            item(key = "swh-refreshing", contentType = "progress") { SupplierCoreRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "swh-empty", contentType = "empty") {
                SupplierCoreEmptyState(
                    "No warehouse locations yet — add ship-from locations from the web store settings.",
                )
            }
        } else {
            items(
                state.rows,
                key = { "swh-${it.id ?: it.hashCode()}" },
                contentType = { "swh-row" },
            ) { row ->
                WarehouseCard(row)
            }
        }
        item(key = "swh-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One warehouseLocations row: name/badge, address, district, coordinates. */
@Composable
private fun WarehouseCard(row: SupplierCoreWarehouseRow) {
    val dateLabel = remember(row) { supplierCoreDateOrDash(row.createdAt) }
    val placeLine = remember(row) {
        listOfNotNull(
            row.city?.takeIf(String::isNotBlank),
            row.district?.takeIf(String::isNotBlank),
        ).joinToString(", ").ifBlank { null }
    }
    val coordLine = remember(row) {
        // Plain numbers only when BOTH exist — no invented geocoding.
        if (row.lat != null && row.lng != null) "${row.lat}, ${row.lng}" else null
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
                    row.name ?: "Unnamed location",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                SupplierCoreStatusBadge(
                    if (row.isActive) "active" else "inactive",
                    if (row.isActive) "active" else "inactive",
                )
            }
            row.addressLine1?.takeIf(String::isNotBlank)?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            row.addressLine2?.takeIf(String::isNotBlank)?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            placeLine?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            coordLine?.let { SupplierCoreKeyValue("Coordinates:", it) }
            SupplierCoreKeyValue("Added:", dateLabel)
        }
    }
}
