package com.zylod.wholesale.ui.orderdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.GppMaybe
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material.icons.outlined.Wallet
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.zylod.wholesale.data.api.OrderDetailItem
import com.zylod.wholesale.data.api.OrderDetailOrder
import com.zylod.wholesale.data.api.OrderDetailPayment
import com.zylod.wholesale.data.api.OrderDetailReceipt
import com.zylod.wholesale.data.api.OrderDetailSubOrder
import com.zylod.wholesale.data.api.OrderDetailTracking
import com.zylod.wholesale.data.api.apiQty
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.logistics.formatTaka
import com.zylod.wholesale.ui.wallet.formatBdt
import kotlinx.serialization.json.Json
import java.util.Locale

/**
 * t274 — TYPED BUYER ORDER DETAIL (pageId "order-detail"): the Kotlin port
 * of order-detail-page.tsx. Replaces the t233 shared NativePageBody renderer
 * for this pageId — the page model could only list "my-orders" rows; the
 * typed screen renders the REAL order: the status stepper, per-supplier
 * shipments with line items + the tracking timeline, the payment summary
 * with the manual-payment leg (Task 56-b), self-service cancellation
 * (Task 57-a/58), the receiving-account instructions (Task 128-a) and the
 * receipt (Task 128-c). Every HTTP failure renders its own honest wall —
 * no mock rows, no fabricated states, ever.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: OrderDetailViewModel = viewModel(key = "order-detail") {
        OrderDetailViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(query) { vm.start(query) }
    // Success banners self-clear like the web toasts they mirror.
    LaunchedEffect(state.payNotice, state.cancelNotice) {
        if (state.payNotice.isNotEmpty() || state.cancelNotice.isNotEmpty()) {
            kotlinx.coroutines.delay(6000)
            vm.clearNotice()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { OrderDetailTopBar(state = state, onBack = onBack, openPage = openPage) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) { CircularProgressIndicator() }

                !state.hasOrderId -> OrderDetailNoOrderWall(openPage = openPage)
                state.needsAuth -> OrderDetailSignInWall(openPage = openPage)
                state.notFound -> OrderDetailNotFoundWall(openPage = openPage)
                state.error.isNotEmpty() -> OrderDetailErrorWall(
                    message = state.error,
                    onRetry = { vm.retry() },
                )

                else -> {
                    val order = state.order ?: return@Box
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        if (state.payNotice.isNotEmpty()) {
                            item(key = "pay-notice") {
                                OrderDetailNoticeBanner(
                                    message = state.payNotice,
                                    tone = OrderDetailNoticeTone.SUCCESS,
                                )
                            }
                        }
                        if (state.cancelNotice.isNotEmpty()) {
                            item(key = "cancel-notice") {
                                OrderDetailNoticeBanner(
                                    message = state.cancelNotice,
                                    tone = OrderDetailNoticeTone.SUCCESS,
                                )
                            }
                        }
                        item(key = "status") {
                            OrderDetailStatusCard(order = order, vm = vm, openPage = openPage)
                        }
                        item(key = "items") {
                            OrderDetailShipmentsCard(order = order, vm = vm, state = state)
                        }
                        item(key = "payment") {
                            OrderDetailPaymentCard(order = order, vm = vm, state = state, openPage = openPage)
                        }
                        item(key = "shipping") {
                            OrderDetailShippingCard(order = order)
                        }
                    }

                    if (state.cancelDialogOpen) {
                        OrderDetailCancelDialog(state = state, vm = vm)
                    }
                    if (state.payDialogOpen) {
                        OrderDetailPayDialog(state = state, vm = vm)
                    }
                    if (state.receiptOpen) {
                        OrderDetailReceiptDialog(state = state, vm = vm)
                    }
                }
            }
        }
    }
}

/* ─── chrome ─────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OrderDetailTopBar(
    state: OrderDetailUiState,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    TopAppBar(
        title = {
            Text(
                if (state.order?.orderNumber != null) "Order #${state.order.orderNumber}" else "Order Detail",
                fontSize = 17.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = MaterialTheme.colorScheme.onSurface)
                }
            }
        },
        actions = {
            if (state.order != null) {
                IconButton(onClick = { openPage("help-center", "") }) {
                    Icon(Icons.Outlined.SupportAgent, "Help", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/* ─── honest guard walls (web verbatim copy) ─────────────────────────────── */

@Composable
private fun OrderDetailNoOrderWall(openPage: (pageId: String, query: String) -> Unit) {
    OrderDetailWall(
        icon = { Icon(Icons.Outlined.ReceiptLong, null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(38.dp)) },
        title = "No order selected",
        body = "Pick an order from your order history to see its details.",
        ctaLabel = "View My Orders",
        onCta = { openPage("buyer-orders", "") },
    )
}

@Composable
private fun OrderDetailSignInWall(openPage: (pageId: String, query: String) -> Unit) {
    OrderDetailWall(
        icon = { Icon(Icons.Outlined.Lock, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(38.dp)) },
        title = "Sign in required",
        body = "You need to be signed in to view this order.",
        ctaLabel = "Sign In",
        onCta = { openPage("login", "") },
    )
}

@Composable
private fun OrderDetailNotFoundWall(openPage: (pageId: String, query: String) -> Unit) {
    OrderDetailWall(
        icon = { Icon(Icons.Outlined.ErrorOutline, null, tint = MaterialTheme.colorScheme.outline, modifier = Modifier.size(38.dp)) },
        title = "Order not found",
        body = "This order does not exist or is not visible to your account.",
        ctaLabel = "View My Orders",
        onCta = { openPage("buyer-orders", "") },
    )
}

@Composable
private fun OrderDetailErrorWall(message: String, onRetry: () -> Unit) {
    OrderDetailWall(
        icon = { Icon(Icons.Outlined.Warning, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(38.dp)) },
        title = "Could not load order",
        body = message,
        ctaLabel = "Retry",
        onCta = onRetry,
    )
}

@Composable
private fun OrderDetailWall(
    icon: @Composable () -> Unit,
    title: String,
    body: String,
    ctaLabel: String,
    onCta: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        icon()
        Spacer(Modifier.height(12.dp))
        Text(title, fontSize = 15.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(
            body,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = onCta,
            shape = RoundedCornerShape(12.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 10.dp),
        ) {
            Text(ctaLabel, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun OrderDetailNoticeBanner(message: String, tone: OrderDetailNoticeTone) {
    val (bg, fg) = when (tone) {
        OrderDetailNoticeTone.SUCCESS ->
            MaterialTheme.colorScheme.primary.copy(alpha = 0.08f) to MaterialTheme.colorScheme.primary
        OrderDetailNoticeTone.ERROR ->
            MaterialTheme.colorScheme.error.copy(alpha = 0.08f) to MaterialTheme.colorScheme.error
    }
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = bg,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Check, null, tint = fg, modifier = Modifier.size(15.dp))
            Spacer(Modifier.width(8.dp))
            Text(message, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = fg)
        }
    }
}

private enum class OrderDetailNoticeTone { SUCCESS, ERROR }

/* ─── status card + 4-step stepper ───────────────────────────────────────── */

@Composable
private fun OrderDetailStatusCard(
    order: OrderDetailOrder,
    vm: OrderDetailViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val status = vm.deriveStatus(order)
    val statuses = order.subOrders.map { (it.status ?: "pending").lowercase(Locale.US) }
    val stepPacked = statuses.any { it in listOf("processing", "packed", "shipped", "delivered") }
    val stepShipped = statuses.any { it in listOf("shipped", "delivered") }
    val stepDelivered = statuses.isNotEmpty() && statuses.all { it == "delivered" }
    val estDelivery = order.subOrders
        .mapNotNull { it.estimatedDelivery }
        .filter { it.isNotBlank() }
        .minOrNull()
    val hasPendingVerification = order.payments.any { it.status == "pending" }
    val paymentStatusLabel = (order.paymentStatus ?: "unpaid").uppercase(Locale.US)

    OrderDetailCard {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(
                    "Order #${order.orderNumber ?: "--"}",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    "Placed ${com.zylod.wholesale.ui.logistics.logisticsDateLabel(order.placedAt) ?: "--"}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            OutlinedButton(
                onClick = { openPage("track-order", "orderId=${order.id}") },
                shape = RoundedCornerShape(10.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                modifier = Modifier.height(34.dp),
            ) {
                Text("Track Order", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(Modifier.height(10.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OrderDetailChip(
                text = status.replaceFirstChar { it.uppercase(Locale.US) },
                bg = MaterialTheme.colorScheme.surfaceVariant,
                fg = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OrderDetailChip(
                text = paymentStatusLabel,
                bg = if (order.paymentStatus == "paid") {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)
                } else {
                    MaterialTheme.colorScheme.error.copy(alpha = 0.08f)
                },
                fg = if (order.paymentStatus == "paid") {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.error
                },
            )
            if (hasPendingVerification) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Schedule, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(11.dp))
                    Spacer(Modifier.width(3.dp))
                    Text(
                        "PAYMENT VERIFICATION PENDING",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        letterSpacing = 0.6.sp,
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        Text(
            if (estDelivery != null) {
                "Estimated Delivery: ${com.zylod.wholesale.ui.logistics.logisticsDateLabel(estDelivery) ?: "--"}"
            } else {
                "Estimated delivery: to be scheduled by the supplier"
            },
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(14.dp))
        OrderDetailStepper(stepPacked, stepShipped, stepDelivered)
    }
}

@Composable
private fun OrderDetailChip(text: String, bg: androidx.compose.ui.graphics.Color, fg: androidx.compose.ui.graphics.Color) {
    Surface(shape = RoundedCornerShape(50), color = bg) {
        Text(
            text,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            color = fg,
            letterSpacing = 0.6.sp,
            modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun OrderDetailStepper(stepPacked: Boolean, stepShipped: Boolean, stepDelivered: Boolean) {
    val active = MaterialTheme.colorScheme.primary
    val inactive = MaterialTheme.colorScheme.surfaceVariant
    val inactiveFg = MaterialTheme.colorScheme.onSurfaceVariant

    @Composable
    fun Step(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, done: Boolean) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Surface(
                shape = CircleShape,
                color = if (done) active else inactive,
                modifier = Modifier.size(30.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        icon,
                        null,
                        tint = if (done) MaterialTheme.colorScheme.onPrimary else inactiveFg,
                        modifier = Modifier.size(15.dp),
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(
                label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = if (done) active else inactiveFg,
            )
        }
    }

    @Composable
    fun RowScope.Bar(done: Boolean) {
        Box(
            Modifier
                .weight(1f)
                .height(2.dp)
                .background(if (done) active else inactive),
        )
    }

    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 6.dp)) {
        Step(Icons.Outlined.Check, "Placed", true)
        Bar(true)
        Step(Icons.Outlined.Inventory, "Packed", stepPacked)
        Bar(stepPacked)
        Step(Icons.Outlined.LocalShipping, "Shipped", stepShipped)
        Bar(stepShipped)
        Step(Icons.Outlined.Home, "Delivered", stepDelivered)
    }
}

/* ─── items card — grouped by shipment (Task 58) ─────────────────────────── */

@Composable
private fun OrderDetailShipmentsCard(
    order: OrderDetailOrder,
    vm: OrderDetailViewModel,
    state: OrderDetailUiState,
) {
    val allItems = order.subOrders.flatMap { it.items }
    val cancellable = vm.canCancelOrder(order)

    OrderDetailCard {
        Text(
            "Items in Order (${allItems.size})",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.height(10.dp))
        if (order.subOrders.isEmpty() || allItems.isEmpty()) {
            Text(
                "No items recorded on this order.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp),
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                order.subOrders.forEach { so ->
                    val soStatus = (so.status ?: "pending").lowercase(Locale.US)
                    OrderDetailShipmentBlock(
                        subOrder = so,
                        statusLabel = soStatus,
                        cancellable = cancellable && (soStatus == "pending" || soStatus == "confirmed") && order.subOrders.size > 1,
                        cancelling = state.cancelling,
                        onCancelShipment = { vm.requestCancelShipment(so.id, so.supplier?.companyName ?: "Supplier") },
                    )
                }
            }
        }
    }
}

@Composable
private fun OrderDetailShipmentBlock(
    subOrder: OrderDetailSubOrder,
    statusLabel: String,
    cancellable: Boolean,
    cancelling: Boolean,
    onCancelShipment: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Storefront, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(6.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        "Shipment · ${subOrder.supplier?.companyName ?: "Supplier"}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        letterSpacing = 0.5.sp,
                    )
                    Text(statusLabel, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (cancellable) {
                    Text(
                        "Cancel this shipment",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .border(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                            .clickable(enabled = !cancelling, onClick = onCancelShipment)
                            .padding(horizontal = 8.dp, vertical = 5.dp),
                    )
                }
            }
            Spacer(Modifier.height(6.dp))
            subOrder.items.forEach { item ->
                OrderDetailItemRow(item = item)
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))
            }
            if (subOrder.tracking.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                OrderDetailShipmentTimeline(subOrder.tracking)
            }
        }
    }
}

@Composable
private fun OrderDetailItemRow(item: OrderDetailItem) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(vertical = 8.dp),
    ) {
        val thumb = item.product?.thumbnailUrl
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.size(60.dp),
        ) {
            if (thumb != null) {
                AsyncImage(
                    model = thumb,
                    contentDescription = item.product?.name ?: "Product",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Outlined.Inventory,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                item.product?.name ?: "--",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))
            val variantLine = item.variant?.let { "${it.variantName}: ${it.variantValue}" }
            val unitLine = item.product?.unit?.let { "Sold per $it" }
            Text(
                listOfNotNull(variantLine, unitLine).joinToString(" · ").ifEmpty { "--" },
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    formatTaka(item.totalPrice ?: 0.0),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "(${formatTaka(item.unitPrice ?: 0.0)}/unit)",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.weight(1f))
                Surface(shape = RoundedCornerShape(6.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                    Text(
                        "Qty: ${item.quantity.apiQty()}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp),
                    )
                }
            }
        }
    }
}

/**
 * Task 80 — the REAL tracking timeline for ONE shipment: newest-first rows,
 * collapsed shows the latest event; expanding shows the full history.
 */
@Composable
private fun OrderDetailShipmentTimeline(rows: List<OrderDetailTracking>) {
    var open by remember { mutableStateOf(false) }
    val ordered = rows.sortedByDescending { it.trackedAt ?: "" }
    if (ordered.isEmpty()) return

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(10.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { open = !open }
                    .padding(vertical = 6.dp),
            ) {
                Icon(Icons.Outlined.LocalShipping, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    "Tracking timeline (${ordered.size} event${if (ordered.size == 1) "" else "s"})",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    letterSpacing = 0.5.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    if (open) "Hide" else "Show all",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(4.dp))
            val visible = if (open) ordered else ordered.take(1)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                visible.forEachIndexed { index, row ->
                    OrderDetailTimelineRow(
                        row = row,
                        isLast = index == visible.lastIndex,
                    )
                }
            }
        }
    }
}

@Composable
private fun OrderDetailTimelineRow(row: OrderDetailTracking, isLast: Boolean) {
    val st = timelineColors(row.status ?: "pending")
    Row {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier
                    .size(10.dp)
                    .background(st.first, CircleShape),
            )
            if (!isLast) {
                Box(
                    Modifier
                        .width(1.dp)
                        .height(26.dp)
                        .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)),
                )
            }
        }
        Spacer(Modifier.width(10.dp))
        Column {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Surface(shape = RoundedCornerShape(50), color = st.second) {
                    Text(
                        (row.status ?: "pending").replace('_', ' ').uppercase(Locale.US),
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        color = st.third,
                        letterSpacing = 0.5.sp,
                        modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp),
                    )
                }
                if (!row.location.isNullOrBlank()) {
                    Text(
                        row.location,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Text(
                    com.zylod.wholesale.ui.logistics.logisticsDateTimeLabel(row.trackedAt),
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (!row.note.isNullOrBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    row.note,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** Task 80 timeline colors — honest dot/chip/text triple per real status.
 *  Pure color math (no Composition reads) — the pending fallback matches the
 *  web's slate palette. */
private fun timelineColors(status: String): Triple<androidx.compose.ui.graphics.Color, androidx.compose.ui.graphics.Color, androidx.compose.ui.graphics.Color> {
    return when (status) {
        "delivered" -> Triple(
            androidx.compose.ui.graphics.Color(0xFF10B981),
            androidx.compose.ui.graphics.Color(0xFF10B981).copy(alpha = 0.12f),
            androidx.compose.ui.graphics.Color(0xFF047857),
        )
        "cancelled", "returned" -> Triple(
            androidx.compose.ui.graphics.Color(0xFFEF4444),
            androidx.compose.ui.graphics.Color(0xFFEF4444).copy(alpha = 0.12f),
            androidx.compose.ui.graphics.Color(0xFFB91C1C),
        )
        "confirmed", "packed" -> Triple(
            androidx.compose.ui.graphics.Color(0xFFF59E0B),
            androidx.compose.ui.graphics.Color(0xFFF59E0B).copy(alpha = 0.12f),
            androidx.compose.ui.graphics.Color(0xFFB45309),
        )
        "picked_up", "shipped", "in_transit", "out_for_delivery" -> Triple(
            androidx.compose.ui.graphics.Color(0xFF0EA5E9),
            androidx.compose.ui.graphics.Color(0xFF0EA5E9).copy(alpha = 0.12f),
            androidx.compose.ui.graphics.Color(0xFF0369A1),
        )
        else -> Triple(
            androidx.compose.ui.graphics.Color(0xFF94A3B8),
            androidx.compose.ui.graphics.Color(0xFFF1F5F9),
            androidx.compose.ui.graphics.Color(0xFF475569),
        )
    }
}

/* ─── payment summary card ───────────────────────────────────────────────── */

@Composable
private fun OrderDetailPaymentCard(
    order: OrderDetailOrder,
    vm: OrderDetailViewModel,
    state: OrderDetailUiState,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val buyerJson = remember { SessionManager.userJson() }
    val buyerId = remember(buyerJson) { parseBuyerId(buyerJson) }
    val subtotal = order.subOrders.sumOf { it.subtotal }
    val shipping = order.subOrders.sumOf { it.shippingCost }
    val shippingMethodNames = order.subOrders
        .mapNotNull { it.shippingMethodName }
        .filter { it.isNotBlank() }
        .distinct()
    val verifiedPaid = vm.verifiedPaid(order)
    val remainingDue = vm.remainingDue(order)
    val canSubmit = buyerId == order.buyerId &&
        (order.paymentStatus == "unpaid" || order.paymentStatus == "partial")
    val canCancel = vm.canCancelOrder(order)
    val hasPendingVerification = order.payments.any { it.status == "pending" }

    OrderDetailCard {
        Text(
            "Payment Summary",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.height(10.dp))
        OrderDetailMoneyRow("Subtotal", formatTaka(subtotal))
        Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
            Column(Modifier.weight(1f)) {
                Text("Shipping", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (shippingMethodNames.isNotEmpty()) {
                    Text(
                        shippingMethodNames.joinToString(" · "),
                        fontSize = 9.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Text(
                if (shipping == 0.0) "With supplier" else formatTaka(shipping),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (shipping == 0.0) {
                    androidx.compose.ui.graphics.Color(0xFF059669)
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
            )
        }
        if ((order.promotionDiscount ?: 0.0) > 0.0) {
            Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                Text(
                    "Promotion${order.promotionName?.let { " · $it" } ?: ""}",
                    fontSize = 11.sp,
                    color = androidx.compose.ui.graphics.Color(0xFF059669),
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "−${formatTaka(order.promotionDiscount ?: 0.0)}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = androidx.compose.ui.graphics.Color(0xFF059669),
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text("Total", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f))
            Text(
                formatTaka(order.totalAmount),
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
        }

        /* ── manual payment leg (Task 56-b) ── */
        if (canSubmit) {
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { vm.openPayDialog() },
                enabled = !state.paySubmitting,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(44.dp),
            ) {
                Icon(Icons.Outlined.Wallet, null, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    if (order.paymentStatus == "partial") {
                        "Submit payment for remaining ${formatTaka(remainingDue)}"
                    } else {
                        "Submit payment"
                    },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(
                "Paid outside the app? Send money to the seller's bKash / bank, then submit the transaction reference here. The seller verifies it before the order is marked paid.",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 14.sp,
            )
        }

        /* ── self-service cancellation (Task 57-a) ── */
        if (canCancel) {
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = { vm.requestCancelOrder() },
                enabled = !state.cancelling,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error,
                ),
                modifier = Modifier.fillMaxWidth().height(44.dp),
            ) {
                Icon(Icons.Outlined.Block, null, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(6.dp))
                Text("Cancel order", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(6.dp))
            Text(
                "Cancelling restores the stock and voids any pending payment reference. Once the seller packs or ships, contact the supplier instead.",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 14.sp,
            )
        }

        /* ── real payment records ── */
        Spacer(Modifier.height(12.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
        Spacer(Modifier.height(10.dp))
        if (order.payments.isEmpty()) {
            Text(
                "No payments recorded yet. Orders start UNPAID — payment is confirmed only after verification.",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 14.sp,
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                order.payments.forEach { p ->
                    OrderDetailPaymentRow(payment = p)
                }
            }
        }

        /* ── actions ── */
        Spacer(Modifier.height(12.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
        Spacer(Modifier.height(10.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = { openPage("order-invoice", "orderId=${order.id}") },
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(44.dp),
            ) {
                Icon(Icons.Outlined.Download, null, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(6.dp))
                Text("View Invoice", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            val statuses = order.subOrders.map { (it.status ?: "pending").lowercase(Locale.US) }
            if (!statuses.all { it in listOf("delivered", "cancelled", "returned") }) {
                OutlinedButton(
                    onClick = { openPage("reschedule-delivery", "orderId=${order.id}") },
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                ) {
                    Icon(Icons.Outlined.CalendarToday, null, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Reschedule Delivery", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            if (order.paymentStatus == "paid" || order.paymentStatus == "partial") {
                OutlinedButton(
                    onClick = { vm.openReceipt() },
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                ) {
                    Icon(Icons.Outlined.ReceiptLong, null, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("View Receipt", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.error.copy(alpha = 0.06f),
                modifier = Modifier.weight(1f).clickable { openPage("submit-ticket", "orderId=${order.id}") },
            ) {
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(vertical = 10.dp),
                ) {
                    Icon(Icons.Outlined.GppMaybe, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Raise Dispute", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                }
            }
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.weight(1f).clickable { openPage("report-user", "orderId=${order.id}") },
            ) {
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(vertical = 10.dp),
                ) {
                    Icon(Icons.Outlined.Flag, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Report Seller", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                "Payment Verification Rules",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.clickable { openPage("escrow-protection-guide", "") },
            )
            Text(
                "Buyer Protection Policy",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.clickable { openPage("buyer-protection-policy", "") },
            )
        }
    }
}

@Composable
private fun OrderDetailPaymentRow(payment: OrderDetailPayment) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.CreditCard, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(13.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            (payment.method ?: "--").replace('_', ' '),
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Column(horizontalAlignment = Alignment.End) {
            Text(
                formatTaka(payment.amount),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                if (payment.status == "pending") "verification pending" else (payment.status ?: "--"),
                fontSize = 9.sp,
                color = if (payment.status == "pending") {
                    androidx.compose.ui.graphics.Color(0xFF0284C7)
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
                fontWeight = if (payment.status == "pending") FontWeight.Bold else FontWeight.Normal,
            )
        }
    }
}

@Composable
private fun OrderDetailMoneyRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Text(value, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
    }
}

/* ─── shipping & billing card ────────────────────────────────────────────── */

@Composable
private fun OrderDetailShippingCard(order: OrderDetailOrder) {
    OrderDetailCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.LocalShipping, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text("Shipping Address", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        }
        Spacer(Modifier.height(6.dp))
        val addr = order.shippingAddress
        if (addr != null) {
            Column(Modifier.padding(start = 20.dp)) {
                if (!addr.label.isNullOrBlank()) {
                    Text(addr.label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                }
                Text(addr.addressLine1 ?: "--", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (!addr.addressLine2.isNullOrBlank()) {
                    Text(addr.addressLine2, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(
                    listOfNotNull(
                        addr.city,
                        addr.district,
                        addr.postalCode,
                    ).joinToString(", "),
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            Row(Modifier.padding(start = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Place, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(5.dp))
                Text("No shipping address on file for this order.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Spacer(Modifier.height(12.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.CreditCard, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text("Billed To", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        }
        Spacer(Modifier.height(6.dp))
        Column(Modifier.padding(start = 20.dp)) {
            val buyerName = remember { parseBuyerDisplayName(SessionManager.userJson()) }
            Text(buyerName, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            val email = remember { parseBuyerEmail(SessionManager.userJson()) }
            if (email != null) {
                Text(email, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            val statusLabel = (order.paymentStatus ?: "unpaid").lowercase(Locale.US)
            Text(
                "Payment status: $statusLabel" + if (order.paymentStatus != "paid") " — verified payment required before shipment" else "",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun OrderDetailCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), content = content)
    }
}

/* ─── cancel dialog (Task 57-a / 58) ─────────────────────────────────────── */

@Composable
private fun OrderDetailCancelDialog(state: OrderDetailUiState, vm: OrderDetailViewModel) {
    AlertDialog(
        onDismissRequest = { vm.dismissCancel() },
        title = {
            Text(
                if (state.cancelShipmentId != null) "Cancel this shipment?" else "Cancel this order?",
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
            )
        },
        text = {
            Column {
                Text(
                    if (state.cancelShipmentId != null) {
                        "Shipment · ${state.cancelShipmentLabel} will be cancelled and its stock restored. Other shipments keep their state."
                    } else {
                        "Every shipment still pending or confirmed will be cancelled, the stock restored and any pending payment reference voided. This cannot be undone."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 16.sp,
                )
                if (state.cancelError.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(state.cancelError, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { vm.confirmCancel() },
                enabled = !state.cancelling,
            ) {
                if (state.cancelling) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                } else {
                    Text("Cancel order", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        dismissButton = {
            TextButton(onClick = { vm.dismissCancel() }, enabled = !state.cancelling) {
                Text("Keep order", fontSize = 12.sp)
            }
        },
    )
}

/* ─── submit-payment dialog (Task 56-b) ──────────────────────────────────── */

@Composable
private fun OrderDetailPayDialog(state: OrderDetailUiState, vm: OrderDetailViewModel) {
    val order = state.order ?: return
    // Dialog-open side effect + t277-1a: keyed on the SELECTED method so a
    // method switch refires the instructions fetch for that method (the VM
    // clears the stale rail in updatePayMethod).
    LaunchedEffect(state.payMethodIdx) { vm.fetchPayInstructions() }
    AlertDialog(
        onDismissRequest = { vm.dismissPayDialog() },
        title = {
            Text(
                "Submit payment for order #${order.orderNumber ?: "--"}",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
            ) {
                Text(
                    "Record how you paid outside the app. The seller verifies the reference before the order is marked paid — false references are rejected and audited.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 15.sp,
                )
                Spacer(Modifier.height(10.dp))
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            if (order.paymentStatus == "partial") "Remaining due" else "Order total",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            formatTaka(
                                if (order.paymentStatus == "partial") vm.remainingDue(order) else order.totalAmount
                            ),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text("Method *", fontSize = 9.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurfaceVariant, letterSpacing = 0.6.sp)
                Spacer(Modifier.height(6.dp))
                OrderDetailMethodChips(state = state, vm = vm)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = state.payTrxId,
                    onValueChange = { vm.updatePayTrxId(it) },
                    label = { Text("Transaction reference *", fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = state.paySender,
                    onValueChange = { vm.updatePaySender(it) },
                    label = { Text("Sender number (optional)", fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = state.payNote,
                    onValueChange = { vm.updatePayNote(it) },
                    label = { Text("Note (optional)", fontSize = 11.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp),
                )
                state.payInstructions?.let { instructions ->
                    if (instructions.isNotEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "Send the money to",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    letterSpacing = 0.6.sp,
                                )
                                instructions.forEach { (k, v) ->
                                    Row {
                                        Text(
                                            "$k: ",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.onSurface,
                                        )
                                        Text(v, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                    }
                }
                if (state.payInstructionsLoading) {
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.size(12.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(6.dp))
                        Text("Loading payment details…", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (state.payInstructionsError.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(state.payInstructionsError, fontSize = 10.sp, color = MaterialTheme.colorScheme.error)
                }
                if (state.payError.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(state.payError, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { vm.submitPayment() }, enabled = !state.paySubmitting) {
                if (state.paySubmitting) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                } else {
                    Text("Submit", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        },
        dismissButton = {
            TextButton(onClick = { vm.dismissPayDialog() }, enabled = !state.paySubmitting) {
                Text("Close", fontSize = 12.sp)
            }
        },
    )
}

@Composable
private fun OrderDetailMethodChips(state: OrderDetailUiState, vm: OrderDetailViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        OrderDetailViewModel.PAYMENT_METHOD_OPTIONS.forEachIndexed { idx, option ->
            FilterChip(
                selected = state.payMethodIdx == idx,
                onClick = { vm.updatePayMethod(idx) },
                label = {
                    Text(
                        option.label,
                        fontSize = 11.sp,
                        fontWeight = if (state.payMethodIdx == idx) FontWeight.Bold else FontWeight.Normal,
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                    selectedLabelColor = MaterialTheme.colorScheme.primary,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/* ─── receipt dialog (Task 128-c) ────────────────────────────────────────── */

@Composable
private fun OrderDetailReceiptDialog(state: OrderDetailUiState, vm: OrderDetailViewModel) {
    AlertDialog(
        onDismissRequest = { vm.dismissReceipt() },
        title = {
            Text(
                "Receipt — order #${state.receipt?.orderNumber ?: state.order?.orderNumber ?: "--"}",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
            )
        },
        text = {
            Column {
                when {
                    state.receiptLoading -> Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                        Text("Loading receipt…", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    state.receiptError.isNotEmpty() ->
                        Text(state.receiptError, fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                    state.receipt != null -> OrderDetailReceiptBody(state.receipt)
                    else -> Text("No receipt data.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { vm.dismissReceipt() }) { Text("Close", fontSize = 12.sp) }
        },
    )
}

@Composable
private fun OrderDetailReceiptBody(receipt: OrderDetailReceipt) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Order date: ${com.zylod.wholesale.ui.logistics.logisticsDateLabel(receipt.orderDate) ?: "--"}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Payment: ${(receipt.paymentMethod ?: "--").replace('_', ' ')} · ${(receipt.paymentStatus ?: "--").uppercase(Locale.US)}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(6.dp))
        receipt.items.forEach { item ->
            Row(Modifier.fillMaxWidth()) {
                Column(Modifier.weight(1f)) {
                    Text(item.productName ?: "--", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    Text("Qty ${item.quantity.apiQty()} · ${formatTaka(item.unitPrice)} each", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(formatTaka(item.total), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
        }
        Spacer(Modifier.height(8.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
        OrderDetailMoneyRow("Subtotal", formatTaka(receipt.subtotal))
        OrderDetailMoneyRow("Shipping", formatTaka(receipt.shipping))
        if (receipt.tax > 0.0) OrderDetailMoneyRow("Tax", formatTaka(receipt.tax))
        Row(Modifier.fillMaxWidth().padding(top = 4.dp)) {
            Text("Total", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f))
            Text(formatTaka(receipt.total), fontSize = 15.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
        }
    }
}

/* ─── session-user helpers (the "Billed To" block) ───────────────────────── */

private val sessionUserJson = Json { ignoreUnknownKeys = true }

@kotlinx.serialization.Serializable
private data class OrderDetailSessionUser(
    val id: String? = null,
    val fullName: String? = null,
    val businessName: String? = null,
    val email: String? = null,
)

private fun parseSessionUser(raw: String?): OrderDetailSessionUser? {
    if (raw.isNullOrBlank()) return null
    return runCatching { sessionUserJson.decodeFromString(OrderDetailSessionUser.serializer(), raw) }.getOrNull()
}

internal fun parseBuyerId(raw: String?): String? = parseSessionUser(raw)?.id

internal fun parseBuyerDisplayName(raw: String?): String =
    parseSessionUser(raw)?.let { it.businessName?.takeIf(String::isNotBlank) ?: it.fullName ?: "Your account" }
        ?: "Your account"

internal fun parseBuyerEmail(raw: String?): String? =
    parseSessionUser(raw)?.email?.takeIf(String::isNotBlank)
