package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.RequestQuote
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.zylod.wholesale.data.api.InvoiceRowDto
import com.zylod.wholesale.data.api.MushakInvoiceDto
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed commercial-invoices screen — ONE screen for THREE pageIds
 * (invoice-management, seller-tax-invoices, invoice), each delegate calling
 * THIS with its own pageId so the page keeps its own [InvoicesViewModel]
 * (TrackOrderScreen convention).
 *
 * Data truth: GET api/invoices via [InvoicesViewModel] — paymentStatus
 * filter chips with the route's REAL values (all/paid/pending, exact
 * match), rows with the INV- + MUSHAK-6.3- numbers (mono), buyer, item
 * count, grand total, status chip, issued + due dates. Row tap opens the
 * REAL order tax invoice (order-invoice pageId with orderId in query — the
 * web page's own file-icon affordance); the "Mushak 6.3" affordance opens
 * the GET api/invoices/{id} document dialog (the web page's primary
 * affordance). Honest loading / sign-in / empty / error / offline states.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoicesScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: InvoicesViewModel = viewModel(key = "native-invoices-$pageId") {
        InvoicesViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { InvoicesTopBar(title = invoicesTitle(pageId), onBack = onBack) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                state.needsAuth -> Column(Modifier.verticalScroll(rememberScrollState())) {
                    FinanceAuthGate(
                        title = "Sign in to view invoices",
                        body = "Commercial invoices are real VAT documents issued against your orders. Sign in to continue.",
                        onSignIn = { openPage("login", "") },
                    )
                }
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> InvoicesContent(state = state, vm = vm, openPage = openPage)
            }
        }
    }

    // The Mushak 6.3 document dialog (GET api/invoices/{id}) — the web
    // page's own secondary affordance, mirrored honestly with its loading
    // / error / document states.
    if (state.mushakOrderId != null) {
        MushakDialog(
            state = state,
            onClose = vm::closeMushak,
        )
    }
}

/** The three pageIds' honest titles (the web pages' own header labels). */
private fun invoicesTitle(pageId: String): String = when (pageId) {
    "invoice-management" -> "Commercial Invoices"
    "seller-tax-invoices" -> "Tax Invoices"
    else -> "Invoice"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InvoicesTopBar(title: String, onBack: (() -> Unit)?) {
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
private fun InvoicesContent(
    state: InvoicesUiState,
    vm: InvoicesViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "banner") {
            InvoicesBanner()
            Spacer(Modifier.height(6.dp))
            if (state.offline) {
                FinanceOfflineBanner("Offline — showing the last saved invoices")
                Spacer(Modifier.height(6.dp))
            }
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                INVOICE_STATUS_FILTERS.forEach { (value, label) ->
                    FilterChipButton(
                        label = label,
                        selected = state.filter == value,
                        onClick = { vm.setFilter(value) },
                    )
                }
            }
        }
        when {
            state.loading -> item(key = "loading") { FinanceSkeleton() }
            state.rows.isEmpty() -> item(key = "empty") {
                FinanceEmptyCard(
                    icon = Icons.Outlined.RequestQuote,
                    title = "No commercial invoices found",
                    body = "Mushak 6.3 tax documents issued against your orders show up here.",
                )
            }
            else -> items(state.rows, key = { it.stableKey }) { row ->
                InvoiceRow(
                    row = row,
                    onOpenInvoice = {
                        val id = row.id
                        if (!id.isNullOrBlank()) openPage("order-invoice", "orderId=$id")
                    },
                    onOpenMushak = {
                        val id = row.id
                        if (!id.isNullOrBlank()) vm.openMushak(id)
                    },
                )
            }
        }
    }
}

/** The web banner's copy (verbatim intent): VAT & Tax Commercial Invoices. */
@Composable
private fun InvoicesBanner() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
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
                    .size(44.dp)
                    .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(14.dp)),
            ) {
                Icon(
                    Icons.Outlined.ReceiptLong,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    "VAT & Tax Commercial Invoices",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Mushak 6.3 compliant tax documents for corporate audit filing.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** One invoice row: numbers, buyer, count, totals, dates, two affordances. */
@Composable
private fun InvoiceRow(
    row: InvoiceRowDto,
    onOpenInvoice: () -> Unit,
    onOpenMushak: () -> Unit,
) {
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
            ),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            row.invoiceNumber.orEmpty(),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(Modifier.width(8.dp))
                        InvoicePaymentStatusChip(row.paymentStatus)
                    }
                    Text(
                        "${row.mushakNumber.orEmpty()} · PO #${row.orderNumber.orEmpty()}",
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Text(
                    formatBdt(row.grandTotal ?: 0.0),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(14.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "Client: ${row.buyerName.orEmpty()}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    "${row.itemsCount} items · Issued ${formatMoneyDate(row.date).ifBlank { "—" }}" +
                        " · Due ${formatMoneyDate(row.dueDate).ifBlank { "—" }}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(
                    color = MaterialTheme.colorScheme.primary,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(onClick = onOpenMushak),
                ) {
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 10.dp),
                    ) {
                        Icon(Icons.Outlined.RequestQuote, null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "View Mushak 6.3",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    }
                }
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(onClick = onOpenInvoice),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    ) {
                        Icon(
                            Icons.Outlined.CreditCard,
                            "Full tax invoice",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
            }
        }
    }
}

/** The order's paymentStatus as a small uppercase pill (paid/pending/…). */
@Composable
private fun InvoicePaymentStatusChip(paymentStatus: String?) {
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer,
        shape = RoundedCornerShape(50),
    ) {
        Text(
            paymentStatus?.trim()?.uppercase()?.takeIf(String::isNotEmpty) ?: "UNKNOWN",
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSecondaryContainer,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

/** The GET api/invoices/{id} document dialog — loading / error / document. */
@Composable
private fun MushakDialog(state: InvoicesUiState, onClose: () -> Unit) {
    AlertDialog(
        onDismissRequest = onClose,
        title = {
            Text("Mushak 6.3 — Commercial Invoice", fontSize = 14.sp, fontWeight = FontWeight.Black)
        },
        text = {
            Column(
                Modifier
                    .fillMaxWidth()
                    .height(420.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                when {
                    state.mushakLoading -> Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 24.dp),
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        Text("Loading document…", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    state.mushakError != null -> {
                        val error = MaterialTheme.colorScheme.error
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(error.copy(alpha = 0.08f), RoundedCornerShape(12.dp))
                                .padding(12.dp),
                        ) {
                            Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(
                                state.mushakError,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = error,
                            )
                        }
                    }
                    else -> state.mushakDoc?.let { doc -> MushakDocumentBody(doc) }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onClose) { Text("Close") }
        },
    )
}

/** The Mushak document body — exactly the fields the web dialog renders. */
@Composable
private fun MushakDocumentBody(doc: MushakInvoiceDto) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(
                    doc.invoiceNumber.orEmpty(),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "${doc.mushakNumber.orEmpty()} · PO #${doc.orderNumber.orEmpty()}",
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Issued ${formatMoneyDate(doc.date).ifBlank { "—" }}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            InvoicePaymentStatusChip(doc.paymentStatus)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            doc.seller?.let { seller ->
                MushakPartyBlock(
                    label = "Seller",
                    name = seller.name.orEmpty(),
                    line = seller.address.orEmpty(),
                    footnote = "TIN ${seller.tin.orEmpty()} · BIN ${seller.bin.orEmpty()}",
                    modifier = Modifier.weight(1f),
                )
            }
            doc.buyer?.let { buyer ->
                MushakPartyBlock(
                    label = "Buyer",
                    name = buyer.name.orEmpty(),
                    line = buyer.address.orEmpty(),
                    footnote = "TIN ${buyer.tin.orEmpty()}",
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Column {
            Text(
                "Item · Qty · Amount",
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 4.dp),
            )
            doc.items.forEach { item ->
                Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            item.name.orEmpty(),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "৳${item.unitPrice ?: 0.0} / ${item.unit.orEmpty()}",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        "${item.quantity ?: 0.0}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.width(44.dp),
                    )
                    Text(
                        formatBdt(item.totalPrice ?: 0.0),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
        Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            MushakTotalRow("Subtotal", formatBdt(doc.subtotal ?: 0.0))
            MushakTotalRow("Shipping", formatBdt(doc.shippingCost ?: 0.0))
            MushakTotalRow("VAT (${doc.vatRate.orEmpty()})", formatBdt(doc.vatAmount ?: 0.0))
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                Text(
                    "Grand Total",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    formatBdt(doc.grandTotal ?: 0.0),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Text(
                "Payment method: ${doc.paymentMethod.orEmpty()} · status ${doc.paymentStatus.orEmpty()}.",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun MushakPartyBlock(label: String, name: String, line: String, footnote: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(1.dp),
    ) {
        Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(name, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        Text(line, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(footnote, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun MushakTotalRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            value,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}
