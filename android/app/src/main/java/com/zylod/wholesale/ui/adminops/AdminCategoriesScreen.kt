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
import com.zylod.wholesale.data.api.AdminOpsCategoryRow

/**
 * t265 — SHARED typed Admin Categories screen (pageId "admin-categories" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * AdminCategoriesViewModel). Real data only, from GET api/admin/categories:
 * the real tree-stats strip, and one elevated card per category row — name,
 * slug, parent line, active badge, sort order, the admin product/children
 * counts (which include inactive and unapproved rows, unlike the public
 * tree) and the creation timestamp. Honest loading / not-admin / offline /
 * empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun AdminCategoriesScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AdminCategoriesViewModel = viewModel(key = "native-admin-ops-$pageId") {
        AdminCategoriesViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    AdminOpsPageScaffold(title = "Admin Categories", onBack = onBack) {
        when {
            state.loading -> AdminOpsCenterSpinner()
            state.notAdmin -> AdminOpsGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> AdminOpsOfflineEmpty(
                message = "No categories saved yet — connect once to save them",
                onRetry = vm::retry,
            )
            else -> CategoriesList(state = state)
        }
    }
}

@Composable
private fun CategoriesList(state: AdminCategoriesUiState) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "cat-stats", contentType = "stats") {
            state.stats?.let { s ->
                AdminOpsStatsStrip(
                    stats = listOf(
                        "Total" to adminOpsCount(s.total),
                        "Active" to adminOpsCount(s.active),
                        "Inactive" to adminOpsCount(s.inactive),
                        "Roots" to adminOpsCount(s.roots),
                    ),
                )
            }
        }
        when {
            state.offline -> item(key = "cat-offline", contentType = "banner") {
                AdminOpsBanner("Connection lost — showing the last loaded categories")
            }
            state.offlineFromCache -> item(key = "cat-cache", contentType = "banner") {
                AdminOpsBanner("Offline — showing saved categories")
            }
        }
        if (state.refreshing) {
            item(key = "cat-refreshing", contentType = "progress") { AdminOpsRefreshingBar() }
        }
        if (state.rows.isEmpty()) {
            item(key = "cat-empty", contentType = "empty") {
                Text(
                    "No categories yet — create the first root category from the admin console.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "cat-${it.id ?: it.hashCode()}" },
                contentType = { "cat-row" },
            ) { row ->
                CategoryCard(row)
            }
        }
        if (state.dataNotes.isNotEmpty()) {
            item(key = "cat-notes", contentType = "notes") {
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
        item(key = "cat-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One category row: identity + parent line, active badge, real counts. */
@Composable
private fun CategoryCard(row: AdminOpsCategoryRow) {
    val parentLine = remember(row) {
        row.parentName?.let { "Under $it" } ?: "Root category"
    }
    val slugLine = remember(row) { row.slug ?: "—" }

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
                        row.name ?: "Unnamed category",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        "/$slugLine",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                AdminOpsStatusBadge(
                    if (row.isActive) "active" else "inactive",
                    if (row.isActive) "active" else "inactive",
                )
            }
            AdminOpsKeyValue("Tree:", parentLine)
            AdminOpsKeyValue("Products:", adminOpsCount(row.productCount))
            AdminOpsKeyValue("Subcategories:", adminOpsCount(row.childrenCount))
            AdminOpsKeyValue("Sort order:", adminOpsCount(row.sortOrder))
            AdminOpsKeyValue("Created:", adminOpsDateOrDash(row.createdAt))
        }
    }
}
