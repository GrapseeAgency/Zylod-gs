package com.zylod.wholesale.ui.seller

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material.icons.outlined.Wallet
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.graphics.vector.ImageVector
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
import coil.request.ImageRequest
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.components.StarRow
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.roundToInt

/**
 * NATIVE Seller Dashboard (pageId "seller-dashboard" — the generated metadata
 * screen is replaced by this live one through RouteOwnership).
 *
 * Structure mirrors DealsScreen: Scaffold + TopAppBar (back arrow only when
 * [onBack] != null) + one sectioned LazyColumn (store header, KPI grid, quick
 * actions, recent orders, low stock, top products), honest loading /
 * not-seller / offline / empty states, sp+FontWeight type styles, theme
 * colors only (brand red arrives as colorScheme.primary — no hex here).
 *
 * Data truth: every number comes from the REAL seller endpoints —
 * GET api/supplier/dashboard (stats/supplier/recentSubOrders/topProducts/
 * inventoryAlerts) and GET api/supplier/orders (recent-orders rail detail).
 * Nothing is fabricated for non-sellers: their 401 renders the honest gate
 * state below. Offline renders the last SAVED dashboard
 * ("zylod_config"/"native_seller_dashboard_cache") under a banner — never a
 * white screen.
 *
 * Smoothness contract (DealsScreen parity): every row has a STABLE key and
 * contentType; derived labels are remember{}ed — zero allocations in
 * composition.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SellerDashboardScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SellerDashboardViewModel = viewModel(key = "native-seller-dashboard") {
        SellerDashboardViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Orders/Deals: re-pull on EVERY entry — the VM survives
    // on the saved back stack, so stats that moved while the user was
    // elsewhere appear at once. The silent refresh keeps visible data mounted.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Seller Dashboard",
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
                // no custom loaders; OrdersScreen parity).
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                // Honest gate for buyers/signed-out users (HTTP 401/403 from
                // requireUserType(['supplier','admin'])) — no fabricated stats.
                state.notSeller -> SellerNotSeller(
                    openPage = openPage,
                    onRetry = vm::refresh,
                )
                // First launch offline: nothing fetched AND nothing saved —
                // a themed empty state with Retry, never a white screen.
                state.error != null -> SellerDashboardEmpty(onRetry = vm::refresh)
                else -> SellerDashboardList(state = state, openPage = openPage)
            }
        }
    }
}

@Composable
private fun SellerDashboardList(
    state: SellerDashboardUiState,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val content = state.content ?: return

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { OfflineBanner() }
        }
        item(key = "store-header", contentType = "header") { StoreHeader(content.store) }
        item(key = "kpi-primary", contentType = "kpi") { KpiPrimaryRow(content.stats) }
        item(key = "kpi-secondary", contentType = "kpi") { KpiSecondaryRow(content.stats) }
        item(key = "quick-actions", contentType = "actions") { QuickActions(openPage) }
        sectionHeader(
            key = "orders-header",
            title = "Recent Orders",
            icon = Icons.Outlined.ReceiptLong,
            count = content.recentOrders.size,
        )
        if (content.recentOrders.isEmpty()) {
            item(key = "orders-empty", contentType = "empty") {
                Text(
                    "No orders yet — they land here the moment a buyer checks out.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                content.recentOrders,
                // "ord-<id>"/"sub-<id>" — stable across refreshes and unique
                // whichever endpoint fed the row.
                key = { it.key },
                contentType = { "order" },
            ) { row ->
                SellerOrderCard(row, openPage)
            }
        }
        if (content.lowStockAlerts.isNotEmpty()) {
            sectionHeader(
                key = "stock-header",
                title = "Low Stock",
                icon = Icons.Outlined.ErrorOutline,
                count = content.lowStockAlerts.size,
            )
            items(
                content.lowStockAlerts,
                key = { "stock-${it.key}" },
                contentType = { "stock" },
            ) { alert ->
                StockAlertCard(alert)
            }
        }
        if (content.topProducts.isNotEmpty()) {
            sectionHeader(
                key = "top-header",
                title = "Top Products",
                icon = Icons.Outlined.TrendingUp,
                count = content.topProducts.size,
            )
            items(
                content.topProducts,
                key = { "top-${it.key}" },
                contentType = { "top-product" },
            ) { product ->
                TopProductCard(product)
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** Section header: themed icon + title + live count (DealsScreen parity). */
private fun LazyListScope.sectionHeader(
    key: String,
    title: String,
    icon: ImageVector,
    count: Int,
) {
    item(key = key, contentType = "header") {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 6.dp),
        ) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.weight(1f))
            Text(
                "$count",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun StoreHeader(store: SellerStoreInfo) {
    val ratingLabel = remember(store.ratingAvg) {
        store.ratingAvg?.let { String.format(Locale.US, "%.1f", it) }
    }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(40.dp)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.08f), RoundedCornerShape(10.dp)),
                ) {
                    Icon(
                        Icons.Outlined.Storefront,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp),
                    )
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        store.companyName,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                        ratingLabel?.let {
                            StarRow(rating = store.ratingAvg?.roundToInt() ?: 0)
                            Spacer(Modifier.width(4.dp))
                            Text(
                                it,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
                VerificationChip(store.verificationStatus)
            }
        }
    }
}

@Composable
private fun VerificationChip(status: String?) {
    val text = status?.trim()?.uppercase().orEmpty()
    if (text.isEmpty()) return
    val positive = text == "APPROVED" || text == "VERIFIED"
    val negative = text == "REJECTED"
    val tint = when {
        positive -> LocalZylodExtra.current.success
        negative -> MaterialTheme.colorScheme.error
        else -> LocalZylodExtra.current.warning
    }
    Surface(shape = RoundedCornerShape(6.dp), color = tint.copy(alpha = 0.08f)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
        ) {
            if (positive) {
                Icon(Icons.Outlined.Verified, null, tint = tint, modifier = Modifier.size(12.dp))
                Spacer(Modifier.width(3.dp))
            }
            Text(
                text,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.8.sp,
                color = tint,
            )
        }
    }
}

/** Primary KPI tiles — the REAL dashboard stats fields, one card each. */
@Composable
private fun KpiPrimaryRow(stats: SellerStats) {
    val products = remember(stats) { stats.totalProducts.toString() }
    val orders = remember(stats) { stats.totalOrders.toString() }
    val revenue = remember(stats) { formatBdtCompact(stats.totalRevenueBDT) }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        KpiCard("Products", products, Icons.Outlined.Inventory2, Modifier.weight(1f))
        KpiCard("Orders", orders, Icons.Outlined.ShoppingCart, Modifier.weight(1f))
        KpiCard("Revenue", revenue, Icons.Outlined.Wallet, Modifier.weight(1f))
    }
}

/** Secondary tiles: pending orders / low stock / this-month revenue (all real). */
@Composable
private fun KpiSecondaryRow(stats: SellerStats) {
    val pending = remember(stats) { stats.pendingOrders.toString() }
    val lowStock = remember(stats) { stats.lowStockCount.toString() }
    val month = remember(stats) { formatBdtCompact(stats.thisMonthRevenue) }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        KpiCard("Pending", pending, Icons.Outlined.History, Modifier.weight(1f))
        KpiCard("Low stock", lowStock, Icons.Outlined.ErrorOutline, Modifier.weight(1f))
        KpiCard("This month", month, Icons.Outlined.TrendingUp, Modifier.weight(1f))
    }
}

@Composable
private fun KpiCard(title: String, value: String, icon: ImageVector, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = modifier,
    ) {
        Column(Modifier.padding(horizontal = 10.dp, vertical = 12.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Text(
                value,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                title,
                fontSize = 9.sp,
                letterSpacing = 0.6.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

/** Quick actions — real registry pageIds, all three verified routes. */
@Composable
private fun QuickActions(openPage: (pageId: String, query: String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        QuickAction("Add product", Icons.Outlined.Add, Modifier.weight(1f)) { openPage("add-product", "") }
        QuickAction("Orders", Icons.Outlined.ReceiptLong, Modifier.weight(1f)) { openPage("seller-orders", "") }
        QuickAction("Analytics", Icons.Outlined.TrendingUp, Modifier.weight(1f)) { openPage("seller-analytics", "") }
    }
}

@Composable
private fun QuickAction(
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)),
        modifier = modifier.clickable(onClick = onClick),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
        ) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            Spacer(Modifier.height(4.dp))
            Text(
                label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/**
 * One recent-order row — the whole card opens the native order-detail page
 * through the t204 path when the row carries the parent orderId (rows fed by
 * GET api/supplier/orders do; dashboard-fallback rows are not clickable).
 */
@Composable
private fun SellerOrderCard(
    row: SellerOrderRow,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val amountLabel = remember(row) { formatBdt(row.totalAmount) }
    val buyerLine = remember(row) { row.buyerName?.takeIf(String::isNotBlank) }
    val itemsLine = remember(row) {
        when {
            row.itemCount > 0 -> "${row.itemCount} item${if (row.itemCount != 1) "s" else ""} • ${row.primaryItemName}"
            else -> row.primaryItemName
        }
    }

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            (if (row.orderId == null) Modifier else Modifier.clickable {
                openPage("order-detail", "orderId=${row.orderId}")
            })
                .padding(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                OrderThumbnail(row)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            row.orderNumber,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        StatusChip(row.status)
                    }
                    buyerLine?.let {
                        Text(
                            it,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    Text(
                        itemsLine,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                    Text(
                        row.dateLabel,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
            ) {
                Text(
                    amountLabel,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.weight(1f))
                StatusChip(row.paymentStatus)
            }
        }
    }
}

/** 44dp thumbnail: Coil crossfade + MATCHING placeholder (DealsScreen parity). */
@Composable
private fun OrderThumbnail(row: SellerOrderRow) {
    val context = LocalContext.current
    val url = remember(row.imageUrl) { resolveImageUrl(row.imageUrl) }
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.size(44.dp),
    ) {
        if (url != null) {
            val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
            val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
            AsyncImage(
                model = remember(url) {
                    ImageRequest.Builder(context)
                        .data(url)
                        .crossfade(200)
                        .build()
                },
                contentDescription = row.primaryItemName,
                placeholder = placeholder,
                error = placeholder,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                Icon(
                    Icons.Outlined.ReceiptLong,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}

/**
 * SubOrder status chip — real subOrder statuses (pending/confirmed/packed/
 * shipped/delivered/cancelled/returned) and payments statuses (paid/pending/
 * failed/refunded) mapped to theme pairs.
 */
@Composable
private fun StatusChip(status: String?) {
    val text = status?.trim()?.uppercase().orEmpty()
    if (text.isEmpty()) return
    val (container, content) = when {
        text in POSITIVE_STATUSES ->
            LocalZylodExtra.current.success to LocalZylodExtra.current.onSuccess
        text in NEGATIVE_STATUSES ->
            MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        text in ATTENTION_STATUSES ->
            LocalZylodExtra.current.warning to LocalZylodExtra.current.onWarning
        else ->
            MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
    }
    Surface(shape = RoundedCornerShape(6.dp), color = container) {
        Text(
            text,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.8.sp,
            color = content,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

private val POSITIVE_STATUSES = setOf("DELIVERED", "PAID", "APPROVED", "VERIFIED", "SUCCESS", "REFUNDED")
private val ATTENTION_STATUSES = setOf("PENDING", "CONFIRMED", "PACKED", "SHIPPED", "UNDER_REVIEW", "COD_PENDING")
private val NEGATIVE_STATUSES = setOf("CANCELLED", "RETURNED", "REJECTED", "FAILED")

@Composable
private fun StockAlertCard(alert: SellerStockAlertRow) {
    val stockLabel = remember(alert) {
        val threshold = alert.threshold?.roundToInt()
        if (threshold != null && threshold > 0) "restock at $threshold" else null
    }
    val tint = if (alert.critical) MaterialTheme.colorScheme.error else LocalZylodExtra.current.warning
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.ErrorOutline, null, tint = tint, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    alert.name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    buildString {
                        append("${alert.currentStock.roundToInt()} in stock")
                        stockLabel?.let { append(" • $it") }
                    },
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                if (alert.critical) "OUT" else "LOW",
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.8.sp,
                color = tint,
            )
        }
    }
}

@Composable
private fun TopProductCard(product: SellerTopProductRow) {
    val priceLabel = remember(product) { formatBdt(product.basePrice) }
    val soldLabel = remember(product) { "${product.soldCount.roundToInt()} sold" }
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(
                Icons.Outlined.Inventory2,
                null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    product.name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    product.category,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(
                soldLabel,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.width(8.dp))
            Text(
                priceLabel,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/** Offline banner over the SAVED dashboard — theme warning pair, DealsScreen banner style. */
@Composable
private fun OfflineBanner() {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, warning.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "You're offline — showing your last saved dashboard",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/**
 * Honest gate for non-seller users: the API answered 401/403 (signed out or a
 * buyer account). No fabricated numbers — an explanation plus the way out.
 */
@Composable
private fun SellerNotSeller(
    openPage: (pageId: String, query: String) -> Unit,
    onRetry: () -> Unit,
) {
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
        Text(
            "Seller account required",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "This dashboard shows real stats for signed-in seller accounts. Sign in with a supplier account — or complete seller registration — to see your store here.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
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
        TextButton(onClick = { openPage("home", "") }) {
            Text(
                "Browse the marketplace",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/**
 * First launch with no connection and NO saved dashboard: themed empty state
 * with Retry — never a white screen.
 */
@Composable
private fun SellerDashboardEmpty(onRetry: () -> Unit) {
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
                Icons.Outlined.CloudOff,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "You're offline",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "No dashboard saved yet — connect once to save it",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
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

/**
 * Order thumbnails are RELATIVE server paths ("/images/products/x.png") —
 * resolve against the persisted last-known server base (same contract as
 * DealsScreen/CartScreen/PDP §6.5; Coil cannot fetch a scheme-less path).
 */
private fun resolveImageUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val server = ServerConfig.cached(ZylodApp.instance) ?: return null
    return server.trimEnd('/') + raw
}

private fun formatBdt(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + NumberFormat.getIntegerInstance().format(value.toLong())
    else "৳" + String.format(Locale.US, "%.2f", value)

/** KPI-tile money: full grouped numbers under ৳1L, lakh/crore above it. */
private fun formatBdtCompact(value: Double): String {
    val v = value.coerceAtLeast(0.0)
    return when {
        v >= 10_000_000.0 -> "৳" + compact(v / 10_000_000.0) + "Cr"
        v >= 100_000.0 -> "৳" + compact(v / 100_000.0) + "L"
        else -> formatBdt(v)
    }
}

private fun compact(value: Double): String =
    String.format(Locale.US, "%.1f", value).removeSuffix(".0")
