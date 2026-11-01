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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.PaymentMethodRowDto
import com.zylod.wholesale.ui.wallet.formatRelativeDate

/**
 * SHARED typed payment-methods-detail screen (pageId payment-methods-detail
 * — the ui/screens delegate calls THIS, so the page keeps its own
 * PaymentMethodsDetailViewModel).
 *
 * Data truth: the row resolved by [PaymentMethodsDetailViewModel] out of
 * the REAL GET api/payment-methods list (there is NO GET-by-id under
 * payment-methods/ — its [id] file declares DELETE only, so the web's
 * default-or-first resolution is mirrored). Type-appropriate rows: mobile
 * wallets render provider/label + masked phone, cards render the tokenized
 * last4 + network + expiry + holder. The Remove action is real (DELETE
 * api/payment-methods/{id} — direct call like the web's delete affordance,
 * button disabled while the wire call is in flight, then pop back).
 * Honest loading / sign-in / empty / not-found / error / offline states —
 * nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentMethodsDetailScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: PaymentMethodsDetailViewModel = viewModel(key = "native-payment-methods-detail-$pageId") {
        PaymentMethodsDetailViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    // Re-resolve on EVERY entry (TrackOrderScreen parity) — a fresh query
    // re-pins the new row.
    LaunchedEffect(Unit) { vm.load(query) }

    // One snackbar line for the honest action failures (delete/network).
    LaunchedEffect(state.actionError) {
        val message = state.actionError ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        vm.consumeActionError()
    }

    // Delete success → back to the list (which re-fetches on re-entry).
    LaunchedEffect(state.deleted) {
        if (state.deleted) onBack?.invoke()
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { DetailTopBar(onBack = onBack) },
        snackbarHost = { SnackbarHost(snackbarHostState) },
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
                    body = "Your mobile wallets and saved cards are tied to your account. Sign in to view them.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                state.notFound -> DetailNotFoundCard(onRetry = vm::retry)
                state.loading -> FinanceSkeleton()
                state.row == null -> FinanceEmptyCard(
                    icon = Icons.Outlined.AccountBalanceWallet,
                    title = "No payment methods saved yet.",
                    body = "Add a mobile wallet or card and its details show up here.",
                )
                else -> state.row?.let { row ->
                    DetailContent(
                        row = row,
                        offlineFromCache = state.offlineFromCache,
                        deleting = state.deleting,
                        onDelete = vm::delete,
                    )
                } ?: Unit
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Payment Method Details",
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
private fun DetailContent(
    row: PaymentMethodRowDto,
    offlineFromCache: Boolean,
    deleting: Boolean,
    onDelete: () -> Unit,
) {
    val isWallet = isMobileWalletType(row.type)
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved details")
        }

        // Identity header: type icon + real label + Default badge.
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    1.dp,
                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                    RoundedCornerShape(24.dp),
                ),
        ) {
            Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (isWallet) Icons.Outlined.AccountBalanceWallet else Icons.Outlined.CreditCard,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(24.dp),
                )
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            row.label.orEmpty().ifBlank { row.type.orEmpty().ifBlank { "Payment Method" } },
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        if (row.isDefault) {
                            Spacer(Modifier.width(8.dp))
                            FinanceDefaultBadge()
                        }
                    }
                    Text(
                        row.type.orEmpty().ifBlank { "Unknown type" },
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }

        // Type-appropriate detail rows — only fields the wire actually has.
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    1.dp,
                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                    RoundedCornerShape(24.dp),
                ),
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                DetailRow("Type", row.type.orEmpty().ifBlank { "Unknown" })
                val masked = maskAccountTail(row.accountNumber)
                if (masked.isNotBlank()) {
                    DetailRow(
                        if (isWallet) "Mobile Account" else "Card Number",
                        masked,
                    )
                }
                val holder = row.holderName?.takeIf(String::isNotBlank)
                if (holder != null) {
                    DetailRow("Holder", holder)
                }
                val network = row.cardNetwork?.takeIf(String::isNotBlank)
                if (network != null && !isWallet) {
                    DetailRow("Network", network)
                }
                val expiry = row.expiry?.takeIf(String::isNotBlank)
                if (expiry != null && !isWallet) {
                    DetailRow("Expiry", expiry)
                }
                val created = formatRelativeDate(row.createdAt)
                if (created.isNotBlank()) {
                    DetailRow("Added", created)
                }
            }
        }

        // Real delete affordance (DELETE api/payment-methods/{id}).
        OutlinedButton(
            onClick = onDelete,
            enabled = !deleting,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.error,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(44.dp),
        ) {
            if (deleting) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            } else {
                Text("Remove Payment Method", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(120.dp),
        )
        Text(
            value,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

/** Definitive miss: a pinned id the live list does not contain. */
@Composable
private fun DetailNotFoundCard(onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    "Payment method not found.",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = error,
                )
            }
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .height(36.dp),
            ) {
                Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
