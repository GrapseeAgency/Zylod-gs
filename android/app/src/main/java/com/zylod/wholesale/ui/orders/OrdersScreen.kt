package com.zylod.wholesale.ui.orders

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.OrderDto
import com.zylod.wholesale.data.api.SubOrderDto
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * Buyer orders — native port of src/components/pages/orders-page.tsx (Phase 2
 * ownership row). Real data only, from GET /api/orders/my-orders: honest
 * loading / sign-in / empty / error / list states, no demo rows. The contract
 * returns NO images, so cards draw the same package/box icon placeholder the web
 * card does — never a faked thumbnail. `onBack == null` renders as a TAB-like
 * destination (highlights the profile tab, no back bar), matching CartScreen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    openAuth: () -> Unit,
) {
    val context = LocalContext.current
    val vm: OrdersViewModel = viewModel { OrdersViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()
    val error = state.error

    // t208: re-pull on every entry — the VM survives on the saved back stack
    // (tab-like destination), so orders placed through the WebView checkout
    // never appeared here until the process restarted.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "My Orders",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
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
        },
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                // THE one page-level loading animation (M3 rule — no shimmer,
                // no custom loaders).
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                state.needsAuth -> OrdersAuthRequired(
                    onSignIn = openAuth,
                    onBrowseProducts = { openPage("home", "") },
                )
                error != null -> OrdersError(message = error, onRetry = vm::retry)
                state.orders.isEmpty() -> OrdersEmpty(
                    onBrowseProducts = { openPage("home", "") },
                )
                else -> OrdersList(
                    orders = state.orders,
                    // t204: order cards open the real order-detail page
                    // (WebView pageId "order-detail") instead of being a
                    // dead-end list.
                    onOpenOrder = { orderId -> openPage("order-detail", "orderId=$orderId") },
                )
            }
        }
    }
}

@Composable
private fun OrdersList(orders: List<OrderDto>, onOpenOrder: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(contentType = "meta") {
            Text(
                "${orders.size} order${if (orders.size != 1) "s" else ""}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        // t216: stable keys (was positional) — a background re-pull that
        // reorders/updates rows keeps scroll and item identity instead of
        // re-composing every visible card.
        items(
            orders,
            key = { order -> order.id?.takeIf(String::isNotBlank) ?: "order-${order.hashCode()}" },
            contentType = { "order" },
        ) { order ->
            OrderCard(order, onOpenOrder)
        }
        item(contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * One order card — mobile card layout of orders-page.tsx:267-372: header row
 * (PO number + date/shipments vs status chip + total + unpaid flag), then the
 * supplier summary row with the icon placeholder.
 */
@Composable
private fun OrderCard(order: OrderDto, onOpenOrder: (String) -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            // t204: the whole card is the tap target — only orders with a
            // real id navigate (a missing id has nowhere honest to go).
            (if (order.id.isNullOrBlank()) Modifier else Modifier.clickable { onOpenOrder(order.id!!) })
                .padding(12.dp),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        poNumberLabel(order),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    // t216: the date line built TWO SimpleDateFormats per card
                    // per recomposition — computed once per order now.
                    val date = remember(order) { dateLine(order) }
                    date?.let {
                        Text(
                            it,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        StatusBadge(deriveOrderStatus(order.subOrders))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            formatBdt(order.totalAmount),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                    // orders-page.tsx:292-295 — the flag only appears when the
                    // order is NOT settled; hidden entirely when paid.
                    val unpaidFlag = order.paymentStatus
                        ?.takeIf { it.isNotBlank() && !it.equals("paid", ignoreCase = true) }
                        ?.uppercase()
                    if (unpaidFlag != null) {
                        Text(
                            unpaidFlag,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = LocalZylodExtra.current.warning,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier.size(56.dp),
                ) {
                    // Contract has no image field — honest icon placeholder
                    // (web draws the identical package/box icon; DATA RULE: no
                    // faked thumbnails).
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                        Icon(
                            Icons.Outlined.Inventory,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        order.supplierNames.joinToString(", ").ifBlank { "--" },
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        "Supplier${if (order.subOrders.size > 1) "s" else ""} on this order",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
    }
}

/** Status chip — theme colors only (no hex outside ui/theme/). */
@Composable
private fun StatusBadge(status: String) {
    val (container, content) = when (status) {
        "delivered" ->
            LocalZylodExtra.current.success to LocalZylodExtra.current.onSuccess
        "shipped" ->
            MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
        "cancelled" ->
            MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        // processing (pending/confirmed/packed)
        else ->
            MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
    }
    Surface(shape = RoundedCornerShape(6.dp), color = container) {
        Text(
            status.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.8.sp,
            color = content,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

/**
 * Overall order status — port of orders-page.tsx deriveStatus (which mirrors
 * the backend's getOverallOrderStatus, orders/my-orders/route.ts:5-12):
 * delivered only when EVERY shipment is delivered; one cancellation cancels;
 * any shipped shipment outranks the rest; pending/confirmed/packed all count
 * as "processing".
 */
private fun deriveOrderStatus(subOrders: List<SubOrderDto>): String {
    val statuses = subOrders.map { (it.status ?: "pending").lowercase() }
    if (statuses.isEmpty()) return "processing"
    if (statuses.all { it == "delivered" }) return "delivered"
    if (statuses.any { it == "cancelled" }) return "cancelled"
    if (statuses.any { it == "shipped" }) return "shipped"
    return "processing"
}

/** orders-page.tsx:103 — `PO #<order_number>`, falling back to the id. */
private fun poNumberLabel(order: OrderDto): String =
    order.orderNumber?.takeIf { it.isNotBlank() }?.let { "PO #$it" }
        ?: order.id?.takeIf { it.isNotBlank() }
        ?: "--"

/** "{date} • {n} shipment(s)" — either segment dropped when unknown (no fake now). */
private fun dateLine(order: OrderDto): String? {
    val date = formatDate(order.placedAt ?: order.updatedAt)
    val count = order.subOrders.size
    val shipments = if (count > 0) "$count shipment${if (count == 1) "" else "s"}" else ""
    return when {
        date.isNotBlank() && shipments.isNotBlank() -> "$date • $shipments"
        date.isNotBlank() -> date
        shipments.isNotBlank() -> shipments
        else -> null
    }
}

/**
 * "Jan 5, 2025" — web parity (orders-page.tsx:104-106 toLocaleDateString
 * en-US short-month form). The wire value is a UTC ISO instant; unparsable
 * input yields "" and the card drops the date segment instead of inventing one.
 */
private fun formatDate(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching {
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.parse(iso)
    }.getOrNull() ?: return ""
    return java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US).format(parsed)
}

@Composable
private fun OrdersEmpty(onBrowseProducts: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Inventory,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text("No orders yet", fontSize = 16.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 16.dp))
        Text(
            "You haven't placed any wholesale orders yet. Once you order, your purchases " +
                "and tracking will appear here.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onBrowseProducts,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Browse Products", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Guest state — the soft sign-in CTA (CartScreen precedent, no redirect). */
@Composable
private fun OrdersAuthRequired(onSignIn: () -> Unit, onBrowseProducts: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Lock,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text("Sign in to see your orders", fontSize = 16.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 16.dp))
        Text(
            "Sign in as a buyer and your wholesale purchases and tracking will appear here.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onSignIn,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Sign In", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        TextButton(onClick = onBrowseProducts, modifier = Modifier.padding(top = 8.dp)) {
            Text("Browse Products", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun OrdersError(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Icon(
            Icons.Outlined.ErrorOutline,
            null,
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(36.dp),
        )
        Text(
            message,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

private fun formatBdt(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + java.text.NumberFormat.getIntegerInstance().format(value.toLong())
    else "৳" + String.format(java.util.Locale.US, "%.2f", value)
