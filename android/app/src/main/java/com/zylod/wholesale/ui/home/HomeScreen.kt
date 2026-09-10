package com.zylod.wholesale.ui.home

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Apartment
import androidx.compose.material.icons.outlined.Apps
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ContentCut
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Factory
import androidx.compose.material.icons.outlined.FlashOn
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Percent
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.RequestQuote
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Sell
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.zylod.wholesale.data.api.CategoryDto
import com.zylod.wholesale.data.api.DealDto
import com.zylod.wholesale.data.api.ProductDto
import com.zylod.wholesale.data.api.StatsDto
import com.zylod.wholesale.ui.theme.QuickChipColors
import com.zylod.wholesale.ui.theme.QuickChipGradients
import kotlin.math.floor

// Faithful port of src/components/mobile/mobile-home-page.tsx (Phase 0 reference).
// Section order: top bar → search → category pills → quick access → flash deals
// → product grid. Sticky-on-scroll search bar is deferred to Phase 1.

@Composable
fun HomeScreen(navigateToPage: (pageId: String, query: String) -> Unit) {
    val context = LocalContext.current
    val vm: HomeViewModel = viewModel { HomeViewModel(context.applicationContext) }
    val state by vm.state.collectAsState()

    when {
        state.loading -> HomeLoading()
        state.error != null -> HomeError(state.error!!) { vm.refresh() }
        else -> HomeContent(state, vm, navigateToPage)
    }
}

@Composable
private fun HomeContent(state: HomeUiState, vm: HomeViewModel, navigateToPage: (String, String) -> Unit) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(horizontal = 12.dp),
    ) {
        item { HomeTopBar(navigateToPage) }
        item { SearchPill(onClick = { navigateToPage("search-home", "") }) }
        item { StatsCaption(state.stats) }
        item { CategoryPills(state.categories) { slug -> navigateToPage("category-products", "category=$slug") } }
        item { QuickAccessCard(navigateToPage) }
        item { FlashDealsRow(state.deals, state.serverUrl, navigateToPage) }
        val rows = state.products.chunked(2)
        items(rows.size) { rowIdx ->
            val row = rows[rowIdx]
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { product ->
                    ProductCard(product, state.serverUrl, Modifier.weight(1f)) {
                        navigateToPage("product-detail", "productId=${product.id}")
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            if (rowIdx == rows.lastIndex && state.page < state.totalPages) {
                LoadMoreItem(state.loadingMore) { vm.loadMore() }
            }
        }
        if (rows.isEmpty()) {
            item {
                Text(
                    "No products found",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 32.dp).fillMaxWidth(),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun HomeTopBar(navigateToPage: (String, String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().height(48.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("Zylod", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.weight(1f))
        IconButton(onClick = { navigateToPage("notifications", "") }) {
            Icon(Icons.Outlined.Notifications, "Notifications", tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        IconButton(onClick = { navigateToPage("category-browser", "") }) {
            Icon(Icons.Outlined.Menu, "Menu", tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SearchPill(onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(50),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp)) {
            Icon(Icons.Outlined.Search, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(8.dp))
            Text("Search products, suppliers...", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun StatsCaption(stats: StatsDto?) {
    if (stats == null) return
    Text(
        "${compact(stats.productCount)}+ products · ${compact(stats.supplierCount)}+ verified suppliers",
        fontSize = 10.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 10.dp),
    )
}

@Composable
private fun CategoryPills(categories: List<CategoryDto>, onCategory: (String) -> Unit) {
    if (categories.isEmpty()) return
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 10.dp)) {
        items(categories, key = { it.id }) { category ->
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.secondary,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
                modifier = Modifier.clickable { category.slug?.let(onCategory) },
            ) {
                Text(
                    category.name,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                )
            }
        }
    }
}

private data class QuickLink(
    val label: String,
    val icon: ImageVector,
    val tint: Color,
    val gradient: Array<Color>,
    val pageId: String,
)

private val PRIMARY_LINKS = listOf(
    QuickLink("Explore", Icons.Outlined.Explore, QuickChipColors.Explore, QuickChipGradients.Red, "explore"),
    QuickLink("Trending", Icons.Outlined.TrendingUp, QuickChipColors.Trending, QuickChipGradients.Red, "trending-products"),
    QuickLink("Flash Sale", Icons.Outlined.FlashOn, QuickChipColors.FlashSale, QuickChipGradients.Orange, "flash-sale"),
    QuickLink("Daily Deals", Icons.Outlined.ContentCut, QuickChipColors.DailyDeals, QuickChipGradients.Red, "daily-deals"),
    QuickLink("New Arrivals", Icons.Outlined.AutoAwesome, QuickChipColors.NewArrivals, QuickChipGradients.Blue, "new-arrivals"),
    QuickLink("Clearance", Icons.Outlined.Sell, QuickChipColors.Clearance, QuickChipGradients.Red, "clearance"),
    QuickLink("Seasonal", Icons.Outlined.WorkspacePremium, QuickChipColors.Seasonal, QuickChipGradients.Green, "seasonal-offers"),
    QuickLink("Brands", Icons.Outlined.Apartment, QuickChipColors.Brands, QuickChipGradients.Purple, "brand-showcase"),
)

private val MORE_LINKS = listOf(
    QuickLink("Categories", Icons.Outlined.Apps, QuickChipColors.Categories, QuickChipGradients.Blue, "category-browser"),
    QuickLink("Coupons", Icons.Outlined.Percent, QuickChipColors.Coupons, QuickChipGradients.Red, "coupons"),
    QuickLink("Suppliers", Icons.Outlined.Storefront, QuickChipColors.Suppliers, QuickChipGradients.Red, "suppliers"),
    QuickLink("Trade Assurance", Icons.Outlined.Security, QuickChipColors.TradeAssurance, QuickChipGradients.Blue, "suppliers"),
    QuickLink("Easy Payments", Icons.Outlined.CreditCard, QuickChipColors.EasyPayments, QuickChipGradients.Green, "checkout"),
    QuickLink("Fast Shipping", Icons.Outlined.LocalShipping, QuickChipColors.FastShipping, QuickChipGradients.Purple, "orders"),
    QuickLink("Top Deals", Icons.Outlined.Schedule, QuickChipColors.TopDeals, QuickChipGradients.Orange, "top-deals"),
    QuickLink("Bulk Orders", Icons.Outlined.Inventory2, QuickChipColors.BulkOrders, QuickChipGradients.Teal, "bulk-order"),
    QuickLink("RFQ", Icons.Outlined.RequestQuote, QuickChipColors.RFQ, QuickChipGradients.Grey, "rfq-list"),
    QuickLink("Support", Icons.Outlined.SupportAgent, QuickChipColors.Support, QuickChipGradients.Red, "support"),
    QuickLink("Cross-border", Icons.Outlined.Public, QuickChipColors.CrossBorder, QuickChipGradients.Blue, "cross-border"),
    QuickLink("Factory Direct", Icons.Outlined.Factory, QuickChipColors.FactoryDirect, QuickChipGradients.Green, "factory-direct"),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QuickAccessCard(navigateToPage: (String, String) -> Unit) {
    var moreOpen by remember { mutableStateOf(false) }
    Surface(
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.padding(top = 16.dp),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Quick Access", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                Text(
                    "More",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable { moreOpen = true },
                )
            }
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(top = 10.dp),
            ) {
                items(PRIMARY_LINKS, key = { it.label }) { link ->
                    QuickIcon(link) { navigateToPage(link.pageId, "") }
                }
                item(key = "+more") {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.width(68.dp).clickable { moreOpen = true },
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.size(44.dp).background(
                                MaterialTheme.colorScheme.surfaceVariant,
                                RoundedCornerShape(14.dp),
                            ),
                        ) {
                            Text("+${MORE_LINKS.size}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text("More", fontSize = 10.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 6.dp))
                    }
                }
            }
        }
    }

    if (moreOpen) {
        ModalBottomSheet(onDismissRequest = { moreOpen = false }) {
            Column(Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
                Text("All Services", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(12.dp))
                MORE_LINKS.chunked(4).forEach { rowLinks ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                        rowLinks.forEach { link ->
                            QuickIcon(link, Modifier.weight(1f)) {
                                moreOpen = false
                                navigateToPage(link.pageId, "")
                            }
                        }
                        repeat(4 - rowLinks.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickIcon(link: QuickLink, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier.width(68.dp).clickable(onClick = onClick).padding(vertical = 2.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(44.dp)
                .background(Brush.linearGradient(link.gradient.toList()), RoundedCornerShape(14.dp)),
        ) {
            Icon(link.icon, link.label, tint = link.tint, modifier = Modifier.size(20.dp))
        }
        Text(
            link.label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}

@Composable
private fun FlashDealsRow(deals: List<DealDto>, serverUrl: String, navigateToPage: (String, String) -> Unit) {
    if (deals.isEmpty()) return
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(top = 12.dp),
    ) {
        items(deals, key = { it.effectiveId ?: it.hashCode().toString() }) { deal ->
            Column(
                modifier = Modifier.width(58.dp).clickable {
                    deal.effectiveId?.let { navigateToPage("product-detail", "productId=$it") }
                },
            ) {
                DealImage(deal, serverUrl)
                Text(
                    formatBdt(deal.effectivePrice),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

@Composable
private fun DealImage(deal: DealDto, serverUrl: String) {
    val url = resolveImageUrl(deal.effectiveImage, serverUrl)
    Surface(shape = MaterialTheme.shapes.small, color = MaterialTheme.colorScheme.card, modifier = Modifier.fillMaxWidth().aspectRatio(1f)) {
        if (url != null) {
            AsyncImage(model = url, contentDescription = deal.effectiveName, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Inventory2, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun ProductCard(product: ProductDto, serverUrl: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        shape = MaterialTheme.shapes.extraSmall,
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = modifier.clickable(onClick = onClick),
    ) {
        Column {
            ProductImage(product, serverUrl)
            Column(Modifier.padding(horizontal = 6.dp, vertical = 5.dp)) {
                Text(
                    product.name,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    lineHeight = 13.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    minLines = 2,
                )
                Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(top = 2.dp)) {
                    Text(formatBdt(product.basePrice), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    if (product.soldCount > 0) {
                        Spacer(Modifier.width(4.dp))
                        Text("${compact(product.soldCount)} sold", fontSize = 8.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProductImage(product: ProductDto, serverUrl: String) {
    val raw = product.firstImage
    val url = resolveImageUrl(raw?.takeIf { !it.startsWith("/placeholder") }, serverUrl)
    Surface(color = MaterialTheme.colorScheme.card, modifier = Modifier.fillMaxWidth().aspectRatio(5f / 6f)) {
        if (url != null) {
            AsyncImage(model = url, contentDescription = product.name, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            Box(contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Inventory2, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
            }
        }
    }
}

@Composable
private fun LoadMoreItem(loadingMore: Boolean, onLoadMore: () -> Unit) {
    Box(Modifier.fillMaxWidth().padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
        if (loadingMore) {
            CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
        } else {
            TextButton(onClick = onLoadMore) { Text("Load more", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary) }
        }
    }
}

@Composable
private fun HomeLoading() {
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(12.dp)) {
        SkeletonBox(Modifier.fillMaxWidth().height(40.dp), RoundedCornerShape(50))
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            repeat(3) { SkeletonBox(Modifier.weight(1f).height(30.dp), RoundedCornerShape(50)) }
        }
        Spacer(Modifier.height(16.dp))
        repeat(2) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(2) { SkeletonBox(Modifier.weight(1f).aspectRatio(0.78f), RoundedCornerShape(6.dp)) }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun SkeletonBox(modifier: Modifier = Modifier, shape: RoundedCornerShape) {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val alpha by transition.animateFloat(
        initialValue = 0.5f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
        label = "skeletonAlpha",
    )
    Box(
        modifier
            .alpha(alpha)
            .background(MaterialTheme.colorScheme.surfaceVariant, shape),
    )
}

@Composable
private fun HomeError(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(32.dp),
    ) {
        Icon(Icons.Outlined.CloudOff, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(16.dp))
        Text("Can't reach Zylod", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Text(
            message,
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(onClick = onRetry, modifier = Modifier.padding(top = 16.dp)) { Text("Retry") }
    }
}

private fun resolveImageUrl(raw: String?, serverUrl: String): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    if (serverUrl.isBlank()) return null
    return serverUrl.trimEnd('/') + raw
}

private fun formatBdt(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + java.text.NumberFormat.getIntegerInstance().format(value.toLong())
    else "৳" + String.format(java.util.Locale.US, "%.2f", value)

private fun compact(count: Int): String =
    if (count >= 1000) "${floor(count / 1000.0).toInt()}k" else count.toString()
