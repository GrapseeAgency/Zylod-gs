package com.zylod.wholesale.ui.checkout

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Login
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.GppMaybe
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.zylod.wholesale.data.api.AddressDto
import com.zylod.wholesale.data.api.CheckoutCreatedOrder
import com.zylod.wholesale.data.api.CheckoutQuoteOption
import com.zylod.wholesale.data.api.CartItemData
import com.zylod.wholesale.ui.wallet.formatBdt
import java.util.Locale

/**
 * t273 — the typed CHECKOUT screen (pageIds "checkout" + "checkout-page",
 * the checkout-page.tsx port). Gated rendering exactly like the web:
 *
 *  - no session (or a 401 after entry) → the Sign-in wall (Sign In / Browse
 *    Products) — never a doomed form;
 *  - empty cart → the honest empty-cart wall;
 *  - order placed → the VERBATIM success panel (promotion/coupon savings,
 *    the goods+shipping receipt line and the PAID / COD / UNPAID status);
 *  - otherwise the review form: Shipping Address / Items / Shipping (the
 *    per-supplier courier quotes) / Payment (wallet, bank transfer, mobile
 *    banking, COD) / Order Summary (with the coupon rail) / Place Order.
 *
 * Accent = MaterialTheme primary (the app's red/rose); emerald + amber +
 * the red alert banner are the web's own status colors. ViewModel:
 * [CheckoutViewModel] (one per pageId via the keyed factory).
 */
@Composable
fun CheckoutScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CheckoutViewModel = viewModel(key = "checkout-$pageId") {
        CheckoutViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-entry (e.g. back from the login page pushed over the wall): the
    // session gate re-runs so signing in lands the buyer inside checkout.
    LaunchedEffect(Unit) { vm.recheckGate() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { CheckoutTopBar(onBack = onBack) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (state.authState) {
                CheckoutAuthState.Checking -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                CheckoutAuthState.SignedOut -> CheckoutSignInWall(openPage = openPage)
                CheckoutAuthState.Allowed -> {
                    if (state.needsAuth) {
                        CheckoutSignInWall(openPage = openPage)
                    } else {
                        val placed = state.placedOrder
                        when {
                            state.orderPlaced && placed != null ->
                                CheckoutPlacedPanel(order = placed, openPage = openPage)
                            state.items.isEmpty() -> CheckoutEmptyCartWall(openPage = openPage)
                            else -> CheckoutFormBody(state = state, vm = vm, openPage = openPage)
                        }
                    }
                }
            }
        }
    }
}

/* ─── chrome ─────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CheckoutTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Checkout",
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

/* ─── gates ──────────────────────────────────────────────────────────────── */

/** Signed-out / needsAuth wall — web AccountGate semantics for checkout. */
@Composable
private fun CheckoutSignInWall(openPage: (pageId: String, query: String) -> Unit) {
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
                Icons.AutoMirrored.Outlined.Login,
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
            "You need a buyer account to check out — your cart, addresses and payment methods live in your account.",
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
            Text("Browse Products", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Authed but the cart holds nothing — the honest empty-cart wall. */
@Composable
private fun CheckoutEmptyCartWall(openPage: (pageId: String, query: String) -> Unit) {
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
                Icons.Outlined.Inventory,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(20.dp)
                    .size(32.dp),
            )
        }
        Text(
            "Your cart is empty",
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Nothing to check out. Browse the catalog and add products first.",
            fontSize = 12.sp,
            lineHeight = 17.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("home", "") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .heightIn(min = 44.dp),
        ) {
            Text("Browse Products", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/* ─── success panel (inline — orderPlaced replaces the form) ─────────────── */

@Composable
private fun CheckoutPlacedPanel(
    order: CheckoutCreatedOrder,
    openPage: (pageId: String, query: String) -> Unit,
) {
    // Web status colors — read in composable scope, never inside remember.
    val emerald = Color(0xFF059669)
    val amber = Color(0xFFB45309)
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(50),
            color = emerald.copy(alpha = 0.14f),
        ) {
            Icon(
                Icons.Outlined.Check,
                contentDescription = null,
                tint = emerald,
                modifier = Modifier
                    .padding(18.dp)
                    .size(34.dp),
            )
        }
        Text(
            "Order ${order.orderNumber.orEmpty()} Created",
            fontSize = 22.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Column(
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(top = 10.dp),
        ) {
            order.promotionApplied?.let { promotion ->
                Text(
                    "Promotion “${promotion.name}” saved you ${formatBdt(promotion.discount)}.",
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = emerald,
                    textAlign = TextAlign.Center,
                )
            }
            order.couponApplied?.let { coupon ->
                Text(
                    "Coupon ${coupon.code} saved you ${formatBdt(coupon.discount)}.",
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = emerald,
                    textAlign = TextAlign.Center,
                )
            }
            val shippingFee = order.shippingFee ?: 0.0
            val totalAmount = order.totalAmount
            if (shippingFee > 0.0 && totalAmount != null) {
                Text(
                    "Goods ${formatBdt(totalAmount - shippingFee)} + Shipping ${formatBdt(shippingFee)} = ${formatBdt(totalAmount)}",
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
        Text(
            text = when {
                order.paymentStatus?.lowercase(Locale.US) == "paid" -> buildAnnotatedString {
                    append("Status: ")
                    withStyle(SpanStyle(fontWeight = FontWeight.Black, color = emerald)) {
                        append("PAID")
                    }
                    append(" — settled from your wallet balance. The supplier can confirm and start packing right away.")
                }
                order.paymentMethod == "cod" -> buildAnnotatedString {
                    append("Status: ")
                    withStyle(SpanStyle(fontWeight = FontWeight.Black, color = amber)) {
                        append("Cash on Delivery")
                    }
                    append(". The supplier collects the cash when the goods arrive.")
                }
                else -> buildAnnotatedString {
                    append("Status: ")
                    withStyle(SpanStyle(fontWeight = FontWeight.Black, color = amber)) {
                        append(order.paymentStatus?.uppercase(Locale.US).orEmpty())
                    }
                    append(". The order is NOT confirmed until payment is verified — submit your payment reference from My Orders.")
                }
            },
            fontSize = 12.sp,
            lineHeight = 17.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp),
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
            Text("Continue Shopping", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/* ─── the review form ────────────────────────────────────────────────────── */

@Composable
private fun CheckoutFormBody(
    state: CheckoutUiState,
    vm: CheckoutViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    // Status colors read in composable scope (rule: never inside remember).
    val emerald = Color(0xFF059669)
    val amber = Color(0xFFB45309)
    val red700 = Color(0xFFB91C1C)
    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        item(key = "heading") {
            Text(
                if (state.items.size == 1) "Review Order (1 item)" else "Review Order (${state.items.size} items)",
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        if (state.error.isNotEmpty()) {
            item(key = "error-banner") {
                CheckoutErrorBanner(message = state.error)
            }
        }
        item(key = "address") {
            CheckoutAddressCard(state = state, openPage = openPage)
        }
        item(key = "items") {
            CheckoutItemsCard(items = state.items)
        }
        item(key = "shipping") {
            CheckoutShippingCard(state = state, vm = vm, emerald = emerald, red700 = red700)
        }
        item(key = "payment") {
            CheckoutPaymentCard(state = state, vm = vm, amber = amber)
        }
        item(key = "summary") {
            CheckoutSummaryCard(state = state, vm = vm, emerald = emerald, red700 = red700)
        }
        item(key = "caption") {
            Text(
                "Prices are recalculated from the live database when the order is placed. Stock and MOQ are enforced server-side.",
                fontSize = 11.sp,
                lineHeight = 15.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp),
            )
        }
        item(key = "cta") {
            CheckoutPlaceOrderCta(state = state, vm = vm)
        }
    }
}

/** The inline error banner (web role="alert" red card). */
@Composable
private fun CheckoutErrorBanner(message: String) {
    val red700 = Color(0xFFB91C1C)
    Surface(
        color = Color(0xFFFEE2E2),
        border = BorderStroke(1.dp, red700.copy(alpha = 0.45f)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(
                Icons.Outlined.ErrorOutline,
                contentDescription = null,
                tint = red700,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                message,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                fontWeight = FontWeight.Bold,
                color = red700,
            )
        }
    }
}

/** Family-styled section card: icon + title header + optional trailing slot. */
@Composable
private fun CheckoutSectionCard(
    title: String,
    icon: ImageVector,
    trailing: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                trailing?.invoke()
            }
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}

/* ─── shipping address card ──────────────────────────────────────────────── */

/** The selected-address body — label + Default badge, contact, street, city lines. */
@Composable
private fun CheckoutSelectedAddressBody(address: AddressDto) {
    val emerald = Color(0xFF059669)
    Column {
        if (address.label?.isNotBlank() == true || address.isDefault) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (address.label?.isNotBlank() == true) {
                    Text(
                        address.label.orEmpty(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                if (address.isDefault) {
                    Spacer(Modifier.width(8.dp))
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = emerald.copy(alpha = 0.12f),
                    ) {
                        Text(
                            "Default",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = emerald,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
                }
            }
        }
        address.contactName?.takeIf(String::isNotBlank)?.let { contact ->
            Text(
                contact,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        val streetLine = listOf(
            address.addressLine1?.takeIf(String::isNotBlank),
            address.addressLine2?.takeIf(String::isNotBlank),
        ).filterNotNull().joinToString(", ")
        if (streetLine.isNotEmpty()) {
            Text(
                streetLine,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        val districtChunk = address.district?.takeIf(String::isNotBlank)?.let { district ->
            address.postalCode?.takeIf(String::isNotBlank)?.let { postal -> "$district $postal" } ?: district
        }
        val cityLine = listOf(
            address.city?.takeIf(String::isNotBlank),
            districtChunk,
            address.country?.takeIf(String::isNotBlank),
        ).filterNotNull().joinToString(", ")
        if (cityLine.isNotEmpty()) {
            Text(
                cityLine,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun CheckoutAddressCard(
    state: CheckoutUiState,
    openPage: (pageId: String, query: String) -> Unit,
) {
    CheckoutSectionCard(
        title = "Shipping Address",
        icon = Icons.Outlined.Place,
        trailing = {
            TextButton(onClick = { openPage("shipping-address", "") }) {
                Text(
                    "Edit",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        },
    ) {
        when {
            state.addressesLoading -> Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
                Text(
                    "Loading your addresses…",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            state.selectedAddress != null -> {
                val address = state.selectedAddress
                if (address != null) {
                    CheckoutSelectedAddressBody(address = address)
                }
            }
            else -> Column {
                if (state.addressesError.isNotEmpty()) {
                    Text(
                        state.addressesError,
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Button(
                    onClick = { openPage("add-address", "") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .heightIn(min = 44.dp),
                ) {
                    Text("Add Address", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/* ─── items card ─────────────────────────────────────────────────────────── */

@Composable
private fun CheckoutItemsCard(items: List<CartItemData>) {
    CheckoutSectionCard(title = "Items", icon = Icons.Outlined.Inventory) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items.forEach { item ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val image = item.productImage
                    if (image.isNullOrBlank()) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.size(48.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Outlined.Inventory,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                        }
                    } else {
                        AsyncImage(
                            model = image,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(10.dp)),
                        )
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            item.productName,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        val variantSuffix =
                            if (item.variantName != null && item.variantValue != null) {
                                " · ${item.variantName}: ${item.variantValue}"
                            } else {
                                ""
                            }
                        Text(
                            "Qty: ${item.quantity} · ${item.supplierName.ifBlank { "Supplier" }}$variantSuffix",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(
                        formatBdt(item.totalPrice.takeIf { it > 0.0 } ?: (item.unitPrice * item.quantity)),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}

/* ─── shipping card ──────────────────────────────────────────────────────── */

/** "12" from 12.0 / "12.5" from 12.5 — web Number() interpolation parity. */
private fun checkoutWeightLabel(weight: Double): String =
    if (weight % 1.0 == 0.0) weight.toLong().toString() else weight.toString()

@Composable
private fun CheckoutShippingCard(
    state: CheckoutUiState,
    vm: CheckoutViewModel,
    emerald: Color,
    red700: Color,
) {
    val district = state.selectedAddress?.district?.takeIf(String::isNotBlank)
    CheckoutSectionCard(
        title = "Shipping",
        icon = Icons.Outlined.LocalShipping,
        trailing = {
            if (district != null) {
                Text(
                    "to $district",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            if (state.groups.isEmpty()) {
                Text(
                    "No supplier shipments to quote — the cart is empty.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            state.groups.forEach { group ->
                CheckoutGroupQuoteBlock(
                    group = group,
                    quoteState = state.quotes[group.supplierId] ?: CheckoutQuoteState(),
                    selectedMethodId = state.shippingChoices[group.supplierId],
                    hasChoice = state.shippingChoices.containsKey(group.supplierId),
                    district = district,
                    vm = vm,
                    emerald = emerald,
                    red700 = red700,
                )
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            Text(
                "Quotes are re-computed server-side from the live rate book when the order is placed — what you see is what the couriers charge today, not a stored estimate.",
                fontSize = 11.sp,
                lineHeight = 15.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun CheckoutGroupQuoteBlock(
    group: CheckoutSupplierGroup,
    quoteState: CheckoutQuoteState,
    selectedMethodId: String?,
    hasChoice: Boolean,
    district: String?,
    vm: CheckoutViewModel,
    emerald: Color,
    red700: Color,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val groupWeight = group.weightKg
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                group.supplierName,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            Text(
                if (groupWeight == null) {
                    "no weight on file"
                } else {
                    "${checkoutWeightLabel(groupWeight)} kg · ships separately"
                },
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (groupWeight == null) {
            Text(
                "A product in this shipment has no weight on file — shipping settles directly with the supplier.",
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            when {
                quoteState.loading -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Quoting couriers for ${district.orEmpty()}…",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                quoteState.error.isNotEmpty() -> Column {
                    Text(
                        quoteState.error,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = red700,
                    )
                    TextButton(onClick = vm::retryQuotes) {
                        Text(
                            "Retry quote",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                quoteState.options.isEmpty() -> Text(
                    "No courier covers ${checkoutWeightLabel(groupWeight)} kg to ${district.orEmpty()} — place the order and settle shipping with the supplier.",
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    quoteState.options.forEach { option ->
                        CheckoutQuoteOptionRow(
                            option = option,
                            selected = selectedMethodId == option.methodId,
                            emerald = emerald,
                            onSelect = { vm.selectShipping(group.supplierId, option.methodId) },
                        )
                    }
                }
            }
        }
        if (hasChoice) {
            TextButton(onClick = { vm.clearShipping(group.supplierId) }) {
                Text(
                    "No shipping method — settle with the supplier",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun CheckoutQuoteOptionRow(
    option: CheckoutQuoteOption,
    selected: Boolean,
    emerald: Color,
    onSelect: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.Top,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onSelect)
            .padding(vertical = 4.dp),
    ) {
        RadioButton(selected = selected, onClick = null)
        Spacer(Modifier.width(4.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    option.methodName,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (option.freeShipping) {
                    Spacer(Modifier.width(8.dp))
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = emerald.copy(alpha = 0.12f),
                    ) {
                        Text(
                            "Free",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = emerald,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    option.estimatedDays?.takeIf(String::isNotBlank)
                        ?.let { "Est. $it" } ?: "Est. delivery not stated",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (option.freeShipping && option.basePrice > 0.0) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        formatBdt(option.basePrice),
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textDecoration = TextDecoration.LineThrough,
                    )
                }
            }
        }
        Text(
            if (option.price == 0.0) "Free" else formatBdt(option.price),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = if (option.price == 0.0) emerald else MaterialTheme.colorScheme.onSurface,
        )
    }
}

/* ─── payment card ───────────────────────────────────────────────────────── */

@Composable
private fun CheckoutPaymentCard(
    state: CheckoutUiState,
    vm: CheckoutViewModel,
    amber: Color,
) {
    CheckoutSectionCard(title = "Payment", icon = Icons.Outlined.CreditCard) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            val walletBalance = state.walletBalance
            if (walletBalance != null) {
                if (state.walletCanCover) {
                    CheckoutPaymentRow(
                        title = "Pay ${formatBdt(state.payableTotal)} from wallet balance",
                        subtitle = "Balance ${formatBdt(walletBalance)} — the order is marked PAID instantly, no verification wait.",
                        selected = state.paymentMethod == "wallet",
                        enabled = true,
                        onSelect = { vm.selectPaymentMethod("wallet") },
                    )
                } else {
                    CheckoutPaymentRow(
                        title = "Wallet balance ${formatBdt(walletBalance)}",
                        subtitle = "Not enough for this order (${formatBdt(state.payableTotal)}) — top up from the wallet page.",
                        selected = state.paymentMethod == "wallet",
                        enabled = false,
                        onSelect = {},
                    )
                }
            }
            CheckoutPaymentRow(
                title = "Bank Transfer",
                subtitle = "Transfer the total, then submit the payment reference for verification.",
                selected = state.paymentMethod == "bank_transfer",
                enabled = true,
                onSelect = { vm.selectPaymentMethod("bank_transfer") },
            )
            CheckoutPaymentRow(
                title = "Mobile Banking",
                subtitle = "bKash / Nagad — submit the transaction ID after sending.",
                selected = state.paymentMethod == "mobile_banking",
                enabled = true,
                onSelect = { vm.selectPaymentMethod("mobile_banking") },
            )
            CheckoutPaymentRow(
                title = "Cash on Delivery",
                subtitle = if (state.codLocked) {
                    "Locked — verify your email or phone in your profile first"
                } else {
                    "Pay the supplier in cash when the goods arrive."
                },
                selected = state.paymentMethod == "cod",
                enabled = !state.codLocked,
                alertIcon = state.codLocked,
                onSelect = { vm.selectPaymentMethod("cod") },
            )
            if (state.paymentMethod.isEmpty()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.GppMaybe,
                        contentDescription = null,
                        tint = amber,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "Select a payment method to enable the order button.",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = amber,
                    )
                }
            }
            CheckoutLockFootnote(state = state)
        }
    }
}

@Composable
private fun CheckoutPaymentRow(
    title: String,
    subtitle: String,
    selected: Boolean,
    enabled: Boolean,
    onSelect: () -> Unit,
    alertIcon: Boolean = false,
) {
    val amber = Color(0xFFB45309)
    Row(
        verticalAlignment = Alignment.Top,
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (enabled) 1f else 0.7f)
            .clickable(enabled = enabled, onClick = onSelect)
            .padding(vertical = 6.dp),
    ) {
        RadioButton(selected = selected, onClick = null, enabled = enabled)
        Spacer(Modifier.width(4.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (alertIcon) {
                    Spacer(Modifier.width(6.dp))
                    Icon(
                        Icons.Outlined.GppMaybe,
                        contentDescription = null,
                        tint = amber,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
            Text(
                subtitle,
                fontSize = 11.sp,
                lineHeight = 15.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** The lock footnote paragraph — wallet / COD / UNPAID flavors (web parity). */
@Composable
private fun CheckoutLockFootnote(state: CheckoutUiState) {
    Row(verticalAlignment = Alignment.Top) {
        Icon(
            Icons.Outlined.Lock,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .padding(top = 2.dp)
                .size(12.dp),
        )
        Spacer(Modifier.width(6.dp))
        if (state.paymentMethod == "wallet" && state.walletCanCover) {
            Text(
                "The total is re-verified server-side from live catalog prices and debited from your wallet in the same transaction that reserves the stock.",
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else if (state.paymentMethod == "cod") {
            Text(
                "The order is created as cash-on-delivery — the supplier collects the cash on arrival. The total is re-verified server-side from live catalog prices.",
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            Text(
                text = buildAnnotatedString {
                    append("The order is created with status ")
                    withStyle(SpanStyle(fontWeight = FontWeight.Black)) {
                        append("UNPAID")
                    }
                    append(" and a pending payment — submit your payment reference from My Orders; the supplier confirms only after the payment is verified. The total is re-verified server-side from live catalog prices.")
                },
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/* ─── order summary card ─────────────────────────────────────────────────── */

@Composable
private fun CheckoutSummaryCard(
    state: CheckoutUiState,
    vm: CheckoutViewModel,
    emerald: Color,
    red700: Color,
) {
    val emeraldDark = Color(0xFF047857)
    CheckoutSectionCard(title = "Order Summary", icon = Icons.Outlined.ReceiptLong) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Items (${state.items.size})",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    formatBdt(state.subtotal),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Shipping",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                when {
                    !state.hasAnyShippingChoice -> Text(
                        "Settled with supplier",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    state.shippingFee == 0.0 -> Text(
                        "Free",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = emerald,
                    )
                    else -> Text(
                        formatBdt(state.shippingFee),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (state.hasAnyShippingChoice) "Total (goods + shipping)" else "Goods total",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    formatBdt(state.payableTotal),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            val coupon = state.couponApplied
            if (coupon != null && state.couponAppliedDiscount > 0.0) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Coupon ${coupon.code}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = emerald,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "− ${formatBdt(state.couponAppliedDiscount)}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = emerald,
                    )
                }
            }
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = emerald.copy(alpha = 0.10f),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Platform promotions on your items apply automatically — before any coupon code. The receipt shows the exact ৳ each discount saved you.",
                    fontSize = 11.sp,
                    lineHeight = 15.sp,
                    color = emeraldDark,
                    modifier = Modifier.padding(10.dp),
                )
            }
            CheckoutCouponBlock(state = state, vm = vm, emerald = emerald, emeraldDark = emeraldDark, red700 = red700)
        }
    }
}

@Composable
private fun CheckoutCouponBlock(
    state: CheckoutUiState,
    vm: CheckoutViewModel,
    emerald: Color,
    emeraldDark: Color,
    red700: Color,
) {
    val applied = state.couponApplied
    if (applied != null) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = emerald.copy(alpha = 0.12f),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Coupon ${applied.code}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = emeraldDark,
                    )
                    Text(
                        if (state.couponAppliedDiscount > 0.0) {
                            "Validated — ${formatBdt(state.couponAppliedDiscount)} off this cart. The server re-confirms the exact ৳ on the receipt."
                        } else {
                            "Validated — the server confirms the exact ৳ on the receipt."
                        },
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        color = emeraldDark,
                    )
                }
                TextButton(onClick = vm::removeCoupon) {
                    Text(
                        "✕",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = emeraldDark,
                    )
                }
            }
        }
    } else {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = state.couponInput,
                onValueChange = { raw ->
                    if (raw.length <= 24) vm.setCouponInput(raw.uppercase(Locale.US))
                },
                placeholder = { Text("Coupon code", fontSize = 12.sp) },
                singleLine = true,
                textStyle = TextStyle(fontSize = 12.sp),
                modifier = Modifier.weight(1f),
            )
            OutlinedButton(
                onClick = { vm.applyCoupon(state.couponInput) },
                enabled = !state.couponChecking,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.heightIn(min = 48.dp),
            ) {
                Text(
                    if (state.couponChecking) "Checking…" else "Apply",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        if (state.couponError.isNotEmpty()) {
            Text(
                state.couponError,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = red700,
            )
        }
    }
}

/* ─── place-order CTA ────────────────────────────────────────────────────── */

@Composable
private fun CheckoutPlaceOrderCta(
    state: CheckoutUiState,
    vm: CheckoutViewModel,
) {
    val onPrimary = MaterialTheme.colorScheme.onPrimary
    Button(
        onClick = vm::placeOrder,
        enabled = !state.submitting && !state.addressesLoading && state.selectedAddress != null,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp),
    ) {
        if (state.submitting) {
            CircularProgressIndicator(
                modifier = Modifier.size(16.dp),
                strokeWidth = 2.dp,
                color = onPrimary,
            )
            Spacer(Modifier.width(10.dp))
            Text("Placing Order…", fontSize = 14.sp, fontWeight = FontWeight.Bold)
        } else {
            Text("Place Order", fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}
