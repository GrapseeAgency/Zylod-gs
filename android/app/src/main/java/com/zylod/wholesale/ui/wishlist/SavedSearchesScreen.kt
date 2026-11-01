package com.zylod.wholesale.ui.wishlist

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.SavedSearchDto
import com.zylod.wholesale.ui.rewards.RewardsEmptyCard
import com.zylod.wholesale.ui.rewards.RewardsErrorCard
import com.zylod.wholesale.ui.rewards.RewardsOfflineBanner
import com.zylod.wholesale.ui.rewards.RewardsSkeleton

/**
 * SHARED typed saved-searches surface (pageId saved-searches).
 *
 * WEB TRUTH (saved-searches-page.tsx): GET api/search/saved renders for
 * GUESTS too (the route answers with the public isDefault rows when
 * signed-out — no sign-in gate here, mirroring the web). Rows carry the
 * name and the filter pills parsed from filterConfig ("query" quoted,
 * category, Min ৳/Max ৳/MOQ ≤ — the web's exact pill labels), the Search
 * Now action (navigates to search-results with the saved query — or the
 * name when the config carries none) and the Alert button whose web
 * behavior is a LOCAL toast, not an endpoint (mirrored as an inline note,
 * verbatim). The trash deletes through DELETE api/search/saved/{id}.
 * The header's + button routes to search-home (the web's creation entry).
 *
 * Honest loading / empty / error / offline states — signed-out works, and
 * a failed delete restores the row instead of the web's silent drop.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedSearchesScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SavedSearchesViewModel = viewModel(key = "native-saved-searches-$pageId") {
        SavedSearchesViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            SearchesTopBar(onBack = onBack, onNew = { openPage("search-home", "") })
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> SearchesBody(state = state, vm = vm, openPage = openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchesTopBar(onBack: (() -> Unit)?, onNew: () -> Unit) {
    TopAppBar(
        title = {
            Text(
                "Saved Searches",
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
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
            IconButton(onClick = onNew) {
                Icon(Icons.Outlined.Add, "Start a new search", tint = MaterialTheme.colorScheme.onSurface)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun SearchesBody(
    state: SavedSearchesUiState,
    vm: SavedSearchesViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        state.actionError?.let { message ->
            item(key = "action-err", contentType = "note") {
                InlineSearchesNote(text = message, success = false, onDismiss = vm::consumeActionError)
            }
        }
        state.alertMessage?.let { message ->
            item(key = "alert-ok", contentType = "note") {
                InlineSearchesNote(text = message, success = true, onDismiss = vm::consumeAlertMessage)
            }
        }
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") {
                RewardsOfflineBanner("Offline — showing your last saved searches")
            }
        }
        when {
            state.rows.isEmpty() -> item(key = "empty", contentType = "empty") {
                RewardsEmptyCard(
                    icon = Icons.Outlined.Search,
                    title = "No saved searches",
                    body = "Save a search to get notified when new products match your criteria",
                )
                Button(
                    onClick = { openPage("search-home", "") },
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                        .height(44.dp),
                ) {
                    Text("Start Searching", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
            else -> {
                item(key = "count", contentType = "meta") {
                    Text(
                        if (state.rows.size == 1) "1 saved search" else "${state.rows.size} saved searches",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                state.rows.forEach { row ->
                    item(key = "ss-${row.stableKey}", contentType = "saved-search-row") {
                        SavedSearchRow(
                            row = row,
                            deleting = state.deletingId == row.stableKey,
                            onDelete = { vm.deleteSearch(row.stableKey) },
                            onAlert = { vm.enableAlert(row.name.orEmpty()) },
                            openPage = openPage,
                        )
                    }
                }
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

@Composable
private fun SavedSearchRow(
    row: SavedSearchDto,
    deleting: Boolean,
    onDelete: () -> Unit,
    onAlert: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val name = row.name?.takeIf(String::isNotBlank) ?: "Saved search"
    val filter = parseSavedFilter(row.filterConfig)
    val searchQuery = filter.query?.takeIf(String::isNotBlank) ?: name
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(32.dp)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), RoundedCornerShape(8.dp)),
                ) {
                    Icon(
                        Icons.Outlined.Search,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp),
                    )
                }
                Spacer(Modifier.width(10.dp))
                Text(
                    name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (deleting) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                } else {
                    IconButton(onClick = onDelete) {
                        Icon(
                            Icons.Outlined.DeleteOutline,
                            "Delete $name",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }
            // The web's filter pills — verbatim labels, only for present values.
            val pills = buildList {
                filter.query?.let { add("\"$it\"") }
                filter.category?.let { add(it) }
                filter.minPrice?.let { add("Min ৳$it") }
                filter.maxPrice?.let { add("Max ৳$it") }
                filter.moq?.let { add("MOQ ≤$it") }
            }
            if (pills.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    pills.forEach { pill ->
                        Surface(
                            color = MaterialTheme.colorScheme.surface,
                            shape = RoundedCornerShape(50),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
                        ) {
                            Text(
                                pill,
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            )
                        }
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { openPage("search-results", "query=$searchQuery") },
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(36.dp),
                ) {
                    Icon(Icons.Outlined.Search, null, modifier = Modifier.size(12.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Search Now", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
                    modifier = Modifier
                        .height(36.dp)
                        .clickable(onClick = onAlert),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(horizontal = 12.dp),
                    ) {
                        Text(
                            "Alert",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

/** Inline verbatim note (delete failures, the local Alert confirmation). */
@Composable
private fun InlineSearchesNote(text: String, success: Boolean, onDismiss: (() -> Unit)?) {
    val color = if (success) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
    Surface(
        color = color.copy(alpha = 0.08f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier.padding(start = 12.dp, top = 4.dp, bottom = 4.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = color,
                textAlign = TextAlign.Start,
                modifier = Modifier.weight(1f),
            )
            if (onDismiss != null) {
                TextButton(onClick = onDismiss) {
                    Text("Dismiss", fontSize = 11.sp, color = color, fontWeight = FontWeight.Bold)
                }
            } else {
                Spacer(Modifier.width(8.dp))
            }
        }
    }
}
