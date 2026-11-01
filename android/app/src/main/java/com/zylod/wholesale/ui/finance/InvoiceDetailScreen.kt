package com.zylod.wholesale.ui.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.outlined.Clock
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.OrderInvoiceDto
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed order tax-invoice screen (pageIds order-invoice AND
 * order-invoice-download — the download pageId is the web page's honest
 * thin-alias twin, so both delegates call THIS with their own pageId).
 *
 * Data truth: GET api/orders/{orderId}/invoice via [InvoiceDetailViewModel]
 * — the server-computed TAX INVOICE sheet: platform billing identity,
 * BILLED TO / SHIP TO (the real buyer of record), per-line items with the
 * supplier name, subtotal / shipping / discount (only when > 0) / "Total
 * (as charged)", the 15% VAT regulatory REFERENCE line (never summed into
 * the total — the web page's own honesty rule, mirrored), and the payment
 * information footnote.
 *
 * DOWNLOAD HONESTY: the web page's Print/Save PDF buttons only call
 * window.print() — there is NO real PDF endpoint anywhere. On the
 * order-invoice-download pageId this screen renders the full sheet and
 * labels download UNAVAILABLE in this build instead of pretending.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoiceDetailScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: InvoiceDetailViewModel = viewModel(key = "native-order-invoice-$pageId") {
        InvoiceDetailViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry — the query may carry a different order id
    // than the last visit.
    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            InvoiceDetailTopBar(
                title = if (pageId == "order-invoice-download") "Order Invoice Download" else "Order Invoice",
                onBack = onBack,
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                state.noId -> InvoiceGuardCard(
                    icon = Icons.Outlined.Info,
                    title = "No order selected",
                    body = "Open an order from your order history to view its invoice.",
                    actionLabel = "View My Orders",
                    onAction = { openPage("buyer-orders", "") },
                )
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in required",
                    body = "You need to be signed in to view invoices.",
                    onSignIn = { openPage("login", "") },
                )
                state.notFound -> InvoiceGuardCard(
                    icon = Icons.Outlined.ErrorOutline,
                    title = "Invoice not found",
                    body = "This order does not exist or has no invoice.",
                    actionLabel = "View My Orders",
                    onAction = { openPage("buyer-orders", "") },
                )
                state.forbidden -> InvoiceGuardCard(
                    icon = Icons.Outlined.Lock,
                    title = "Not authorized",
                    body = "Only the order's buyer, a supplier on the order, or an admin can view this invoice.",
                    actionLabel = null,
                    onAction = {},
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                state.loading -> FinanceSkeleton()
                else -> state.detail?.let { detail ->
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (state.offlineFromCache) {
                            FinanceOfflineBanner("Offline — showing the last saved invoice")
                        }
                        InvoiceActionsCard(detail = detail)
                        InvoiceSheet(detail = detail)
                        if (pageId == "order-invoice-download") {
                            DownloadHonestyCard()
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InvoiceDetailTopBar(title: String, onBack: (() -> Unit)?) {
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

/** The honest centered guard card for no-id / 404 / 403 (the web's cards). */
@Composable
private fun InvoiceGuardCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    body: String,
    actionLabel: String?,
    onAction: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 64.dp),
    ) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(40.dp))
        Text(
            title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            body,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        actionLabel?.let { label ->
            Button(
                onClick = onAction,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.padding(top = 20.dp),
            ) {
                Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Header card: "Invoice — Order #…", issued date, invoice number. */
@Composable
private fun InvoiceActionsCard(detail: OrderInvoiceDto) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(16.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "Invoice — Order #${detail.orderNumber.orEmpty()}",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Issued: ${formatMoneyDate(detail.invoiceDate).ifBlank { "—" }} · ${detail.invoiceNumber.orEmpty()}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            InvoicePaidChip(detail.paymentStatus)
        }
    }
}

@Composable
private fun InvoicePaidChip(paymentStatus: String?) {
    val paid = paymentStatus?.trim()?.lowercase() == "paid"
    val container = if (paid) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondaryContainer
    val content = if (paid) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSecondaryContainer
    Surface(color = container, shape = RoundedCornerShape(50)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        ) {
            Icon(
                if (paid) Icons.Outlined.CheckCircle else Icons.Outlined.Clock,
                null,
                tint = content,
                modifier = Modifier.size(12.dp),
            )
            Spacer(Modifier.width(4.dp))
            Text(
                if (paid) "PAID" else (paymentStatus?.trim()?.uppercase()?.takeIf(String::isNotEmpty) ?: "UNPAID"),
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                color = content,
            )
        }
    }
}

/** The invoice sheet — exactly the web page's sections and copy. */
@Composable
private fun InvoiceSheet(detail: OrderInvoiceDto) {
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
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            // Document header — company identity from the endpoint.
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "TAX INVOICE",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        detail.company?.name.orEmpty(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        buildString {
                            append(detail.company?.address.orEmpty())
                            append("\n")
                            append(detail.company?.city.orEmpty())
                            append(", ")
                            append(detail.company?.country.orEmpty())
                            append("\n")
                            append(detail.company?.taxId.orEmpty())
                        },
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.End,
                    )
                }
            }
            // BILLED TO / SHIP TO — the real buyer of record from the endpoint.
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                InvoicePartyBlock(
                    label = "BILLED TO",
                    name = detail.buyer?.businessName?.takeIf(String::isNotBlank)
                        ?: detail.buyer?.name.orEmpty(),
                    address = detail.buyer?.address.orEmpty(),
                    footnote = "Buyer of record on this order.",
                    modifier = Modifier.weight(1f),
                )
                InvoicePartyBlock(
                    label = "SHIP TO",
                    name = buildString {
                        append(detail.buyer?.city.orEmpty())
                        val district = detail.buyer?.district
                        if (!district.isNullOrBlank() && district != "N/A") append(", $district")
                    },
                    address = detail.buyer?.address.orEmpty(),
                    footnote = detail.buyer?.country.orEmpty(),
                    modifier = Modifier.weight(1f),
                )
            }
            // Items table — per-line supplier from the endpoint.
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "# · Item Description · Qty · Amount",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (detail.items.isEmpty()) {
                    Text(
                        "No items recorded on this order.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 12.dp),
                    )
                } else {
                    detail.items.forEachIndexed { index, item ->
                        Row(verticalAlignment = Alignment.Top) {
                            Text(
                                "${index + 1}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.width(24.dp),
                            )
                            Column(Modifier.weight(1f)) {
                                Text(
                                    item.productName.orEmpty(),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                                val subline = listOfNotNull(
                                    item.variant?.takeIf(String::isNotBlank),
                                    item.supplier?.takeIf(String::isNotBlank),
                                ).joinToString(" · ")
                                if (subline.isNotEmpty()) {
                                    Text(
                                        subline,
                                        fontSize = 10.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                            Text(
                                "${item.quantity ?: 0.0}",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.width(40.dp),
                            )
                            Text(
                                formatBdt(item.total ?: 0.0),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
            }
            // Financial breakdown — EVERY number server-computed. VAT is a
            // regulatory REFERENCE line, never summed into the charged total
            // (the web page's honesty rule, mirrored verbatim).
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                InvoiceTotalRow("Subtotal", formatBdt(detail.subtotal ?: 0.0))
                InvoiceTotalRow("Shipping & Handling", formatBdt(detail.shipping ?: 0.0))
                val discount = detail.discount ?: 0.0
                if (discount > 0.0) {
                    InvoiceTotalRow("Discounts applied", "− ${formatBdt(discount)}")
                }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom,
                ) {
                    Text(
                        "Total (as charged)",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        formatBdt(detail.grandTotal ?: 0.0),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Text(
                    "VAT (15%) regulatory reference: ${formatBdt(detail.tax ?: 0.0)}. " +
                        "This total is the amount actually charged for the order.",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            // Payment info footnote — from the endpoint's real payment records.
            Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "Payment Information",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Method: ${(detail.paymentMethod.orEmpty()).uppercase()} · Status: " +
                        "${(detail.paymentStatus.orEmpty()).uppercase()} · Reference: Order #${detail.orderNumber.orEmpty()}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "For any discrepancies regarding this invoice, contact ${detail.company?.email.orEmpty()} " +
                        "within 14 days of receipt. All goods remain the property of the supplier until fully paid.",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun InvoicePartyBlock(label: String, name: String, address: String, footnote: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(14.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            label,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            name,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            address,
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            footnote,
            fontSize = 9.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
private fun InvoiceTotalRow(label: String, value: String) {
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

/**
 * The honest download label: the web's Save PDF is window.print() — no PDF
 * endpoint exists anywhere, so this build says so instead of pretending.
 */
@Composable
private fun DownloadHonestyCard() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(14.dp),
        ) {
            Icon(
                Icons.Outlined.Info,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(10.dp))
            Text(
                "PDF export is not available in this build — the web app's download is a print action, " +
                    "not a real PDF endpoint. The full invoice is rendered above.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
