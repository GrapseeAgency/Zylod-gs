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
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import com.zylod.wholesale.ui.components.ZylodButton
import com.zylod.wholesale.ui.components.ZylodTextField
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * NATIVE typed Admin Orders (pageId "admin-orders" — replaces the generated
 * metadata screen in NativePageRegistry; this file's composable signature is
 * byte-compatible with the generated ui/screens/AdminOrdersScreen.kt).
 *
 * Data truth: GET api/admin/orders (admin-only) with REAL operations filters —
 * paymentStatus (unpaid/partial/paid/refunded/all, ALWAYS explicit: the
 * handler's bare default is the unpaid verification queue), fulfillment
 * status (a REAL subOrder status) and q (orderNumber / buyer email) — plus
 * page/limit pagination and POST api/admin/orders/{id}/verify-payment for
 * human-verified bank-transfer recording. Nothing is fabricated for
 * non-admins: their 401/403 renders the honest gate state below. Offline
 * renders the last SAVED page ("zylod_config"/"native_admin_orders_cache")
 * under a banner — never a white screen.
 *
 * Structure mirrors AdminUsersScreen/AdminDashboardScreen: Scaffold +
 * TopAppBar (back arrow only when [onBack] not null) + one LazyColumn (search
 * row, two filter chip rows, order cards, load-more), honest loading /
 * not-admin / offline / empty states, sp+FontWeight type styles, theme colors
 * only (the brand red arrives as MaterialTheme.colorScheme.primary — no hex
 * here; the success/warning badge pairs come from LocalZylodExtra; the ৳
 * money format is the shared WalletFormat helper).
 *
 * Smoothness contract: every row has a STABLE "admin-order-" prefixed key;
 * derived labels (money, payment summary, relative time, subOrder statuses)
 * are remember{}ed or precomputed in AdminModels — zero allocations in
 * composition.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminOrdersScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AdminOrdersViewModel = viewModel(key = "native-admin-orders") {
        AdminOrdersViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Seller/Admin Dashboard: re-pull on EVERY entry — the VM
    // survives on the saved back stack, so orders that moved while the admin
    // was elsewhere appear at once. The silent refresh keeps visible data.
    LaunchedEffect(Unit) { vm.refresh() }

    // One-shot verify-payment feedback → snackbar, then the VM clears it.
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
                        "Orders",
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
                // admin-only requireUserType handler) — no fabricated orders.
                state.notAdmin -> AdminOrdersNotAdmin(
                    openPage = openPage,
                    onRetry = vm::refresh,
                )
                // First launch offline: nothing fetched AND nothing saved —
                // a themed empty state with Retry, never a white screen.
                state.error != null -> AdminOrdersEmpty(onRetry = vm::retry)
                else -> AdminOrdersList(state = state, vm = vm)
            }
        }
    }
}

/** Payment chips — the handler's exact paymentStatus values (all = none). */
private val PAYMENT_FILTERS = listOf(
    "all" to "All",
    "unpaid" to "Unpaid",
    "partial" to "Partial",
    "paid" to "Paid",
    "refunded" to "Refunded",
)

/** Fulfillment chips — the handler's REAL subOrder statuses (all = none). */
private val FULFILLMENT_FILTERS = listOf(
    "all" to "All",
    "pending" to "Pending",
    "confirmed" to "Confirmed",
    "packed" to "Packed",
    "shipped" to "Shipped",
    "delivered" to "Delivered",
    "cancelled" to "Cancelled",
    "returned" to "Returned",
)

@Composable
private fun AdminOrdersList(state: AdminOrdersUiState, vm: AdminOrdersViewModel) {
    // Draft text — committed to the VM on the search action, NOT per keystroke
    // (each commit is a real server round-trip that resets pagination).
    var searchDraft by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "orders-search", contentType = "search") {
            SearchRow(
                draft = searchDraft,
                onDraftChange = { searchDraft = it },
                onCommit = { vm.setSearchQuery(searchDraft) },
            )
        }
        item(key = "orders-payment-filters", contentType = "filter") {
            FilterChipRow(options = PAYMENT_FILTERS, selected = state.paymentStatusFilter, onSelect = vm::setPaymentStatusFilter)
        }
        item(key = "orders-fulfillment-filters", contentType = "filter") {
            FilterChipRow(options = FULFILLMENT_FILTERS, selected = state.statusFilter, onSelect = vm::setStatusFilter)
        }
        when {
            state.offline -> item(key = "orders-offline-banner", contentType = "banner") {
                OfflineBanner("Connection lost — showing the last loaded orders")
            }
            state.offlineFromCache -> item(key = "orders-cache-banner", contentType = "banner") {
                OfflineBanner("Offline — showing saved orders")
            }
        }
        if (state.refreshing) {
            item(key = "orders-refreshing", contentType = "progress") {
                LinearProgressIndicator(Modifier.fillMaxWidth())
            }
        }
        item(key = "orders-meta", contentType = "meta") {
            Text(
                "Page ${state.page} of ${state.totalPages} · " +
                    "${state.total} order${if (state.total != 1) "s" else ""}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state.orders.isEmpty()) {
            item(key = "orders-empty", contentType = "empty") {
                Text(
                    if (state.searchQuery.isNotBlank() || state.paymentStatusFilter != "all" || state.statusFilter != "all") {
                        "No orders match the current filters."
                    } else {
                        "No orders to show yet — they land here the moment a buyer checks out."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.orders,
                key = { "admin-${it.key}" }, // "admin-order-<id>" — fully prefixed
                contentType = { "admin-order" },
            ) { row ->
                AdminOrderCard(
                    row = row,
                    verifyInFlight = row.id != null && state.verifyInProgressOrderId == row.id,
                    onVerify = vm::verifyPayment,
                )
            }
            if (state.page < state.totalPages) {
                item(key = "orders-load-more", contentType = "load-more") {
                    LoadMoreItem(loading = state.loadingMore, onClick = vm::loadMore)
                }
            }
        }
        item(key = "orders-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
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
        label = "Search orders",
        placeholder = "Order number or buyer email",
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
 * One order card: orderNumber headline + derived fulfillment chip, buyer
 * line, item/sub-order counts, ৳ total (WalletFormat), paymentStatus chip +
 * first-payment summary, per-subOrder status chips (max 4 + "+n more") and
 * the Verify-payment action for unpaid/partial orders.
 */
@Composable
private fun AdminOrderCard(
    row: AdminOrderRow,
    verifyInFlight: Boolean,
    onVerify: (orderId: String, amount: Double, transactionId: String, method: String, note: String?) -> Unit,
) {
    val amountLabel = remember(row) { formatBdt(row.totalAmount) }
    val buyerLine = remember(row) {
        listOfNotNull(
            row.buyerName,
            row.buyerEmail?.takeIf { it != row.buyerName },
        ).joinToString(" • ")
    }
    val countsLine = remember(row) {
        listOfNotNull(
            if (row.itemCount > 0) "${row.itemCount} item${if (row.itemCount != 1) "s" else ""}" else null,
            if (row.subOrderCount > 0) "${row.subOrderCount} sub-order${if (row.subOrderCount != 1) "s" else ""}" else null,
        ).joinToString(" · ")
    }
    var verifyOpen by remember(row) { mutableStateOf(false) }
    // Local non-null capture so the dialog callback can call onVerify safely.
    val orderId = row.id

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.orderNumber,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                row.status?.let { OrderStatusBadge(it) }
            }
            if (buyerLine.isNotBlank()) {
                Text(
                    buyerLine,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            if (countsLine.isNotBlank()) {
                Text(
                    countsLine,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                row.paymentStatus?.let { PaymentStatusBadge(it) }
                row.subOrderStatuses.take(4).forEach { status ->
                    MiniBadge(status, MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (row.subOrderStatuses.size > 4) {
                    MiniBadge(
                        "+${row.subOrderStatuses.size - 4} more",
                        MaterialTheme.colorScheme.surfaceVariant,
                        MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (verifyInFlight) {
                LinearProgressIndicator(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                )
            }
            row.paymentSummary?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
            ) {
                Text(
                    amountLabel,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    row.relativeLabel ?: row.dateLabel,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (row.hasPendingPayment && orderId != null && row.totalAmount > 0.0) {
                ZylodButton(
                    text = "Verify payment",
                    onClick = { verifyOpen = true },
                    enabled = !verifyInFlight,
                    height = 36.dp,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }

    if (verifyOpen && orderId != null && row.totalAmount > 0.0) {
        VerifyPaymentDialog(
            row = row,
            onDismiss = { verifyOpen = false },
            onConfirm = { transactionId, method, note ->
                verifyOpen = false
                onVerify(orderId, row.totalAmount, transactionId, method, note)
            },
        )
    }
}

/**
 * Human-verified payment recording — the route's REAL contract in a dialog:
 * transaction reference (unique, required), method (bank_transfer |
 * mobile_banking), optional note, and the amount shown for confirmation —
 * it is always the order's own total from the server row, never invented.
 */
@Composable
private fun VerifyPaymentDialog(
    row: AdminOrderRow,
    onDismiss: () -> Unit,
    onConfirm: (transactionId: String, method: String, note: String?) -> Unit,
) {
    var transactionId by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var method by remember { mutableStateOf("bank_transfer") }
    val amountLabel = remember(row) { formatBdt(row.totalAmount) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Verify payment", fontSize = 16.sp, fontWeight = FontWeight.Black)
        },
        text = {
            Column {
                Text(
                    "Record a payment you have CONFIRMED arrived in the company account for ${row.orderNumber}. The reference must be unique and the amount must match the order total.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Amount: $amountLabel (order total)",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(top = 8.dp),
                ) {
                    FilterChip(
                        selected = method == "bank_transfer",
                        onClick = { method = "bank_transfer" },
                        label = { Text("Bank transfer", fontSize = 11.sp) },
                    )
                    FilterChip(
                        selected = method == "mobile_banking",
                        onClick = { method = "mobile_banking" },
                        label = { Text("Mobile banking", fontSize = 11.sp) },
                    )
                }
                OutlinedTextField(
                    value = transactionId,
                    onValueChange = { transactionId = it },
                    label = { Text("Transaction reference (required)", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                )
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Note (optional)", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(transactionId, method, note) },
                enabled = transactionId.isNotBlank(),
            ) {
                Text(
                    "Verify",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
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

/**
 * Payment status badge: paid=green, unpaid/partial=amber (needs attention),
 * refunded=neutral (resolved, no money moving).
 */
@Composable
private fun PaymentStatusBadge(status: String) {
    val normalized = status.trim().lowercase()
    val (container, content) = when (normalized) {
        "paid" -> LocalZylodExtra.current.success to LocalZylodExtra.current.onSuccess
        "unpaid", "partial" -> LocalZylodExtra.current.warning to LocalZylodExtra.current.onWarning
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    MiniBadge(normalized.ifBlank { status }, container, content)
}

/** Derived fulfillment badge: delivered=green, cancelled/returned=red, else amber. */
@Composable
private fun OrderStatusBadge(status: String) {
    val normalized = status.trim().lowercase()
    val (container, content) = when (normalized) {
        "delivered" -> LocalZylodExtra.current.success to LocalZylodExtra.current.onSuccess
        "cancelled", "returned" -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        "pending", "confirmed", "packed", "shipped", "processing" -> LocalZylodExtra.current.warning to LocalZylodExtra.current.onWarning
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
 * buyer/supplier account). No fabricated orders — an explanation plus the
 * way out (AdminDashboardScreen's gate pattern).
 */
@Composable
private fun AdminOrdersNotAdmin(
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
            "The operations queue lists real platform orders for signed-in admin accounts. Sign in with an admin account to work them here.",
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
 * First launch with no connection and NO saved orders: themed empty state
 * with Retry — never a white screen.
 */
@Composable
private fun AdminOrdersEmpty(onRetry: () -> Unit) {
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
            "No orders saved yet — connect once to save them",
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
