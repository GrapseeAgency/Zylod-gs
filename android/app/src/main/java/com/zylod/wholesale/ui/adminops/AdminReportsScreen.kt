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
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.AdminOpsReportRow

/**
 * t265 — SHARED typed Admin Reports screen (pageId "admin-reports" — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * AdminReportsViewModel). Real data only, from GET api/admin/reports: the
 * moderation metrics strip, the status filter chip row, and one elevated
 * card per reportedUsers row (reason + status badges, description, reporter
 * identity, reported entity, related order, admin notes). Honest loading /
 * not-admin / offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun AdminReportsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AdminReportsViewModel = viewModel(key = "native-admin-ops-$pageId") {
        AdminReportsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    AdminOpsPageScaffold(title = "Admin Reports", onBack = onBack) {
        when {
            state.loading -> AdminOpsCenterSpinner()
            state.notAdmin -> AdminOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> AdminOpsOfflineEmpty(
                message = "No reports saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> ReportsList(state = state, onFilter = vm::setStatusFilter)
        }
    }
}

/** Status chips — "" = the handler's "all" default, else its exact values. */
private val STATUS_FILTERS = listOf(
    "" to "All",
    "pending" to "Pending",
    "under_review" to "Under review",
    "action_taken" to "Action taken",
    "dismissed" to "Dismissed",
)

@Composable
private fun ReportsList(state: AdminReportsUiState, onFilter: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "rep-metrics", contentType = "stats") {
            state.metrics?.let { m ->
                AdminOpsStatsStrip(
                    stats = listOf(
                        "Total" to adminOpsCount(m.total),
                        "Pending" to adminOpsCount(m.pending),
                        "Actioned" to adminOpsCount(m.actionTaken),
                        "Dismissed" to adminOpsCount(m.dismissed),
                    ),
                )
            }
        }
        item(key = "rep-filters", contentType = "filter") {
            AdminOpsChipRow(STATUS_FILTERS, state.statusFilter, onSelect = onFilter)
        }
        when {
            state.offline -> item(key = "rep-offline", contentType = "banner") {
                AdminOpsBanner("Connection lost — showing the last loaded reports")
            }
            state.offlineFromCache -> item(key = "rep-cache", contentType = "banner") {
                AdminOpsBanner("Offline — showing saved reports")
            }
        }
        if (state.refreshing) {
            item(key = "rep-refreshing", contentType = "progress") { AdminOpsRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "rep-empty", contentType = "empty") {
                Text(
                    if (state.statusFilter.isNotBlank()) {
                        "No reports match this status filter."
                    } else {
                        "No moderation reports yet — buyer/seller reports land here."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "rep-${it.id ?: it.hashCode()}" },
                contentType = { "rep-row" },
            ) { row ->
                ReportCard(row)
            }
        }
        item(key = "rep-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One moderation report: reason + status badges, parties, notes, trail. */
@Composable
private fun ReportCard(row: AdminOpsReportRow) {
    val reasonLabel = remember(row) {
        row.reason?.replace('_', ' ') ?: "unknown reason"
    }
    val reportedLine = remember(row) {
        row.reportedEntity?.let { entity ->
            listOfNotNull(
                entity.name ?: "Unknown entity",
                entity.type?.let { "($it)" },
            ).joinToString(" ")
        } ?: row.reportedUserId?.let { "User …${it.takeLast(6)}" } ?: "Unknown entity"
    }
    val reporterLine = remember(row) {
        row.reporter?.name
            ?: row.reporterId?.let { "Buyer …${it.takeLast(6)}" }
            ?: "Unknown reporter"
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
                AdminOpsStatusBadge(reasonLabel, "")
                Spacer(Modifier.width(6.dp))
                AdminOpsStatusBadge(
                    row.status ?: "unknown",
                    row.status.orEmpty(),
                )
                Spacer(Modifier.weight(1f))
                Text(
                    createdLabel,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            row.description?.takeIf(String::isNotBlank)?.let { description ->
                Text(
                    description,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    lineHeight = 16.sp,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            AdminOpsKeyValue("Reported:", reportedLine)
            row.reportedEntity?.rating?.let { rating ->
                AdminOpsKeyValue("Entity rating:", String.format(java.util.Locale.US, "%.1f", rating))
            }
            AdminOpsKeyValue("Reporter:", reporterLine)
            row.relatedOrderId?.takeIf(String::isNotBlank)?.let { orderId ->
                AdminOpsKeyValue("Related order:", "…${orderId.takeLast(10)}")
            }
            row.adminNotes?.takeIf(String::isNotBlank)?.let { notes ->
                Text(
                    "Admin notes: $notes",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}
