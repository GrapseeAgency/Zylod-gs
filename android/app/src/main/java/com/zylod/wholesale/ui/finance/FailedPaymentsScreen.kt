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
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.FailedPaymentRowDto
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed failed-transactions screen (pageId payment-failed — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * [FailedPaymentsViewModel]).
 *
 * Data truth: GET api/payments/failed via [FailedPaymentsViewModel] — each
 * row's gateway error reason surfaces VERBATIM (the route's stored
 * gatewayResponse or its honest fallback copy). HONESTY: there is no retry
 * endpoint anywhere under api/payments, so this screen does not pretend to
 * retry — it links to the REAL payment-method surface ("Change Method",
 * the web page's own second affordance) and the payment hub, with copy that
 * says where a retry actually happens. Honest loading / sign-in / empty /
 * error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FailedPaymentsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: FailedPaymentsViewModel = viewModel(key = "native-payment-failed-$pageId") {
        FailedPaymentsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { FailedTopBar(onBack = onBack) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in to view failed payments",
                    body = "Failed gateway transactions are listed from your own account's orders. Sign in to see the real list.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> FailedContent(state = state, openPage = openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FailedTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Failed Transactions",
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
private fun FailedContent(state: FailedPaymentsUiState, openPage: (pageId: String, query: String) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved failed transactions")
        }
        when {
            state.loading -> FinanceSkeleton()
            state.rows.isEmpty() -> FinanceEmptyCard(
                icon = Icons.Outlined.Refresh,
                title = "Zero failed payments",
                body = "All wholesale gateway authorizations are operating normally.",
            )
            else -> {
                FailedBanner()
                state.rows.forEach { row ->
                    FailedRow(row = row, openPage = openPage)
                }
            }
        }
    }
}

/** The rose "Payment Authorizations Required" banner (the web page's copy). */
@Composable
private fun FailedBanner() {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.08f),
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(24.dp)),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(20.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(44.dp)
                    .background(error.copy(alpha = 0.16f), RoundedCornerShape(14.dp)),
            ) {
                Icon(Icons.Outlined.Warning, null, tint = error, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    "Payment Authorizations Required",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Transactions that could not be completed by your banking gateway.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** One failed row: PO + method/date + amount + the VERBATIM gateway reason. */
@Composable
private fun FailedRow(row: FailedPaymentRowDto, openPage: (pageId: String, query: String) -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(20.dp)),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(40.dp)
                        .background(error.copy(alpha = 0.12f), RoundedCornerShape(14.dp)),
                ) {
                    Icon(Icons.Outlined.CreditCard, null, tint = error, modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        "PO #${row.orderNumber.orEmpty()}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        "Attempted via ${row.method.orEmpty()} · ${formatMoneyDate(row.date).ifBlank { "—" }}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Text(
                    formatBdt(row.amount ?: 0.0),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    color = error,
                )
            }
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(error.copy(alpha = 0.06f), RoundedCornerShape(14.dp))
                    .padding(12.dp),
            ) {
                Text(
                    "Gateway Error Reason",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = error,
                )
                Text(
                    row.reason.orEmpty(),
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            // HONEST affordances — the web's Retry button only navigates to
            // checkout (no retry endpoint exists), so the native row links
            // to the real surfaces where the fix actually happens.
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = { openPage("payment-method", "") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp),
                ) {
                    Icon(Icons.Outlined.CreditCard, null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Change Method", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = { openPage("payment", "") },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp),
                ) {
                    Icon(Icons.Outlined.ShoppingCart, null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Payment Hub", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
            Text(
                "There is no direct retry call — settle the order's payment from checkout once your method works.",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
