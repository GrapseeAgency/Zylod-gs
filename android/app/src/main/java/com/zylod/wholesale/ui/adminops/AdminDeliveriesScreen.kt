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
import com.zylod.wholesale.data.api.AdminOpsDeliveryAssignment
import com.zylod.wholesale.data.api.AdminOpsDriverAccount

/**
 * t265 — SHARED typed Admin Deliveries screen (pageId "admin-deliveries" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * AdminDeliveriesViewModel). Real data only, from the TWO delivery
 * sub-endpoints (there is no bare api/admin/deliveries listing route):
 * the driver-assignment history section and the driver-accounts section, one
 * elevated card per row with status badges, driver names and timestamps.
 * Honest loading / not-admin / offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun AdminDeliveriesScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AdminDeliveriesViewModel = viewModel(key = "native-admin-ops-$pageId") {
        AdminDeliveriesViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    AdminOpsPageScaffold(title = "Admin Deliveries", onBack = onBack) {
        when {
            state.loading -> AdminOpsCenterSpinner()
            state.notAdmin -> AdminOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> AdminOpsOfflineEmpty(
                message = "No delivery data saved yet — connect once to save it",
                onRetry = vm::retry,
            )
            else -> DeliveriesList(state = state)
        }
    }
}

@Composable
private fun DeliveriesList(state: AdminDeliveriesUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when {
            state.offline -> item(key = "dlv-offline", contentType = "banner") {
                AdminOpsBanner("Connection lost — showing the last loaded delivery data")
            }
            state.offlineFromCache -> item(key = "dlv-cache", contentType = "banner") {
                AdminOpsBanner("Offline — showing saved delivery data")
            }
        }
        if (state.refreshing) {
            item(key = "dlv-refreshing", contentType = "progress") { AdminOpsRefreshingBar() }
        }
        // Section 1 — the driver-assignment history (wire fact: newest first).
        item(key = "dlv-assignments-header", contentType = "header") {
            AdminOpsSectionHeader(
                title = "Driver assignments",
                countLine = "${state.assignments.size} recent assignments (max 100)",
            )
        }
        if (state.assignments.isEmpty()) {
            item(key = "dlv-assignments-empty", contentType = "empty") {
                Text(
                    "No assignments yet — assign a driver to a sub-order to start live tracking.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.assignments,
                key = { "dlv-asg-${it.id ?: it.hashCode()}" },
                contentType = { "dlv-assignment" },
            ) { row ->
                AssignmentCard(row)
            }
        }
        // Section 2 — the driver ACCOUNT list (userType 'driver' rows).
        item(key = "dlv-drivers-header", contentType = "header") {
            AdminOpsSectionHeader(
                title = "Drivers",
                countLine = "${state.drivers.size} driver accounts (max 100)",
            )
        }
        if (state.drivers.isEmpty()) {
            item(key = "dlv-drivers-empty", contentType = "empty") {
                Text(
                    "No driver accounts yet — mint the first one from the admin console.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.drivers,
                key = { "dlv-drv-${it.id ?: it.hashCode()}" },
                contentType = { "dlv-driver" },
            ) { row ->
                DriverCard(row)
            }
        }
        item(key = "dlv-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One assignment row: driver + sub-order pair, status badges, timestamps. */
@Composable
private fun AssignmentCard(row: AdminOpsDeliveryAssignment) {
    val driverLine = remember(row) { row.driver?.name ?: "Unknown driver" }
    val assignedLabel = remember(row) { adminOpsDateOrDash(row.assignedAt) }
    val completedLabel = remember(row) {
        row.completedAt?.let { adminOpsDate(it) }
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
                    driverLine,
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
            AdminOpsKeyValue(
                "Sub-order:",
                listOfNotNull(
                    row.subOrderId?.let { "…${it.takeLast(10)}" },
                    row.subOrderStatus,
                ).joinToString(" · ").ifBlank { "—" },
            )
            AdminOpsKeyValue("Order:", row.orderId?.let { "…${it.takeLast(10)}" } ?: "—")
            AdminOpsKeyValue("Assigned:", assignedLabel)
            completedLabel?.let { AdminOpsKeyValue("Completed:", it) }
        }
    }
}

/** One driver ACCOUNT row: email/phone, account status, created date. */
@Composable
private fun DriverCard(row: AdminOpsDriverAccount) {
    val contactLine = remember(row) {
        listOfNotNull(row.email, row.phone).joinToString(" • ").ifBlank { "No contact on file" }
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
                    row.email ?: row.id ?: "Unknown driver account",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                AdminOpsStatusBadge(
                    row.accountStatus ?: "unknown",
                    row.accountStatus.orEmpty(),
                )
            }
            if (!row.email.isNullOrBlank()) {
                AdminOpsKeyValue("Contact:", contactLine)
            }
            AdminOpsKeyValue("Created:", createdLabel)
        }
    }
}
