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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
 * SHARED typed add-bank-account screen (pageId add-bank-account — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * AddBankAccountViewModel).
 *
 * Data truth: POST api/bank-accounts via [AddBankAccountViewModel] — the
 * route's exact form: the required bankName/accountNumber/accountHolderName
 * trio, the optional branch/routing pair, and the set-as-default switch.
 * Client validation mirrors the route's required trio; the route's REAL
 * 400 text surfaces verbatim in the red server line. Success shows the
 * wire's real message in a snackbar, then pops back — the bank-accounts
 * list re-fetches on re-entry. Submit is disabled while saving and
 * double-submits are guarded.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddBankAccountScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AddBankAccountViewModel = viewModel(key = "native-add-bank-account-$pageId") {
        AddBankAccountViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { vm.load() }

    // Success: the wire's real message, then back to the list (which
    // re-fetches on re-entry). [openPage] is part of the delegate contract;
    // this form's flow pops back rather than pushing.
    LaunchedEffect(state.saved) {
        if (state.saved) {
            snackbarHostState.showSnackbar(
                state.successMessage.ifBlank { "Bank account added successfully" },
            )
            onBack?.invoke()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { AddBankTopBar(onBack = onBack) },
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
                    title = "Sign in to add a bank account",
                    body = "Bank accounts are tied to your account. Sign in to add one.",
                    onSignIn = { openPage("login", "") },
                )
            } else {
                AddBankAccountForm(state = state, vm = vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddBankTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Add Bank Account",
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
private fun AddBankAccountForm(state: AddBankAccountUiState, vm: AddBankAccountViewModel) {
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

        FinanceField(
            label = "Bank Name",
            required = true,
            value = state.form.bankName,
            error = state.errors["bankName"],
            placeholder = "e.g. Dutch-Bangla Bank",
            onValueChange = { vm.setField("bankName", it) },
        )
        FinanceField(
            label = "Account Number",
            required = true,
            value = state.form.accountNumber,
            error = state.errors["accountNumber"],
            placeholder = "Full account number",
            onValueChange = { vm.setField("accountNumber", it) },
        )
        FinanceField(
            label = "Account Holder Name",
            required = true,
            value = state.form.accountHolderName,
            error = state.errors["accountHolderName"],
            placeholder = "Name on the account",
            onValueChange = { vm.setField("accountHolderName", it) },
        )
        FinanceField(
            label = "Branch Name",
            required = false,
            optionalHint = "(Optional)",
            value = state.form.branchName,
            error = null,
            placeholder = "e.g. Gulshan Branch",
            onValueChange = { vm.setField("branchName", it) },
        )
        FinanceField(
            label = "Routing Number",
            required = false,
            optionalHint = "(Optional)",
            value = state.form.routingNumber,
            error = null,
            placeholder = "9-digit routing number",
            onValueChange = { vm.setField("routingNumber", it) },
        )

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "Set as default account",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Used first where a payout account is needed.",
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
                if (state.saving) "Adding..." else "Add Bank Account",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

/** Shared labeled text field (AddAddressScreen LabeledField convention). */
@Composable
internal fun FinanceField(
    label: String,
    required: Boolean,
    value: String,
    error: String?,
    placeholder: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    optionalHint: String? = null,
    supportingHint: String? = null,
) {
    Column(modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                label,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.width(2.dp))
            if (required) {
                Text(
                    "*",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            optionalHint?.let {
                Spacer(Modifier.width(2.dp))
                Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Spacer(Modifier.height(6.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = if (placeholder.isEmpty()) {
                null
            } else {
                { Text(placeholder, fontSize = 12.sp) }
            },
            isError = error != null,
            supportingText = error?.let { message ->
                { Text(message, fontSize = 10.sp, color = MaterialTheme.colorScheme.error) }
            },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
                focusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        if (error == null && supportingHint != null) {
            Text(
                supportingHint,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp, start = 4.dp),
            )
        }
    }
}
