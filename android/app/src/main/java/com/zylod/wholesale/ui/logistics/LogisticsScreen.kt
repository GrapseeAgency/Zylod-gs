package com.zylod.wholesale.ui.logistics

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.util.Locale

/**
 * SHARED typed Logistics & Freight hub screen (pageId logistics — the
 * ui/screens delegate calls THIS, ported from logistics-page.tsx).
 *
 * Data truth: /api/delivery-methods + /api/warehouses loaded in parallel
 * (the web Promise.allSettled semantics — one failing rail must not hide
 * the other's data) + the REAL /api/shipping/quote engine in the rate
 * calculator section. Structure mirrors the web faithfully: the primary
 * header banner, the four real quick-tool cards (all registered native
 * pageIds), the Delivery Methods section (honest empty card), the Shipping
 * Rate Calculator (three inputs + Get Shipping Rates + the honest empty /
 * error answers), and the Ship-From Warehouses section with the debounced
 * q= search. Nothing is invented.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogisticsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: LogisticsViewModel = viewModel(key = "native-logistics-$pageId") {
        LogisticsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Logistics & Freight",
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
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (state.loading) {
                item(key = "hub-loading", contentType = "notice") {
                    HubNoticeCard(
                        icon = Icons.Outlined.LocalShipping,
                        text = "Loading logistics data…",
                    )
                }
                return@LazyColumn
            }
            if (state.loadError != null) {
                item(key = "hub-error", contentType = "notice") {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        HubNoticeCard(
                            icon = Icons.Outlined.ErrorOutline,
                            text = state.loadError.orEmpty(),
                        )
                        Text(
                            "Retry",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier
                                .clickable { vm.retry() }
                                .padding(4.dp),
                        )
                    }
                }
                return@LazyColumn
            }
            if (state.offlineFromCache) {
                item(key = "hub-offline", contentType = "banner") {
                    HubOfflineBanner("Offline — showing the last saved logistics data")
                }
            }
            // ─── Quick tools — all real registered pages ───
            item(key = "hub-quick-tools", contentType = "tools") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    QuickTool(
                        icon = Icons.Outlined.CheckCircle,
                        label = "Track an Order",
                        caption = "Live consignment status",
                        onClick = { openPage("track-order", "") },
                    )
                    QuickTool(
                        icon = Icons.Outlined.LocalShipping,
                        label = "Freight Tracking",
                        caption = "Containers & cargo",
                        onClick = { openPage("freight-tracking", "") },
                    )
                    QuickTool(
                        icon = Icons.Outlined.Public,
                        label = "Import / Export",
                        caption = "Cross-border shipments",
                        onClick = { openPage("import-export-tracker", "") },
                    )
                    QuickTool(
                        icon = Icons.Outlined.Inventory2,
                        label = "Customs Clearance",
                        caption = "Customs status",
                        onClick = { openPage("customs-clearance", "") },
                    )
                }
            }
            // ─── Delivery methods (admin-configured, real) ───
            item(key = "hub-methods-header", contentType = "header") {
                HubSectionTitle("Delivery Methods")
            }
            if (state.methods.isEmpty()) {
                item(key = "hub-methods-empty", contentType = "notice") {
                    HubNoticeCard(
                        icon = Icons.Outlined.LocalShipping,
                        text = "No delivery methods have been published yet. Check the shipping quote below — " +
                            "zone rates are configured separately and may still be available for your district.",
                    )
                }
            } else {
                items(state.methods, key = { it.key }, contentType = { "method" }) { method ->
                    HubMethodCard(method)
                }
            }
            // ─── Shipping Rate Calculator (real rate engine) ───
            item(key = "hub-quote-header", contentType = "header") {
                HubSectionTitle("Shipping Rate Calculator")
            }
            item(key = "hub-quote-form", contentType = "form") {
                HubQuoteCard(state = state, vm = vm)
            }
            // ─── Ship-From Warehouses (real rows) ───
            item(key = "hub-warehouses-header", contentType = "header") {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        "Ship-From Warehouses",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    val count = state.warehouses.size
                    Text(
                        "$count location" + (if (count == 1) "" else "s"),
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            item(key = "hub-warehouse-search", contentType = "search") {
                OutlinedTextField(
                    value = state.warehouseQuery,
                    onValueChange = vm::searchWarehouses,
                    placeholder = {
                        Text(
                            "Search warehouses by name, city, district, or company…",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    },
                    leadingIcon = {
                        Icon(
                            Icons.Outlined.Search,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                        )
                    },
                    shape = RoundedCornerShape(16.dp),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (state.warehouses.isEmpty()) {
                item(key = "hub-warehouses-empty", contentType = "notice") {
                    HubNoticeCard(
                        icon = Icons.Outlined.LocationOn,
                        text = "No warehouses match yet. Suppliers publish their ship-from locations as they are " +
                            "verified — new facilities appear here automatically.",
                    )
                }
            } else {
                items(state.warehouses, key = { it.key }, contentType = { "warehouse" }) { row ->
                    HubWarehouseCard(row, openPage)
                }
            }
        }
    }
}

/* ─── quick tools ────────────────────────────────────────────────────────── */

@Composable
private fun QuickTool(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    caption: String,
    onClick: () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(16.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    label,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    caption,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Icon(
                Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

/* ─── delivery methods ───────────────────────────────────────────────────── */

@Composable
private fun HubMethodCard(method: DeliveryMethodRow) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        method.name,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    if (method.description.isNotBlank()) {
                        Text(
                            method.description,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
                method.badge?.let {
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier.padding(start = 8.dp),
                    ) {
                        Text(
                            it,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 12.dp)) {
                Icon(
                    Icons.Outlined.Schedule,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(12.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    method.estimatedDelivery ?: "Timeline set by courier",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    if (method.isFree) "Free" else formatTaka(method.price),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

/* ─── shipping rate calculator ───────────────────────────────────────────── */

@Composable
private fun HubQuoteCard(state: LogisticsUiState, vm: LogisticsViewModel) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            LabeledField(
                label = "Delivery district",
                value = state.quoteDistrict,
                onValueChange = vm::setQuoteDistrict,
                placeholder = "e.g. Dhaka",
            )
            LabeledField(
                label = "Shipment weight (kg)",
                value = state.quoteWeight,
                onValueChange = vm::setQuoteWeight,
                placeholder = "10",
                numeric = true,
            )
            LabeledField(
                label = "Order value (৳)",
                value = state.quoteSubtotal,
                onValueChange = vm::setQuoteSubtotal,
                placeholder = "50000",
                numeric = true,
            )
            Button(
                onClick = vm::fetchQuote,
                enabled = !state.quoteLoading,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier.height(44.dp),
            ) {
                Text(
                    if (state.quoteLoading) "Quoting…" else "Get Shipping Rates",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            state.quoteError?.let {
                Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
            }
            val options = state.quoteOptions
            when {
                options == null -> {}
                options.isEmpty() -> {
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                        ) {
                            Icon(
                                Icons.Outlined.LocationOn,
                                null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(20.dp),
                            )
                            Text(
                                "No rates cover that district yet",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                            Text(
                                "Shipping zones are configured per district — this district has no active " +
                                    "zone/rate combination for the given weight.",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }
                }
                else -> {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        options.forEachIndexed { index, option ->
                            HubQuoteRow(option, cheapest = index == 0)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LabeledField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    numeric: Boolean = false,
) {
    Column {
        Text(
            label,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) },
            keyboardOptions = if (numeric) {
                KeyboardOptions(keyboardType = KeyboardType.Decimal)
            } else {
                KeyboardOptions.Default
            },
            shape = RoundedCornerShape(12.dp),
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp),
        )
    }
}

@Composable
private fun HubQuoteRow(option: QuoteOptionDto, cheapest: Boolean) {
    val extra = LocalZylodExtra.current
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        option.methodName.orEmpty(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    if (cheapest) {
                        Spacer(Modifier.width(8.dp))
                        Surface(
                            color = extra.success.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(6.dp),
                        ) {
                            Text(
                                "Cheapest",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = extra.success,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                    }
                }
                val meta = buildString {
                    append(option.zoneName.orEmpty())
                    option.estimatedDays?.let { append(" · $it") }
                    if (option.freeShipping) {
                        option.freeAbove?.let { append(" · free above ") ; append(formatTaka(it)) }
                    }
                }
                Text(
                    meta,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                if (option.freeShipping) "FREE" else formatTaka(option.price),
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = if (option.freeShipping) extra.success else MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/* ─── warehouses ─────────────────────────────────────────────────────────── */

@Composable
private fun HubWarehouseCard(row: WarehouseRow, openPage: (pageId: String, query: String) -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        row.name,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        row.addressLabel,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                if (row.verified) {
                    Icon(
                        Icons.Outlined.Verified,
                        null,
                        tint = LocalZylodExtra.current.success,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 12.dp)) {
                Text(
                    row.companyName,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier
                        .weight(1f)
                        .clickable(enabled = row.supplierId != null) {
                            openPage("supplier-storefront", "supplierId=${row.supplierId}")
                        },
                )
                Icon(
                    Icons.Outlined.Star,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(12.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    if ((row.ratingAvg ?: 0.0) > 0.0) {
                        String.format(Locale.US, "%.1f", row.ratingAvg)
                    } else {
                        "New"
                    } + if ((row.ratingCount ?: 0) > 0) " (${row.ratingCount})" else "",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/* ─── shared pieces ──────────────────────────────────────────────────────── */

@Composable
private fun HubSectionTitle(title: String) {
    Text(
        title,
        fontSize = 16.sp,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurface,
    )
}

@Composable
private fun HubNoticeCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(20.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(12.dp))
            Text(text, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Amber banner over the cached hub lists — the LiveChatScreen banner style. */
@Composable
private fun HubOfflineBanner(text: String) {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(text, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}
