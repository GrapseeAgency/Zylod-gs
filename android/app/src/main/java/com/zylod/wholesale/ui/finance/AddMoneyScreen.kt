package com.zylod.wholesale.ui.finance

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.Button
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.TopupClaimDto
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed add-money screen (pageId add-money — the ui/screens delegate
 * calls THIS, so the page keeps its own [AddMoneyViewModel]).
 *
 * Two funding tabs, both honest to the route doctrine:
 *  1. MANUAL CLAIM — the web page's own flow: send money to the company
 *     account, then submit the transaction reference here. POST
 *     api/wallet/topup creates a walletTopups row with status 'pending'
 *     and NOTHING else — the success card shows the route's verbatim
 *     "admin verification" message, the reference and the pending status.
 *     It NEVER says "balance added".
 *  2. GATEWAY — POST api/wallet/topup/initiate starts a real bKash
 *     Tokenized Checkout / SSLCommerz EasyCheckout session; on success the
 *     returned redirectUrl is handed to the OS as an "Open secure payment
 *     page" ACTION_VIEW (no in-app pretense, credited only by the verified
 *     callback/IPN); a 503 gateway-not-configured surfaces verbatim.
 *
 * Below both tabs: the caller's REAL claim ledger (GET api/wallet/topup)
 * with honest status chips (pending / credited / rejected / …), provider,
 * reference and dates. Honest loading / sign-in / error / offline states —
 * nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddMoneyScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AddMoneyViewModel = viewModel(key = "native-add-money-$pageId") {
        AddMoneyViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (BankAccountsScreen parity) — a claim the
    // admin credited elsewhere shows its status the moment the user lands
    // back here.
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            MoneyTopBar(title = "Add Money", onBack = onBack)
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                // Honest gate for signed-out users — a funding claim always
                // belongs to an account (the API 401s without a session).
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in to add funds",
                    body = "Funding claims are tied to your Zylod account — sign in or create one to submit one.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> AddMoneyContent(state = state, vm = vm)
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

@Composable
private fun AddMoneyContent(state: AddMoneyUiState, vm: AddMoneyViewModel) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved claim ledger")
        }
        // The two funding tabs (manual claim / gateway session).
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterChipButton(
                label = "Manual claim",
                selected = state.tab == AddMoneyUiState.TAB_MANUAL,
                onClick = { vm.setTab(AddMoneyUiState.TAB_MANUAL) },
            )
            FilterChipButton(
                label = "Gateway payment",
                selected = state.tab == AddMoneyUiState.TAB_GATEWAY,
                onClick = { vm.setTab(AddMoneyUiState.TAB_GATEWAY) },
            )
        }
        when (state.tab) {
            AddMoneyUiState.TAB_GATEWAY -> GatewayTab(state = state, vm = vm)
            else -> ManualClaimTab(state = state, vm = vm)
        }
        ClaimLedger(state = state, vm = vm)
    }
}

/** The web page's hero + verification-doctrine banner (copy mirrored). */
@Composable
private fun DoctrineHero() {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "Add Funds to Wallet",
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Text(
                "Send money to the Zylod company account, then submit the transaction reference here.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
            )
            Row(verticalAlignment = Alignment.Top) {
                Icon(
                    Icons.Outlined.Shield,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier
                        .padding(top = 1.dp)
                        .size(14.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Verification doctrine: your claim stays PENDING and your balance does NOT change " +
                        "until a Zylod finance admin confirms the money arrived — the same rule as order " +
                        "payments. Fake or duplicate references are rejected and audit-logged.",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
    }
}

/** One selectable method card (the web's 2-col grid cards, mirrored). */
@Composable
private fun MethodCard(
    title: String,
    desc: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val accent = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
    Surface(
        color = if (selected) {
            MaterialTheme.colorScheme.primary.copy(alpha = 0.06f)
        } else {
            MaterialTheme.colorScheme.surfaceContainer
        },
        shape = RoundedCornerShape(16.dp),
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .border(
                if (selected) 2.dp else 1.dp,
                accent.copy(alpha = if (selected) 1f else 0.6f),
                RoundedCornerShape(16.dp),
            )
            .clickable(onClick = onClick),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                title,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            )
            Text(
                desc,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** The manual funding claim form — the route's exact field set + guards. */
@Composable
private fun ManualClaimTab(state: AddMoneyUiState, vm: AddMoneyViewModel) {
    DoctrineHero()
    state.successMessage?.let { message ->
        ClaimPendingCard(
            message = message,
            reference = state.successReference,
            status = state.successStatus,
            onDismiss = vm::consumeClaimSuccess,
        )
    }
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
            Text(
                "ENTER DEPOSIT AMOUNT (BDT)",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = state.amountText,
                onValueChange = vm::setClaimAmount,
                label = { Text("Amount (৳10 – ৳100,000)", fontSize = 11.sp) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                isError = state.claimAmountInvalid,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            if (state.claimAmountInvalid) {
                Text(
                    "Amount must be between ৳10 and ৳100,000 (the verification desk rejects anything else).",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("5000", "15000", "25000", "50000", "100000").forEach { preset ->
                    FilterChipButton(
                        label = "+৳$preset",
                        selected = state.amountText == preset,
                        onClick = { vm.setClaimAmount(preset) },
                    )
                }
            }
            Text(
                "HOW DID YOU PAY?",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                TOPUP_CLAIM_METHODS.chunked(2).forEach { rowMethods ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        rowMethods.forEach { (id, desc) ->
                            MethodCard(
                                title = id,
                                desc = desc,
                                selected = state.claimMethod == id,
                                onClick = { vm.setClaimMethod(id) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                        if (rowMethods.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
            OutlinedTextField(
                value = state.transactionReference,
                onValueChange = vm::setTransactionReference,
                label = { Text("Transaction reference (TRXID) *", fontSize = 11.sp) },
                singleLine = true,
                isError = state.transactionReference.isNotBlank() && state.referenceInvalid,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                if (state.transactionReference.isNotBlank() && state.referenceInvalid) {
                    "6-64 characters — letters, numbers, dash, underscore"
                } else {
                    "Copy it exactly from your " +
                        (if (state.claimMethod == "bank_transfer") "bank receipt" else "${state.claimMethod} confirmation SMS")
                },
                fontSize = 10.sp,
                color = if (state.transactionReference.isNotBlank() && state.referenceInvalid) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
            )
            OutlinedTextField(
                value = state.senderNumber,
                onValueChange = vm::setSenderNumber,
                label = {
                    Text(
                        if (state.claimMethod == "bank_transfer") {
                            "Bank account / deposit slip number (optional)"
                        } else {
                            "${state.claimMethod} number you paid from (optional)"
                        },
                        fontSize = 11.sp,
                    )
                },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.note,
                onValueChange = vm::setNote,
                label = { Text("Note for the finance team (optional, ≤300)", fontSize = 11.sp) },
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
            Button(
                onClick = vm::submitClaim,
                enabled = !state.submitting && !state.claimAmountInvalid && !state.referenceInvalid,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
            ) {
                if (state.submitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("Recording claim…", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                } else {
                    Text(
                        "Submit ${formatBdt(state.amountText.trim().toDoubleOrNull() ?: 0.0)} claim for verification",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Text(
                "Submitting does not move money. Verification does.",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** The gateway tab — amount + method → honest 503 or a real payment URL. */
@Composable
private fun GatewayTab(state: AddMoneyUiState, vm: AddMoneyViewModel) {
    val context = LocalContext.current
    var openError by remember { mutableStateOf(false) }
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
            Text(
                "GATEWAY TOP-UP",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                "bKash Tokenized Checkout (bKash) or SSLCommerz EasyCheckout (Nagad, Upay, Rocket, card). " +
                    "The wallet is credited ONLY by the gateway's verified callback — never by this screen.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = state.gatewayAmountText,
                onValueChange = vm::setGatewayAmount,
                label = { Text("Amount (৳10 – ৳100,000)", fontSize = 11.sp) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                isError = state.gatewayAmountInvalid,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            if (state.gatewayAmountInvalid) {
                Text(
                    "Amount must be between ৳10 and ৳100,000",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TOPUP_GATEWAY_METHODS.forEach { method ->
                    FilterChipButton(
                        label = method,
                        selected = state.gatewayMethod == method,
                        onClick = { vm.setGatewayMethod(method) },
                    )
                }
            }
            state.initiateError?.let { message ->
                // The route's verbatim error — including the honest 503
                // 'bKash is not configured' / 'SSLCommerz is not configured'.
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            if (state.paymentUrl != null) {
                val paymentUrl = state.paymentUrl.orEmpty()
                val handoff = MaterialTheme.colorScheme.primary
                Surface(
                    color = handoff.copy(alpha = 0.08f),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, handoff.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
                ) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Outlined.Shield,
                                null,
                                tint = handoff,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "Secure gateway session started",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = handoff,
                            )
                        }
                        Text(
                            "Reference: ${state.paymentReference?.takeIf(String::isNotBlank) ?: "—"} · " +
                                "your balance changes only after the gateway's verified callback.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Button(
                            onClick = {
                                openError = false
                                val opened = runCatching {
                                    context.startActivity(
                                        Intent(Intent.ACTION_VIEW, Uri.parse(paymentUrl)),
                                    )
                                }.isSuccess
                                if (!opened) openError = true
                            },
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                        ) {
                            Text("Open secure payment page", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        if (openError) {
                            Text(
                                "No app on this device can open the payment URL. Retry or switch to the manual claim tab.",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.error,
                            )
                        }
                        OutlinedButton(
                            onClick = vm::consumeGatewayResult,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.height(40.dp),
                        ) {
                            Text("Dismiss", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            Button(
                onClick = vm::initiateGateway,
                enabled = !state.initiating && !state.gatewayAmountInvalid,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
            ) {
                if (state.initiating) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(Modifier.width(8.dp))
                }
                Text("Continue to secure payment", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** The post-submit doctrine card — the route's verbatim pending message. */
@Composable
private fun ClaimPendingCard(
    message: String,
    reference: String?,
    status: String?,
    onDismiss: () -> Unit,
) {
    val amber = Color(0xFFB26A00)
    Surface(
        color = amber.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, amber.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
            Icon(
                Icons.Outlined.Schedule,
                null,
                tint = amber,
                modifier = Modifier
                    .padding(top = 1.dp)
                    .size(16.dp),
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    "Payment verification pending",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = amber,
                )
                Text(
                    message,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Text(
                    buildString {
                        append("Reference: ")
                        append(reference?.takeIf(String::isNotBlank) ?: "—")
                        append(" · Status: ")
                        append(status?.takeIf(String::isNotBlank) ?: "pending")
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

/** The caller's REAL claim ledger (GET api/wallet/topup), newest first. */
@Composable
private fun ClaimLedger(state: AddMoneyUiState, vm: AddMoneyViewModel) {
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
                    "Your funding claims",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
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
                state.claims.isEmpty() -> Text(
                    "No funding claims yet. Submit your first claim above — it will appear here with its live status.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> state.claims.forEach { claim ->
                    ClaimRow(claim)
                }
            }
        }
    }
}

/** One claim row — amount, honest status chip, provider · reference · date. */
@Composable
private fun ClaimRow(claim: TopupClaimDto) {
    val tint = when (topupClaimTint(claim.status)) {
        TopupClaimTint.EMERALD -> Color(0xFF2E7D32)
        TopupClaimTint.AMBER -> Color(0xFFB26A00)
        TopupClaimTint.ROSE -> MaterialTheme.colorScheme.error
        TopupClaimTint.NEUTRAL -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    formatBdt(claim.amount ?: 0.0),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.width(8.dp))
                Surface(
                    color = tint.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(50),
                ) {
                    Text(
                        claim.status?.trim()?.uppercase()?.takeIf(String::isNotEmpty) ?: "UNKNOWN",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = tint,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    )
                }
            }
            Text(
                buildString {
                    append(claim.provider?.takeIf(String::isNotBlank) ?: "—")
                    append(" · ")
                    append(claim.reference?.takeIf(String::isNotBlank) ?: "—")
                    append(" · ")
                    append(formatMoneyDate(claim.createdAt).ifBlank { "—" })
                },
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}
