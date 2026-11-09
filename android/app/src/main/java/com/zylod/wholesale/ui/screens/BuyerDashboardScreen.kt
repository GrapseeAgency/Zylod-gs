package com.zylod.wholesale.ui.screens

import android.content.Context
import android.util.Log
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Savings
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.BuyerDashboardApi
import com.zylod.wholesale.data.api.BuyerDashboardDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.apiQty
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import com.zylod.wholesale.ui.wallet.formatBdt
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * t282 — NATIVE Kotlin screen for the SPA pageId "buyer-dashboard".
 *
 * The t233-era curated-bullets body is GONE: this pageId now renders the
 * REAL GET api/buyer/dashboard payload (src/app/api/buyer/dashboard/route.ts,
 * the exact shape buyer-dashboard-page.tsx consumes):
 *
 *  - the five stats (total orders, total spent, active/unpaid orders,
 *    wishlist count, coupon savings);
 *  - the 6-month spending chart (real monthly totals, bar heights
 *    proportional to the max month — no invented numbers);
 *  - recent orders (order-detail links), favorite suppliers (real
 *    order-item-derived counts), wishlist previews (PDP links), recent
 *    searches (search chips), and the merged recent-activity feed;
 *  - 401 guests → the honest in-screen sign-in CTA (web parity);
 *  - offline → last saved snapshot under prefs "zylod_config"/
 *    "native_buyer_dashboard_cache" with the honest banner.
 */
data object BuyerDashboardPageMeta : NativePageMeta() {
    override val pageId = "buyer-dashboard"
    override val title = "Buyer Dashboard"
    override val category = "Dashboards & Analytics"
    override val kind = NativePageKind.CONTENT
    override val endpoint = "api/buyer/dashboard" // typed VM below owns the call
    override val summary =
        "Your real buying stats: GET api/buyer/dashboard — totals, unpaid count, savings, " +
            "the 6-month spending chart, recent orders, favorite suppliers, wishlist " +
            "previews, recent searches and the activity feed."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Requires sign-in — guests see the in-screen sign-in CTA (Orders-screen convention).",
        "Every number comes from the server aggregation — no invented figures, ever.",
        "Offline, the last saved dashboard renders from the device cache.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "My Orders"),
        NativePageLink("wishlist", "Wishlist"),
        NativePageLink("my-wallet", "My Wallet"),
    )
}

/* ─── ViewModel ──────────────────────────────────────────────────────────── */

data class BuyerDashboardUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val data: BuyerDashboardDto? = null,
    val offline: Boolean = false,
    val error: String? = null,
)

@Serializable
private data class BuyerDashboardSnapshot(val data: BuyerDashboardDto? = null)

class BuyerDashboardViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(BuyerDashboardUiState())
    val state: StateFlow<BuyerDashboardUiState> = _state.asStateFlow()

    private var api: BuyerDashboardApi? = null

    /** Entry pull / retry (t208 convention: called on EVERY entry). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = BuyerDashboardUiState(loading = false, needsAuth = true)
            return
        }
        val hasData = _state.value.data != null
        _state.update { it.copy(loading = !hasData, error = null, needsAuth = false) }
        viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.buyerDashboardApi(baseUrl).also { api = it }
            val response = client.dashboard()
            if (response.code() == 401) {
                _state.value = BuyerDashboardUiState(loading = false, needsAuth = true)
                return
            }
            val envelope = response.body()
            val data = envelope?.takeIf { it.success }?.data
            if (envelope == null || (!envelope.success && data == null)) {
                degrade("Server error — the dashboard is temporarily unavailable.")
                return
            }
            _state.value = BuyerDashboardUiState(loading = false, data = data, offline = false)
            persist(data)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "buyer dashboard refresh failed: ${e.message}")
            degrade("Network error — check your connection and retry.")
        }
    }

    private suspend fun degrade(message: String) {
        val inMemory = _state.value.data
        if (inMemory != null) {
            _state.update { it.copy(loading = false, offline = true, error = null) }
            return
        }
        val saved = withContext(Dispatchers.IO) { readSnapshot() }
        if (saved?.data != null) {
            _state.value = BuyerDashboardUiState(loading = false, data = saved.data, offline = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persist(data: BuyerDashboardDto?) {
        if (data == null) return
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val raw = ApiClient.json.encodeToString(BuyerDashboardSnapshot.serializer(), BuyerDashboardSnapshot(data))
                appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, raw).apply()
            }.onFailure { Log.w(TAG, "buyer dashboard cache write failed: ${it.message}") }
        }
    }

    private fun readSnapshot(): BuyerDashboardSnapshot? = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return null
        ApiClient.json.decodeFromString(BuyerDashboardSnapshot.serializer(), raw)
    }.onFailure { Log.w(TAG, "buyer dashboard cache read failed: ${it.message}") }.getOrNull()

    private companion object {
        const val TAG = "ZylodBuyerDashboard"
        const val PREFS = "zylod_config"
        const val KEY = "native_buyer_dashboard_cache"
    }
}

/* ─── Screen ─────────────────────────────────────────────────────────────── */

/**
 * Typed Buyer Dashboard (t282). Profile-tab sub-page: back arrow present,
 * tabHint "profile"; needsAuth soft CTA.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BuyerDashboardScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: BuyerDashboardViewModel = viewModel(key = "native-buyer-dashboard") {
        BuyerDashboardViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Buyer Dashboard",
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
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                state.needsAuth -> BuyerDashboardNeedsAuth(openPage = openPage)
                state.error != null -> BuyerDashboardError(onRetry = vm::refresh)
                else -> state.data?.let { data ->
                    BuyerDashboardContent(data = data, offline = state.offline, openPage = openPage)
                }
            }
        }
    }
}

@Composable
private fun BuyerDashboardContent(
    data: BuyerDashboardDto,
    offline: Boolean,
    openPage: (pageId: String, query: String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (offline) {
            item(key = "offline-banner", contentType = "banner") { BuyerDashboardOfflineBanner() }
        }

        // ── Stats (the five real numbers) ──
        item(key = "stats", contentType = "stats") {
            val stats = data.stats
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Outlined.ReceiptLong,
                        label = "Total orders",
                        value = (stats?.totalOrders ?: 0).toString(),
                    )
                    StatCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Outlined.AccountBalanceWallet,
                        label = "Total spent",
                        value = formatBdt(stats?.totalSpentBDT ?: 0.0),
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Outlined.Schedule,
                        label = "Unpaid orders",
                        value = (stats?.activeOrders ?: 0).toString(),
                    )
                    StatCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Outlined.Savings,
                        label = "Coupon savings",
                        value = formatBdt(stats?.totalSavingsBDT ?: 0.0),
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Outlined.Inventory2,
                        label = "Wishlist items",
                        value = (stats?.wishlistCount ?: 0).toString(),
                    )
                    Spacer(Modifier.weight(1f))
                }
            }
        }

        // ── 6-month spending chart (real proportions) ──
        if (data.spendingData.isNotEmpty()) {
            item(key = "spending", contentType = "section") {
                BuyerDashboardSection(title = "Spending — last 6 months") {
                    SpendingChart(data.spendingData)
                }
            }
        }

        // ── Recent orders ──
        if (data.recentOrders.isNotEmpty()) {
            item(key = "orders-header", contentType = "header") {
                BuyerDashboardSectionHeader(
                    title = "Recent orders",
                    actionLabel = "View all",
                    onAction = { openPage("buyer-orders", "") },
                )
            }
            items(data.recentOrders.size, key = { data.recentOrders[it].stableKey }, contentType = { "order-row" }) { index ->
                val order = data.recentOrders[index]
                DashboardOrderRow(order = order, openPage = openPage)
            }
        }

        // ── Favorite suppliers ──
        if (data.favoriteSuppliers.isNotEmpty()) {
            item(key = "suppliers-header", contentType = "header") {
                BuyerDashboardSectionHeader(
                    title = "Suppliers you buy from",
                    actionLabel = null,
                    onAction = {},
                )
            }
            item(key = "suppliers-row", contentType = "chips") {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    data.favoriteSuppliers.forEach { supplier ->
                        SupplierChip(supplier = supplier)
                    }
                }
            }
        }

        // ── Wishlist previews ──
        if (data.wishlistItems.isNotEmpty()) {
            item(key = "wishlist-header", contentType = "header") {
                BuyerDashboardSectionHeader(
                    title = "Saved for later",
                    actionLabel = "Wishlist",
                    onAction = { openPage("wishlist", "") },
                )
            }
            item(key = "wishlist-row", contentType = "rail") {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    data.wishlistItems.forEach { item ->
                        WishlistPreviewTile(item = item, openPage = openPage)
                    }
                }
            }
        }

        // ── Recent searches ──
        val searches = data.recentSearches.mapNotNull { it.effectiveQuery }
        if (searches.isNotEmpty()) {
            item(key = "searches-header", contentType = "header") {
                BuyerDashboardSectionHeader(title = "Recent searches", actionLabel = null, onAction = {})
            }
            item(key = "searches-row", contentType = "chips") {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    searches.forEach { q ->
                        Surface(
                            shape = RoundedCornerShape(50),
                            color = MaterialTheme.colorScheme.surfaceContainer,
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
                            modifier = Modifier.clickable { openPage("search-results", "query=${android.net.Uri.encode(q)}") },
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                                Icon(Icons.Outlined.History, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(q, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
                            }
                        }
                    }
                }
            }
        }

        // ── Recent activity ──
        if (data.recentActivity.isNotEmpty()) {
            item(key = "activity-header", contentType = "header") {
                BuyerDashboardSectionHeader(title = "Recent activity", actionLabel = null, onAction = {})
            }
            items(data.recentActivity.size, key = { "activity-$it-${data.recentActivity[it].text.orEmpty().hashCode()}" }, contentType = { "activity-row" }) { index ->
                val activity = data.recentActivity[index]
                ActivityRow(activity = activity)
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

@Composable
private fun StatCard(modifier: Modifier, icon: ImageVector, label: String, value: String) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = modifier,
    ) {
        Column(Modifier.padding(12.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
            Text(
                value,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 6.dp),
            )
            Text(
                label,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun BuyerDashboardSection(title: String, content: @Composable () -> Unit) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(
                title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
private fun BuyerDashboardSectionHeader(title: String, actionLabel: String?, onAction: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(
            title,
            fontSize = 14.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        if (actionLabel != null) {
            Text(
                actionLabel,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable(onClick = onAction),
            )
        }
    }
}

/** Bar heights are proportional to the max month — real proportions, no styling invention. */
@Composable
private fun SpendingChart(points: List<com.zylod.wholesale.data.api.BuyerSpendingPointDto>) {
    val max = points.maxOfOrNull { it.amount }?.takeIf { it > 0.0 } ?: 0.0
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth().height(110.dp),
    ) {
        points.forEach { point ->
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                Box(Modifier.weight(1f), contentAlignment = Alignment.BottomCenter) {
                    if (max > 0.0 && point.amount > 0.0) {
                        val fraction = (point.amount / max).toFloat().coerceIn(0.04f, 1f)
                        Box(
                            Modifier
                                .fillMaxWidth(0.55f)
                                .height((86 * fraction).dp)
                                .background(
                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.85f),
                                    RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp),
                                ),
                        )
                    }
                }
                Text(
                    point.month.orEmpty(),
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun DashboardOrderRow(
    order: com.zylod.wholesale.data.api.BuyerDashboardOrderDto,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val imageUrl = remember(order.thumbnailUrl) { resolveUrl(order.thumbnailUrl) }
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(order.effectiveOrderId != null) {
                openPage("order-detail", "orderId=${order.effectiveOrderId}")
            },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(10.dp)) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(48.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
            ) {
                if (imageUrl != null) {
                    val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
                    val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
                    AsyncImage(
                        model = remember(imageUrl) { ImageRequest.Builder(context).data(imageUrl).crossfade(200).build() },
                        contentDescription = order.summary,
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Icon(Icons.Outlined.Inventory2, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                }
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    "Order ${order.orderNumber ?: order.stableKey.takeLast(8)}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOfNotNull(order.summary, order.supplier).joinToString(" · "),
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val status = order.status
                if (!status.isNullOrBlank()) {
                    Text(
                        status.replaceFirstChar { it.uppercase() },
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
            Text(
                formatBdt(order.totalAmount),
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun SupplierChip(supplier: com.zylod.wholesale.data.api.BuyerFavoriteSupplierDto) {
    Surface(
        shape = RoundedCornerShape(50),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            Icon(Icons.Outlined.Storefront, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                supplier.name.orEmpty(),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.width(6.dp))
            Text(
                "${supplier.orderCount} order${if (supplier.orderCount == 1) "" else "s"}",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun WishlistPreviewTile(
    item: com.zylod.wholesale.data.api.BuyerDashboardWishlistItemDto,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val imageUrl = remember(item.thumbnailUrl) { resolveUrl(item.thumbnailUrl) }
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier
            .width(132.dp)
            .clickable(item.effectiveProductId != null) {
                openPage("product-detail", "productId=${item.effectiveProductId}")
            },
    ) {
        Column {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(84.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                if (imageUrl != null) {
                    val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
                    val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
                    AsyncImage(
                        model = remember(imageUrl) { ImageRequest.Builder(context).data(imageUrl).crossfade(200).build() },
                        contentDescription = item.name,
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Icon(Icons.Outlined.Inventory2, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(22.dp))
                }
            }
            Column(Modifier.padding(8.dp)) {
                Text(
                    item.name.orEmpty(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                    Text(
                        formatBdt(item.price),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        "MOQ ${item.moq.apiQty()}",
                        fontSize = 9.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun ActivityRow(activity: com.zylod.wholesale.data.api.BuyerRecentActivityDto) {
    val icon = if (activity.type == "wishlist") Icons.Outlined.Inventory2 else Icons.Outlined.TrendingUp
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    activity.text.orEmpty(),
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                val time = activity.time
                if (!time.isNullOrBlank()) {
                    Text(
                        remember(time) { formatActivityTime(time) },
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun BuyerDashboardNeedsAuth(openPage: (pageId: String, query: String) -> Unit) {
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
            Icon(Icons.Outlined.ReceiptLong, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(36.dp))
        }
        Text(
            "Sign in to see your dashboard",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Your orders, spending and savings in one place.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("login", "") },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Sign in", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun BuyerDashboardError(onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Icon(
            Icons.Outlined.CloudOff,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(36.dp),
        )
        Text(
            "Can't load your dashboard",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun BuyerDashboardOfflineBanner() {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, warning.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
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

/** "02 Oct 2026" for activity rows (the web's fmt convention, t282 shared util). */
private fun formatActivityTime(iso: String): String =
    com.zylod.wholesale.util.formatIsoDate(iso)

private fun resolveUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val base = com.zylod.wholesale.data.api.ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}
