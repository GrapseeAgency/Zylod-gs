package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.wallet.formatBdt
import com.zylod.wholesale.ui.wallet.formatRelativeDate
import com.zylod.wholesale.ui.wallet.formatSignedBdt
import com.zylod.wholesale.ui.wallet.walletTxIsCredit
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed transaction-detail screen (pageId transaction-detail — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * TransactionDetailViewModel).
 *
 * Data truth: GET api/wallet/transactions/{id} through the EXISTING
 * WalletApi via [TransactionDetailViewModel] — the REAL server-verified
 * transaction. Honest rows only: the signed+formatted amount (the
 * ui/wallet formatters, imported not copied), the type badge, status,
 * reference number, payment method, fee, balance after, and the real
 * created date. The "No transaction selected" state, sign-in gate,
 * "Transaction not found" card and error card are all honest — nothing
 * fabricated. Offline renders the per-id saved snapshot under a banner.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionDetailScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: TransactionDetailViewModel = viewModel(key = "native-tx-detail-$pageId") {
        TransactionDetailViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (TrackOrderScreen parity) — a fresh query
    // re-pins the new transaction.
    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { DetailTopBar(onBack = onBack) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in to view your transactions",
                    body = "Your wallet history is tied to your account. Sign in to view it.",
                    onSignIn = { openPage("login", "") },
                )
                !state.hasId -> NoTransactionState(openPage = openPage)
                state.notFound -> TransactionNotFoundCard(onRetry = vm::retry)
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                state.loading -> FinanceSkeleton()
                else -> state.detail?.let { detail ->
                    DetailContent(detail = detail, offlineFromCache = state.offlineFromCache)
                } ?: Unit
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Transaction Detail",
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

@Composable
private fun DetailContent(detail: com.zylod.wholesale.data.api.WalletTransactionDetailDto, offlineFromCache: Boolean) {
    val credit = remember(detail) { walletTxIsCredit(detail.type, detail.amount) }
    val amountLabel = remember(detail) { formatSignedBdt(detail.type, detail.amount ?: 0.0) }
    val createdLabel = remember(detail) { formatRelativeDate(detail.createdAt) }
    val balanceLabel = remember(detail) { detail.balanceAfter?.let { formatBdt(it) } }

    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved details")
        }

        // Amount header: direction arrow + the signed+formatted amount.
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
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
                            .padding(10.dp)
                            .size(20.dp),
                    )
                }
                Text(
                    amountLabel,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Black,
                    color = if (credit) LocalZylodExtra.current.success else MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 10.dp),
                )
                val description = detail.description?.takeIf(String::isNotBlank)
                if (description != null) {
                    Text(
                        description,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                val type = detail.type?.takeIf(String::isNotBlank)
                if (type != null) {
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        Text(
                            type.uppercase(),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
                }
            }
        }

        // Honest detail rows — only fields the wire actually has.
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                val status = detail.status?.takeIf(String::isNotBlank)
                if (status != null) {
                    DetailRow("Status", status)
                }
                val reference = detail.referenceNumber?.takeIf(String::isNotBlank)
                if (reference != null) {
                    DetailRow("Reference", reference)
                }
                val method = detail.paymentMethod?.takeIf(String::isNotBlank)
                if (method != null) {
                    DetailRow("Payment Method", method)
                }
                val fee = detail.fee
                if (fee != null) {
                    DetailRow("Fee", formatBdt(fee))
                }
                if (balanceLabel != null) {
                    DetailRow("Balance After", balanceLabel)
                }
                if (createdLabel.isNotBlank()) {
                    DetailRow("Created", createdLabel)
                }
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(130.dp),
        )
        Text(
            value,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

/** Web parity: no transaction id in the entry query. */
@Composable
private fun NoTransactionState(openPage: (pageId: String, query: String) -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 64.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.ReceiptLong,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "No transaction selected",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Open a transaction from your wallet history to see its details here.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = { openPage("transaction-history", "") },
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("View History", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Definitive HTTP 404 — the honest "Transaction not found" card. */
@Composable
private fun TransactionNotFoundCard(onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    "Transaction not found.",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = error,
                )
            }
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .height(36.dp),
            ) {
                Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
