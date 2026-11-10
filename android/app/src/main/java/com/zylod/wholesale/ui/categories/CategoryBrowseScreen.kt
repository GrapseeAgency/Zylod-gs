package com.zylod.wholesale.ui.categories

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items as lazyRowItems
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.data.api.ProductDto
import com.zylod.wholesale.util.formatBdt

/**
 * t298 — the SHARED typed category browse screen: ONE implementation for
 * every pageId in page-loader.ts's CATEGORY_IDS set (20 rows), exactly like
 * the web's single GenericCategoryPage hosts all of them. The thin
 * ui/screens delegates (TextilesFabricsScreen, GarmentsScreen, …) keep their
 * own meta objects and pass this composable their pageId — the suppliercore
 * pageId-keyed delegation pattern.
 *
 * NO FAKE STUFF: the grid is the server's own category-scoped rows
 * (GET api/products?limit=24&category=<slug> — the web's exact call and
 * slug map below, verbatim from generic-category-page.tsx). Unmapped ids
 * pass the pageId itself as the filter → zero rows → the honest empty state
 * (the web's own two messages, mapped vs unmapped). The web's `selectedSub`
 * sub-filter is a dead state (declared, never set — no UI sets it), so it is
 * documented and skipped, not mirrored (the t296 dead-filter doctrine).
 */

/** pageId → REAL seeded category slug (generic-category-page.tsx CATEGORY_SLUG_MAP). */
val CATEGORY_SLUG_MAP: Map<String, String> = mapOf(
    "textiles-fabrics" to "textiles-fabrics",
    "agriculture-food" to "agriculture-food",
    "electronics" to "electronics",
    "construction" to "construction-hardware",
    "packaging" to "packaging-printing",
    "home-garden" to "home-garden",
    "gifts-crafts" to "gifts-crafts",
    "beauty-personal-care" to "beauty-personal-care",
    "promotional-items" to "promotional-items",
    "garments" to "garments-apparel",
    "spices" to "spices-condiments",
    "mobile-accessories" to "mobile-accessories",
    "led-lighting" to "led-lighting",
    "automotive" to "automotive-transport",
    "medical-supplies" to "health-medical",
)

fun categorySlugFor(pageId: String): String = CATEGORY_SLUG_MAP[pageId] ?: pageId

/** Banner copy + the web's own gradient stops (CATEGORY_META verbatim hexes). */
data class CategoryBannerMeta(
    val name: String,
    val description: String,
    val colorFrom: Long,
    val colorTo: Long,
)

val CATEGORY_META: Map<String, CategoryBannerMeta> = mapOf(
    "textiles-fabrics" to CategoryBannerMeta(
        "Textiles & Fabrics",
        "Premium Bangladeshi textiles — from Dhaka muslin to Narayanganj silk",
        0xFFE53935, 0xFFFF8A80,
    ),
    "agriculture-food" to CategoryBannerMeta(
        "Agriculture & Food",
        "Fresh Bangladeshi produce — from Rajshahi rice to Sylhet tea",
        0xFF2E7D32, 0xFF81C784,
    ),
    "electronics" to CategoryBannerMeta(
        "Electronics & Components",
        "Wholesale electronics and components",
        0xFF262626, 0xFF404040,
    ),
    "construction" to CategoryBannerMeta(
        "Construction & Hardware",
        "Building materials, hardware, and safety gear",
        0xFFE65100, 0xFFFFB74D,
    ),
    "packaging" to CategoryBannerMeta(
        "Packaging & Printing",
        "Boxes, bags, containers, and print materials",
        0xFF6A1B9A, 0xFFBA68C8,
    ),
    "home-garden" to CategoryBannerMeta(
        "Home & Garden",
        "Home decor, cookware, and garden supplies",
        0xFF00695C, 0xFF4DB6AC,
    ),
    "beauty-personal-care" to CategoryBannerMeta(
        "Beauty & Personal Care",
        "Cosmetics, skincare, and personal care wholesale",
        0xFFAD1457, 0xFFF06292,
    ),
    "gifts-crafts" to CategoryBannerMeta(
        "Gifts & Crafts",
        "Traditional Bangladeshi handicrafts and promotional items",
        0xFFC62828, 0xFFEF9A9A,
    ),
    "garments" to CategoryBannerMeta(
        "Garments & Apparel",
        "Ready-made garments and apparel from BGMEA-grade factories",
        0xFF4527A0, 0xFF7986CB,
    ),
    "spices" to CategoryBannerMeta(
        "Spices & Condiments",
        "Whole and ground spices direct from Chattogram importers",
        0xFFBF360C, 0xFFFF8A65,
    ),
    "automotive" to CategoryBannerMeta(
        "Automotive & Transport",
        "Parts, accessories, and transport equipment wholesale",
        0xFF37474F, 0xFF78909C,
    ),
    "medical-supplies" to CategoryBannerMeta(
        "Health & Medical",
        "Medical supplies and equipment from licensed distributors",
        0xFF00838F, 0xFF4DD0E1,
    ),
    // The web's meta also carries 'flash-sale'/'new-arrivals' rows for the
    // DEAL surfaces; the DEAL_IDS pages are the typed DealsScreen's family,
    // so only the 20 CATEGORY pageIds live in the native table.
)

/** Client-side sorts over the SAME 24 server rows — the web's four options. */
enum class CategorySort(val label: String) {
    POPULAR("Most Popular"),
    PRICE_LOW("Price: Low to High"),
    PRICE_HIGH("Price: High to Low"),
    RATING("Highest Rated"),
}

private fun sortedFor(sort: CategorySort, rows: List<ProductDto>): List<ProductDto> = when (sort) {
    // The web sorts sold desc for "popular" — the endpoint's own default order
    // is already soldCount desc, but the web re-sorts client-side; we mirror
    // the client-side sort so the ORDER matches the web for every option.
    CategorySort.POPULAR -> rows.sortedByDescending { it.soldCount }
    CategorySort.PRICE_LOW -> rows.sortedBy { it.basePrice }
    CategorySort.PRICE_HIGH -> rows.sortedByDescending { it.basePrice }
    CategorySort.RATING -> rows.sortedByDescending { it.ratingAvg }
}

/** 1.0 → "1", 12.5 → "12.5" — the web renders the raw JSON number. */
private fun formatCount(v: Double): String =
    if (v == v.toLong().toDouble()) v.toLong().toString() else v.toString()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryBrowseScreen(
    pageId: String,
    title: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CategoryBrowseViewModel = viewModel(key = "category-browse-$pageId") {
        CategoryBrowseViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val gridState = rememberLazyGridState()
    val snackbar = remember { SnackbarHostState() }

    var sort by remember(pageId) { mutableStateOf(CategorySort.POPULAR) }

    val meta = CATEGORY_META[pageId] ?: CategoryBannerMeta(
        name = pageId.replace('-', ' ').replaceFirstChar { it.uppercase() },
        description = "Explore wholesale ${pageId.replace('-', ' ')} products directly from verified Bangladeshi manufacturers.",
        colorFrom = 0xFFC8102E,
        colorTo = 0xFFE53935,
    )

    LaunchedEffect(state.toast) {
        state.toast?.let {
            snackbar.showSnackbar(it)
            vm.consumeToast()
        }
    }

    val visible = sortedFor(sort, state.products)

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        title,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
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
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        when {
            state.loading -> {
                // Loading ownership: one centered theme spinner — never a web
                // spinner (ARCHITECTURE.md §1.2).
                Box(
                    Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }
            state.error != null -> {
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(
                        Icons.Outlined.CloudOff,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(40.dp),
                    )
                    Spacer(Modifier.size(12.dp))
                    Text(
                        state.error ?: "",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.size(16.dp))
                    FilterChip(
                        selected = false,
                        onClick = { vm.refresh() },
                        label = { Text("Retry", fontWeight = FontWeight.Bold) },
                    )
                }
            }
            else -> {
                LazyVerticalGrid(
                    state = gridState,
                    columns = GridCells.Fixed(2),
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(
                        start = 16.dp, end = 16.dp, top = 12.dp, bottom = 24.dp,
                    ),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // Banner — the web's gradient header with the REAL copy.
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .background(
                                    Brush.linearGradient(
                                        listOf(
                                            Color(meta.colorFrom),
                                            Color(meta.colorTo),
                                        ),
                                    ),
                                    RoundedCornerShape(16.dp),
                                )
                                .padding(20.dp),
                        ) {
                            Column {
                                Text(
                                    meta.name,
                                    color = Color.White,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Black,
                                )
                                Spacer(Modifier.size(6.dp))
                                Text(
                                    meta.description,
                                    color = Color.White.copy(alpha = 0.92f),
                                    fontSize = 13.sp,
                                    lineHeight = 18.sp,
                                )
                            }
                        }
                    }

                    // Offline banner — the rows below are the SAVED grid.
                    if (state.offline) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp),
                            ) {
                                Icon(
                                    Icons.Outlined.CloudOff,
                                    null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(14.dp),
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    "Showing saved products — reconnect for the live category grid",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }

                    // Controls — the web's four sorts + the honest count.
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Column {
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                lazyRowItems(CategorySort.entries) { option ->
                                    FilterChip(
                                        selected = sort == option,
                                        onClick = { sort = option },
                                        label = {
                                            Text(
                                                option.label,
                                                fontSize = 12.sp,
                                                fontWeight = if (sort == option) FontWeight.Bold else FontWeight.Medium,
                                            )
                                        },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                                        ),
                                    )
                                }
                            }
                            Spacer(Modifier.size(6.dp))
                            Text(
                                "Showing ${visible.size} products",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    if (visible.isEmpty()) {
                        // The web's honest empty states — mapped ids vs unmapped.
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 48.dp, start = 24.dp, end = 24.dp),
                            ) {
                                Icon(
                                    Icons.Outlined.Inventory2,
                                    null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(44.dp),
                                )
                                Spacer(Modifier.size(12.dp))
                                Text(
                                    "No products in ${meta.name} yet",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                                Spacer(Modifier.size(6.dp))
                                Text(
                                    if (vm.mappedToSeededCategory) {
                                        "Verified suppliers are still listing into this category — check back soon."
                                    } else {
                                        "This category has no listings on Zylod yet. We only show real, verified inventory — never placeholder products."
                                    },
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    lineHeight = 18.sp,
                                )
                            }
                        }
                    } else {
                        items(visible, key = { it.id }) { product ->
                            CategoryProductCard(
                                product = product,
                                wished = product.id in state.wishedIds,
                                onToggleWishlist = { vm.toggleWishlist(product.id) },
                                onOpen = {
                                    openPage("product-detail", "productId=${product.id}")
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * The web's card (generic-category-page.tsx): square thumbnail (object-cover
 * on the web, Fit here per the t277 product-art rule), heart overlay top
 * right, 2-line name, RED price, MOQ line, star + rating (sold), supplier.
 */
@Composable
private fun CategoryProductCard(
    product: ProductDto,
    wished: Boolean,
    onToggleWishlist: () -> Unit,
    onOpen: () -> Unit,
) {
    val context = LocalContext.current
    val url = remember(product.id) { resolveProductImage(product) }

    Card(
        onClick = onOpen,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column {
            Box(
                Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
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
                        contentDescription = product.name,
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                        Icon(
                            Icons.Outlined.LocalOffer,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(28.dp),
                        )
                    }
                }
                // Heart — top-right white circle (the web's overlay).
                IconButton(
                    onClick = onToggleWishlist,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp)
                        .size(28.dp)
                        .background(
                            MaterialTheme.colorScheme.surface.copy(alpha = 0.9f),
                            RoundedCornerShape(14.dp),
                        ),
                ) {
                    Icon(
                        if (wished) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder,
                        if (wished) "Remove from wishlist" else "Add to wishlist",
                        tint = if (wished) Color(0xFFE31C3D) else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }

            Column(Modifier.padding(10.dp)) {
                Text(
                    product.name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 15.sp,
                )
                Spacer(Modifier.size(6.dp))
                Text(
                    formatBdt(product.basePrice),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFFC8102E),
                )
                Spacer(Modifier.size(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "MOQ: ${formatCount(product.moq)} ${product.unit ?: "pcs"}",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.weight(1f))
                    Icon(
                        Icons.Outlined.Star,
                        null,
                        tint = Color(0xFFF59E0B),
                        modifier = Modifier.size(10.dp),
                    )
                    Spacer(Modifier.width(2.dp))
                    Text(
                        "${String.format(java.util.Locale.US, "%.1f", product.ratingAvg)} (${formatCount(product.soldCount)})",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.size(6.dp))
                Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(4.dp)) {
                    Text(
                        product.supplier?.companyName ?: "Verified Supplier",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                    )
                }
            }
        }
    }
}

/** Relative API image paths resolve against the active server (FavoritesScreen convention). */
private fun resolveProductImage(product: ProductDto): String? {
    val raw = product.firstImage ?: return null
    if (raw.startsWith("http")) return raw
    val base = com.zylod.wholesale.data.api.ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}
