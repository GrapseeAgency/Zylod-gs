package com.zylod.wholesale.ui.checkout

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
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
import com.zylod.wholesale.data.api.CheckoutSuccessItem
import com.zylod.wholesale.data.api.CheckoutSuccessOrder
import com.zylod.wholesale.data.api.apiQty
import com.zylod.wholesale.util.breakableOrderToken
import com.zylod.wholesale.ui.wallet.formatBdt
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * t273 — the typed ORDER-CONFIRMATION screen (pageId "checkout-success",
 * the order-confirmation-page.tsx port). Gated rendering exactly like the
 * web: no orderId in the entry query → the honest "No order to confirm"
 * wall; loading → spinner; load failure → the red error card with Retry;
 * success → the centered double-ring check, "Order Received", the
 * order-number / est-delivery strip, the payment-status row, the items
 * ledger and the subtotal / freight / total rows, then Track Order +
 * Continue Sourcing. ViewModel: [CheckoutSuccessViewModel] (one per pageId
 * via the keyed factory).
 */
@Composable
fun CheckoutSuccessScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CheckoutSuccessViewModel = viewModel(key = "checkout-success-$pageId") {
        CheckoutSuccessViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Entry resolve — re-runs when the query itself changes; vm.retry()
    // re-fetches with the stored query.
    LaunchedEffect(query) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { CheckoutSuccessTopBar(onBack = onBack) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                !state.hasOrderId -> CheckoutSuccessNoOrder(openPage = openPage)
                state.needsAuth -> CheckoutSuccessAuthGate(openPage = openPage)
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                state.error.isNotEmpty() || state.order == null -> {
                    val errorMessage = state.error.ifEmpty { "Order not found." }
                    CheckoutSuccessErrorCard(
                        message = errorMessage,
                        onRetry = vm::retry,
                        openPage = openPage,
                    )
                }
                else -> {
                    val order = state.order
                    if (order != null) {
                        CheckoutSuccessContent(order = order, openPage = openPage)
                    }
                }
            }
        }
    }
}

/* ─── chrome ─────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CheckoutSuccessTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Checkout Success",
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(
                        Icons.AutoMirrored.Outlined.ArrowBack,
                        "Go back",
                        tint = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/* ─── honest states ──────────────────────────────────────────────────────── */

/** No orderId in the entry query — the honest empty wall (web parity). */
@Composable
private fun CheckoutSuccessNoOrder(openPage: (pageId: String, query: String) -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(50),
            color = MaterialTheme.colorScheme.surfaceVariant,
        ) {
            Icon(
                Icons.Outlined.ShoppingBag,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(20.dp)
                    .size(32.dp),
            )
        }
        Text(
            "No order to confirm",
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "This screen shows the details of an order you have placed. Place an order first and its real details will appear here.",
            fontSize = 12.sp,
            lineHeight = 17.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("orders", "") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .heightIn(min = 44.dp),
        ) {
            Text("View My Orders", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        OutlinedButton(
            onClick = { openPage("home", "") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .padding(top = 10.dp)
                .heightIn(min = 44.dp),
        ) {
            Text("Continue Sourcing", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Signed-out / 401 gate — no fabricated order, a straight way to sign in. */
@Composable
private fun CheckoutSuccessAuthGate(openPage: (pageId: String, query: String) -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(50),
            color = MaterialTheme.colorScheme.surfaceVariant,
        ) {
            Icon(
                Icons.Outlined.ShoppingBag,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(20.dp)
                    .size(32.dp),
            )
        }
        Text(
            "Sign in required",
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Order confirmations are private — sign in with the buyer account that placed the order.",
            fontSize = 12.sp,
            lineHeight = 17.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("login", "") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .heightIn(min = 44.dp),
        ) {
            Text("Sign In", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        OutlinedButton(
            onClick = { openPage("home", "") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .padding(top = 10.dp)
                .heightIn(min = 44.dp),
        ) {
            Text("Continue Sourcing", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Load failure — the red error card with Retry + a way to My Orders. */
@Composable
private fun CheckoutSuccessErrorCard(
    message: String,
    onRetry: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val red700 = Color(0xFFB91C1C)
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
    ) {
        Surface(
            color = Color(0xFFFEE2E2),
            border = BorderStroke(1.dp, red700.copy(alpha = 0.45f)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                message,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                fontWeight = FontWeight.Bold,
                color = red700,
                modifier = Modifier.padding(12.dp),
            )
        }
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = red700,
                contentColor = Color.White,
            ),
            modifier = Modifier
                .padding(top = 20.dp)
                .heightIn(min = 44.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        OutlinedButton(
            onClick = { openPage("orders", "") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .padding(top = 10.dp)
                .heightIn(min = 44.dp),
        ) {
            Text("Go to My Orders", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/* ─── success content ────────────────────────────────────────────────────── */

/** ISO instants on the orders wire: "2024-05-05T10:00:00.000Z" (UTC). */
private val confirmationIsoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

private val confirmationDateFormat = SimpleDateFormat("MMM d, yyyy", Locale.US)

/** "Jan 5, 2026" from a UTC ISO instant — null on absent/unparsable input. */
private fun checkoutConfirmationDateLabel(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val parsed = runCatching { confirmationIsoParser.parse(iso.take(19)) }.getOrNull() ?: return null
    return confirmationDateFormat.format(parsed)
}

@Composable
private fun CheckoutSuccessContent(
    order: CheckoutSuccessOrder,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val emerald = Color(0xFF059669)
    val amber = Color(0xFFB45309)
    val primary = MaterialTheme.colorScheme.primary
    val onSurface = MaterialTheme.colorScheme.onSurface

    val allItems = order.subOrders.flatMap { it.items }
    val estDelivery = remember(order) {
        order.subOrders
            .mapNotNull { it.estimatedDelivery }
            .mapNotNull { iso ->
                runCatching { confirmationIsoParser.parse(iso.take(19)) }.getOrNull()?.let { iso to it.time }
            }
            .minByOrNull { it.second }
            ?.first
            ?.let { iso -> checkoutConfirmationDateLabel(iso) }
    }
    val paid = order.paymentStatus?.lowercase(Locale.US) == "paid"

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        // The double-ring check circle — primary ring, primary check inside.
        Surface(
            shape = RoundedCornerShape(50),
            color = primary.copy(alpha = 0.12f),
        ) {
            Surface(
                shape = RoundedCornerShape(50),
                color = primary.copy(alpha = 0.20f),
                modifier = Modifier.padding(10.dp),
            ) {
                Surface(
                    shape = RoundedCornerShape(50),
                    color = primary,
                    modifier = Modifier.padding(10.dp),
                ) {
                    Icon(
                        Icons.Outlined.Check,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier
                            .padding(10.dp)
                            .size(26.dp),
                    )
                }
            }
        }
        Text(
            "Order Received",
            fontSize = 24.sp,
            fontWeight = FontWeight.Black,
            color = onSurface,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        val itemWord = if (allItems.size == 1) "item" else "items"
        // t281 5-c: dash-boundary break opportunities — the 18-char token
        // wrapped mid-glyph on 320dp screens (VLM run 175, capture 70).
        val subLine = if (allItems.isEmpty()) {
            "Order #${breakableOrderToken(order.orderNumber)} was created and sent to the supplier."
        } else {
            "Order #${breakableOrderToken(order.orderNumber)} was created and sent to the supplier with ${allItems.size} $itemWord."
        }
        Text(
            subLine,
            fontSize = 12.sp,
            lineHeight = 17.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp),
        )

        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surfaceContainer,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 18.dp),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.Top) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Order Number",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            // t281 5-c: same dash-boundary break helper.
                            breakableOrderToken(order.orderNumber),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = onSurface,
                        )
                    }
                    // t284: the Est.-Delivery column had NO width bound — its
                    // long fallback ("To be scheduled by the supplier") took
                    // the full intrinsic width and visually interleaved with
                    // the wrapped order-number lines (round-8 VLM audit,
                    // capture 70). Web parity = two balanced columns: bound
                    // both to weight(1f) so each wraps inside its own half.
                    Column(
                        horizontalAlignment = Alignment.End,
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(
                            "Est. Delivery",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            estDelivery ?: "To be scheduled by the supplier",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.End,
                            color = primary,
                        )
                    }
                }
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                    modifier = Modifier.padding(vertical = 12.dp),
                )
                Text(
                    text = if (paid) {
                        "Payment status: PAID"
                    } else {
                        "Payment status: ${order.paymentStatus?.uppercase(Locale.US).orEmpty()}"
                    },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (paid) emerald else amber,
                )
                Text(
                    if (paid) {
                        "Your payment has been verified."
                    } else {
                        "This order is not confirmed until payment is verified. Use the payment instructions on the order to pay."
                    },
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }

        // Items ledger.
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 18.dp),
        ) {
            Text(
                "Items Ordered (${allItems.size})",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = onSurface,
            )
            if (allItems.isEmpty()) {
                Text(
                    "This order has no line items recorded.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            allItems.forEach { item ->
                CheckoutSuccessItemRow(item = item, primary = primary)
            }
        }

        // Financial rows.
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surfaceContainer,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 18.dp),
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.padding(16.dp),
            ) {
                val subtotal = order.subOrders.sumOf { it.subtotal }
                val shipping = order.subOrders.sumOf { it.shippingCost }
                CheckoutSuccessMoneyRow(
                    label = "Subtotal",
                    value = formatBdt(subtotal),
                    valueColor = onSurface,
                    valueBold = false,
                )
                CheckoutSuccessMoneyRow(
                    label = "Freight Shipping",
                    value = if (shipping > 0.0) formatBdt(shipping) else "Set by supplier",
                    valueColor = onSurface,
                    valueBold = false,
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                CheckoutSuccessMoneyRow(
                    label = "Total",
                    value = formatBdt(order.totalAmount),
                    valueColor = onSurface,
                    valueBold = true,
                    labelBold = true,
                    valueLarge = true,
                )
            }
        }

        Button(
            onClick = { openPage("track-order", "orderId=${order.id}") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 22.dp)
                .heightIn(min = 48.dp),
        ) {
            Text("Track Order", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        // t274: the typed order-detail surface — the placed order's full
        // detail (items, payments, tracking, the manual-payment leg) is one
        // tap away from the confirmation, matching the web confirmation's
        // order link.
        OutlinedButton(
            onClick = { openPage("order-detail", "orderId=${order.id}") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 10.dp)
                .heightIn(min = 48.dp),
        ) {
            Text("View Order Details", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        OutlinedButton(
            onClick = { openPage("home", "") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 10.dp)
                .heightIn(min = 48.dp),
        ) {
            Text("Continue Sourcing", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun CheckoutSuccessItemRow(
    item: CheckoutSuccessItem,
    primary: Color,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        val thumb = item.product?.thumbnailUrl
        if (thumb.isNullOrBlank()) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.size(56.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Outlined.Inventory,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }
        } else {
            AsyncImage(
                model = thumb,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(12.dp)),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                item.product?.name ?: "--",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val unit = item.product?.unit.orEmpty()
            Text(
                if (unit.isNotBlank()) "Qty: ${item.quantity.apiQty()} $unit" else "Qty: ${item.quantity.apiQty()}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(
            formatBdt(item.totalPrice ?: 0.0),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = primary,
        )
    }
}

@Composable
private fun CheckoutSuccessMoneyRow(
    label: String,
    value: String,
    valueColor: Color,
    valueBold: Boolean,
    labelBold: Boolean = false,
    valueLarge: Boolean = false,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            label,
            fontSize = if (labelBold) 13.sp else 12.sp,
            fontWeight = if (labelBold) FontWeight.Bold else FontWeight.Normal,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(
            value,
            fontSize = if (valueLarge) 17.sp else 12.sp,
            fontWeight = if (valueBold) FontWeight.Black else FontWeight.SemiBold,
            color = valueColor,
        )
    }
}
