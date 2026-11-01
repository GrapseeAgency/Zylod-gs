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
import com.zylod.wholesale.data.api.AdminOpsInspectionRow

/**
 * t265 — SHARED typed Admin Inspections screen (pageId "admin-inspections" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * InspectionsViewModel). Real data only, from GET api/admin/inspections: the
 * platform-wide status stats strip, the status filter chip row (the
 * handler's exact four statuses), and one elevated card per inspection
 * request (order, buyer, inspector type, status badge, schedule/completion
 * timestamps). Honest loading / not-admin / offline / empty states.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun InspectionsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: InspectionsViewModel = viewModel(key = "native-admin-ops-$pageId") {
        InspectionsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    AdminOpsPageScaffold(title = "Admin Inspections", onBack = onBack) {
        when {
            state.loading -> AdminOpsCenterSpinner()
            state.notAdmin -> AdminOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> AdminOpsOfflineEmpty(
                message = "No inspections saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> InspectionsList(state = state, onFilter = vm::setStatusFilter)
        }
    }
}

/** Status chips — "" = all, else the handler's exact inspection statuses. */
private val STATUS_FILTERS = listOf(
    "" to "All",
    "pending" to "Pending",
    "scheduled" to "Scheduled",
    "completed" to "Completed",
    "failed" to "Failed",
)

@Composable
private fun InspectionsList(state: InspectionsUiState, onFilter: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "insp-stats", contentType = "stats") {
            val s = state.stats
            if (s != null) {
                AdminOpsStatsStrip(
                    stats = listOf(
                        "Total" to adminOpsCount(s.total),
                        "Pending" to adminOpsCount(s.pending),
                        "Scheduled" to adminOpsCount(s.scheduled),
                        "Done" to adminOpsCount(s.completed),
                        "Failed" to adminOpsCount(s.failed),
                    ),
                )
            }
        }
        item(key = "insp-filters", contentType = "filter") {
            AdminOpsChipRow(STATUS_FILTERS, state.statusFilter, onSelect = onFilter)
        }
        when {
            state.offline -> item(key = "insp-offline", contentType = "banner") {
                AdminOpsBanner("Connection lost — showing the last loaded inspections")
            }
            state.offlineFromCache -> item(key = "insp-cache", contentType = "banner") {
                AdminOpsBanner("Offline — showing saved inspections")
            }
        }
        if (state.refreshing) {
            item(key = "insp-refreshing", contentType = "progress") { AdminOpsRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "insp-empty", contentType = "empty") {
                Text(
                    if (state.statusFilter.isNotBlank()) {
                        "No inspections match this status filter."
                    } else {
                        "No inspection requests yet — buyers file them from their orders."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "insp-${it.id ?: it.hashCode()}" },
                contentType = { "insp-row" },
            ) { row ->
                InspectionCard(row)
            }
        }
        item(key = "insp-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One inspection request: order + buyer, type/status badges, timestamps. */
@Composable
private fun InspectionCard(row: AdminOpsInspectionRow) {
    val title = remember(row) {
        row.orderNumber ?: row.orderId?.let { "Order …${it.takeLast(10)}" } ?: "Unknown order"
    }
    val typeLine = remember(row) {
        when (row.inspectorType?.trim()?.lowercase()) {
            "self" -> "Self-inspected"
            "third_party" -> "Third-party"
            else -> row.inspectorType ?: "Unknown inspector"
        }
    }
    val scheduleLine = remember(row) {
        listOfNotNull(
            row.scheduledAt?.let { "Scheduled ${adminOpsDate(it)}" },
            row.completedAt?.let { "Completed ${adminOpsDate(it)}" },
        ).joinToString(" · ").ifBlank { null }
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
                    title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                AdminOpsStatusBadge(
                    row.status ?: "unknown",
                    row.status.orEmpty(),
                )
            }
            row.buyerName?.let { AdminOpsKeyValue("Buyer:", it) }
            AdminOpsKeyValue("Inspection:", typeLine)
            row.orderTotal?.let { AdminOpsKeyValue("Order total:", adminOpsMoney(it)) }
            scheduleLine?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            row.reportUrl?.takeIf(String::isNotBlank)?.let { url ->
                Text(
                    "Report filed — $url",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}
