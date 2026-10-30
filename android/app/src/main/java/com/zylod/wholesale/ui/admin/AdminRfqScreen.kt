package com.zylod.wholesale.ui.admin

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Lock
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
import androidx.compose.material3.OutlinedButton
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
import com.zylod.wholesale.ui.rfq.rfqStatusLabel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * NATIVE typed Admin RFQ review (pageId "admin-rfq" — replaces the generated
 * metadata screen in NativePageRegistry; this file's composable signature is
 * byte-compatible with the generated ui/screens/AdminRfqScreen.kt).
 *
 * Data truth: GET api/admin/rfqs (admin-only) with the REAL status filter
 * (open/quoted/awarded/closed/expired) and page/limit pagination, the wire
 * stats block (per-status counts) as the KPI chip row, plus the PATCH
 * api/admin/rfqs/{id} close action ({ status: "closed" } — the handler
 * accepts it ONLY from status open|quoted). Nothing is fabricated for
 * non-admins: their 401/403 renders the honest gate state below. Offline
 * renders the last SAVED page ("zylod_config"/"native_admin_rfq_cache")
 * under a banner — never a white screen.
 *
 * Structure mirrors AdminUsersScreen: Scaffold + TopAppBar (back arrow only
 * when [onBack] not null) + one LazyColumn (stats chip row, status filter
 * chips, RFQ cards with inline expand-to-detail and the close action,
 * load-more), honest loading / not-admin / offline / empty states,
 * sp+FontWeight type styles, theme colors only (the brand red arrives as
 * MaterialTheme.colorScheme — no hex here; the success/warning badge pairs
 * come from LocalZylodExtra).
 *
 * Smoothness contract: every row has a STABLE fully-prefixed key
 * ("admin-rfq-<id>", items "admin-rfq-item-…", quotes "admin-rfq-quote-…");
 * derived labels (money ranges, deadlines, badges) are precomputed in
 * [AdminRfqViewModel]'s mappers — zero formatting in composition.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminRfqScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AdminRfqViewModel = viewModel(key = "native-admin-rfq") {
        AdminRfqViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Seller/Admin Dashboard: re-pull on EVERY entry — the
    // VM survives on the saved back stack, so RFQs that moved while the
    // admin was elsewhere appear at once. The silent refresh keeps data.
    LaunchedEffect(Unit) { vm.refresh() }

    // One-shot close feedback → snackbar, then the VM clears it.
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
                        "RFQ Review",
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
                state.notAdmin -> AdminRfqNotAdmin(
                    openPage = openPage,
                    onRetry = vm::refresh,
                )
                // First launch offline: nothing fetched AND nothing saved —
                // a themed empty state with Retry, never a white screen.
                state.error != null -> AdminRfqEmpty(onRetry = vm::retry)
                else -> AdminRfqList(state = state, vm = vm)
            }
        }
    }
}

/** Status chips — "all" = none, else the handler's exact rfqs.status values. */
private val ADMIN_RFQ_STATUS_FILTERS = listOf(
    "all" to "All",
    "open" to "Open",
    "quoted" to "Quoted",
    "awarded" to "Awarded",
    "closed" to "Closed",
    "expired" to "Expired",
)

@Composable
private fun AdminRfqList(state: AdminRfqUiState, vm: AdminRfqViewModel) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "admin-rfq-stats", contentType = "stats") {
            StatsRow(stats = state.stats)
        }
        item(key = "admin-rfq-filters", contentType = "filter") {
            FilterChipRow(
                options = ADMIN_RFQ_STATUS_FILTERS,
                selected = state.statusFilter,
                onSelect = vm::setStatusFilter,
            )
        }
        when {
            state.offline -> item(key = "admin-rfq-offline-banner", contentType = "banner") {
                OfflineBanner("Connection lost — showing the last loaded RFQs")
            }
            state.offlineFromCache -> item(key = "admin-rfq-cache-banner", contentType = "banner") {
                OfflineBanner("Offline — showing saved RFQs")
            }
        }
        if (state.refreshing) {
            item(key = "admin-rfq-refreshing", contentType = "progress") {
                LinearProgressIndicator(Modifier.fillMaxWidth())
            }
        }
        item(key = "admin-rfq-meta", contentType = "meta") {
            Text(
                "Page ${state.page} of ${state.totalPages} · " +
                    "${state.total} RFQ${if (state.total != 1) "s" else ""}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state.rows.isEmpty()) {
            item(key = "admin-rfq-empty", contentType = "empty") {
                Text(
                    if (state.statusFilter != "all") {
                        "No RFQs match the current filter."
                    } else {
                        "No RFQs to review yet — buyer quote requests land here."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "admin-${it.key}" }, // "admin-rfq-<id>" — fully prefixed
                contentType = { "admin-rfq-card" },
            ) { row ->
                AdminRfqCard(
                    row = row,
                    expanded = state.expandedRfqId != null && state.expandedRfqId == row.id,
                    detail = state.detail?.takeIf { row.id != null && it.id == row.id },
                    detailLoading = state.detailLoading && state.expandedRfqId == row.id,
                    closing = state.closingRfqId != null && state.closingRfqId == row.id,
                    onToggle = { vm.toggleExpand(row.id) },
                    onClose = vm::closeRfq,
                )
            }
            if (state.page < state.totalPages) {
                item(key = "admin-rfq-load-more", contentType = "load-more") {
                    LoadMoreItem(loading = state.loadingMore, onClick = vm::loadMore)
                }
            }
        }
        item(key = "admin-rfq-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * The wire stats block as a horizontally-scrollable chip row — Open n ·
 * Quoted n · Awarded n · Closed n · Expired n · Total n. Renders nothing
 * (an empty spacer keeps the LazyColumn keys stable) until a live payload
 * carries real numbers — the offline/cache render never fakes stats.
 */
@Composable
private fun StatsRow(stats: AdminRfqStats?) {
    if (stats == null) return
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
    ) {
        listOf(
            "Open" to stats.open,
            "Quoted" to stats.quoted,
            "Awarded" to stats.awarded,
            "Closed" to stats.closed,
            "Expired" to stats.expired,
            "Total" to stats.total,
        ).forEach { (label, count) ->
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                ) {
                    Text(
                        label,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "$count",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}

/** One horizontally-scrollable FilterChip row (AdminUsersScreen style). */
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
 * One admin RFQ card: title + status badge, buyer display name, the
 * quantity/target line, delivery city + deadline, item/quote counts and the
 * precomputed bestQuote range; tapping expands the detail section
 * (description, items, quotes) with the [Close RFQ] action when the RFQ's
 * status still allows it (open|quoted — the handler's rule).
 */
@Composable
private fun AdminRfqCard(
    row: AdminRfqRow,
    expanded: Boolean,
    detail: AdminRfqDetail?,
    detailLoading: Boolean,
    closing: Boolean,
    onToggle: () -> Unit,
    onClose: (rfqId: String) -> Unit,
) {
    var closeOpen by remember(row.key) { mutableStateOf(false) }

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onToggle),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Spacer(Modifier.width(8.dp))
                AdminRfqStatusBadge(row.status)
            }
            row.buyerName?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            if (row.summaryLabel.isNotBlank()) {
                Text(
                    row.summaryLabel,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
            ) {
                row.deliveryCity?.let {
                    Text(
                        it,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                row.deadlineLabel?.let {
                    Text(
                        it,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
            ) {
                Text(
                    "${row.itemCountLabel} · ${row.quoteCountLabel}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "Best ${row.bestQuoteLabel}",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
            ) {
                Text(
                    row.createdLabel ?: "",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    if (expanded) "Hide details" else "View details",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            if (expanded) {
                AdminRfqDetailSection(
                    row = row,
                    detail = detail,
                    detailLoading = detailLoading,
                    closing = closing,
                    onRequestClose = { closeOpen = true },
                )
            }
        }
    }

    // Close confirmation — closes a REAL buyer RFQ, so it gets the explicit
    // confirm (the handler 409s anything but open|quoted; the VM surfaces
    // that text verbatim if the row went stale mid-dialog).
    if (closeOpen) {
        AlertDialog(
            onDismissRequest = { closeOpen = false },
            title = {
                Text("Close this RFQ?", fontSize = 16.sp, fontWeight = FontWeight.Black)
            },
            text = {
                Text(
                    "Closing stops suppliers from quoting on this request. Buyers cannot reopen it.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    closeOpen = false
                    row.id?.let(onClose)
                }) {
                    Text(
                        "Close RFQ",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { closeOpen = false }) {
                    Text("Cancel", fontSize = 13.sp)
                }
            },
        )
    }
}

/** Status badge: open=brand, quoted=amber, awarded=green, closed/expired=neutral. */
@Composable
private fun AdminRfqStatusBadge(status: String?) {
    val normalized = status?.trim()?.lowercase() ?: ""
    val (container, content) = when (normalized) {
        // The brand red family arrives through the theme's primary containers.
        "open" -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        "quoted" -> LocalZylodExtra.current.warning to LocalZylodExtra.current.onWarning
        "awarded" -> LocalZylodExtra.current.success to LocalZylodExtra.current.onSuccess
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    MiniBadge(rfqStatusLabel(status), container, content)
}

/** Quote status badge: pending=amber, accepted=green, rejected=neutral. */
@Composable
private fun AdminRfqQuoteBadge(statusLabel: String, status: String?) {
    val normalized = status?.trim()?.lowercase() ?: ""
    val (container, content) = when (normalized) {
        "pending" -> LocalZylodExtra.current.warning to LocalZylodExtra.current.onWarning
        "accepted" -> LocalZylodExtra.current.success to LocalZylodExtra.current.onSuccess
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    MiniBadge(statusLabel, container, content)
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
 * The expanded admin card body: description, line items, supplier quotes —
 * plus the [Close RFQ] button ONLY while the detail (or the row) reports a
 * closeable status (open|quoted).
 */
@Composable
private fun AdminRfqDetailSection(
    row: AdminRfqRow,
    detail: AdminRfqDetail?,
    detailLoading: Boolean,
    closing: Boolean,
    onRequestClose: () -> Unit,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 10.dp),
    ) {
        if (detailLoading) {
            LinearProgressIndicator(Modifier.fillMaxWidth())
        }
        // Description — from the detail when present (the list projection
        // carries none), so a slow detail keeps the section honest.
        val description = detail?.description
        if (description != null) {
            Text(
                description,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        detail?.categorySlug?.let {
            Text(
                "Category: $it",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // Items — the detail's real line items (the admin list projection
        // carries only the itemCount, never invented here).
        val items = detail?.items.orEmpty()
        if (items.isNotEmpty()) {
            Text(
                "Items",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
            items.forEach { item ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                            RoundedCornerShape(8.dp),
                        )
                        .padding(8.dp),
                ) {
                    Text(
                        item.name,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    item.specs?.let {
                        Text(
                            it,
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (item.qtyLabel.isNotBlank()) {
                            Text(
                                item.qtyLabel,
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        item.targetLabel?.let {
                            Text(
                                "target $it",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
            }
        }

        // Quotes — the detail projection (supplier briefs + totals).
        val quotes = detail?.quotes.orEmpty()
        Text(
            "Quotes",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
        )
        if (quotes.isEmpty()) {
            Text(
                if (detail == null && detailLoading) {
                    "Loading quotes…"
                } else {
                    "No quotes on this RFQ yet."
                },
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            quotes.forEach { quote ->
                AdminQuoteRowCard(quote)
            }
        }

        // Close RFQ — ONLY from open|quoted (the handler 409s anything else;
        // the detail is the authority when loaded, the row otherwise).
        val status = detail?.status ?: row.status
        val closable = status?.trim()?.lowercase() == "open" || status?.trim()?.lowercase() == "quoted"
        if (closable && row.id != null) {
            OutlinedButton(
                onClick = onRequestClose,
                enabled = !closing && !detailLoading,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error,
                ),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    if (closing) "Closing…" else "Close RFQ",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

/** One supplier quote row inside the expanded admin card (read-only). */
@Composable
private fun AdminQuoteRowCard(quote: AdminRfqQuoteRow) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    quote.supplierLabel,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Spacer(Modifier.width(8.dp))
                AdminRfqQuoteBadge(quote.statusLabel, quote.status)
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.padding(top = 4.dp),
            ) {
                quote.totalLabel?.let {
                    Text(
                        it,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                quote.priceLabel?.let {
                    Text(
                        it,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                quote.deliveryLabel?.let {
                    Text(
                        it,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            quote.message?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
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

/** Amber banner over saved/stale rows — the AdminUsers banner style. */
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
 * out (AdminUsersScreen's gate pattern).
 */
@Composable
private fun AdminRfqNotAdmin(
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
            "The RFQ review queue lists real buyer quote requests for signed-in admin accounts. Sign in with an admin account to review them here.",
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
 * First launch with no connection and NO saved RFQs: themed empty state with
 * Retry — never a white screen.
 */
@Composable
private fun AdminRfqEmpty(onRetry: () -> Unit) {
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
            "No RFQs saved yet — connect once to save them",
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
