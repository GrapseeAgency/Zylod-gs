package com.zylod.wholesale.ui.logistics

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Verified
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.util.Locale

/**
 * SHARED typed warehouse-locator screen (pageIds warehouse-locator,
 * fulfillment-center — the ui/screens delegates call THIS with their
 * pageId, so every page keeps its own WarehouseLocatorViewModel instance
 * through the pageId-keyed factory below).
 *
 * Data truth: GET api/warehouses via [WarehouseLocatorViewModel] — the
 * REAL ship-from rows of approved suppliers. Structure mirrors
 * warehouse-locator-page.tsx: the search card (debounced q= hits + the
 * district chips with the All (total) chip), honest empty / error states,
 * facility rows (name, company, VERIFIED accent, address, real rating),
 * and the two real companion-tool cards (freight calculator / my orders).
 * Nothing is fabricated: no invented distances, utilization, or
 * capabilities the model cannot know.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WarehouseLocatorScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: WarehouseLocatorViewModel = viewModel(key = "native-warehouse-locator-$pageId") {
        WarehouseLocatorViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (pageId == "fulfillment-center") "Fulfillment Center" else "Warehouse Locator",
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
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(key = "locator-title", contentType = "header") {
                Column {
                    Text(
                        "Warehouse Directory",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        "Ship-from locations suppliers publish on Zylod — real rows, no invented distances.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            item(key = "locator-search", contentType = "search") {
                SearchCard(state = state, onSearch = vm::search, onDistrict = vm::setDistrict)
            }
            if (state.offlineFromCache) {
                item(key = "locator-offline", contentType = "banner") {
                    OfflineBannerRow("Offline — showing the last saved directory")
                }
            }
            when {
                state.loading -> item(key = "locator-skeleton", contentType = "skeleton") {
                    LocatorSkeleton()
                }
                state.error != null -> item(key = "locator-error", contentType = "notice") {
                    LocatorErrorCard(state.error.orEmpty(), onRetry = vm::retry)
                }
                state.filteredRows.isEmpty() -> item(key = "locator-empty", contentType = "notice") {
                    EmptyLocatorCard(total = state.total)
                }
                else -> items(state.filteredRows, key = { it.key }, contentType = { "facility" }) { row ->
                    FacilityCard(row = row, openPage = openPage)
                }
            }
            item(key = "locator-companions", contentType = "companions") {
                CompanionTools(openPage = openPage)
            }
        }
    }
}

/** Search card: debounced q= field + district chips (client-side facet). */
@Composable
private fun SearchCard(
    state: WarehouseLocatorUiState,
    onSearch: (String) -> Unit,
    onDistrict: (String?) -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedTextField(
                value = state.searchQuery,
                onValueChange = onSearch,
                placeholder = {
                    Text(
                        "Search by warehouse, company, city, or district…",
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
            if (state.districts.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    DistrictChip(label = "All (${state.total})", active = state.activeDistrict == null) {
                        onDistrict(null)
                    }
                    state.districts.forEach { district ->
                        DistrictChip(label = district, active = state.activeDistrict == district) {
                            onDistrict(if (state.activeDistrict == district) null else district)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DistrictChip(label: String, active: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(50),
        modifier = Modifier.clickable { onClick() },
    ) {
        Text(
            label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            color = if (active) {
                MaterialTheme.colorScheme.onPrimary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
        )
    }
}

@Composable
private fun FacilityCard(row: WarehouseRow, openPage: (pageId: String, query: String) -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = row.supplierId != null) {
                openPage("seller-storefront", "supplierId=${row.supplierId}")
            },
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        row.name,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        row.companyName,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                if (row.verified) {
                    Surface(
                        color = LocalZylodExtra.current.success.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(50),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        ) {
                            Icon(
                                Icons.Outlined.Verified,
                                null,
                                tint = LocalZylodExtra.current.success,
                                modifier = Modifier.size(11.dp),
                            )
                            Spacer(Modifier.width(3.dp))
                            Text(
                                "VERIFIED",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                color = LocalZylodExtra.current.success,
                            )
                        }
                    }
                }
            }
            Row(verticalAlignment = Alignment.Top) {
                Icon(
                    Icons.Outlined.LocationOn,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .size(14.dp)
                        .padding(top = 1.dp),
                )
                Spacer(Modifier.width(5.dp))
                Text(
                    row.addressLabel,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (row.hasRating) {
                Text(
                    "★ " + String.format(Locale.US, "%.1f", row.ratingAvg) +
                        " (" + row.ratingCount + " store review" + (if (row.ratingCount == 1) "" else "s") + ")",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .padding(top = 4.dp)
                    .fillMaxWidth(),
            ) {
                Text(
                    "${row.district} district",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                if (row.supplierId != null) {
                    Text(
                        "View supplier",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Icon(
                        Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }
    }
}

/** Web parity empty states — total 0 vs a filter/search miss. */
@Composable
private fun EmptyLocatorCard(total: Int) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
        ) {
            Icon(
                Icons.Outlined.Inventory2,
                null,
                tint = MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(28.dp),
            )
            Text(
                if (total == 0) "No warehouses published yet" else "Nothing matches that search",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                if (total == 0) {
                    "Suppliers publish their ship-from locations from their console — the directory fills as they do. Nothing is invented here."
                } else {
                    "Try a different name, city, or district — or clear the filters."
                },
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

/** Honest failure card: the error text + a Retry (web parity). */
@Composable
private fun LocatorErrorCard(message: String, onRetry: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
        ) {
            Icon(
                Icons.Outlined.ErrorOutline,
                null,
                tint = MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(28.dp),
            )
            Text(
                message,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                "Retry",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .padding(top = 12.dp)
                    .clickable { onRetry() },
            )
        }
    }
}

/** First load — row placeholders (web PageLoader parity). */
@Composable
private fun LocatorSkeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(3) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp),
            ) {}
        }
    }
}

/** The two real companion tools (web parity — both navigate natively). */
@Composable
private fun CompanionTools(openPage: (pageId: String, query: String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        CompanionCard(
            icon = Icons.Outlined.ReceiptLong,
            title = "Live freight quotes",
            caption = "The operators' real zone book — same rates checkout charges.",
            onClick = { openPage("shipping-calculator", "") },
            modifier = Modifier.weight(1f),
        )
        CompanionCard(
            icon = Icons.Outlined.LocalShipping,
            title = "Track a real shipment",
            caption = "Real tracking events live on each order's detail page.",
            onClick = { openPage("my-orders", "") },
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun CompanionCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    caption: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = modifier.clickable { onClick() },
    ) {
        Column(Modifier.padding(16.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            Text(
                title,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                caption,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

/** Amber banner over the cached rows — the LiveChatScreen banner style. */
@Composable
private fun OfflineBannerRow(text: String) {
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
