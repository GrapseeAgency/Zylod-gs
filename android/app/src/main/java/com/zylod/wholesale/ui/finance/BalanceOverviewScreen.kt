package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.TrendingDown
import androidx.compose.material.icons.automirrored.outlined.TrendingUp
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Savings
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.WalletBalanceDto
import com.zylod.wholesale.ui.wallet.formatBdt
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * Native Balance Overview screen (t302) — the web's balance-overview page,
 * behavior-exact: the server's own GET api/wallet/breakdown aggregate
 * rendered as the big "Balance Breakdown" card (available liquid) plus the
 * escrow/inflow/outflow cards and the full cash-flow ledger list
 * (deposits, withdrawals, payments, refunds, cashback). Guests get the web
 * page's AccountGate as a soft sign-in CTA; offline renders the saved
 * breakdown under the warning banner; first launch with neither: the
 * honest Retry state — never a fabricated ৳0.
 *
 * Visual language: Scaffold + TopAppBar ("Balance Breakdown"), the
 * brand-tinted hero card, 16dp surfaces on surfaceContainer with the 0.5
 * alpha outline border, M3-only loading (the ONE center spinner).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BalanceOverviewScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: BalanceOverviewViewModel = viewModel { BalanceOverviewViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — a topup or withdrawal made
    // anywhere else in the app shows up the moment the user lands back.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Balance Breakdown",
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
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                // Guests: the web page's AccountGate, soft CTA form.
                state.needsAuth -> BalanceAuthRequired(onSignIn = { openPage("login", "") })
                state.error != null -> BalanceErrorState(message = state.error!!, onRetry = vm::retry)
                state.balance != null -> BalanceContent(
                    balance = state.balance!!,
                    offline = state.offline,
                    onOpenWallet = { openPage("my-wallet", "") },
                )
            }
        }
    }
}

@Composable
private fun BalanceContent(
    balance: WalletBalanceDto,
    offline: Boolean,
    onOpenWallet: () -> Unit,
) {
    val ledger = remember(balance) { ledgerRows(balance) }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (offline) {
            item(key = "offline-banner", contentType = "banner") { BalanceOfflineBanner() }
        }
        item(key = "hero", contentType = "hero") {
            BalanceHeroCard(balance = balance, onOpenWallet = onOpenWallet)
        }
        item(key = "flow-cards", contentType = "row") {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                BalanceStatCard(
                    icon = Icons.AutoMirrored.Outlined.TrendingUp,
                    label = "Total Inflow",
                    value = formatBdt(balance.totalInflow ?: 0.0),
                    modifier = Modifier.weight(1f),
                )
                BalanceStatCard(
                    icon = Icons.AutoMirrored.Outlined.TrendingDown,
                    label = "Total Outflow",
                    value = formatBdt(balance.totalOutflow ?: 0.0),
                    modifier = Modifier.weight(1f),
                )
            }
        }
        item(key = "escrow-card", contentType = "stat") {
            BalanceStatCard(
                icon = Icons.Outlined.Savings,
                label = "Held in Escrow",
                value = formatBdt(balance.heldInEscrow ?: 0.0),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item(key = "ledger-header", contentType = "header") {
            Text(
                "Cash-flow ledger",
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
        items(count = ledger.size, key = { ledger[it].first }, contentType = { "ledger-row" }) { index ->
            val (label, value) = ledger[index]
            LedgerRow(label = label, value = value)
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** The web page's ledger list, straight off the same wire fields. */
private fun ledgerRows(balance: WalletBalanceDto): List<Pair<String, Double?>> = listOf(
    "Total deposits" to balance.totalDeposits,
    "Total withdrawals" to balance.totalWithdrawals,
    "Total payments" to balance.totalPayments,
    "Total refunds" to balance.totalRefunds,
    "Total cashback" to balance.totalCashback,
    "Escrow released" to balance.releasedEscrow,
)

@Composable
private fun BalanceHeroCard(balance: WalletBalanceDto, onOpenWallet: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.primary,
        contentColor = MaterialTheme.colorScheme.onPrimary,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.AccountBalanceWallet,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "Available Liquid",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f),
                )
            }
            Text(
                remember(balance) { formatBdt(balance.availableBalance ?: 0.0) },
                fontSize = 34.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.padding(top = 4.dp),
            )
            Button(
                onClick = onOpenWallet,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.onPrimary,
                    contentColor = MaterialTheme.colorScheme.primary,
                ),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .height(38.dp),
            ) {
                Text("Open Wallet", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun BalanceStatCard(
    icon: ImageVector,
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = modifier,
    ) {
        Column(Modifier.padding(14.dp)) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(32.dp)
                    .background(
                        LocalZylodExtra.current.success.copy(alpha = 0.12f),
                        RoundedCornerShape(10.dp),
                    ),
            ) {
                Icon(icon, null, tint = LocalZylodExtra.current.success, modifier = Modifier.size(16.dp))
            }
            Text(
                label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                value,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun LedgerRow(label: String, value: Double?) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Text(
                label,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            Text(
                value?.let { formatBdt(it) } ?: "—",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/** Offline banner over the SAVED breakdown — theme warning pair. */
@Composable
private fun BalanceOfflineBanner() {
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
                "You're offline — showing your last saved balance",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/** First launch with no connection and NO saved breakdown — never white. */
@Composable
private fun BalanceErrorState(message: String, onRetry: () -> Unit) {
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
            Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Signed out: the web page's AccountGate, soft-CTA form. */
@Composable
private fun BalanceAuthRequired(onSignIn: () -> Unit) {
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
            "Your balance and cash-flow figures come from your real wallet record",
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 6.dp),
        )
        Button(
            onClick = onSignIn,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 16.dp)
                .height(40.dp),
        ) {
            Text("Sign in", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}
