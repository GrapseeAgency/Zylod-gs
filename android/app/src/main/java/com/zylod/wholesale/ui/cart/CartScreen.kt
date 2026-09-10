package com.zylod.wholesale.ui.cart

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Minus
import androidx.compose.material.icons.outlined.Plus
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.zylod.wholesale.data.api.CartItemData
import kotlinx.coroutines.launch

/**
 * Cart — port of src/components/pages/cart-page.tsx (spec §3.10): supplier
 * grouped sections, MOQ-aware steppers, tier-priced line totals, visual-only
 * coupon entry, sticky checkout CTA → WebView `checkout`, soft sign-in CTA
 * for the unauthenticated local cart. `onBack == null` renders as a TAB
 * destination (no back bar, no extra top padding).
 */
@Composable
fun CartScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    openAuth: () -> Unit,
) {
    val context = LocalContext.current
    val vm: CartViewModel = viewModel { CartViewModel(context.applicationContext) }
    val state by vm.items.collectAsState()
    val authed by vm.authed.collectAsState()
    val itemErrors by vm.itemErrors.collectAsState()
    val notice by vm.notice.collectAsState()
    val syncing by vm.syncing.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(notice) {
        notice?.let { snackbar.showSnackbar(it); vm.consumeNotice() }
    }

    val items = state.items

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        CartHeader(onBack)

        if (items.isEmpty()) {
            CartEmpty(
                unauthenticated = !authed,
                onSignIn = openAuth,
                onStartShopping = { openPage("home", "") },
            )
        } else {
            if (!authed) {
                SyncBanner(onSignIn = openAuth)
            }
            Box(Modifier.weight(1f)) {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    item {
                        Text(
                            "${items.size} product${if (items.size != 1) "s" else ""}" +
                                if (syncing) " · syncing…" else "",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    items.groupedBySupplier().forEach { (supplierKey, supplierItems) ->
                        item(key = "supplier-$supplierKey") {
                            SupplierSectionHeader(supplierKey, supplierItems)
                        }
                        items(supplierItems, key = { it.id }) { item ->
                            CartItemCard(
                                item = item,
                                error = itemErrors[item.id],
                                onChange = { delta -> vm.changeQuantity(item, delta) },
                                onRemove = {
                                    vm.removeItem(item)
                                    scope.launch { snackbar.showSnackbar("Removed from cart") }
                                },
                                onOpenProduct = { openPage("product-detail", "productId=${item.productId}") },
                            )
                        }
                    }
                    item { Spacer(Modifier.height(4.dp)) }
                }

                SnackbarHost(
                    hostState = snackbar,
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            }

            CartSummaryCard(
                items = items,
                onCheckout = { openPage("checkout", "") },
            )
        }
    }
}

@Composable
private fun CartHeader(onBack: (() -> Unit)?) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 6.dp),
    ) {
        if (onBack != null) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = MaterialTheme.colorScheme.onSurface)
            }
        } else {
            Spacer(Modifier.width(8.dp))
        }
        Text(
            "Your Cart",
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(start = 8.dp),
        )
    }
}

@Composable
private fun SyncBanner(onSignIn: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.secondary,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
        shape = MaterialTheme.shapes.small,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            Text(
                "Sign in to sync your cart across devices",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSecondary,
                modifier = Modifier.weight(1f),
            )
            Text(
                "Sign In",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .padding(start = 8.dp)
                    .clickable(onClick = onSignIn),
            )
        }
    }
}

/** Supplier-grouped sections (cart/route.ts groups by supplier; §3.10 layout). */
private fun List<CartItemData>.groupedBySupplier(): List<Pair<String, List<CartItemData>>> {
    val grouped = LinkedHashMap<String, MutableList<CartItemData>>()
    for (item in this) {
        val key = item.supplierName.ifBlank { item.supplierId.ifBlank { "Other suppliers" } }
        grouped.getOrPut(key) { mutableListOf() }.add(item)
    }
    return grouped.entries.map { it.key to it.value.toList() }
}

@Composable
private fun SupplierSectionHeader(supplierName: String, supplierItems: List<CartItemData>) {
    val subtotal = supplierItems.sumOf { it.totalPrice }
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
        Icon(Icons.Outlined.ShoppingBag, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            supplierName,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Text(
            formatBdt(subtotal),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun CartItemCard(
    item: CartItemData,
    error: String?,
    onChange: (Int) -> Unit,
    onRemove: () -> Unit,
    onOpenProduct: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier
                        .size(80.dp)
                        .clickable(onClick = onOpenProduct),
                ) {
                    val url = resolveImageUrl(item.productImage)
                    if (url != null) {
                        AsyncImage(
                            model = url,
                            contentDescription = item.productName,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                    } else {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Outlined.ShoppingBag,
                                null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(24.dp),
                            )
                        }
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        item.productName,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 16.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.clickable(onClick = onOpenProduct),
                    )
                    Text(
                        "${item.supplierName.ifBlank { "Supplier" }} · MOQ ${item.moq} ${item.unit.ifBlank { "units" }}",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                    Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(top = 6.dp)) {
                        Text(
                            formatBdt(item.unitPrice),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            " / ${item.unit.ifBlank { "unit" }}",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                QuantityStepper(
                    quantity = item.quantity,
                    onChange = onChange,
                )
                Spacer(Modifier.weight(1f))
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        formatBdt(item.totalPrice),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                    )
                    Text(
                        "${item.quantity} ${item.unit.ifBlank { "units" }}",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            error?.let {
                Spacer(Modifier.height(6.dp))
                Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
            ) {
                RemoveButton(onRemove)
            }
        }
    }
}

@Composable
private fun QuantityStepper(quantity: Int, onChange: (Int) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .border(
                1.dp,
                MaterialTheme.colorScheme.outline.copy(alpha = 0.6f),
                RoundedCornerShape(12.dp),
            )
            .padding(4.dp),
    ) {
        StepperIcon(Icons.Outlined.Minus, "Decrease quantity", enabled = true) { onChange(-1) }
        Text(
            quantity.toString(),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.width(44.dp),
        )
        StepperIcon(Icons.Outlined.Plus, "Increase quantity", enabled = true) { onChange(1) }
    }
}

@Composable
private fun StepperIcon(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(28.dp)
            .background(
                if (enabled) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant,
                RoundedCornerShape(8.dp),
            )
            .clickable(enabled = enabled, onClick = onClick),
    ) {
        Icon(
            icon,
            description,
            tint = if (enabled) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.outline,
            modifier = Modifier.size(14.dp),
        )
    }
}

@Composable
private fun RemoveButton(onRemove: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .border(
                1.dp,
                MaterialTheme.colorScheme.error.copy(alpha = 0.3f),
                RoundedCornerShape(8.dp),
            )
            .clickable(onClick = onRemove)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Icon(Icons.Outlined.DeleteOutline, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(13.dp))
        Spacer(Modifier.width(5.dp))
        Text(
            "Cancel",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.error,
        )
    }
}

@Composable
private fun CartSummaryCard(items: List<CartItemData>, onCheckout: () -> Unit) {
    val subtotal = items.sumOf { it.totalPrice }
    val totalUnits = items.sumOf { it.quantity }
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
            Spacer(Modifier.height(10.dp))

            SummaryLine("Subtotal (${items.size} products, $totalUnits units)", formatBdt(subtotal))
            SummaryLine("Shipping", "Calculated at checkout")

            // Visual-only coupon entry (web parity — checkout owns coupons server-side).
            OutlinedTextField(
                value = "",
                onValueChange = {},
                enabled = false,
                singleLine = true,
                placeholder = { Text("Coupon code", fontSize = 12.sp) },
                shape = MaterialTheme.shapes.small,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
            )
            Text(
                "Coupons are applied at checkout",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp, start = 4.dp),
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 10.dp),
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Total", fontSize = 10.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        formatBdt(subtotal),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Button(
                    onClick = onCheckout,
                    enabled = items.isNotEmpty(),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier.height(48.dp),
                ) {
                    Icon(Icons.Outlined.Lock, null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Proceed to Checkout", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun SummaryLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Text(value, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun CartEmpty(unauthenticated: Boolean, onSignIn: () -> Unit, onStartShopping: () -> Unit) {
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
                Icons.Outlined.ShoppingBag,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text("Your cart is empty", fontSize = 16.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 16.dp))
        Text(
            "Browse wholesale deals and add products to get started.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onStartShopping,
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
            Text("Start Shopping", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        if (unauthenticated) {
            TextButton(onClick = onSignIn, modifier = Modifier.padding(top = 8.dp)) {
                Text("Sign in to sync your cart", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

private fun resolveImageUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val server = com.zylod.wholesale.data.api.ServerConfig.cached(
        com.zylod.wholesale.ZylodApp.instance,
    ) ?: return null
    return server.trimEnd('/') + raw
}

private fun formatBdt(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + java.text.NumberFormat.getIntegerInstance().format(value.toLong())
    else "৳" + String.format(java.util.Locale.US, "%.2f", value)
