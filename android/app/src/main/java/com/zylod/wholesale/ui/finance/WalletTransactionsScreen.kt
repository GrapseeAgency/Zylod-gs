package com.zylod.wholesale.ui.finance

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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.History
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
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
import com.zylod.wholesale.data.api.WalletTransactionDto
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import com.zylod.wholesale.ui.wallet.formatRelativeDate
import com.zylod.wholesale.ui.wallet.formatSignedBdt
import com.zylod.wholesale.ui.wallet.walletTxIsCredit

/**
 * SHARED typed transaction-history screen (pageId transaction-history —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * WalletTransactionsViewModel).
 *
 * Data truth: GET api/wallet/transactions through the EXISTING WalletApi
 * via [WalletTransactionsViewModel] — the REAL paged history. The type
 * chips send the route's exact wire values (all/deposit/withdrawal/
 * payment/refund/cashback — there is no credit/debit wire value, that is
 * a client-side derivation), rows show the signed+formatted amount (the
 * ui/wallet formatters, imported not copied), the type badge and the real
 * date, and a tap opens the transaction-detail page with the id in the
 * query (the TrackOrder query convention). Load-more fires near the list
 * end (snapshotFlow, WalletScreen parity); honest loading / sign-in /
 * offline / empty / error states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletTransactionsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: WalletTransactionsViewModel = viewModel(key = "native-wallet-tx-$pageId") {
        WalletTransactionsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (WalletScreen parity) — a topup or refund made
    // anywhere else in the app shows up the moment the user lands back.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { HistoryTopBar(onBack = onBack) },
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
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in to view your transactions",
                    body = "Your wallet history is tied to your account. Sign in to view it.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                    ) {
                        Spacer(Modifier.height(24.dp))
                        FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                    }
                }
                else -> HistoryContent(
                    state = state,
                    onLoadMore = vm::loadMore,
                    onFilter = vm::setFilter,
                    onOpenDetail = { id -> openPage("transaction-detail", "id=$id") },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HistoryTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Transaction History",
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
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/**
 * Auto-append distance: page N+1 is requested while the last row is within
 * ~400px of the viewport end (WalletScreen/DealsScreen parity).
 */
private const val LOAD_MORE_THRESHOLD_PX = 400

@Composable
private fun HistoryContent(
    state: WalletTransactionsUiState,
    onLoadMore: () -> Unit,
    onFilter: (String) -> Unit,
    onOpenDetail: (String) -> Unit,
) {
    val listState = rememberLazyListState()

    // Robust infinite scroll: ONE snapshotFlow over the lazy list layout —
    // identical contract to WalletScreen. The lambda allocates nothing.
    LaunchedEffect(listState) {
        snapshotFlow {
            val info = listState.layoutInfo
            val last = info.visibleItemsInfo.lastOrNull()
            when {
                last == null -> Int.MAX_VALUE
                last.index < info.totalItemsCount - 1 -> Int.MAX_VALUE
                else -> info.viewportEndOffset - (last.offset + last.size)
            }
        }.collect { pxBelowLastItem ->
            if (pxBelowLastItem <= LOAD_MORE_THRESHOLD_PX) onLoadMore()
        }
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") {
                FinanceOfflineBanner("You're offline — showing your last saved history")
            }
        }
        item(key = "filter-chips", contentType = "chips") {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.History,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "Transactions",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        if (state.txTotal == 1) "1 entry" else "${state.txTotal} entries",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.height(10.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    WALLET_TX_FILTERS.forEach { (value, label) ->
                        FilterChip(
                            selected = state.filter == value,
                            onClick = { onFilter(value) },
                            label = { Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                            ),
                        )
                    }
                }
            }
        }
        if (state.transactions.isEmpty()) {
            item(key = "tx-empty", contentType = "empty") {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceContainer,
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .size(64.dp)
                                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
                        ) {
                            Icon(
                                Icons.Outlined.History,
                                null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(30.dp),
                            )
                        }
                        Text(
                            "No transactions match this filter yet.",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 10.dp),
                        )
                    }
                }
            }
        } else {
            items(
                state.transactions,
                // Transaction id — stable across appends and unique per row
                // (VM-side dedup guards server-side reshuffles).
                key = { "tx-${it.stableKey}" },
                contentType = { "tx" },
            ) { tx ->
                HistoryRow(tx = tx, onOpen = onOpenDetail)
            }
        }
        if (state.loadingMore) {
            item(key = "footer-loading", contentType = "footer") {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 10.dp),
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                }
            }
        }
        if (!state.canLoadMore && !state.loadingMore && state.transactions.isNotEmpty()) {
            item(key = "footer-end", contentType = "footer") {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "You've reached the end of your wallet history",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * One transaction row — direction arrow (credit lands in the success color
 * from the theme extras, debit stays neutral), the signed+formatted amount
 * (ui/wallet formatters — imported, not copied), the type badge and the
 * real date. Tap opens the detail page with the REAL id in the query —
 * rows the wire sent without an id are honestly not navigable.
 */
@Composable
private fun HistoryRow(tx: WalletTransactionDto, onOpen: (String) -> Unit) {
    val credit = remember(tx) { walletTxIsCredit(tx.type) }
    val amountLabel = remember(tx) { formatSignedBdt(tx.type, tx.amount ?: 0.0) }
    val dateLabel = remember(tx) { formatRelativeDate(tx.createdAt) }
    val typeLabel = remember(tx) { tx.type.orEmpty().uppercase().ifBlank { "TRANSACTION" } }
    val realId = remember(tx) { tx.id?.takeIf(String::isNotBlank) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = realId != null, onClick = { realId?.let(onOpen) }),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(12.dp),
        ) {
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.surfaceVariant,
            ) {
                Text(
                    typeLabel,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    tx.description.orEmpty().ifBlank { "Wallet Transaction" },
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    lineHeight = 17.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    dateLabel,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(
                amountLabel,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = if (credit) LocalZylodExtra.current.success else MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}
