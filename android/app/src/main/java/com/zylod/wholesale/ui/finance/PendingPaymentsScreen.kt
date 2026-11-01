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
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Schedule
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.PendingPaymentRowDto
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed pending-clearances screen (pageId payment-pending — the
 * ui/screens delegate calls THIS, so the page keeps its own
 * [PendingPaymentsViewModel]).
 *
 * Data truth: GET api/payments/pending via [PendingPaymentsViewModel] — the
 * merged pipeline rendered as its TWO real sections (Order Payment
 * Clearance + Trade Assurance Escrow rows with the server's own escrow
 * description line), amounts + dates, and the "In Clearance Pipeline"
 * total banner (the honest sum of the loaded rows). Rows tap into the REAL
 * order-invoice document for that order. Honest loading / sign-in /
 * empty / error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PendingPaymentsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: PendingPaymentsViewModel = viewModel(key = "native-payment-pending-$pageId") {
        PendingPaymentsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            PendingTopBar(onBack = onBack)
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
                    title = "Sign in to view pending clearances",
                    body = "Pending clearances are the payment reports on your own orders. Sign in to see the real amounts.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> PendingContent(state = state, openPage = openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PendingTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Pending Clearances",
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
private fun PendingContent(state: PendingPaymentsUiState, openPage: (pageId: String, query: String) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved pending clearances")
        }
        when {
            state.loading -> FinanceSkeleton()
            state.rows.isEmpty() -> FinanceEmptyCard(
                icon = Icons.Outlined.CheckCircle,
                title = "Nothing pending — all payments settled",
                body = "No pending payments at this moment.",
            )
            else -> {
                // The banner total is the REAL sum of the loaded rows.
                PipelineBanner(total = state.rows.fold(0.0) { acc, row -> acc + (row.amount ?: 0.0) })
                val clearance = state.rows.filter { it.type == PENDING_TYPE_CLEARANCE }
                val escrow = state.rows.filter { it.type == PENDING_TYPE_ESCROW }
                val rest = state.rows.filter { it.type != PENDING_TYPE_CLEARANCE && it.type != PENDING_TYPE_ESCROW }
                if (clearance.isNotEmpty()) {
                    SectionHeader(label = PENDING_TYPE_CLEARANCE, count = clearance.size)
                    clearance.forEach { row ->
                        PendingRow(row = row, openPage = openPage)
                    }
                }
                if (escrow.isNotEmpty()) {
                    SectionHeader(label = PENDING_TYPE_ESCROW, count = escrow.size)
                    escrow.forEach { row ->
                        PendingRow(row = row, openPage = openPage)
                    }
                }
                // Shape-drift tolerance: an unknown type still renders honestly.
                if (rest.isNotEmpty()) {
                    SectionHeader(label = "Other Pending Items", count = rest.size)
                    rest.forEach { row ->
                        PendingRow(row = row, openPage = openPage)
                    }
                }
            }
        }
    }
}

/** "In Clearance Pipeline" banner with the honest row-sum total (web layout). */
@Composable
private fun PipelineBanner(total: Double) {
    val warning = MaterialTheme.colorScheme.tertiary
    Surface(
        color = warning.copy(alpha = 0.10f),
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, warning.copy(alpha = 0.25f), RoundedCornerShape(24.dp)),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(44.dp)
                        .background(warning.copy(alpha = 0.16f), RoundedCornerShape(14.dp)),
                ) {
                    Icon(Icons.Outlined.Schedule, null, tint = warning, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(
                        "In Clearance Pipeline",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = warning,
                    )
                    Text(
                        formatBdt(total),
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
            Text(
                "Payments reported but not yet verified. Orders stay UNPAID until Zylod verifies the payment.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SectionHeader(label: String, count: Int) {
    Text(
        "$label · $count",
        fontSize = 11.sp,
        fontWeight = FontWeight.Black,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 4.dp),
    )
}

/** One merged row: PO + type chip + initiated date + amount + description. */
@Composable
private fun PendingRow(row: PendingPaymentRowDto, openPage: (pageId: String, query: String) -> Unit) {
    val orderId = row.orderId
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
            .then(if (orderId.isNullOrBlank()) Modifier else Modifier.clickable {
                openPage("order-invoice", "orderId=$orderId")
            }),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(40.dp)
                        .background(
                            MaterialTheme.colorScheme.secondaryContainer,
                            RoundedCornerShape(14.dp),
                        ),
                ) {
                    Icon(
                        Icons.Outlined.Lock,
                        null,
                        tint = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "PO #${row.orderNumber.orEmpty()}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(Modifier.width(8.dp))
                        Surface(
                            color = MaterialTheme.colorScheme.secondaryContainer,
                            shape = RoundedCornerShape(50),
                        ) {
                            Text(
                                row.type.orEmpty(),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                color = MaterialTheme.colorScheme.onSecondaryContainer,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            )
                        }
                    }
                    Text(
                        "Initiated on ${formatMoneyDate(row.date).ifBlank { "—" }}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Text(
                    formatBdt(row.amount ?: 0.0),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            row.description?.takeIf(String::isNotBlank)?.let { description ->
                Text(
                    description,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(14.dp))
                        .padding(12.dp),
                )
            }
        }
    }
}
