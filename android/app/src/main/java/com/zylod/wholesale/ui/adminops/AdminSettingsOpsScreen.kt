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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.AdminOpsSettingRow

/**
 * t265 — SHARED typed Admin Settings screen (pageId "admin-settings" — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * AdminSettingsOpsViewModel). Real data only, from GET api/admin/settings:
 * one elevated card per registry setting — label, key, category, the stored
 * value (or the honest "Not set" + built-in default line, never a default
 * dressed up as a stored value), the public/private scope badge, the update
 * timestamp and the full enforcement description — plus the route's own
 * dataNotes rendered verbatim at the bottom. Honest loading / not-admin /
 * offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun AdminSettingsOpsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AdminSettingsOpsViewModel = viewModel(key = "native-admin-ops-$pageId") {
        AdminSettingsOpsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    AdminOpsPageScaffold(title = "Admin Settings", onBack = onBack) {
        when {
            state.loading -> AdminOpsCenterSpinner()
            state.notAdmin -> AdminOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> AdminOpsOfflineEmpty(
                message = "No settings saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> SettingsList(state = state)
        }
    }
}

@Composable
private fun SettingsList(state: AdminSettingsOpsUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when {
            state.offline -> item(key = "set-offline", contentType = "banner") {
                AdminOpsBanner("Connection lost — showing the last loaded settings")
            }
            state.offlineFromCache -> item(key = "set-cache", contentType = "banner") {
                AdminOpsBanner("Offline — showing saved settings")
            }
        }
        if (state.refreshing) {
            item(key = "set-refreshing", contentType = "progress") { AdminOpsRefreshingBar() }
        }
        item(key = "set-meta", contentType = "meta") {
            Text(
                "${state.rows.size} registry settings — unset keys show their built-in default",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state.rows.isEmpty()) {
            item(key = "set-empty", contentType = "empty") {
                Text(
                    "No settings registered yet — the admin-settings registry is the whitelist.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "set-${it.key ?: it.hashCode()}" },
                contentType = { "set-row" },
            ) { row ->
                SettingCard(row)
            }
        }
        if (state.dataNotes.isNotEmpty()) {
            item(key = "set-notes", contentType = "notes") {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            "Data notes (from the API, verbatim)",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        state.dataNotes.forEachIndexed { index, note ->
                            Text(
                                "${index + 1}. $note",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                lineHeight = 14.sp,
                            )
                        }
                    }
                }
            }
        }
        item(key = "set-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One registry setting: identity, honest value/default line, scope, trail. */
@Composable
private fun SettingCard(row: AdminOpsSettingRow) {
    val storedValue = remember(row) { adminOpsSettingValueText(row.value) }
    val defaultValue = remember(row) { adminOpsSettingValueText(row.defaultValue) }

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
                        row.label ?: row.key ?: "Unknown setting",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        row.key ?: "—",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                // Scope pill: green = publicly served, gray = admin-only.
                AdminOpsStatusBadge(
                    if (row.isPublic) "public" else "admin-only",
                    if (row.isPublic) "approved" else "inactive",
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                Text(
                    if (storedValue != null) "Value: $storedValue" else "Not set",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (storedValue != null) {
                        MaterialTheme.colorScheme.onSurface
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
                if (storedValue == null && defaultValue != null) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "— default in use: $defaultValue",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            row.updatedAt?.let {
                Text(
                    "Updated ${adminOpsDate(it)}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            row.description?.takeIf(String::isNotBlank)?.let { description ->
                Text(
                    description,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 15.sp,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}
