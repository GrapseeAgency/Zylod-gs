package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

/**
 * SHARED typed add-payment-method screen (pageId add-payment-method — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * AddPaymentMethodViewModel).
 *
 * Data truth: POST api/payment-methods via [AddPaymentMethodViewModel] —
 * the route's TWO families behind a segmented toggle:
 *  - Mobile Wallet: provider chips (bKash/Nagad/Upay/Rocket — the route's
 *    exact whitelist), a required label, and the account number with the
 *    route's Bangladeshi phone regex mirrored client-side as a hint.
 *  - Card: the tokenized contract (the route stores ONLY the last 4
 *    digits — the form accepts a full number and sends the derived last4),
 *    required holder, optional MM/YY expiry and the debit/credit +
 *    network pickers.
 * The route's REAL 400 text surfaces verbatim in the red server line.
 * Success shows the created row's real label in a snackbar, then pops
 * back — the payment-methods list re-fetches on re-entry.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddPaymentMethodScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AddPaymentMethodViewModel = viewModel(key = "native-add-payment-method-$pageId") {
        AddPaymentMethodViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { vm.load() }

    // Success: the created row's real label, then back to the list (which
    // re-fetches on re-entry).
    LaunchedEffect(state.saved) {
        if (state.saved) {
            snackbarHostState.showSnackbar(
                state.successMessage.ifBlank { "Payment method added" },
            )
            onBack?.invoke()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { AddMethodTopBar(onBack = onBack) },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            if (state.needsAuth) {
                FinanceAuthGate(
                    title = "Sign in to add a payment method",
                    body = "Payment methods are tied to your account. Sign in to add one.",
                    onSignIn = { openPage("login", "") },
                )
            } else {
                AddMethodForm(state = state, vm = vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddMethodTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Add Payment Method",
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
private fun AddMethodForm(state: AddPaymentMethodUiState, vm: AddPaymentMethodViewModel) {
    val walletMode = state.form.family == AddPaymentMethodForm.FAMILY_WALLET
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        state.serverError?.let { message ->
            val error = MaterialTheme.colorScheme.error
            Surface(
                color = error.copy(alpha = 0.08f),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(16.dp)),
            ) {
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = error,
                    modifier = Modifier.padding(16.dp),
                )
            }
        }

        // Segmented toggle: Mobile Wallet | Card.
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = walletMode,
                onClick = { vm.setFamily(AddPaymentMethodForm.FAMILY_WALLET) },
                label = { Text("Mobile Wallet", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                ),
            )
            FilterChip(
                selected = !walletMode,
                onClick = { vm.setFamily(AddPaymentMethodForm.FAMILY_CARD) },
                label = { Text("Card", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                ),
            )
        }

        if (walletMode) {
            MobileWalletFields(state = state, vm = vm)
        } else {
            CardFields(state = state, vm = vm)
        }

        Button(
            onClick = vm::save,
            enabled = !state.saving && !state.saved,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
        ) {
            Text(
                if (state.saving) "Adding..." else "Add Payment Method",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun MobileWalletFields(state: AddPaymentMethodUiState, vm: AddPaymentMethodViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column {
            Text(
                "Provider",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MOBILE_WALLET_TYPES.forEach { provider ->
                    FilterChip(
                        selected = state.form.provider == provider,
                        onClick = { vm.setProvider(provider) },
                        label = { Text(provider, fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                        ),
                    )
                }
            }
        }

        FinanceField(
            label = "Label",
            required = true,
            value = state.form.walletLabel,
            error = state.errors["walletLabel"],
            placeholder = "e.g. My ${state.form.provider}",
            onValueChange = { vm.setField("walletLabel", it) },
        )

        FinanceField(
            label = "Account Number",
            required = true,
            value = state.form.walletAccount,
            error = state.errors["walletAccount"],
            placeholder = "01XXXXXXXXX",
            supportingHint = "Bangladeshi mobile number: 01XXXXXXXXX, +8801XXXXXXXXX or 8801XXXXXXXXX",
            onValueChange = { vm.setField("walletAccount", it) },
        )
    }
}

@Composable
private fun CardFields(state: AddPaymentMethodUiState, vm: AddPaymentMethodViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column {
            FinanceField(
                label = "Card Number",
                required = true,
                value = state.displayCardNumber,
                error = state.errors["cardNumber"],
                placeholder = "1234 5678 9012 3456",
                onValueChange = { vm.setField("cardNumber", it) },
            )
            Text(
                "Tokenized like the web rail — only the last 4 digits are saved.",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp, start = 4.dp),
            )
        }

        FinanceField(
            label = "Cardholder Name",
            required = true,
            value = state.form.holderName,
            error = state.errors["holderName"],
            placeholder = "Name on the card",
            onValueChange = { vm.setField("holderName", it) },
        )

        FinanceField(
            label = "Expiry",
            required = false,
            optionalHint = "(Optional)",
            value = state.form.expiry,
            error = state.errors["expiry"],
            placeholder = "MM/YY",
            supportingHint = "Month and year, e.g. 08/27",
            onValueChange = { vm.setField("expiry", it) },
        )

        Column {
            Text(
                "Card Type",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = !state.form.isDebit,
                    onClick = { vm.setCardFamilyType(false) },
                    label = { Text("Credit", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    ),
                )
                FilterChip(
                    selected = state.form.isDebit,
                    onClick = { vm.setCardFamilyType(true) },
                    label = { Text("Debit", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    ),
                )
            }
        }

        Column {
            Text(
                "Network",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Visa", "Mastercard", "Amex").forEach { network ->
                    FilterChip(
                        selected = state.form.cardNetwork == network,
                        onClick = { vm.setCardNetwork(network) },
                        label = { Text(network, fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                        ),
                    )
                }
            }
        }
    }
}
