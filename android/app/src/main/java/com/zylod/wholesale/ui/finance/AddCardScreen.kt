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
import androidx.compose.material3.Switch
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

/**
 * SHARED typed add-card screen (pageId add-card — the ui/screens delegate
 * calls THIS, so the page keeps its own AddCardViewModel).
 *
 * Data truth: POST api/cards via [AddCardViewModel] — the route's exact
 * form: the required cardNumber/holderName/expiry trio (the number renders
 * digit-grouped and is sent IN FULL; the server tokenizes to last4), the
 * Debit/Credit toggle, the Visa/Mastercard/Amex brand picker, and the
 * set-as-default switch. Client validation mirrors the route's required
 * trio; the route's REAL 400 text surfaces verbatim in the red server
 * line. Success shows the wire's real message ("Card added securely") in
 * a snackbar, then pops back — the cards list re-fetches on re-entry.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddCardScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AddCardViewModel = viewModel(key = "native-add-card-$pageId") {
        AddCardViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { vm.load() }

    // Success: the wire's real message, then back to the list (which
    // re-fetches on re-entry).
    LaunchedEffect(state.saved) {
        if (state.saved) {
            snackbarHostState.showSnackbar(
                state.successMessage.ifBlank { "Card added securely" },
            )
            onBack?.invoke()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { AddCardTopBar(onBack = onBack) },
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
                    title = "Sign in to add a card",
                    body = "Saved cards are tied to your account. Sign in to add one.",
                    onSignIn = { openPage("login", "") },
                )
            } else {
                AddCardForm(state = state, vm = vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddCardTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Add Card",
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

/** The brand picker's options — the checkout rail's real networks. */
private val CARD_BRANDS = listOf("Visa", "Mastercard", "Amex")

@Composable
private fun AddCardForm(state: AddCardUiState, vm: AddCardViewModel) {
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
                "Sent over an authenticated connection — only the last 4 digits are stored.",
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
            required = true,
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
                    onClick = { vm.setDebit(false) },
                    label = { Text("Credit", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    ),
                )
                FilterChip(
                    selected = state.form.isDebit,
                    onClick = { vm.setDebit(true) },
                    label = { Text("Debit", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    ),
                )
            }
        }

        Column {
            Text(
                "Brand",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CARD_BRANDS.forEach { brand ->
                    FilterChip(
                        selected = state.form.brand == brand,
                        onClick = { vm.setBrand(brand) },
                        label = { Text(brand, fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                        ),
                    )
                }
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "Set as default card",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Used first where a card is needed at checkout.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(checked = state.form.setAsDefault, onCheckedChange = { vm.setDefault(it) })
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
                if (state.saving) "Adding..." else "Add Card",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
