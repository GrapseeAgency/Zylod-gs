package com.zylod.wholesale.ui.home

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.FlashOn
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.data.api.BannerDto
import com.zylod.wholesale.data.api.CategoryDto
import com.zylod.wholesale.data.api.DealDto
import com.zylod.wholesale.data.api.ProductDto
import com.zylod.wholesale.data.api.StatsDto
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import kotlin.math.roundToInt

/**
 * t233 page metadata — the Kotlin-side registry entry for the SPA pageId
 * "home" (src/lib/page-loader.ts). The home tab root renders THIS screen:
 * banners + stats + deals + categories + an infinitely appending featured
 * grid, all native Compose.
 */
data object HomePageMeta : NativePageMeta() {
    override val pageId = "home"
    override val title = "Zylod"
    override val category = "Storefront"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null // Home composes its own five endpoints in HomeViewModel
    override val summary =
        "The Zylod wholesale marketplace home: live banners, marketplace stats, hot deals, " +
            "top categories and an endlessly appending featured-product grid."
    override val tabHint = "home"
    override val bullets = listOf(
        "Banners come from the real banners table (GET api/banners?position=home_top).",
        "Featured grid appends page by page from GET api/products — smooth, keyed, no jank.",
        "Offline, the last saved home renders from the device cache.",
    )
    override val related = listOf(
        NativePageLink("category-browser", "Categories"),
        NativePageLink("flash-deals", "Hot Deals"),
        NativePageLink("cart", "Cart"),
    )
}

/**
 * NATIVE Home (t233 directive — the SPA no longer renders any page in the
 * app; the home tab root is this Compose screen).
 *
 * Structure: header brand row → banner rail → stats strip → deals rail →
 * category chips → featured grid with infinite append. Tab-like destination
 * (bottom bar visible, home highlighted, onBack == null): system Back on the
 * home route is moveTaskToBack (root semantics) and bottom-bar taps pop back
 * to this route via ZylodRoot's popBackStack(HOME_ROUTE) contract.
 */
@Composable
fun HomeScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: HomeViewModel = viewModel { HomeViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            state.error != null -> HomeErrorState(message = state.error.orEmpty(), onRetry = vm::refresh)
            else -> HomeContent(state = state, onLoadMore = vm::loadMore, openPage = openPage)
        }
    }
}

@Composable
private fun HomeContent(
    state: HomeUiState,
    onLoadMore: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val listState = rememberLazyListState()
    LaunchedEffect(listState) {
        snapshotFlow {
            val info = listState.layoutInfo
            val last = info.visibleItemsInfo.lastOrNull()
            when {
                last == null -> Int.MAX_VALUE
                last.index < info.totalItemsCount - 1 -> Int.MAX_VALUE
                else -> info.viewportEndOffset - (last.offset + last.size)
            }
        }.collect { pxBelowLast -> if (pxBelowLast <= LOAD_MORE_THRESHOLD_PX) onLoadMore() }
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "brand", contentType = "header") {
            Text(
                "Zylod",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { HomeOfflineBanner() }
        }
        if (state.banners.isNotEmpty()) {
            items(state.banners, key = { "banner-${it.id}" }, contentType = { "banner" }) { banner ->
                BannerCard(banner, openPage)
            }
        }
        state.stats?.let { stats ->
            item(key = "stats", contentType = "stats") { StatsStrip(stats) }
        }
        if (state.dealsRaw.isNotEmpty()) {
            item(key = "deals-header", contentType = "header") { SectionTitle("Hot deals", Icons.Outlined.FlashOn, "flash-deals", openPage) }
            item(key = "deals-rail", contentType = "deals") { DealsRail(state.dealsRaw, openPage) }
        }
        if (state.categories.isNotEmpty()) {
            item(key = "cats-header", contentType = "header") { SectionTitle("Shop by category", Icons.Outlined.GridView, "category-browser", openPage) }
            item(key = "cats-grid", contentType = "categories") { CategoryChips(state.categories, openPage) }
        }
        item(key = "featured-header", contentType = "header") {
            SectionTitle("Featured products", Icons.Outlined.LocalOffer, "all-products", openPage)
        }
        featuredGrid(state.products, openPage)
        if (state.loadingMore) {
            item(key = "footer-loading", contentType = "footer") {
                Box(Modifier.fillMaxWidth().padding(vertical = 10.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                }
            }
        }
        if (!state.canLoadMore && !state.loadingMore && state.products.isNotEmpty()) {
            item(key = "footer-end", contentType = "footer") {
                Text(
                    "You've reached the end of the featured catalog",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                )
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** Auto-append distance (raw px below the last row) — DealsScreen contract. */
private const val LOAD_MORE_THRESHOLD_PX = 400

private fun LazyListScope.featuredGrid(
    products: List<ProductDto>,
    openPage: (pageId: String, query: String) -> Unit,
) {
    products.chunked(2).forEachIndexed { rowIndex, pair ->
        item(key = "featured-row-$rowIndex-${pair.first().id}", contentType = "product-row") {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                pair.forEach { product ->
                    Box(Modifier.weight(1f)) { FeaturedCard(product, openPage) }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun SectionTitle(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    targetPageId: String,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable { openPage(targetPageId, "") },
    ) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            title,
            fontSize = 15.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.weight(1f))
        Text(
            "See all",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

/** One REAL banner row (banners table) — image + title/subtitle overlay. */
@Composable
private fun BannerCard(banner: BannerDto, openPage: (pageId: String, query: String) -> Unit) {
    val context = LocalContext.current
    val url = remember(banner.imageUrl) { resolveUrl(banner.imageUrl) }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(banner.linkPageId != null) {
                openPage(banner.linkPageId ?: "home", banner.linkParams ?: "")
            },
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(2.6f)) {
            if (url != null) {
                val placeholder = remember { ColorPainter(MaterialTheme.colorScheme.surfaceVariant) }
                AsyncImage(
                    model = remember(url) { ImageRequest.Builder(context).data(url).crossfade(200).build() },
                    contentDescription = banner.title,
                    placeholder = placeholder,
                    error = placeholder,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.primaryContainer))
            }
            Column(
                Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(androidx.compose.ui.graphics.Color.Transparent, androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.55f))))
                    .padding(12.dp),
            ) {
                Text(
                    banner.title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    color = androidx.compose.ui.graphics.Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                banner.subtitle?.takeIf(String::isNotBlank)?.let {
                    Text(
                        it,
                        fontSize = 11.sp,
                        color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.85f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun StatsStrip(stats: StatsDto) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        StatBlock("${stats.productCount}", "Products", Modifier.weight(1f))
        StatBlock("${stats.supplierCount}", "Suppliers", Modifier.weight(1f))
    }
}

@Composable
private fun StatBlock(value: String, label: String, modifier: Modifier = Modifier) {
    Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surfaceContainer, modifier = modifier) {
        Column(Modifier.padding(12.dp)) {
            Text(value, fontSize = 18.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
            Text(label, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun DealsRail(deals: List<DealDto>, openPage: (pageId: String, query: String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        deals.take(3).forEach { deal ->
            val productId = deal.effectiveId
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceContainer,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(productId != null) {
                        openPage("product-detail", "productId=$productId")
                    },
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(10.dp)) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(44.dp)
                            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
                    ) {
                        Icon(Icons.Outlined.LocalOffer, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            deal.effectiveName ?: "Deal",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            formatBdt(deal.effectivePrice),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                    Icon(
                        Icons.Outlined.FlashOn,
                        null,
                        tint = LocalZylodExtra.current.warning,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun CategoryChips(categories: List<CategoryDto>, openPage: (pageId: String, query: String) -> Unit) {
    categories.chunked(2).forEachIndexed { rowIndex, pair ->
        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = if (rowIndex == 0) 0.dp else 10.dp),
        ) {
            pair.forEach { category ->
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.primaryContainer,
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            openPage("category-products", "category=${category.slug ?: category.id}")
                        },
                ) {
                    Column(Modifier.padding(10.dp)) {
                        Text(
                            category.name,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            "${category.productCount} products",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.75f),
                        )
                    }
                }
            }
            if (pair.size == 1) Spacer(Modifier.weight(1f))
        }
    }
}

@Composable
private fun FeaturedCard(product: ProductDto, openPage: (pageId: String, query: String) -> Unit) {
    val context = LocalContext.current
    val url = remember(product.firstImage) { resolveUrl(product.firstImage) }
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { openPage("product-detail", "productId=${product.id}") },
    ) {
        Column {
            Box(
                Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                if (url != null) {
                    val placeholder = remember { ColorPainter(MaterialTheme.colorScheme.surfaceVariant) }
                    AsyncImage(
                        model = remember(url) { ImageRequest.Builder(context).data(url).crossfade(200).build() },
                        contentDescription = product.name,
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Text(
                        product.name.take(1).uppercase(),
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Column(Modifier.padding(10.dp)) {
                Text(
                    product.name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 15.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                product.supplier?.companyName?.let {
                    Text(
                        it,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                    Text(
                        formatBdt(product.basePrice),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        "MOQ ${product.moq}",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeOfflineBanner() {
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
                "You're offline — showing your last saved home",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun HomeErrorState(message: String, onRetry: () -> Unit) {
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
            Icon(Icons.Outlined.Storefront, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(36.dp))
        }
        Text(
            "Can't load Home right now",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            message,
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

private fun resolveUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val base = com.zylod.wholesale.data.api.ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}

private fun formatBdt(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + java.text.NumberFormat.getIntegerInstance().format(value.toLong())
    else "৳" + String.format(java.util.Locale.US, "%.2f", value)
