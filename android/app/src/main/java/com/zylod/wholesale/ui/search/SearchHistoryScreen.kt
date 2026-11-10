package com.zylod.wholesale.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.ManageSearch
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * Native Search History / Trending surface (t301) — ONE pageId-keyed
 * screen behind the four former seed stubs, wire-exact with the web pages:
 *
 *  - "search-history" / "recently-searched" → HISTORY mode: the server
 *    rows (GET api/search/history) with per-row delete (DELETE ?term=) and
 *    Clear All, tap → search-results; GUESTS get the web page's device-
 *    local fallback (the search home's own recents store) — never a hard
 *    sign-in wall, never fabricated rows.
 *  - "trending-searches" / "popular-searches" → POPULAR mode: the public
 *    GET api/search/popular?limit=40 rows sliced to 30 (the web page's own
 *    slice), category chips filtered from the rows' real category values,
 *    tap → search-results.
 *
 * Visual language: Scaffold + TopAppBar, M3 FilterChips for the popular
 * categories, the ONE M3 spinner for page loads, the offline warning
 * banner over saved rows, and the themed Retry state on first launch —
 * never a white screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchHistoryScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SearchHistoryViewModel = viewModel(key = "native-search-history-$pageId") {
        SearchHistoryViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 convention) — searches made anywhere show
    // up at once.
    LaunchedEffect(Unit) { vm.refresh() }

    val isPopular = vm.isPopularMode
    val title = when (pageId) {
        "recently-searched" -> "Recently Searched"
        "trending-searches" -> "Trending Searches"
        "popular-searches" -> "Popular Searches"
        else -> "Search History"
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        title,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                },
                actions = {
                    // The web page's Clear All — history rows only.
                    if (!isPopular && (state.history.isNotEmpty() || state.localRecent.isNotEmpty())) {
                        TextButton(onClick = vm::clearAll, enabled = !state.clearingAll) {
                            if (state.clearingAll) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(14.dp),
                                    strokeWidth = 2.dp,
                                )
                            } else {
                                Text(
                                    "Clear All",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.error,
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                state.error != null -> SearchHistoryEmpty(
                    message = state.error!!,
                    icon = if (isPopular) Icons.Outlined.ManageSearch else Icons.Outlined.History,
                    onRetry = vm::retry,
                )
                else -> SearchHistoryContent(
                    pageId = pageId,
                    isPopular = isPopular,
                    state = state,
                    onCategory = vm::selectCategory,
                    onDelete = vm::deleteTerm,
                    onSearch = { term ->
                        openPage("search-results", "query=${android.net.Uri.encode(term)}")
                    },
                    onBrowse = { openPage("search", "") },
                )
            }
        }
    }
}

@Composable
private fun SearchHistoryContent(
    pageId: String,
    isPopular: Boolean,
    state: SearchHistoryUiState,
    onCategory: (String?) -> Unit,
    onDelete: (String) -> Unit,
    onSearch: (String) -> Unit,
    onBrowse: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { SearchHistoryOfflineBanner() }
        }
        if (isPopular) {
            // Category chips — the web page's own row-scoped filter.
            if (state.popularCategories.isNotEmpty()) {
                item(key = "category-chips", contentType = "chips") {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item(key = "chip-all", contentType = "chip") {
                            FilterChip(
                                selected = state.selectedCategory == null,
                                onClick = { onCategory(null) },
                                label = { Text("All", fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                                ),
                            )
                        }
                        items(items = state.popularCategories, key = { it }, contentType = { "chip" }) { cat ->
                            FilterChip(
                                selected = state.selectedCategory == cat,
                                onClick = { onCategory(if (state.selectedCategory == cat) null else cat) },
                                label = { Text(cat, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                                ),
                            )
                        }
                    }
                }
            }
            val rows = state.visiblePopular
            if (rows.isEmpty()) {
                item(key = "empty", contentType = "empty") {
                    Text(
                        "No trending searches in this category yet.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(items = rows, key = { it.stableKey }, contentType = { "popular-row" }) { row ->
                PopularRowCard(row = row, onTap = { onSearch(row.query) })
            }
        } else {
            val guestRows = state.localRecent
            val serverRows = state.history
            if (serverRows.isEmpty() && guestRows.isEmpty()) {
                item(key = "empty-cta", contentType = "empty") {
                    SearchHistoryEmpty(
                        message = "No searches yet.",
                        icon = Icons.Outlined.History,
                        onRetry = onBrowse,
                        retryLabel = "Start Searching",
                    )
                }
            } else {
                if (guestRows.isNotEmpty()) {
                    item(key = "local-header", contentType = "header") {
                        Text(
                            "On this device",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                // Guests: device-local rows; signed in: server rows.
                val localItems = guestRows.map { term ->
                    SearchHistoryRow(id = "local-$term", query = term, searchedAt = null)
                }
                val allRows = if (serverRows.isNotEmpty()) serverRows else localItems
                items(items = allRows, key = { it.stableKey }, contentType = { "history-row" }) { row ->
                    HistoryRowCard(
                        row = row,
                        deleting = state.deletingTerm == row.query,
                        onTap = { onSearch(row.query) },
                        onDelete = { onDelete(row.query) },
                    )
                }
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** One server history row — tap searches again, ✕ deletes (web parity). */
@Composable
private fun HistoryRowCard(
    row: SearchHistoryRow,
    deleting: Boolean,
    onTap: () -> Unit,
    onDelete: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onTap),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(
                Icons.Outlined.History,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(10.dp))
            Text(
                row.query,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            if (deleting) {
                CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
            } else {
                Icon(
                    Icons.Outlined.Close,
                    contentDescription = "Delete ${row.query} from search history",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .size(16.dp)
                        .clickable(onClick = onDelete),
                )
            }
        }
    }
}

/** One trending row — count + optional category chip, tap searches. */
@Composable
private fun PopularRowCard(row: PopularSearchRow, onTap: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onTap),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(
                Icons.AutoMirrored.Outlined.TrendingUp,
                null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    row.query,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    buildString {
                        append(java.text.NumberFormat.getIntegerInstance(java.util.Locale.US)
                            .format(row.searchCount.toLong()))
                        append(" searches")
                        row.category?.let { append("  •  "); append(it) }
                    },
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Icon(
                Icons.Outlined.Search,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(14.dp),
            )
        }
    }
}

/** Offline banner over SAVED rows — theme warning pair, Wallet style. */
@Composable
private fun SearchHistoryOfflineBanner() {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        border = androidx.compose.foundation.BorderStroke(1.dp, warning.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "You're offline — showing your last saved searches",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/** Themed empty / first-launch state with Retry — never a white screen. */
@Composable
private fun SearchHistoryEmpty(
    message: String,
    icon: ImageVector,
    onRetry: () -> Unit,
    retryLabel: String = "Retry",
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                icon,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            message,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 16.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 16.dp)
                .height(40.dp),
        ) {
            Icon(Icons.Outlined.Refresh, null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(retryLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}
