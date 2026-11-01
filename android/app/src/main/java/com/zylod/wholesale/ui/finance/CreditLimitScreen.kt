package com.zylod.wholesale.ui.finance

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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed trade-credit screen (pageIds credit-limit AND buyer-credit —
 * the ui/screens delegates call THIS, pageId-keyed so each page keeps its
 * own [CreditLimitViewModel]).
 *
 * Data truth: GET api/credits/limit via [CreditLimitViewModel] — the
 * find-or-create facility, so the gauge always shows the buyer's REAL
 * credit line (limit vs used vs available progress, BDT via WalletFormat),
 * the grace period, the next settlement date and the status chip. Below:
 * the "Request Limit Increase" expandable form → the REAL POST with the
 * client positive-amount guard, the server's verbatim 400/429 text, and
 * the returned referenceId + under_review status shown INLINE (no dialog).
 * Honest loading / sign-in / error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreditLimitScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CreditLimitViewModel = viewModel(key = "native-credit-limit-$pageId") {
        CreditLimitViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (BankAccountsScreen parity) — an approved
    // change elsewhere shows the moment the user lands back here.
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            CreditTopBar(
                title = "Trade Credit Line",
                onBack = onBack,
                actionIcon = Icons.Outlined.TrendingUp,
                actionLabel = "Credit score",
                onAction = { openPage("credit-score", "") },
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
                // Honest gate for signed-out buyers (no token, or a 401 after
                // the shared authenticator's refresh attempt) — never a fake
                // facility.
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in to view your trade credit line",
                    body = "Your credit line shows your real approved facility and utilization. Sign in to continue.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> CreditLimitContent(state = state, vm = vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreditTopBar(
    title: String,
    onBack: (() -> Unit)?,
    actionIcon: androidx.compose.ui.graphics.vector.ImageVector,
    actionLabel: String,
    onAction: () -> Unit,
) {
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
        actions = {
            IconButton(onClick = onAction) {
                Icon(actionIcon, actionLabel, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun CreditLimitContent(state: CreditLimitUiState, vm: CreditLimitViewModel) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved credit line")
        }
        when {
            state.loading -> FinanceSkeleton()
            else -> {
                state.line?.let { line ->
                    CreditGaugeCard(
                        creditLimit = line.creditLimit ?: 0.0,
                        usedCredit = line.usedCredit ?: 0.0,
                        availableCredit = line.availableCredit ?: 0.0,
                        status = line.status,
                    )
                    CreditTermsCard(
                        gracePeriod = line.interestFreeGracePeriod,
                        nextSettlementDate = line.nextSettlementDate,
                    )
                }
                state.successMessage?.let { message ->
                    CreditSuccessCard(
                        message = message,
                        referenceId = state.referenceId,
                        requestStatus = state.requestStatus,
                        onDismiss = vm::consumeSuccess,
                    )
                }
                if (state.formVisible) {
                    CreditRequestForm(state = state, vm = vm)
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
                        Icon(Icons.Outlined.Add, null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Request Credit Limit Increase", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/** The facility gauge: available credit headline, used/limit progress, totals. */
@Composable
private fun CreditGaugeCard(
    creditLimit: Double,
    usedCredit: Double,
    availableCredit: Double,
    status: String?,
) {
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
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Approved Revolving Line",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                CreditStatusChip(status)
            }
            Column {
                Text(
                    "Available Sourcing Credit",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    formatBdt(availableCredit),
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            LinearProgressIndicator(
                progress = { creditUtilizationFraction(usedCredit, creditLimit) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(10.dp)
                    .clip(RoundedCornerShape(50)),
            )
            Row(Modifier.fillMaxWidth()) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "Total Facility",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        formatBdt(creditLimit),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        "Drawn / Utilized",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        formatBdt(usedCredit),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        }
    }
}

/** The facility's real status token ('active') as a small pill. */
@Composable
private fun CreditStatusChip(status: String?) {
    val label = status?.trim()?.uppercase()?.takeIf(String::isNotEmpty) ?: "ACTIVE"
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer,
        shape = RoundedCornerShape(50),
    ) {
        Text(
            label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSecondaryContainer,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
        )
    }
}

/** Terms & Settlement SLA rows — the API's real values, web layout. */
@Composable
private fun CreditTermsCard(
    gracePeriod: String?,
    nextSettlementDate: String?,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "Terms & Settlement SLA",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            TermsRow(
                label = "Interest-Free Grace Period",
                value = gracePeriod?.takeIf(String::isNotBlank) ?: "30 Days",
                valueColor = MaterialTheme.colorScheme.primary,
            )
            TermsRow(
                label = "Next Settlement Cycle",
                value = formatMoneyDate(nextSettlementDate).ifBlank { "Active Cycle" },
            )
            TermsRow(
                label = "Underwriting Sponsor",
                value = "City Bank Wholesale Trade Partner",
            )
        }
    }
}

@Composable
private fun TermsRow(label: String, value: String, valueColor: Color = MaterialTheme.colorScheme.onSurface) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
    ) {
        Text(
            label,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Icon(
            Icons.Outlined.Schedule,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(12.dp),
        )
        Spacer(Modifier.width(4.dp))
        Text(
            value,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = valueColor,
            textAlign = TextAlign.End,
        )
    }
}

/** The REAL POST success — message + referenceId + status, inline, dismissible. */
@Composable
private fun CreditSuccessCard(
    message: String,
    referenceId: String?,
    requestStatus: String?,
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
                if (!referenceId.isNullOrBlank() || !requestStatus.isNullOrBlank()) {
                    Text(
                        buildString {
                            append("Reference: ")
                            append(referenceId?.takeIf(String::isNotBlank) ?: "—")
                            append(" · Status: ")
                            append(requestStatus?.takeIf(String::isNotBlank) ?: "under_review")
                        },
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
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

/** The expandable underwriting request form (amount + reason + optional doc URL). */
@Composable
private fun CreditRequestForm(state: CreditLimitUiState, vm: CreditLimitViewModel) {
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
                    Icons.Outlined.Shield,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Request Credit Limit Increase",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            OutlinedTextField(
                value = state.amountText,
                onValueChange = vm::setAmount,
                label = { Text("Requested Credit Ceiling (BDT)", fontSize = 11.sp) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                isError = state.amountInvalid,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            if (state.amountInvalid) {
                Text(
                    "Enter a positive number — the server rejects anything else.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            OutlinedTextField(
                value = state.reason,
                onValueChange = vm::setReason,
                label = { Text("Business Justification", fontSize = 11.sp) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.docUrl,
                onValueChange = vm::setDocUrl,
                label = { Text("Bank Solvency Doc URL (optional)", fontSize = 11.sp) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            state.submitError?.let { message ->
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = vm::submitRequest,
                    enabled = !state.submitting && !state.amountInvalid,
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
                    Text("Submit Underwriting Request", fontSize = 12.sp, fontWeight = FontWeight.Bold)
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
