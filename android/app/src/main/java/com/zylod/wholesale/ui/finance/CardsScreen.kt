package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.border
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
import com.zylod.wholesale.data.api.CardDto

/**
 * SHARED typed cards screen (pageId credit-debit-cards — the ui/screens
 * delegate calls THIS, so the page keeps its own CardsViewModel).
 *
 * Data truth: GET api/cards via [CardsViewModel] — the session user's REAL
 * card rows (tokenized last4 only; the PAN never survives the wire back).
 * The cardType label arrives from the server ('Debit Card' | 'Credit
 * Card'), the brand badge is the row's real network, expiry renders
 * verbatim MM/YY, and the Default badge is the row's real isDefault flag.
 * The DELETE affordance is real (DELETE api/cards/{id} — the [id] route
 * defines it, with a confirm dialog before the wire call). "Add Card"
 * jumps to the shared add-card form. Honest loading / sign-in / empty /
 * error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CardsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CardsViewModel = viewModel(key = "native-cards-$pageId") {
        CardsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var pendingDelete by remember { mutableStateOf<CardDto?>(null) }

    // Re-resolve on EVERY entry (BankAccountsScreen parity) — a card added
    // on the add page shows the moment the user lands back here.
    LaunchedEffect(Unit) { vm.load() }

    // One snackbar line for the honest action failures (delete/network).
    LaunchedEffect(state.actionError) {
        val message = state.actionError ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        vm.consumeActionError()
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { CardsTopBar(onBack = onBack) },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            if (!state.needsAuth && state.error == null) {
                ExtendedFloatingActionButton(
                    onClick = { openPage("add-card", "") },
                    icon = { Icon(Icons.Outlined.Add, null) },
                    text = { Text("Add Card", fontWeight = FontWeight.Bold) },
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
                    title = "Sign in to view your cards",
                    body = "Your saved debit and credit cards are tied to your account. Sign in to view, add, and remove them.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> CardsContent(
                    state = state,
                    onDeleteRequest = { pendingDelete = it },
                )
            }
        }
    }

    pendingDelete?.let { row ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = {
                Text(
                    "Remove card?",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                )
            },
            text = {
                Text(
                    "${row.brand.orEmpty().ifBlank { "This card" }} ending in " +
                        "${row.last4.orEmpty().ifBlank { "••••" }} will be removed from your account.",
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
private fun CardsTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Credit & Debit Cards",
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
private fun CardsContent(
    state: CardsUiState,
    onDeleteRequest: (CardDto) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved cards")
        }
        when {
            state.loading -> FinanceSkeleton()
            state.cards.isEmpty() -> FinanceEmptyCard(
                icon = Icons.Outlined.CreditCard,
                title = "No cards saved yet.",
                body = "Debit and credit cards you add for checkout show up here.",
            )
            else -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                state.cards.forEach { row ->
                    CardRowCard(
                        row = row,
                        deleting = state.deletingId == row.id,
                        onDelete = { onDeleteRequest(row) },
                    )
                }
            }
        }
    }
}

@Composable
private fun CardRowCard(
    row: CardDto,
    deleting: Boolean,
    onDelete: () -> Unit,
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
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.Top) {
            Icon(
                Icons.Outlined.CreditCard,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp).size(20.dp),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        cardTypeLabel(row.cardType),
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
                val brand = row.brand?.takeIf(String::isNotBlank)
                if (brand != null) {
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier.padding(top = 6.dp),
                    ) {
                        Text(
                            brand,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
                }
                Column(Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        "•••• ${row.last4.orEmpty().ifBlank { "····" }}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    val holder = row.holderName?.takeIf(String::isNotBlank)
                    if (holder != null) {
                        Text(holder, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    val expiry = row.expiry?.takeIf(String::isNotBlank)
                    if (expiry != null) {
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
                        "Remove card",
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}
