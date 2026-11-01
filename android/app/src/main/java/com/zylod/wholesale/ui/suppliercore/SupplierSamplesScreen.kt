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
import com.zylod.wholesale.data.api.SupplierCoreAddressSnapshot
import com.zylod.wholesale.data.api.SupplierCoreSampleRow

/**
 * t267 — SHARED typed Supplier Samples screen (pageId "supplier-samples" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * SupplierSamplesViewModel). Real data only, from GET api/supplier/samples:
 * the wire stats strip (total / requested / shipped / delivered — the
 * handler's own derived counts), and one elevated card per sample request
 * (product title + status badge + qty + ৳ sample price + buyer + the
 * creation-time address snapshot lines + captured-note). No chip row — the
 * route takes no params. Honest loading / not-seller / offline / empty
 * states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SupplierSamplesScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierSamplesViewModel = viewModel(key = "native-supplier-core-$pageId") {
        SupplierSamplesViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SupplierCorePageScaffold(title = "Supplier Samples", onBack = onBack) {
        when {
            state.loading -> SupplierCoreCenterSpinner()
            state.notSeller -> SupplierCoreGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SupplierCoreOfflineEmpty(
                message = "No sample requests saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> SamplesList(state)
        }
    }
}

@Composable
private fun SamplesList(state: SupplierSamplesUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "ssamp-stats", contentType = "stats") {
            val s = state.stats
            if (s != null) {
                SupplierCoreStatsStrip(
                    stats = listOf(
                        "Total" to supplierCoreCount(s.total),
                        "Requested" to supplierCoreCount(s.requested),
                        "Shipped" to supplierCoreCount(s.shipped),
                        "Delivered" to supplierCoreCount(s.delivered),
                    ),
                )
            }
        }
        when {
            state.offline -> item(key = "ssamp-offline", contentType = "banner") {
                SupplierCoreBanner("Connection lost — showing the last loaded sample requests")
            }
            state.offlineFromCache -> item(key = "ssamp-cache", contentType = "banner") {
                SupplierCoreBanner("Offline — showing saved sample requests")
            }
        }
        if (state.refreshing) {
            item(key = "ssamp-refreshing", contentType = "progress") { SupplierCoreRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "ssamp-empty", contentType = "empty") {
                SupplierCoreEmptyState(
                    "No sample requests yet — buyer sample requests on your products land here.",
                )
            }
        } else {
            items(
                state.rows,
                key = { "ssamp-${it.id ?: it.hashCode()}" },
                contentType = { "ssamp-row" },
            ) { row ->
                SampleCard(row)
            }
        }
        item(key = "ssamp-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One sample request: product/status/qty/price + buyer + address snapshot. */
@Composable
private fun SampleCard(row: SupplierCoreSampleRow) {
    val priceLabel = remember(row) { supplierCoreMoney(row.samplePrice) }
    val qtyLabel = remember(row) { supplierCoreQty(row.quantity) }
    val dateLabel = remember(row) { supplierCoreDateOrDash(row.createdAt) }
    val addressLines = remember(row) { row.shippingAddress?.let(::snapshotLines).orEmpty() }

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
                        row.product?.name ?: "Sample request",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        priceLabel,
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
            SupplierCoreKeyValue("Quantity:", qtyLabel)
            row.buyerName?.takeIf(String::isNotBlank)?.let { SupplierCoreKeyValue("Buyer:", it) }
            SupplierCoreKeyValue("Requested:", dateLabel)
            if (addressLines.isNotEmpty()) {
                Text(
                    "Ship to",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 6.dp),
                )
                addressLines.forEach { line ->
                    Text(
                        line,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (row.fromSnapshot) {
                Text(
                    "Address captured at request time (snapshot)",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/**
 * The snapshot's renderable lines — contact name/phone, the two address
 * lines, then "city, district, postalCode" — ONLY non-blank values, never
 * an invented placeholder (buildAddressSnapshot stores raw strings).
 */
private fun snapshotLines(snapshot: SupplierCoreAddressSnapshot): List<String> {
    fun line(value: String?): String? = value?.takeIf(String::isNotBlank)
    val placeLine = listOfNotNull(
        line(snapshot.city),
        line(snapshot.district),
        line(snapshot.postalCode),
    ).joinToString(", ").takeIf(String::isNotBlank)
    return listOfNotNull(
        line(snapshot.contactName),
        line(snapshot.contactPhone),
        line(snapshot.addressLine1),
        line(snapshot.addressLine2),
        placeLine,
    )
}
