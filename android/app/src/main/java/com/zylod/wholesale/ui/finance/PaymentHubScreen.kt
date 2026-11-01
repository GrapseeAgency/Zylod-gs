package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed payment-hub screen (pageId payment — the ui/screens delegate
 * calls THIS, so the page keeps its own [PaymentHubViewModel]).
 *
 * The web "?page=payment" component is the wallet-overview experience
 * (GenericFinancePage): a REAL balance strip, the saved methods, and the
 * payment surfaces one tap away. The native hub mirrors that intent
 * honestly: the REAL wallet balance (existing WalletApi — never redeclared),
 * the signed-in user's REAL default method row (FinanceApi.paymentMethods),
 * and links ONLY into live native surfaces — payment-history /
 * payment-pending / payment-failed / payment-method / add-payment-method /
 * wallet. No fabricated methods, no fake balance for guests.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentHubScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: PaymentHubViewModel = viewModel(key = "native-payment-hub-$pageId") {
        PaymentHubViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { HubTopBar(onBack = onBack) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in to manage your wallet",
                    body = "Your balance, top-ups, withdrawals, and saved payment methods are tied to your account. Sign in to continue.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> HubContent(state = state, openPage = openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HubTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Payment",
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
private fun HubContent(state: PaymentHubUiState, openPage: (pageId: String, query: String) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved snapshot")
        }
        if (state.loading) {
            FinanceSkeleton()
            return@Column
        }
        state.wallet?.let { wallet ->
            HubBalanceCard(
                balance = wallet.balance ?: 0.0,
                escrow = wallet.escrowBalance ?: 0.0,
                currency = wallet.currency.orEmpty(),
            )
        }
        HubDefaultMethodCard(
            method = state.defaultMethod,
            hasMethods = state.hasMethods,
            openPage = openPage,
        )
        HubSectionHeader("Payment Records")
        HubLinkCard(
            icon = Icons.Outlined.History,
            title = "Payment History",
            subtitle = "Every payment recorded on your orders",
            onClick = { openPage("payment-history", "") },
        )
        HubLinkCard(
            icon = Icons.Outlined.Schedule,
            title = "Pending Clearances",
            subtitle = "Payments reported but not yet verified",
            onClick = { openPage("payment-pending", "") },
        )
        HubLinkCard(
            icon = Icons.Outlined.Warning,
            title = "Failed Transactions",
            subtitle = "Gateway authorizations that did not complete",
            onClick = { openPage("payment-failed", "") },
        )
        HubSectionHeader("Methods & Wallet")
        HubLinkCard(
            icon = Icons.Outlined.CreditCard,
            title = "My Payment Methods",
            subtitle = "Mobile wallets and tokenized cards on file",
            onClick = { openPage("payment-method", "") },
        )
        HubLinkCard(
            icon = Icons.Outlined.Add,
            title = "Add Payment Method",
            subtitle = "bKash, Nagad, Upay, Rocket or a card",
            onClick = { openPage("add-payment-method", "") },
        )
        HubLinkCard(
            icon = Icons.Outlined.AccountBalanceWallet,
            title = "Open Wallet",
            subtitle = "Top up, withdraw and the full transaction history",
            onClick = { openPage("wallet", "") },
        )
    }
}

/** The real balance strip (the wallet route's numbers, BDT via WalletFormat). */
@Composable
private fun HubBalanceCard(balance: Double, escrow: Double, currency: String) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(20.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(48.dp)
                    .background(MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.08f), RoundedCornerShape(50)),
            ) {
                Icon(
                    Icons.Outlined.AccountBalanceWallet,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    "Available Balance${if (currency.isNotBlank()) " ($currency)" else ""}",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    formatBdt(balance),
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    "Held in escrow: ${formatBdt(escrow)}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                )
            }
        }
    }
}

/** The signed-in user's REAL default method row (or the honest empty line). */
@Composable
private fun HubDefaultMethodCard(
    method: com.zylod.wholesale.data.api.PaymentMethodRowDto?,
    hasMethods: Boolean,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .clickable { openPage("payment-method", "") },
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(16.dp),
        ) {
            Icon(
                Icons.Outlined.CreditCard,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                when {
                    method != null -> {
                        Text(
                            buildString {
                                append(method.label?.takeIf(String::isNotBlank)
                                    ?: method.type?.takeIf(String::isNotBlank)
                                    ?: "Payment method")
                                append(" · Default")
                            },
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            maskAccountTail(method.accountNumber),
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    hasMethods -> {
                        Text(
                            "No default payment method set",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "Tap to pick one from your saved methods",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    else -> {
                        Text(
                            "No payment method on file",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "Add a mobile wallet or a tokenized card to pay faster",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Icon(
                Icons.AutoMirrored.Outlined.ArrowForward,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

@Composable
private fun HubSectionHeader(label: String) {
    Text(
        label,
        fontSize = 11.sp,
        fontWeight = FontWeight.Black,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 4.dp),
    )
}

@Composable
private fun HubLinkCard(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(20.dp),
            )
            .clickable(onClick = onClick),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(16.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(38.dp)
                    .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(12.dp)),
            ) {
                Icon(icon, null, tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    subtitle,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Icon(
                Icons.AutoMirrored.Outlined.ArrowForward,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}
