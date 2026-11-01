package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.PayoutRowDto
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed withdraw screen (pageId-keyed for BOTH "withdraw" AND
 * "withdraw-money" — the two ui/screens delegates call THIS, each page
 * keeps its own [WithdrawViewModel]).
 *
 * Data truth: GET api/wallet/withdraw via [WithdrawViewModel] — the Task
 * 107 supplier payout rail's honest three-way split (balance / onHold /
 * available) + the payout queue with status chips, destinations, transfer
 * references and dates. Buyer session → the route's 403 renders the honest
 * supplier gate (SellerFinanceScreen pattern) — NEVER a zero-shaped balance
 * card. The "Request Withdrawal" expandable form posts the withdrawSchema
 * field set: amount ≥ ৳50 and ≤ the REAL available, method chips
 * (bank/bKash/Nagad/Upay/Rocket), account number, holder name, bank name
 * (when bank). Success 201 shows the route's verbatim message + payoutId +
 * availableAfter INLINE — a pending row, the wallet untouched until an
 * admin completes it. Honest loading / sign-in / 403 / 400 / 404 / empty /
 * offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WithdrawScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: WithdrawViewModel = viewModel(key = "native-withdraw-$pageId") {
        WithdrawViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (BankAccountsScreen parity) — a payout the
    // admin completed elsewhere shows the moment the user lands back here.
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            MoneyTopBar(
                title = if (pageId == "withdraw-money") "Withdraw Money" else "Withdraw",
                onBack = onBack,
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
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in to view your payouts",
                    body = "Withdrawal requests and their holds are tied to your account. Sign in to continue.",
                    onSignIn = { openPage("login", "") },
                )
                // The honest 403 role gate — the route denied a buyer session;
                // a zero-shaped balance card must never render here.
                state.supplierGateMessage != null -> SupplierGateCard(
                    message = state.supplierGateMessage.orEmpty(),
                    onSupplierDashboard = { openPage("supplier-dashboard", "") },
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> WithdrawContent(state = state, vm = vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MoneyTopBar(title: String, onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                title,
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

/** The 403 role gate — honest copy + real links, no fabricated balance. */
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
            "Withdrawals are supplier-scoped money data — the server answers 403 for a buyer session, " +
                "so no balance or payout figures are shown here.",
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
private fun WithdrawContent(state: WithdrawUiState, vm: WithdrawViewModel) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved payout rail")
        }
        state.ledger?.let { ledger ->
            BalanceCards(
                balance = ledger.balance ?: 0.0,
                onHold = ledger.onHold ?: 0.0,
                available = ledger.available ?: 0.0,
            )
        }
        state.successMessage?.let { message ->
            PayoutSuccessCard(
                message = message,
                payoutId = state.successPayoutId,
                availableAfter = state.successAvailableAfter,
                onDismiss = vm::consumeSuccess,
            )
        }
        if (state.formVisible) {
            WithdrawRequestForm(state = state, vm = vm)
        } else {
            Button(
                onClick = vm::toggleForm,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
            ) {
                Icon(Icons.Outlined.ArrowUpward, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Request Withdrawal", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
        PayoutLedgerList(state = state)
    }
}

/** The honest three-way split card (balance / on hold / available). */
@Composable
private fun BalanceCards(balance: Double, onHold: Double, available: Double) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "Available for withdrawal",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Text(
                formatBdt(available),
                fontSize = 30.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Row(Modifier.fillMaxWidth()) {
                Text(
                    "Wallet ${formatBdt(balance)}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "On hold ${formatBdt(onHold)}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                )
            }
            Row(verticalAlignment = Alignment.Top) {
                Icon(
                    Icons.Outlined.Lock,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier
                        .padding(top = 1.dp)
                        .size(12.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "Every request is held until an admin verifies the settlement — the same rule that " +
                        "protects buyer payments. Rejected requests release the hold instantly.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                )
            }
        }
    }
}

/** The REAL POST success — message + payoutId + availableAfter, inline. */
@Composable
private fun PayoutSuccessCard(
    message: String,
    payoutId: String?,
    availableAfter: Double?,
    onDismiss: () -> Unit,
) {
    val success = MaterialTheme.colorScheme.primary
    Surface(
        color = success.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, success.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
            Icon(
                Icons.Outlined.CheckCircle,
                null,
                tint = success,
                modifier = Modifier
                    .padding(top = 1.dp)
                    .size(16.dp),
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = success,
                )
                Text(
                    buildString {
                        append("Payout: ")
                        append(payoutId?.takeIf(String::isNotBlank) ?: "—")
                        append(" · Status: pending")
                        if (availableAfter != null) {
                            append(" · Available after: ")
                            append(formatBdt(availableAfter))
                        }
                    },
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                Icon(
                    Icons.Outlined.Close,
                    "Dismiss",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(14.dp),
                )
            }
        }
    }
}

/** The expandable withdrawal request form (the withdrawSchema field set). */
@Composable
private fun WithdrawRequestForm(state: WithdrawUiState, vm: WithdrawViewModel) {
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
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.ArrowUpward,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Request Withdrawal",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "PAYOUT AMOUNT",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "Withdraw Max",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(onClick = vm::fillMaxAmount)
                        .padding(4.dp),
                )
            }
            OutlinedTextField(
                value = state.amountText,
                onValueChange = vm::setAmount,
                label = { Text("Amount (≥ ৳50, ≤ available)", fontSize = 11.sp) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                isError = state.amountText.isNotBlank() && state.amountInvalid,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            if (state.amountText.isNotBlank() && state.amountInvalid) {
                Text(
                    "Minimum withdrawal threshold is ৳50 — and the amount cannot exceed the available " +
                        "balance (balance minus requests already pending verification).",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Text(
                "PAYOUT DESTINATION",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PAYOUT_METHODS.forEach { (id, label) ->
                    FilterChipButton(
                        label = label,
                        selected = state.payoutMethod == id,
                        onClick = { vm.setPayoutMethod(id) },
                    )
                }
            }
            if (state.payoutMethod == "bank") {
                Text(
                    "Bank Name",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PAYOUT_BANK_NAMES.forEach { bank ->
                        FilterChipButton(
                            label = bank,
                            selected = state.bankName == bank,
                            onClick = { vm.setBankName(bank) },
                        )
                    }
                }
            }
            OutlinedTextField(
                value = state.accountNumber,
                onValueChange = vm::setAccountNumber,
                label = {
                    Text(
                        if (state.payoutMethod == "bank") "Account Number" else "${state.payoutMethod} Wallet Number",
                        fontSize = 11.sp,
                    )
                },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.holderName,
                onValueChange = vm::setHolderName,
                label = { Text("Beneficiary / Corporate Account Title", fontSize = 11.sp) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            state.submitError?.let { message ->
                // The route's verbatim 400 — including the exceeds-available
                // text that spells out the real balance/hold numbers — and
                // the verbatim 404 'No wallet found for this account'.
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = vm::submitWithdrawal,
                    enabled = !state.submitting &&
                        !(state.amountText.isNotBlank() && state.amountInvalid) &&
                        !state.fieldsInvalid,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(44.dp),
                ) {
                    if (state.submitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(
                        "Request ${formatBdt(state.amountText.trim().toDoubleOrNull() ?: 0.0)} payout",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                OutlinedButton(
                    onClick = vm::toggleForm,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.height(44.dp),
                ) {
                    Text("Cancel", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/** The payout queue — the list the admin actually works from. */
@Composable
private fun PayoutLedgerList(state: WithdrawUiState) {
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
                    "Your payout requests",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "${state.ledger?.payouts?.size ?: 0}",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            val payouts = state.ledger?.payouts.orEmpty()
            when {
                state.loading -> FinanceSkeleton()
                payouts.isEmpty() -> Text(
                    "No payout requests yet — the money in your wallet is all available.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> payouts.forEach { payout ->
                    PayoutRow(payout)
                }
            }
        }
    }
}

/** One payout row — amount, status chip, destination · ref, held note. */
@Composable
private fun PayoutRow(payout: PayoutRowDto) {
    val tint = when (payoutTint(payout.status)) {
        PayoutTint.EMERALD -> Color(0xFF2E7D32)
        PayoutTint.AMBER -> Color(0xFFB26A00)
        PayoutTint.ROSE -> MaterialTheme.colorScheme.error
        PayoutTint.NEUTRAL -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                formatBdt(payout.amount ?: 0.0),
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            Surface(
                color = tint.copy(alpha = 0.12f),
                shape = RoundedCornerShape(50),
            ) {
                Text(
                    payoutStatusLabel(payout.status),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    color = tint,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
        }
        Text(
            buildString {
                append(payout.destination?.takeIf(String::isNotBlank) ?: payout.method.orEmpty())
                payout.reference?.takeIf(String::isNotBlank)?.let { append(" · ref $it") }
            },
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            buildString {
                append(formatMoneyDate(payout.createdAt).ifBlank { "—" })
                if (payoutIsHold(payout.status)) append(" · amount held until verified")
            },
            fontSize = 9.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
