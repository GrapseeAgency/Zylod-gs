package com.zylod.wholesale.ui.wallet

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.WalletBalanceDto
import com.zylod.wholesale.data.api.WalletTransactionDto
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * NATIVE Wallet (pageId "wallet", RouteOwnership buyer-money surface).
 * Real data only, from GET /api/wallet/balance + GET /api/wallet/transactions:
 * balance overview card (brand-red amount), quick actions into the
 * add-money / withdraw-money / bank-accounts native pages, and the paged
 * transaction history — honest loading / sign-in / offline / empty states,
 * sp+FontWeight type styles, theme colors only (no hex outside ui/theme).
 *
 * Structure mirrors DealsScreen: Scaffold + TopAppBar + one keyed LazyColumn
 * with the same snapshotFlow auto-append contract (~400px threshold, zero
 * allocations in composition), stable row keys (transaction id).
 *
 * Signature parity: byte-compatible with the generated
 * ui/screens/WalletScreen.kt composable so the integrator can swap the
 * NativePageRegistry "wallet" row to this screen unchanged. `query` is
 * accepted for that contract; the wallet page has no deep-link parameters.
 *
 * BACK CONTRACT: installs NO BackHandler — like Deals/Orders, onBack == null
 * renders as a tab-like destination and system Back pops the NavHost entry.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: WalletViewModel = viewModel { WalletViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Orders/Cart/Deals: re-pull on EVERY entry — a topup or
    // withdrawal made anywhere else in the app shows up the moment the user
    // lands back here. The VM's silent refresh keeps visible data mounted.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Wallet",
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
                // no custom loaders; OrdersScreen parity).
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                // Signed out: money is per-user — a soft sign-in CTA, never a
                // hard redirect (RouteOwnership guest policy, CartScreen
                // precedent).
                state.needsAuth -> WalletAuthRequired(onSignIn = { openPage("login", "") })
                // First launch offline: nothing fetched AND nothing saved —
                // a themed empty state with Retry, never a white screen.
                state.error != null -> WalletOfflineEmpty(onRetry = vm::retry)
                else -> WalletContent(state = state, onLoadMore = vm::loadMore, openPage = openPage)
            }
        }
    }
}

/**
 * Auto-append distance: page N+1 is requested while the last row is within
 * ~400px of the viewport end (raw px, per the owner brief) — DealsScreen
 * parity.
 */
private const val LOAD_MORE_THRESHOLD_PX = 400

@Composable
private fun WalletContent(
    state: WalletUiState,
    onLoadMore: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val listState = rememberLazyListState()

    // Robust infinite scroll: ONE snapshotFlow over the lazy list layout —
    // identical contract to DealsScreen. The lambda allocates nothing
    // (primitives only); it runs inside the flow, never during composition.
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
            item(key = "offline-banner", contentType = "banner") { OfflineBanner() }
        }
        item(key = "balance-card", contentType = "balance") {
            BalanceCard(state.balance)
        }
        item(key = "quick-actions", contentType = "actions") {
            QuickActions(openPage)
        }
        transactionsSection(state)
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

/** History section: themed header + keyed rows (or an honest empty line). */
private fun LazyListScope.transactionsSection(state: WalletUiState) {
    item(key = "tx-header", contentType = "header") {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 6.dp),
        ) {
            Icon(Icons.Outlined.History, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
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
    }
    if (state.transactions.isEmpty()) {
        item(key = "tx-empty", contentType = "empty") {
            Text(
                "No transactions yet — money you add, spend or get refunded shows up here.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    } else {
        items(
            state.transactions,
            // Transaction id — stable across appends and unique per row
            // (VM-side dedup guards server-side reshuffles).
            key = { "tx-${it.stableKey}" },
            contentType = { "tx" },
        ) { tx ->
            TransactionRow(tx)
        }
    }
}

/**
 * Balance overview card — the big amount is the brand red via
 * MaterialTheme.colorScheme.primary (#C8102E), never a hardcoded hex here.
 */
@Composable
private fun BalanceCard(balance: WalletBalanceDto?) {
    // remember{} for derived values — no per-recomposition reformatting.
    val availableLabel = remember(balance) { formatBdt(balance?.availableBalance ?: 0.0) }
    val escrowLabel = remember(balance) { formatBdt(balance?.heldInEscrow ?: 0.0) }
    val inflowLabel = remember(balance) { formatBdt(balance?.totalInflow ?: 0.0) }
    val outflowLabel = remember(balance) { formatBdt(balance?.totalOutflow ?: 0.0) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                "AVAILABLE BALANCE",
                fontSize = 10.sp,
                letterSpacing = 0.8.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                availableLabel,
                fontSize = 30.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 4.dp),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 14.dp),
            ) {
                BalanceStat("In Escrow", escrowLabel, Modifier.weight(1f))
                BalanceStat("Total Inflow", inflowLabel, Modifier.weight(1f))
                BalanceStat("Total Outflow", outflowLabel, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun BalanceStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(
            label.uppercase(),
            fontSize = 9.sp,
            letterSpacing = 0.6.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            value,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

/**
 * Quick actions row — Add Money / Withdraw / Bank Accounts route into the
 * existing native pages (verified NativePageRegistry pageIds).
 */
@Composable
private fun QuickActions(openPage: (pageId: String, query: String) -> Unit) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        QuickAction("Add Money", Icons.Outlined.Add, Modifier.weight(1f)) {
            openPage("add-money", "")
        }
        QuickAction("Withdraw", Icons.Outlined.ArrowUpward, Modifier.weight(1f)) {
            openPage("withdraw-money", "")
        }
        QuickAction("Bank Accounts", Icons.Outlined.AccountBalance, Modifier.weight(1f)) {
            openPage("bank-accounts", "")
        }
    }
}

@Composable
private fun QuickAction(
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = modifier,
    ) {
        Column(
            // OrdersScreen card contract: the whole tile is the tap target.
            Modifier
                .clickable(onClick = onClick)
                .padding(horizontal = 8.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.primaryContainer,
            ) {
                Icon(
                    icon,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier
                        .padding(8.dp)
                        .size(18.dp),
                )
            }
            Text(
                label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}

/**
 * One transaction row — direction arrow (credit lands in the success color
 * from the theme extras, debit stays neutral), signed amount, balance after.
 */
@Composable
private fun TransactionRow(tx: WalletTransactionDto) {
    val credit = remember(tx) { walletTxIsCredit(tx.type) }
    val amountLabel = remember(tx) { formatSignedBdt(tx.type, tx.amount ?: 0.0) }
    val dateLabel = remember(tx) { formatRelativeDate(tx.createdAt) }
    val balanceLine = remember(tx) { tx.balanceAfter?.let { formatBdt(it) + " balance" } }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(12.dp),
        ) {
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.surfaceVariant,
            ) {
                Icon(
                    if (credit) Icons.Outlined.ArrowDownward else Icons.Outlined.ArrowUpward,
                    null,
                    tint = if (credit) LocalZylodExtra.current.success else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .padding(8.dp)
                        .size(16.dp),
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
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    amountLabel,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = if (credit) LocalZylodExtra.current.success else MaterialTheme.colorScheme.onSurface,
                )
                balanceLine?.let {
                    Text(
                        it,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
    }
}

/** Offline banner over SAVED wallet data — theme warning pair, DealsScreen banner style. */
@Composable
private fun OfflineBanner() {
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
            Text(
                "You're offline — showing your last saved wallet",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/**
 * First launch with no connection and NO saved wallet: themed empty state
 * with Retry — never a white screen.
 */
@Composable
private fun WalletOfflineEmpty(onRetry: () -> Unit) {
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
            "No wallet data saved yet — connect once to save it",
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

/**
 * Signed out: the wallet belongs to the account — soft sign-in CTA (the
 * login pageId is the RouteOwnership guest-policy path, no hard redirect).
 */
@Composable
private fun WalletAuthRequired(onSignIn: () -> Unit) {
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
            "Sign in to view your wallet",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Your balance, escrow and transaction history live with your account",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onSignIn,
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
    }
}
