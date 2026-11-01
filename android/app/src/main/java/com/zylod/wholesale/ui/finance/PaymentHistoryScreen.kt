package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Schedule
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.PaymentHistoryRowDto
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed payment-history screen (pageId payment-history — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * [PaymentHistoryViewModel]).
 *
 * Data truth: GET api/payments/history via [PaymentHistoryViewModel] — the
 * status chips send the route's REAL wire values (all/success/pending/
 * failed, exact-match semantics), rows render PO number, amount (BDT via
 * WalletFormat), method, the status chip, the transaction id in mono and
 * the paidAt date. Rows tap into the REAL order-invoice document for that
 * order (GET api/orders/{id}/invoice) — a detail target that exists; no
 * fabricated deep-dive. Honest loading / sign-in / empty / error / offline
 * states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentHistoryScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: PaymentHistoryViewModel = viewModel(key = "native-payment-history-$pageId") {
        PaymentHistoryViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            HistoryTopBar(
                onBack = onBack,
                onPending = { openPage("payment-pending", "") },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                state.needsAuth -> Column(Modifier.verticalScroll(rememberScrollState())) {
                    FinanceAuthGate(
                        title = "Sign in to view your payment history",
                        body = "Payment records are listed from your own orders. Sign in to see the real list.",
                        onSignIn = { openPage("login", "") },
                    )
                }
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> PaymentHistoryContent(
                    state = state,
                    vm = vm,
                    openPage = openPage,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HistoryTopBar(onBack: (() -> Unit)?, onPending: () -> Unit) {
    TopAppBar(
        title = {
            Text(
                "Payment History",
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
            IconButton(onClick = onPending) {
                Icon(Icons.Outlined.Schedule, "Pending clearances", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun PaymentHistoryContent(
    state: PaymentHistoryUiState,
    vm: PaymentHistoryViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "filters") {
            if (state.offline) {
                FinanceOfflineBanner("Offline — showing the last saved payment records")
                Spacer(Modifier.height(10.dp))
            }
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                PAYMENT_HISTORY_FILTERS.forEach { (value, label) ->
                    FilterChipButton(
                        label = label,
                        selected = state.filter == value,
                        onClick = { vm.setFilter(value) },
                    )
                }
            }
        }
        when {
            state.loading -> item(key = "loading") { FinanceSkeleton() }
            state.rows.isEmpty() -> item(key = "empty") {
                FinanceEmptyCard(
                    icon = Icons.Outlined.CreditCard,
                    title = "No payment records found",
                    body = "Payments on your wholesale orders — completed, pending, or failed — show up here.",
                )
            }
            else -> items(state.rows, key = { it.stableKey }) { row ->
                PaymentHistoryRow(
                    row = row,
                    onClick = {
                        val orderId = row.orderId
                        if (!orderId.isNullOrBlank()) {
                            openPage("order-invoice", "orderId=$orderId")
                        }
                    },
                    clickable = !row.orderId.isNullOrBlank(),
                )
            }
        }
    }
}

/** The exact-match status chip row (the route's real wire values). */
@Composable
internal fun FilterChipButton(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick),
    ) {
        Text(
            label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) {
                MaterialTheme.colorScheme.onPrimary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
        )
    }
}

/** One history row — PO number + status chip, method + transaction, amount. */
@Composable
private fun PaymentHistoryRow(row: PaymentHistoryRowDto, onClick: () -> Unit, clickable: Boolean) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(20.dp),
            )
            .then(if (clickable) Modifier.clickable(onClick = onClick) else Modifier),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(40.dp)
                    .background(paymentStatusTint(row.status).copy(alpha = 0.12f), RoundedCornerShape(14.dp)),
            ) {
                Icon(
                    Icons.Outlined.CreditCard,
                    null,
                    tint = paymentStatusTint(row.status),
                    modifier = Modifier.size(18.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "PO #${row.orderNumber.orEmpty()}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.width(8.dp))
                    PaymentStatusChip(row.status)
                }
                Text(
                    "Via ${row.method.orEmpty()} · ${row.transactionId.orEmpty()}",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    formatBdt(row.amount ?: 0.0),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    row.paidAt?.let { formatMoneyDate(it) }.takeUnless { it.isNullOrBlank() } ?: "Pending",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** The wire's payment status as a small uppercase pill (success/pending/…). */
@Composable
internal fun PaymentStatusChip(status: String?) {
    Surface(
        color = paymentStatusTint(status).copy(alpha = 0.12f),
        shape = RoundedCornerShape(50),
    ) {
        Text(
            status?.trim()?.uppercase()?.takeIf(String::isNotEmpty) ?: "UNKNOWN",
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            color = paymentStatusTint(status),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

/**
 * The web's three-way status coloring (success → emerald, pending → amber,
 * everything else → rose) mapped onto the theme roles so it reads in dark
 * mode too.
 */
@Composable
private fun paymentStatusTint(status: String?): Color = when (status?.trim()?.lowercase()) {
    "success" -> Color(0xFF2E7D32)
    "pending" -> Color(0xFFB26A00)
    else -> MaterialTheme.colorScheme.error
}
