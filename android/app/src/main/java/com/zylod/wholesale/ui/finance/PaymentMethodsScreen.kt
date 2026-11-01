package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.PaymentMethodRowDto

/**
 * SHARED typed payment-methods screen (pageId payment-method — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * PaymentMethodsViewModel).
 *
 * Data truth: GET api/payment-methods via [PaymentMethodsViewModel] — the
 * session user's RAW db rows, rendered as two honest sections: Mobile
 * Wallets (bKash/Nagad/Upay/Rocket rows with their label + masked phone)
 * and Cards (debit/credit rows with the tokenized last4 + expiry). The
 * Default badge is the row's real isDefault flag. Row taps open the
 * payment-methods-detail page with the row id in the query; the DELETE
 * affordance is real (DELETE api/payment-methods/{id} — the [id] route's
 * only method, with a confirm dialog before the wire call). "Add Payment
 * Method" jumps to the shared add form. Honest loading / sign-in / empty /
 * error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentMethodsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: PaymentMethodsViewModel = viewModel(key = "native-payment-methods-$pageId") {
        PaymentMethodsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var pendingDelete by remember { mutableStateOf<PaymentMethodRowDto?>(null) }

    // Re-resolve on EVERY entry (BankAccountsScreen parity) — a method
    // added on the add page shows the moment the user lands back here.
    LaunchedEffect(Unit) { vm.load() }

    // One snackbar line for the honest action failures (delete/network).
    LaunchedEffect(state.actionError) {
        val message = state.actionError ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        vm.consumeActionError()
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { MethodsTopBar(onBack = onBack) },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            if (!state.needsAuth && state.error == null) {
                ExtendedFloatingActionButton(
                    onClick = { openPage("add-payment-method", "") },
                    icon = { Icon(Icons.Outlined.Add, null) },
                    text = { Text("Add Payment Method", fontWeight = FontWeight.Bold) },
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                )
            }
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
                    title = "Sign in to view your payment methods",
                    body = "Your mobile wallets and saved cards are tied to your account. Sign in to view, add, and remove them.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> MethodsContent(
                    state = state,
                    onDeleteRequest = { pendingDelete = it },
                    onOpenDetail = { id -> openPage("payment-methods-detail", "id=$id") },
                )
            }
        }
    }

    pendingDelete?.let { row ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = {
                Text(
                    "Remove payment method?",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                )
            },
            text = {
                Text(
                    "${row.label.orEmpty().ifBlank { "This payment method" }} " +
                        "(${maskAccountTail(row.accountNumber)}) will be removed from your account.",
                    fontSize = 13.sp,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val id = row.id
                    pendingDelete = null
                    if (!id.isNullOrBlank()) vm.delete(id)
                }) {
                    Text("Remove", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MethodsTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Payment Methods",
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
private fun MethodsContent(
    state: PaymentMethodsUiState,
    onDeleteRequest: (PaymentMethodRowDto) -> Unit,
    onOpenDetail: (String) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved payment methods")
        }
        when {
            state.loading -> FinanceSkeleton()
            state.isEmpty -> FinanceEmptyCard(
                icon = Icons.Outlined.AccountBalanceWallet,
                title = "No payment methods saved yet.",
                body = "Mobile wallets (bKash, Nagad, Upay, Rocket) and cards you add show up here.",
            )
            else -> {
                if (state.wallets.isNotEmpty()) {
                    SectionHeader("Mobile Wallets")
                    state.wallets.forEach { row ->
                        MethodRow(
                            row = row,
                            leading = Icons.Outlined.AccountBalanceWallet,
                            deleting = state.deletingId == row.id,
                            onClick = { row.id?.let(onOpenDetail) },
                            onDelete = { onDeleteRequest(row) },
                        )
                    }
                }
                if (state.cards.isNotEmpty()) {
                    SectionHeader("Cards")
                    state.cards.forEach { row ->
                        MethodRow(
                            row = row,
                            leading = Icons.Outlined.CreditCard,
                            deleting = state.deletingId == row.id,
                            onClick = { row.id?.let(onOpenDetail) },
                            onDelete = { onDeleteRequest(row) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        title,
        fontSize = 13.sp,
        fontWeight = FontWeight.Black,
        color = MaterialTheme.colorScheme.onSurface,
        modifier = Modifier.padding(top = 4.dp),
    )
}

@Composable
private fun MethodRow(
    row: PaymentMethodRowDto,
    leading: androidx.compose.ui.graphics.vector.ImageVector,
    deleting: Boolean,
    onClick: () -> Unit,
    onDelete: () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .clickable(onClick = onClick)
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(24.dp),
            ),
    ) {
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.Top) {
            Icon(
                leading,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp).size(20.dp),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        row.label.orEmpty().ifBlank { row.type.orEmpty().ifBlank { "Payment Method" } },
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (row.isDefault) {
                        Spacer(Modifier.width(8.dp))
                        FinanceDefaultBadge()
                    }
                }
                Column(Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    val masked = maskAccountTail(row.accountNumber)
                    if (masked.isNotBlank()) {
                        Text(
                            masked,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                    val holder = row.holderName?.takeIf(String::isNotBlank)
                    if (holder != null && isCardFamilyType(row.type)) {
                        Text(holder, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    val network = row.cardNetwork?.takeIf(String::isNotBlank)
                    if (network != null) {
                        Text(network, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    val expiry = row.expiry?.takeIf(String::isNotBlank)
                    if (expiry != null && isCardFamilyType(row.type)) {
                        Text(
                            "Expires $expiry",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            if (deleting) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Outlined.Delete,
                        "Remove payment method",
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}
