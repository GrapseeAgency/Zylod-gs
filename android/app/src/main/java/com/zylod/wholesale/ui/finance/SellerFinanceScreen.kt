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
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.CommissionItemDto
import com.zylod.wholesale.data.api.SellerEarningsDto
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed seller-finance screen (pageId finance — the ui/screens
 * delegate calls THIS, so the page keeps its own [SellerFinanceViewModel]).
 *
 * Data truth: GET api/finance/earnings + GET api/finance/commissions (the
 * SAME two endpoints composed, in the same order, as the money domain's
 * seller surface). SUPPLIER-ONLY: on the earnings route's 403 role denial
 * the screen renders the honest gate — "Supplier account required" with
 * the route's verbatim text, a supplier-dashboard link and sign-in — and
 * NEVER a zero-shaped revenue card. On success: the earnings cards (gross
 * GMV, platform commission, net earnings, available payout, on-hold
 * payouts, escrow held, paid-out ledger) and the commissions table (order
 * rows with rate / net / status chips) + its totals.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SellerFinanceScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SellerFinanceViewModel = viewModel(key = "native-seller-finance-$pageId") {
        SellerFinanceViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { SellerFinanceTopBar(onBack = onBack) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in to view your earnings",
                    body = "Seller earnings and the commission ledger are tied to your account. Sign in to continue.",
                    onSignIn = { openPage("login", "") },
                )
                // The honest 403 role gate — the route denied a buyer session;
                // a zero-shaped revenue card must never render here.
                state.supplierGateMessage != null -> SupplierGateCard(
                    message = state.supplierGateMessage.orEmpty(),
                    onSupplierDashboard = { openPage("supplier-dashboard", "") },
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> SellerFinanceContent(state = state, vm = vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SellerFinanceTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Seller Finance",
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

/** The 403 role gate — honest copy + real links, no fabricated revenue. */
@Composable
private fun SupplierGateCard(message: String, onSupplierDashboard: () -> Unit, onSignIn: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 48.dp),
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
            "Supplier account required",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            message,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.error,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            "Earnings and commissions are supplier-scoped money data — the server answers 403 for a " +
                "buyer session, so no revenue figures are shown here.",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = onSupplierDashboard,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Icon(Icons.Outlined.Storefront, null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text("Open Supplier Dashboard", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        TextButton(onClick = onSignIn) {
            Text("Sign in with a supplier account", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun SellerFinanceContent(state: SellerFinanceUiState, vm: SellerFinanceViewModel) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved finance payloads")
        }
        if (state.loading) {
            FinanceSkeleton()
            return@Column
        }
        state.earnings?.let { earnings ->
            EarningsCards(earnings)
        }
        when {
            state.commissionsError != null -> {
                val errorMessage = state.commissionsError
                FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retryCommissions)
            }
            state.commissions != null -> CommissionTable(state.commissions)
        }
    }
}

/** The earnings cards — every number from the supplier-scoped payload. */
@Composable
private fun EarningsCards(earnings: SellerEarningsDto) {
    val gmv = earnings.grossGMV ?: 0.0
    val commission = earnings.platformCommission ?: 0.0
    val net = earnings.netEarnings ?: 0.0
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        EarningsHero(
            label = "Net Earnings",
            value = formatBdt(net),
            footnote = "Gross GMV ${formatBdt(gmv)} minus the platform commission " +
                "(${earnings.commissionRate.orEmpty()})",
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            EarningsTile("Gross GMV", formatBdt(gmv), Modifier.weight(1f))
            EarningsTile(
                "Platform Commission",
                formatBdt(commission),
                Modifier.weight(1f),
                footnote = earnings.commissionRate.orEmpty(),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            EarningsTile("Available Payout", formatBdt(earnings.availablePayout ?: 0.0), Modifier.weight(1f))
            EarningsTile("On-Hold Payouts", formatBdt(earnings.onHoldForPayouts ?: 0.0), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            EarningsTile("Escrow Held", formatBdt(earnings.pendingEscrow ?: 0.0), Modifier.weight(1f))
            EarningsTile(
                "Total Paid Out",
                formatBdt(earnings.totalPaidOut ?: 0.0),
                Modifier.weight(1f),
                footnote = "${earnings.totalOrders} sub-orders",
            )
        }
    }
}

@Composable
private fun EarningsHero(label: String, value: String, footnote: String) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Text(
                value,
                fontSize = 30.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Text(
                footnote,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
            )
        }
    }
}

@Composable
private fun EarningsTile(label: String, value: String, modifier: Modifier = Modifier, footnote: String = "") {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = modifier,
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                value,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurface,
            )
            if (footnote.isNotBlank()) {
                Text(
                    footnote,
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** The commissions table: totals header + per-subOrder rows with chips. */
@Composable
private fun CommissionTable(book: com.zylod.wholesale.data.api.CommissionBookDto) {
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
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Commission Ledger",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "Total gross ${formatBdt(book.totalGross ?: 0.0)} · Total commissions " +
                        formatBdt(book.totalCommissions ?: 0.0),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (book.items.isEmpty()) {
                Text(
                    "No commission rows recorded for your supplier profile yet.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                book.items.forEach { item ->
                    CommissionRow(item)
                }
            }
        }
    }
}

@Composable
private fun CommissionRow(item: CommissionItemDto) {
    val settled = item.status?.trim()?.lowercase() == "settled"
    Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "PO #${item.orderNumber.orEmpty()} · ${item.subOrderNumber.orEmpty()}",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            Surface(
                color = if (settled) {
                    MaterialTheme.colorScheme.primaryContainer
                } else {
                    MaterialTheme.colorScheme.secondaryContainer
                },
                shape = RoundedCornerShape(50),
            ) {
                Text(
                    item.status?.trim()?.uppercase()?.takeIf(String::isNotEmpty) ?: "—",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    color = if (settled) {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSecondaryContainer
                    },
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
        }
        Row(horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                "Gross ${formatBdt(item.grossAmount ?: 0.0)} · Rate ${item.ratePercent.orEmpty()} · " +
                    "Commission ${formatBdt(item.commissionAmount ?: 0.0)}",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            Text(
                "Net ${formatBdt(item.netPayout ?: 0.0)}",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        Text(
            formatMoneyDate(item.date).ifBlank { "—" },
            fontSize = 9.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
