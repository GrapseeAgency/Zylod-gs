package com.zylod.wholesale.ui.adminops

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
import com.zylod.wholesale.data.api.AdminOpsShippingMethodRow
import com.zylod.wholesale.data.api.AdminOpsShippingRateRow
import com.zylod.wholesale.data.api.AdminOpsShippingZoneRow

/**
 * t265 — SHARED typed Admin Shipping screen (pageId "admin-shipping" — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * AdminShippingViewModel). Real data only, from the THREE shipping
 * sub-endpoints (there is no bare api/admin/shipping listing route): the
 * carrier methods section, the weight-band price book section, and the
 * delivery-zones section with their parsed districts — one elevated card per
 * row, live rate counts and active badges included. Honest loading /
 * not-admin / offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun AdminShippingScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AdminShippingViewModel = viewModel(key = "native-admin-ops-$pageId") {
        AdminShippingViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    AdminOpsPageScaffold(title = "Admin Shipping", onBack = onBack) {
        when {
            state.loading -> AdminOpsCenterSpinner()
            state.notAdmin -> AdminOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> AdminOpsOfflineEmpty(
                message = "No shipping config saved yet — connect once to save it",
                onRetry = vm::retry,
            )
            else -> ShippingList(state = state)
        }
    }
}

@Composable
private fun ShippingList(state: AdminShippingUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when {
            state.offline -> item(key = "shp-offline", contentType = "banner") {
                AdminOpsBanner("Connection lost — showing the last loaded shipping config")
            }
            state.offlineFromCache -> item(key = "shp-cache", contentType = "banner") {
                AdminOpsBanner("Offline — showing saved shipping config")
            }
        }
        if (state.refreshing) {
            item(key = "shp-refreshing", contentType = "progress") { AdminOpsRefreshingBar() }
        }
        // Section 1 — carrier methods (the buyer-facing vocabulary).
        item(key = "shp-methods-header", contentType = "header") {
            AdminOpsSectionHeader(
                title = "Shipping methods",
                countLine = "${state.methods.size} carriers",
            )
        }
        if (state.methods.isEmpty()) {
            item(key = "shp-methods-empty", contentType = "empty") {
                Text(
                    "No shipping methods yet — buyers need a carrier vocabulary to check out.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.methods,
                key = { "shp-method-${it.id ?: it.hashCode()}" },
                contentType = { "shp-method" },
            ) { row ->
                MethodCard(row)
            }
        }
        // Section 2 — the weight-band price book.
        item(key = "shp-rates-header", contentType = "header") {
            AdminOpsSectionHeader(
                title = "Shipping rates",
                countLine = "${state.rates.size} price bands",
            )
        }
        if (state.rates.isEmpty()) {
            item(key = "shp-rates-empty", contentType = "empty") {
                Text(
                    "No rates yet — a rate says what a weight band costs per zone and method.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rates,
                key = { "shp-rate-${it.id ?: it.hashCode()}" },
                contentType = { "shp-rate" },
            ) { row ->
                RateCard(row)
            }
        }
        // Section 3 — delivery zones with their parsed districts.
        item(key = "shp-zones-header", contentType = "header") {
            AdminOpsSectionHeader(
                title = "Shipping zones",
                countLine = "${state.zones.size} zones",
            )
        }
        if (state.zones.isEmpty()) {
            item(key = "shp-zones-empty", contentType = "empty") {
                Text(
                    "No zones yet — zones group districts so rates can price them.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.zones,
                key = { "shp-zone-${it.id ?: it.hashCode()}" },
                contentType = { "shp-zone" },
            ) { row ->
                ZoneCard(row)
            }
        }
        item(key = "shp-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One carrier: name, estimate, active badge, live rate count. */
@Composable
private fun MethodCard(row: AdminOpsShippingMethodRow) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.name ?: "Unnamed carrier",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                AdminOpsStatusBadge(
                    if (row.isActive) "active" else "inactive",
                    if (row.isActive) "active" else "inactive",
                )
            }
            row.estimatedDays?.takeIf(String::isNotBlank)?.let {
                AdminOpsKeyValue("Estimate:", it)
            }
            AdminOpsKeyValue("Rates attached:", adminOpsCount(row.rateCount))
            row.description?.takeIf(String::isNotBlank)?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/** One price band: zone × method, weight window, price, free-above. */
@Composable
private fun RateCard(row: AdminOpsShippingRateRow) {
    val routeLine = remember(row) {
        listOfNotNull(row.zoneName, row.methodName).joinToString(" × ").ifBlank { "Unknown route" }
    }
    val bandLine = remember(row) {
        val max = row.weightMax?.let { "${adminOpsWeight(it)}kg" } ?: "∞"
        "${adminOpsWeight(row.weightMin)}kg – $max"
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
                    routeLine,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    adminOpsMoney(row.price),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            AdminOpsKeyValue("Weight band:", bandLine)
            AdminOpsKeyValue(
                "Free above:",
                row.freeAbove?.let { adminOpsMoney(it) } ?: "never free",
            )
        }
    }
}

/** One zone: name, active badge, parsed districts, live rate count. */
@Composable
private fun ZoneCard(row: AdminOpsShippingZoneRow) {
    val districtLine = remember(row) {
        if (row.districts.isEmpty()) "No districts parsed" else row.districts.joinToString(", ")
    }
    val createdLabel = remember(row) { adminOpsDateOrDash(row.createdAt) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.name ?: "Unnamed zone",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                AdminOpsStatusBadge(
                    if (row.isActive) "active" else "inactive",
                    if (row.isActive) "active" else "inactive",
                )
            }
            Text(
                districtLine,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 15.sp,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 4.dp),
            )
            AdminOpsKeyValue("Rates attached:", adminOpsCount(row.rateCount))
            AdminOpsKeyValue("Created:", createdLabel)
        }
    }
}

/** Weight text: whole kilograms stay integers ("2kg"), fractions keep 1 decimal. */
private fun adminOpsWeight(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString() else String.format(java.util.Locale.US, "%.1f", value)
