package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Smartphone
import androidx.compose.material.icons.outlined.Wallet
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.RefundRowDto
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed refund-to-wallet screen (pageId refund-to-wallet — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * [RefundToWalletViewModel]).
 *
 * The web page mirrored faithfully (Task 140 honesty pass): this is the
 * buyer's REAL processed-refund ledger (GET api/wallet/refund — the rows
 * the platform's admin rail wrote after approved returns), documented with
 * each refund's real UTR / TxnID reference, method and status, under the
 * route's own doctrine banner ("How refunds reach you") and the 4-step
 * "The refund path" explainer. There is NO form — refunds are never
 * self-claimed; that channel is retired server-side. The empty state says
 * exactly where refunds come from and links to the buyer's orders.
 * Honest loading / sign-in / error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RefundToWalletScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: RefundToWalletViewModel = viewModel(key = "native-refund-to-wallet-$pageId") {
        RefundToWalletViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (BankAccountsScreen parity) — a refund the
    // admin processed elsewhere appears the moment the user lands here.
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            RefundsTopBar(
                onBack = onBack,
                onWallet = { openPage("my-wallet", "") },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                // The route is 401-first — the honest sign-in gate.
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in to see your refund records",
                    body = "Refunds are listed from the returns the platform processed for your account. " +
                        "Sign in to see the real list.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> RefundContent(state = state, vm = vm, openPage = openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RefundsTopBar(onBack: (() -> Unit)?, onWallet: () -> Unit) {
    TopAppBar(
        title = {
            Text(
                "Refunds",
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
            IconButton(onClick = onWallet) {
                Icon(
                    Icons.Outlined.Wallet,
                    "Wallet",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun RefundContent(
    state: RefundToWalletUiState,
    vm: RefundToWalletViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved refund ledger")
        }
        // Doctrine banner — what a refund actually is here (web copy).
        RefundDoctrineBanner()
        // The ledger: the platform's real processed refunds.
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .border(
                    1.dp,
                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                    RoundedCornerShape(24.dp),
                ),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "PROCESSED REFUNDS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "Refresh",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(onClick = vm::retry)
                            .padding(4.dp),
                    )
                }
                when {
                    state.loading -> FinanceSkeleton()
                    state.rows.isEmpty() -> RefundEmptyState(openPage = openPage)
                    else -> state.rows.forEach { row ->
                        RefundLedgerRow(row)
                    }
                }
            }
        }
        // "The refund path" explainer (web copy, verbatim steps).
        RefundPathCard()
    }
}

/** The web page's "How refunds reach you" banner (copy mirrored). */
@Composable
private fun RefundDoctrineBanner() {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier.padding(20.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(40.dp)
                    .background(
                        MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.08f),
                        RoundedCornerShape(14.dp),
                    ),
            ) {
                Icon(
                    Icons.Outlined.Wallet,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    "How refunds reach you",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    "When a return is approved, the platform processes your refund through the channel " +
                        "you arranged — bank transfer, mobile banking, or cash. Every completed refund is " +
                        "documented below with its real transaction reference. Refunds are never " +
                        "self-claimed; that is what keeps your money safe.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/** The honest empty state — where refunds come from + the real orders link. */
@Composable
private fun RefundEmptyState(openPage: (pageId: String, query: String) -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(52.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(16.dp)),
        ) {
            Icon(
                Icons.Outlined.ReceiptLong,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(24.dp),
            )
        }
        Text(
            "No refunds processed yet",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            "If something went wrong with an order, request a return from your order history. Once the " +
                "platform approves and processes it, the refund — with its transaction reference — appears here.",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            modifier = Modifier.padding(horizontal = 12.dp),
        )
        OutlinedButton(
            onClick = { openPage("purchase-history", "") },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.height(38.dp),
        ) {
            Text("View my orders", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** One refund row — method icon, amount, label, status, real reference. */
@Composable
private fun RefundLedgerRow(row: RefundRowDto) {
    val emerald = Color(0xFF2E7D32)
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainerLowest,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                RoundedCornerShape(18.dp),
            ),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(36.dp)
                        .background(emerald.copy(alpha = 0.1f), RoundedCornerShape(12.dp)),
                ) {
                    Icon(
                        refundMethodIcon(row.method),
                        null,
                        tint = emerald,
                        modifier = Modifier.size(16.dp),
                    )
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        formatBdt(row.amount ?: 0.0),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        refundMethodLabel(row.method),
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Surface(
                    color = emerald.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Text(
                        row.status?.trim()?.uppercase()?.takeIf(String::isNotEmpty) ?: "UNKNOWN",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = emerald,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    )
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        MaterialTheme.colorScheme.surfaceContainer,
                        RoundedCornerShape(10.dp),
                    )
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            ) {
                Text(
                    "Ref: ${row.reference?.takeIf(String::isNotBlank) ?: "—"}",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    formatMoneyDate(row.createdAt).ifBlank { "—" },
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            row.note?.takeIf(String::isNotBlank)?.let { note ->
                Text(
                    note,
                    fontSize = 11.sp,
                    fontStyle = FontStyle.Italic,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/**
 * The refund method's icon (the web's METHOD_ICONS mapping semantics —
 * bank_transfer → AccountBalance, mobile_banking → Smartphone, cash →
 * AccountBalanceWallet, anything else falls back to the bank icon).
 */
private fun refundMethodIcon(method: String?): ImageVector = when (method?.trim()?.lowercase()) {
    "mobile_banking" -> Icons.Outlined.Smartphone
    "cash" -> Icons.Outlined.AccountBalanceWallet
    else -> Icons.Outlined.AccountBalance
}

/** The web page's "The refund path" ordered list (verbatim steps). */
@Composable
private fun RefundPathCard() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(24.dp),
            ),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "THE REFUND PATH",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            listOf(
                "Request a return from the order in your purchase history.",
                "The platform reviews and approves (or rejects) the request.",
                "Once approved, the refund is processed through your arranged channel — bank transfer, mobile banking, or cash.",
                "The completed transfer is documented here with its real UTR / TxnID reference.",
            ).forEachIndexed { index, step ->
                Row(verticalAlignment = Alignment.Top) {
                    Text(
                        "${index + 1}.",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.width(18.dp),
                    )
                    Text(
                        step,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
