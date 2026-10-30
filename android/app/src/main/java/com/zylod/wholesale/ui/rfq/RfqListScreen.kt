package com.zylod.wholesale.ui.rfq

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
import androidx.compose.material.icons.outlined.RequestQuote
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
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * NATIVE typed buyer RFQ list (pageId "rfq-list" — replaces the generated
 * metadata screen in NativePageRegistry; this file's composable signature is
 * byte-compatible with the generated ui/screens/RfqListScreen.kt).
 *
 * Data truth: GET api/rfq?role=buyer (rows scoped by the signed-in buyer's
 * buyerId) with the REAL status filter (open/quoted/awarded/closed/expired)
 * and page/limit pagination, plus the two buyer actions — PATCH
 * api/rfq/{id}/quotes/{quoteId} ({ action: accept|reject }) and POST
 * api/rfq/{id}/convert-order. Nothing is fabricated for signed-out users:
 * their state renders the honest sign-in gate below. Offline renders the
 * last SAVED page ("zylod_config"/"native_rfq_list_cache") under a banner —
 * never a white screen.
 *
 * Structure mirrors AdminUsersScreen: Scaffold + TopAppBar (back arrow only
 * when [onBack] not null) + one LazyColumn (status chip row, RFQ cards with
 * inline expand-to-detail, load-more), honest loading / needs-auth /
 * offline / empty states, sp+FontWeight type styles, theme colors only (the
 * brand red arrives as MaterialTheme.colorScheme — no hex here; the
 * amber/green badge pairs come from LocalZylodExtra).
 *
 * Smoothness contract: every row has a STABLE fully-prefixed key
 * ("rfq-row-<id>", items "rfq-item-…", quotes "rfq-quote-…"); derived labels
 * (money, deadlines, badges) are precomputed in RfqModels — zero formatting
 * in composition.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RfqListScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: RfqListViewModel = viewModel(key = "native-rfq-list") {
        RfqListViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity: re-pull on EVERY entry — the VM survives on the saved back
    // stack, so quotes that arrived while the buyer was elsewhere appear at
    // once. The silent refresh keeps visible data.
    LaunchedEffect(Unit) { vm.load() }

    // One-shot award/convert feedback → snackbar, then the VM clears it.
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
                        "My RFQs",
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
                // no custom loaders; AdminUsers parity).
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                // Honest gate for signed-out buyers (no token, or a 401 after
                // the shared authenticator's refresh attempt) — no fake rows.
                state.needsAuth -> RfqListAuthGate(
                    openPage = openPage,
                    onRetry = vm::load,
                )
                // First launch offline: nothing fetched AND nothing saved —
                // a themed empty state with Retry, never a white screen.
                state.error != null -> RfqListEmpty(onRetry = vm::retry)
                else -> RfqListContent(state = state, vm = vm)
            }
        }
    }
}

/** Status chips — "" = all, else the handler's exact rfqs.status values. */
private val RFQ_STATUS_FILTERS = listOf(
    "" to "All",
    "open" to "Open",
    "quoted" to "Quoted",
    "awarded" to "Awarded",
    "closed" to "Closed",
    "expired" to "Expired",
)

@Composable
private fun RfqListContent(state: RfqListUiState, vm: RfqListViewModel) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "rfq-filters", contentType = "filter") {
            FilterChipRow(options = RFQ_STATUS_FILTERS, selected = state.statusFilter, onSelect = vm::setStatusFilter)
        }
        when {
            state.offline -> item(key = "rfq-offline-banner", contentType = "banner") {
                OfflineBanner("Connection lost — showing the last loaded RFQs")
            }
            state.offlineFromCache -> item(key = "rfq-cache-banner", contentType = "banner") {
                OfflineBanner("Offline — showing saved RFQs")
            }
        }
        if (state.refreshing) {
            item(key = "rfq-refreshing", contentType = "progress") {
                LinearProgressIndicator(Modifier.fillMaxWidth())
            }
        }
        item(key = "rfq-meta", contentType = "meta") {
            Text(
                "Page ${state.page} of ${state.totalPages} · " +
                    "${state.total} RFQ${if (state.total != 1) "s" else ""}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state.rows.isEmpty()) {
            item(key = "rfq-empty", contentType = "empty") {
                Text(
                    if (state.statusFilter.isNotBlank()) {
                        "No RFQs match the current filter."
                    } else {
                        "No RFQs yet — request a quote from any product page and it lands here."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                state.rows,
                key = { "rfq-row-${it.key}" }, // "rfq-row-rfq-<id>" — fully prefixed
                contentType = { "rfq-card" },
            ) { row ->
                RfqCard(
                    row = row,
                    expanded = state.expandedRfqId != null && state.expandedRfqId == row.id,
                    detail = state.detail?.takeIf { row.id != null && it.id == row.id },
                    detailLoading = state.detailLoading && state.expandedRfqId == row.id,
                    awardInFlightQuoteId = state.awardInFlightQuoteId,
                    converting = state.convertingRfqId != null && state.convertingRfqId == row.id,
                    onToggle = { vm.toggleExpand(row.id) },
                    onAward = vm::awardQuote,
                    onConvert = vm::convertToOrder,
                )
            }
            if (state.page < state.totalPages) {
                item(key = "rfq-load-more", contentType = "load-more") {
                    LoadMoreItem(loading = state.loadingMore, onClick = vm::loadMore)
                }
            }
        }
        item(key = "rfq-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
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
 * One RFQ card: title + status badge + the precomputed quantity/target line,
 * delivery city, deadline and quote count; tapping expands the detail
 * section (description, items, quotes with the accept/reject actions and the
 * convert-to-order CTA). The detail body renders from the VM's cached
 * [RfqDetail] when it matches this row, falling back to the row's own list
 * projection until the fetch lands.
 */
@Composable
private fun RfqCard(
    row: RfqRow,
    expanded: Boolean,
    detail: RfqDetail?,
    detailLoading: Boolean,
    awardInFlightQuoteId: String?,
    converting: Boolean,
    onToggle: () -> Unit,
    onAward: (quoteId: String, accept: Boolean) -> Unit,
    onConvert: (rfqId: String) -> Unit,
) {
    // "accept" while the confirm dialog is up (null = closed).
    var acceptQuoteId by remember(row.key) { mutableStateOf<String?>(null) }
    var convertOpen by remember(row.key) { mutableStateOf(false) }

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
                RfqStatusBadge(row.status)
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
                    row.quoteCountLabel,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    row.createdLabel ?: "",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (row.convertedOrderNumber != null) {
                ConvertedRow(orderNumber = row.convertedOrderNumber)
            }

            if (expanded) {
                RfqDetailSection(
                    row = row,
                    detail = detail,
                    detailLoading = detailLoading,
                    awardInFlightQuoteId = awardInFlightQuoteId,
                    converting = converting,
                    onAward = onAward,
                    onConvert = onConvert,
                )
            }
        }
    }

    // Accept confirmation — the destructive-ish commitment (reject fires
    // straight from its button; only Accept needs the explicit confirm).
    acceptQuoteId?.let { quoteId ->
        AlertDialog(
            onDismissRequest = { acceptQuoteId = null },
            title = {
                Text("Accept this quote?", fontSize = 16.sp, fontWeight = FontWeight.Black)
            },
            text = {
                Text(
                    "Accepting awards the RFQ to this supplier — the other pending quotes stay pending and the RFQ can then be converted into an order.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    acceptQuoteId = null
                    onAward(quoteId, true)
                }) {
                    Text(
                        "Accept",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { acceptQuoteId = null }) {
                    Text("Cancel", fontSize = 13.sp)
                }
            },
        )
    }

    // Convert-to-order confirmation — creates a REAL order from the accepted
    // quote, so it gets the same explicit confirm as Accept.
    if (convertOpen) {
        AlertDialog(
            onDismissRequest = { convertOpen = false },
            title = {
                Text("Convert to order?", fontSize = 16.sp, fontWeight = FontWeight.Black)
            },
            text = {
                Text(
                    "This creates a real order from the accepted quote using your default shipping address.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    convertOpen = false
                    row.id?.let(onConvert)
                }) {
                    Text(
                        "Convert",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { convertOpen = false }) {
                    Text("Cancel", fontSize = 13.sp)
                }
            },
        )
    }
}

/** Status badge: open=brand, quoted=amber, awarded=green, closed/expired=neutral. */
@Composable
private fun RfqStatusBadge(status: String?) {
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
private fun RfqQuoteStatusBadge(statusLabel: String, status: String?) {
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
 * The expanded card body: description, line items, quotes (detail projection
 * when loaded, the row's raw ≤5 quotes as the fallback), per-quote
 * accept/reject actions on pending rows and the convert-to-order CTA.
 */
@Composable
private fun RfqDetailSection(
    row: RfqRow,
    detail: RfqDetail?,
    detailLoading: Boolean,
    awardInFlightQuoteId: String?,
    converting: Boolean,
    onAward: (quoteId: String, accept: Boolean) -> Unit,
    onConvert: (rfqId: String) -> Unit,
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
        // Description — from the detail when present, else the row's own copy.
        val description = detail?.description ?: row.description
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
        detail?.buyerName?.let {
            Text(
                it,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // Items — the detail's real line items (the list projection embeds
        // them too, but only the detail section renders them richly).
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

        // Quotes — detail projection when loaded, else the row's embedded ≤5.
        val quotes = detail?.quotes ?: row.quotes
        Text(
            "Quotes",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
        )
        if (quotes.isEmpty()) {
            Text(
                "No quotes yet — suppliers are reviewing this request.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            quotes.forEach { quote ->
                QuoteRowCard(
                    quote = quote,
                    awardInFlight = quote.id != null && awardInFlightQuoteId == quote.id,
                    onAccept = { quote.id?.let { qid -> onAward(qid, true) } },
                    onReject = { quote.id?.let { qid -> onAward(qid, false) } },
                )
            }
        }

        // Convert CTA: awarded AND nothing converted yet (the detail is the
        // authority when loaded; the row's own markers otherwise).
        val converted = detail?.convertedOrderNumber ?: row.convertedOrderNumber
        val convertible = detail?.convertible ?: row.convertible
        if (converted != null) {
            ConvertedRow(orderNumber = converted)
        } else if (convertible && row.id != null) {
            OutlinedButton(
                onClick = { onConvert(row.id) },
                enabled = !converting,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.primary,
                ),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    if (converting) "Creating order…" else "Convert to Order",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

/** One supplier quote row inside the expanded card. */
@Composable
private fun QuoteRowCard(
    quote: RfqQuoteRow,
    awardInFlight: Boolean,
    onAccept: () -> Unit,
    onReject: () -> Unit,
) {
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
                RfqQuoteStatusBadge(quote.statusLabel, quote.status)
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
            if (awardInFlight) {
                LinearProgressIndicator(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                )
            }
            if (quote.pending && quote.id != null && !awardInFlight) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 6.dp),
                ) {
                    Button(
                        onClick = onAccept,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary,
                        ),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                        modifier = Modifier.height(32.dp),
                    ) {
                        Text("Accept", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(
                        onClick = onReject,
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        ),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                        modifier = Modifier.height(32.dp),
                    ) {
                        Text("Reject", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/** "Converted to order <number>" — the green confirmation row. */
@Composable
private fun ConvertedRow(orderNumber: String) {
    val success = LocalZylodExtra.current.success
    Surface(
        color = success.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, success.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp),
    ) {
        Text(
            "Converted to order $orderNumber",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
        )
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
 * Honest gate for signed-out buyers: no token (or a 401 after the shared
 * authenticator's refresh attempt). No fabricated rows — an explanation
 * plus the way out (the OrdersScreen gate pattern with buyer copy).
 */
@Composable
private fun RfqListAuthGate(
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
            "Sign in to see your RFQs",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Your quote requests, supplier quotes and awarded orders appear here once you sign in as a buyer.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("login", "") },
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Sign In", fontSize = 13.sp, fontWeight = FontWeight.Bold)
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
private fun RfqListEmpty(onRetry: () -> Unit) {
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
                Icons.Outlined.RequestQuote,
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
