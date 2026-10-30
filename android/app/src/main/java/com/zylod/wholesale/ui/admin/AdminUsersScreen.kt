package com.zylod.wholesale.ui.admin

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.components.ZylodTextField
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * NATIVE typed Admin Users (pageId "admin-users" — replaces the generated
 * metadata screen in NativePageRegistry; this file's composable signature is
 * byte-compatible with the generated ui/screens/AdminUsersScreen.kt).
 *
 * Data truth: GET api/admin/users (admin-only) with REAL moderation filters —
 * role (buyer/supplier/admin), account status (active/suspended/banned) and
 * search over email/phone/name/company — plus page/limit pagination and the
 * PATCH api/admin/users moderation actions (suspend/activate/ban, reason
 * audit-logged). Nothing is fabricated for non-admins: their 401/403 renders
 * the honest gate state below. Offline renders the last SAVED page
 * ("zylod_config"/"native_admin_users_cache") under a banner — never a white
 * screen.
 *
 * Structure mirrors AdminDashboardScreen: Scaffold + TopAppBar (back arrow
 * only when [onBack] not null) + one LazyColumn (search row, two filter chip
 * rows, user cards, load-more), honest loading / not-admin / offline / empty
 * states, sp+FontWeight type styles, theme colors only (the brand red arrives
 * as MaterialTheme.colorScheme.primary — no hex here; the success/warning
 * badge pairs come from LocalZylodExtra).
 *
 * Smoothness contract: every row has a STABLE "admin-user-" prefixed key;
 * derived labels (contact line, badges, dates) are remember{}ed or
 * precomputed in AdminModels — zero allocations in composition.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminUsersScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AdminUsersViewModel = viewModel(key = "native-admin-users") {
        AdminUsersViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Seller/Admin Dashboard: re-pull on EVERY entry — the VM
    // survives on the saved back stack, so users that moved while the admin
    // was elsewhere appear at once. The silent refresh keeps visible data.
    LaunchedEffect(Unit) { vm.refresh() }

    // One-shot moderation feedback → snackbar, then the VM clears it.
    val snackbar = remember { SnackbarHostState() }
    val actionMessage = state.actionMessage
    LaunchedEffect(actionMessage) {
        if (actionMessage != null) {
            snackbar.showSnackbar(actionMessage)
            vm.clearActionMessage()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Users",
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
                // THE one page-level loading animation (M3 rule — no shimmer,
                // no custom loaders; AdminDashboard parity).
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                // Honest gate for non-admin users (HTTP 401/403 from the
                // admin-only requireUserType handler) — no fabricated rows.
                state.notAdmin -> AdminUsersNotAdmin(
                    openPage = openPage,
                    onRetry = vm::refresh,
                )
                // First launch offline: nothing fetched AND nothing saved —
                // a themed empty state with Retry, never a white screen.
                state.error != null -> AdminUsersEmpty(onRetry = vm::retry)
                else -> AdminUsersList(state = state, vm = vm)
            }
        }
    }
}

/** Role chips — "" = all, else the handler's exact role values. */
private val ROLE_FILTERS = listOf(
    "" to "All",
    "buyer" to "Buyers",
    "supplier" to "Suppliers",
    "admin" to "Admins",
)

/** Status chips — "" = all, else the handler's exact accountStatus values. */
private val STATUS_FILTERS = listOf(
    "" to "All",
    "active" to "Active",
    "suspended" to "Suspended",
    "banned" to "Banned",
)

@Composable
private fun AdminUsersList(state: AdminUsersUiState, vm: AdminUsersViewModel) {
    // Draft text — committed to the VM on the search action, NOT per keystroke
    // (each commit is a real server round-trip that resets pagination).
    var searchDraft by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "users-search", contentType = "search") {
            SearchRow(
                draft = searchDraft,
                onDraftChange = { searchDraft = it },
                onCommit = { vm.setSearchQuery(searchDraft) },
            )
        }
        item(key = "users-role-filters", contentType = "filter") {
            FilterChipRow(options = ROLE_FILTERS, selected = state.roleFilter, onSelect = vm::setRoleFilter)
        }
        item(key = "users-status-filters", contentType = "filter") {
            FilterChipRow(options = STATUS_FILTERS, selected = state.statusFilter, onSelect = vm::setStatusFilter)
        }
        when {
            state.offline -> item(key = "users-offline-banner", contentType = "banner") {
                OfflineBanner("Connection lost — showing the last loaded users")
            }
            state.offlineFromCache -> item(key = "users-cache-banner", contentType = "banner") {
                OfflineBanner("Offline — showing saved users")
            }
        }
        if (state.refreshing) {
            item(key = "users-refreshing", contentType = "progress") {
                LinearProgressIndicator(Modifier.fillMaxWidth())
            }
        }
        item(key = "users-meta", contentType = "meta") {
            Text(
                "Page ${state.page} of ${state.totalPages} · " +
                    "${state.total} user${if (state.total != 1) "s" else ""}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state.rows.isEmpty()) {
            item(key = "users-empty", contentType = "empty") {
                Text(
                    if (state.searchQuery.isNotBlank() || state.roleFilter.isNotBlank() || state.statusFilter.isNotBlank()) {
                        "No users match the current filters."
                    } else {
                        "No users to show yet — new registrations land here."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "admin-${it.key}" }, // "admin-user-<id>" — fully prefixed
                contentType = { "admin-user" },
            ) { row ->
                AdminUserCard(
                    row = row,
                    actionInProgress = row.id != null && state.actionInProgressUserId == row.id,
                    onAction = vm::applyUserAction,
                )
            }
            if (state.page < state.totalPages) {
                item(key = "users-load-more", contentType = "load-more") {
                    LoadMoreItem(loading = state.loadingMore, onClick = vm::loadMore)
                }
            }
        }
        item(key = "users-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * Search row — ZylodTextField + an explicit Search commit button. The value
 * is a local draft; vm.setSearchQuery fires only on commit (IME submit is
 * not reachable through the shared field, so the button is the contract).
 */
@Composable
private fun SearchRow(draft: String, onDraftChange: (String) -> Unit, onCommit: () -> Unit) {
    ZylodTextField(
        value = draft,
        onValueChange = onDraftChange,
        label = "Search users",
        placeholder = "Email, phone, name, company",
        leadingIcon = Icons.Outlined.Search,
        trailing = {
            TextButton(onClick = onCommit) {
                Text(
                    "Search",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        },
    )
}

/** One horizontally-scrollable FilterChip row (NotificationsScreen style). */
@Composable
private fun FilterChipRow(
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
    ) {
        options.forEach { (value, label) ->
            val isSelected = selected == value
            FilterChip(
                selected = isSelected,
                onClick = { onSelect(value) },
                label = {
                    Text(
                        label,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                    )
                },
            )
        }
    }
}

/**
 * One user card: display label + overflow menu (Activate/Suspend/Ban — the
 * action matching the current accountStatus is hidden), contact lines,
 * userType/accountStatus/verification badges, the precomputed rating line
 * and the precomputed "Joined <relative>" label.
 */
@Composable
private fun AdminUserCard(
    row: AdminUserRow,
    actionInProgress: Boolean,
    onAction: (userId: String, action: String, reason: String?) -> Unit,
) {
    val contactLine = remember(row) { listOfNotNull(row.email, row.phone).joinToString(" • ") }
    var menuOpen by remember(row) { mutableStateOf(false) }
    // "suspend" | "ban" while the reason dialog is up (null = closed).
    var reasonAction by remember(row) { mutableStateOf<String?>(null) }
    val status = remember(row) { row.accountStatus?.trim()?.lowercase() }
    // Local non-null capture so the menu callbacks can call onAction safely.
    val userId = row.id

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.label,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (userId != null) {
                    Box {
                        IconButton(
                            onClick = { menuOpen = true },
                            enabled = !actionInProgress,
                        ) {
                            Icon(
                                Icons.Outlined.MoreVert,
                                if (actionInProgress) "Action in progress" else "User actions",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            if (status != "active") {
                                DropdownMenuItem(
                                    text = { Text("Activate", fontSize = 13.sp) },
                                    onClick = {
                                        menuOpen = false
                                        onAction(userId, "activate", null)
                                    },
                                )
                            }
                            if (status != "suspended") {
                                DropdownMenuItem(
                                    text = { Text("Suspend", fontSize = 13.sp) },
                                    onClick = {
                                        menuOpen = false
                                        reasonAction = "suspend"
                                    },
                                )
                            }
                            if (status != "banned") {
                                DropdownMenuItem(
                                    text = { Text("Ban", fontSize = 13.sp) },
                                    onClick = {
                                        menuOpen = false
                                        reasonAction = "ban"
                                    },
                                )
                            }
                        }
                    }
                }
            }
            if (contactLine.isNotBlank()) {
                Text(
                    contactLine,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(top = 6.dp),
            ) {
                row.userType?.let {
                    MiniBadge(it, MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                }
                row.accountStatus?.let { AccountStatusBadge(it) }
                row.verificationStatus?.let { VerificationBadge(it) }
            }
            if (actionInProgress) {
                LinearProgressIndicator(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                )
            }
            row.ratingLine?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
            ) {
                Text(
                    row.joinedLabel ?: "Joined date unavailable",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    row.dateLabel,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }

    reasonAction?.let { action ->
        ReasonDialog(
            action = action,
            onDismiss = { reasonAction = null },
            onConfirm = { reason ->
                reasonAction = null
                userId?.let { onAction(it, action, reason) }
            },
        )
    }
}

/**
 * Suspend/Ban confirmation with an optional audit-logged reason. Composed
 * only while open, so the draft reason resets every time it appears.
 */
@Composable
private fun ReasonDialog(action: String, onDismiss: () -> Unit, onConfirm: (String?) -> Unit) {
    var reason by remember { mutableStateOf("") }
    val isBan = action == "ban"
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                if (isBan) "Ban user" else "Suspend user",
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
            )
        },
        text = {
            Column {
                Text(
                    if (isBan) {
                        "Permanently ban this account? They will no longer be able to sign in. The reason is audit-logged."
                    } else {
                        "Temporarily suspend this account? They can be re-activated later. The reason is audit-logged."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Reason (optional)", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(reason) }) {
                Text(
                    if (isBan) "Ban" else "Suspend",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", fontSize = 13.sp)
            }
        },
    )
}

/** Small rounded badge — the shared chip visual for all card badges. */
@Composable
private fun MiniBadge(text: String, container: Color, content: Color) {
    Surface(shape = RoundedCornerShape(6.dp), color = container) {
        Text(
            text.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.8.sp,
            color = content,
            maxLines = 1,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

/** Account status badge: active=green, suspended=amber, banned=red. */
@Composable
private fun AccountStatusBadge(status: String) {
    val normalized = status.trim().lowercase()
    val (container, content) = when (normalized) {
        "active" -> LocalZylodExtra.current.success to LocalZylodExtra.current.onSuccess
        "suspended" -> LocalZylodExtra.current.warning to LocalZylodExtra.current.onWarning
        "banned" -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    MiniBadge(normalized.ifBlank { status }, container, content)
}

/** Supplier verification badge: verified=green, pending=amber, else neutral. */
@Composable
private fun VerificationBadge(status: String) {
    val normalized = status.trim().lowercase()
    val (container, content) = when (normalized) {
        "verified", "approved" -> LocalZylodExtra.current.success to LocalZylodExtra.current.onSuccess
        "pending", "under_review" -> LocalZylodExtra.current.warning to LocalZylodExtra.current.onWarning
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    MiniBadge(normalized.ifBlank { status }, container, content)
}

/** Trailing pagination item — spinner while the next page is in flight. */
@Composable
private fun LoadMoreItem(loading: Boolean, onClick: () -> Unit) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp),
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
        } else {
            Button(
                onClick = onClick,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            ) {
                Text("Load more", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Amber banner over saved/stale rows — the AdminDashboard banner style. */
@Composable
private fun OfflineBanner(text: String) {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, warning.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(text, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

/**
 * Honest gate for non-admin users: the API answered 401/403 (signed out or a
 * buyer/supplier account). No fabricated rows — an explanation plus the way
 * out (AdminDashboardScreen's gate pattern).
 */
@Composable
private fun AdminUsersNotAdmin(
    openPage: (pageId: String, query: String) -> Unit,
    onRetry: () -> Unit,
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
                Icons.Outlined.Lock,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "Admin account required",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "The user directory lists real platform accounts for signed-in admin accounts. Sign in with an admin account to manage them here.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        TextButton(onClick = { openPage("home", "") }) {
            Text(
                "Browse the marketplace",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/**
 * First launch with no connection and NO saved users: themed empty state with
 * Retry — never a white screen.
 */
@Composable
private fun AdminUsersEmpty(onRetry: () -> Unit) {
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
                Icons.Outlined.CloudOff,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "You're offline",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "No users saved yet — connect once to save them",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}
