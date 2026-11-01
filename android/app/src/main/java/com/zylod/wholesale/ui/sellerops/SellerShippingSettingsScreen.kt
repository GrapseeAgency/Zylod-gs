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
import com.zylod.wholesale.data.api.SellerOpsShippingConfig

/**
 * t266 — SHARED typed Seller Shipping Settings screen (pageId
 * "seller-shipping-settings" — the ui/screens delegate calls THIS, so the
 * page keeps its own SellerShippingSettingsViewModel). Real data only, from
 * GET api/supplier/shipping: one elevated card per configured zone
 * (active/inactive badge, base rate, per-kg rate, free-above threshold or
 * the honest "never free", the free-text estimated days) plus the zones the
 * model defines that this seller has NOT configured yet, listed as honest
 * "not set" rows. READ-ONLY: the PATCH upsert stays a web-console action.
 * Honest loading / not-seller / offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SellerShippingSettingsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SellerShippingSettingsViewModel = viewModel(key = "native-seller-ops-$pageId") {
        SellerShippingSettingsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SellerOpsPageScaffold(title = "Seller Shipping Settings", onBack = onBack) {
        when {
            state.loading -> SellerOpsCenterSpinner()
            state.notSeller -> SellerOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SellerOpsOfflineEmpty(
                message = "No shipping settings saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> ShippingList(state)
        }
    }
}

@Composable
private fun ShippingList(state: SellerShippingSettingsUiState) {
    val unconfigured = remember(state.rows, state.zones) {
        val configured = state.rows.mapNotNull { it.zone?.lowercase() }.toHashSet()
        state.zones.filter { it.lowercase() !in configured }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "ship-stats", contentType = "stats") {
            SellerOpsStatsStrip(
                stats = listOf(
                    "Configured" to sellerOpsCount(state.rows.size),
                    "Zones" to sellerOpsCount(state.zones.size),
                    "Active" to sellerOpsCount(state.rows.count { it.isActive }),
                    "Not set" to sellerOpsCount(unconfigured.size),
                ),
            )
        }
        when {
            state.offline -> item(key = "ship-offline", contentType = "banner") {
                SellerOpsBanner("Connection lost — showing the last loaded settings")
            }
            state.offlineFromCache -> item(key = "ship-cache", contentType = "banner") {
                SellerOpsBanner("Offline — showing saved settings")
            }
        }
        if (state.refreshing) {
            item(key = "ship-refreshing", contentType = "progress") { SellerOpsRefreshingBar() }
        }
        if (state.rows.isEmpty() && unconfigured.isEmpty()) {
            item(key = "ship-empty", contentType = "empty") {
                Text(
                    "No zone configs yet — set your rates from the web seller console and they land here.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "ship-${it.id ?: it.zone ?: it.hashCode()}" },
                contentType = { "ship-row" },
            ) { row ->
                ZoneConfigCard(row)
            }
            if (unconfigured.isNotEmpty()) {
                item(key = "ship-unset-header", contentType = "header") {
                    SellerOpsSectionHeader(
                        "Zones without a config",
                        "The model defines these — nothing saved for them yet",
                    )
                }
                items(
                    unconfigured,
                    key = { "unset-$it" },
                    contentType = { "unset-row" },
                ) { zone ->
                    Text(
                        "${zone.replaceFirstChar { it.uppercase() }} — not set",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        item(key = "ship-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One zone config row: badge + rates + free-above + estimate. */
@Composable
private fun ZoneConfigCard(row: SellerOpsShippingConfig) {
    val baseLabel = remember(row) { sellerOpsMoney(row.baseRate) }
    val perKgLabel = remember(row) { sellerOpsMoney(row.ratePerKg) }
    val freeAboveLabel = remember(row) {
        row.freeAboveAmount?.let { sellerOpsMoney(it) } ?: "Never free"
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
                Text(
                    row.zone?.replaceFirstChar { it.uppercase() } ?: "Unknown zone",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                SellerOpsStatusBadge(
                    if (row.isActive) "Active" else "Inactive",
                    if (row.isActive) "active" else "inactive",
                )
            }
            SellerOpsKeyValue("Base rate:", baseLabel)
            SellerOpsKeyValue("Per kg:", perKgLabel)
            SellerOpsKeyValue("Free above:", freeAboveLabel)
            SellerOpsKeyValue("Estimated days:", row.estimatedDays?.ifBlank { null } ?: "—")
            SellerOpsKeyValue("Updated:", updatedLabel)
        }
    }
}
