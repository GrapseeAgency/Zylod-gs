package com.zylod.wholesale.ui.adminops

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import com.zylod.wholesale.data.api.AdminOpsAuditLogRow

/**
 * t265 — SHARED typed Admin Audit Logs screen (pageId "admin-audit-logs" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * AuditLogsViewModel). Real data only, from GET api/admin/audit-logs: the
 * action filter chip row, the wire-fact entityType summary line, page meta,
 * and one elevated card per audited write (action + entityType/entityId,
 * actor name/type, timestamp, metadata excerpt). Honest loading / not-admin
 * / offline / empty states; theme colors only, palette green/red/orange/gray.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun AuditLogsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AuditLogsViewModel = viewModel(key = "native-admin-ops-$pageId") {
        AuditLogsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    AdminOpsPageScaffold(title = "Admin Audit Logs", onBack = onBack) {
        when {
            state.loading -> AdminOpsCenterSpinner()
            state.notAdmin -> AdminOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> AdminOpsOfflineEmpty(
                message = "No audit logs saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> AuditLogsList(
                state = state,
                onLoadMore = vm::loadMore,
                onFilter = vm::setActionFilter,
            )
        }
    }
}

/** Action chips — "" = all, else CONTAINS substrings the handler matches. */
private val ACTION_FILTERS = listOf(
    "" to "All",
    "payment" to "Payment",
    "order" to "Order",
    "product" to "Product",
    "category" to "Category",
    "shipping" to "Shipping",
    "user" to "User",
)

@Composable
private fun AuditLogsList(
    state: AuditLogsUiState,
    onLoadMore: () -> Unit,
    onFilter: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = AdminOpsListPadding,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "audit-filters", contentType = "filter") {
            AdminOpsChipRow(ACTION_FILTERS, state.actionFilter, onSelect = onFilter)
        }
        when {
            state.offline -> item(key = "audit-offline", contentType = "banner") {
                AdminOpsBanner("Connection lost — showing the last loaded audit logs")
            }
            state.offlineFromCache -> item(key = "audit-cache", contentType = "banner") {
                AdminOpsBanner("Offline — showing saved audit logs")
            }
        }
        if (state.refreshing) {
            item(key = "audit-refreshing", contentType = "progress") { AdminOpsRefreshingBar() }
        }
        item(key = "audit-summary", contentType = "meta") {
            val summaryLine = remember(state.summary) {
                if (state.summary.isEmpty()) "" else
                    "Most audited: " + state.summary.take(3)
                        .joinToString { (type, count) -> "$type ($count)" }
            }
            Text(
                listOfNotNull(
                    "Page ${state.page} of ${state.totalPages} · ${state.total} entries",
                    summaryLine.ifBlank { null },
                ).joinToString("  •  "),
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state.rows.isEmpty()) {
            item(key = "audit-empty", contentType = "empty") {
                Text(
                    if (state.actionFilter.isNotBlank()) {
                        "No audit entries match this action filter."
                    } else {
                        "No audit entries yet — every audited write lands here."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "audit-${it.id ?: it.hashCode()}" },
                contentType = { "audit-row" },
            ) { row ->
                AuditLogCard(row)
            }
            if (state.page < state.totalPages) {
                item(key = "audit-load-more", contentType = "load-more") {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                    ) {
                        TextButton(onClick = onLoadMore, enabled = !state.loadingMore) {
                            Text(
                                if (state.loadingMore) "Loading…" else "Load more",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
        }
        item(key = "audit-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One audited write: action + entity badges, actor line, time, metadata. */
@Composable
private fun AuditLogCard(row: AdminOpsAuditLogRow) {
    val entityLine = remember(row) {
        listOfNotNull(row.entityType, row.entityId?.let { "#${it.takeLast(10)}" })
            .joinToString(" ")
    }
    val actorLine = remember(row) {
        row.actor?.let { actor ->
            listOfNotNull(
                actor.name ?: actor.email ?: "Unknown actor",
                actor.userType?.let { "($it)" },
            ).joinToString(" ")
        } ?: "System / unknown actor"
    }
    val dateLabel = remember(row) { adminOpsDateOrDash(row.createdAt) }
    // t284: the wire metadata is raw JSON (e.g. banner writes carry
    // {"title":…,"position":…}) — the VLM round-8 audit caught it rendered
    // verbatim as a debug wall. Prettify into "key: value" pairs; anything
    // non-JSON passes through unchanged.
    val metaLine = remember(row) { prettifyAuditMetadata(row.metadata) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.action ?: "unknown action",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (entityLine.isNotBlank()) {
                    AdminOpsStatusBadge(entityLine, row.entityType.orEmpty())
                }
            }
            AdminOpsKeyValue("Actor:", actorLine)
            AdminOpsKeyValue("When:", dateLabel)
            metaLine?.let { meta ->
                Text(
                    meta,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/**
 * t284 — audit metadata as a human line: a JSON object renders as
 * "title: Electronics Wholesale Lots · position: home_top" (keys in wire
 * order, strings unquoted); scalars/arrays and non-JSON text pass through
 * verbatim (still capped at 3 lines by the caller).
 */
internal fun prettifyAuditMetadata(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    val trimmed = raw.trim()
    if (!trimmed.startsWith("{")) return trimmed
    return runCatching {
        val obj = org.json.JSONObject(trimmed)
        val parts = mutableListOf<String>()
        for (key in obj.keys()) {
            val value = obj.opt(key)
            val rendered = when (value) {
                null, org.json.JSONObject.NULL -> "null"
                is String -> value
                else -> value.toString()
            }
            parts.add("$key: $rendered")
        }
        parts.joinToString(" · ").ifBlank { null }
    }.getOrNull() ?: trimmed
}
