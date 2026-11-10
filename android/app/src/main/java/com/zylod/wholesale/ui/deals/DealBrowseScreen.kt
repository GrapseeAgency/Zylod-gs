package com.zylod.wholesale.ui.deals

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.data.api.DealItemDto
import com.zylod.wholesale.util.formatBdt
import kotlin.math.roundToInt

/**
 * t299 — the SHARED typed deal browse screen: ONE implementation for the 14
 * DEAL_IDS pageIds that rode the generic pipeline (mega-sale, bulk-discounts,
 * top-deals, week-special, pre-order, sample-orders, factory-direct,
 * cross-border, flash-sale, clearance, seasonal-offers, new-arrivals,
 * recommended, trending-products), exactly like the web's single
 * GenericDealsPage hosts all of them. The thin ui/screens delegates keep
 * their meta objects and pass this composable their pageId.
 *
 * NO FAKE STUFF: the grid is the server's merged flash+daily rows
 * (GET api/deals?limit=20 — the web's exact call, merge and dedupe), the
 * banners are the web's DEAL_META copy + gradient hexes verbatim, the empty
 * state is the web's own message. 'daily-deals' keeps the typed Hot Deals
 * screen (tab root); 'group-buy'/'best-sellers' stay on the SPA's real pages
 * (the t281 removals).
 */

/** Banner copy + the web's own gradient stops (DEAL_META verbatim). */
data class DealBannerMeta(
    val name: String,
    val subtitle: String,
    val colorFrom: Long,
    val colorTo: Long,
)

val DEAL_BANNER_META: Map<String, DealBannerMeta> = mapOf(
    "mega-sale" to DealBannerMeta(
        "Mega Sale Events",
        "Huge seasonal markdowns across top wholesale categories",
        0xFFD84315, 0xFFFF7043,
    ),
    "seasonal-offers" to DealBannerMeta(
        "Seasonal Offers",
        "Limited-time deals tailored for peak purchasing seasons",
        0xFF2E7D32, 0xFF66BB6A,
    ),
    "bulk-discounts" to DealBannerMeta(
        "Bulk Volume Discounts",
        "Tiered pricing: order more, save up to 40% more",
        0xFFB71C1C, 0xFFEF9A9A,
    ),
    "clearance" to DealBannerMeta(
        "Clearance & Liquidation",
        "Final inventory stockouts at rock-bottom factory rates",
        0xFFC62828, 0xFFEF5350,
    ),
    "new-arrivals" to DealBannerMeta(
        "New Product Launches",
        "Be the first to source newly listed factory releases",
        0xFF6A1B9A, 0xFFAB47BC,
    ),
)

private fun dealBannerFor(pageId: String): DealBannerMeta =
    DEAL_BANNER_META[pageId] ?: DealBannerMeta(
        name = pageId.replace('-', ' ').replaceFirstChar { it.uppercase() },
        subtitle = "Exclusive wholesale deal offerings with limited-time price reductions.",
        colorFrom = 0xFFC8102E,
        colorTo = 0xFFE53935,
    )

/** The web's card math: -N% badge when the original price is higher. */
private fun discountPercent(deal: DealItemDto): Int {
    val original = deal.originalPrice ?: return 0
    val price = deal.dealPrice ?: return 0
    if (original <= price || original <= 0.0) return 0
    return (((original - price) / original) * 100.0).roundToInt()
}

/** 1.0 → "1", 12.5 → "12.5" — the web renders the raw JSON number. */
private fun formatCount(v: Double?): String {
    val d = v ?: return "0"
    return if (d == d.toLong().toDouble()) d.toLong().toString() else d.toString()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DealBrowseScreen(
    pageId: String,
    title: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: DealBrowseViewModel = viewModel(key = "deal-browse-$pageId") {
        DealBrowseViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val gridState = rememberLazyGridState()
    val snackbar = remember { SnackbarHostState() }

    val meta = dealBannerFor(pageId)

    LaunchedEffect(state.toast) {
        state.toast?.let {
            snackbar.showSnackbar(it)
            vm.consumeToast()
        }
    }

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
                    contentPadding = PaddingValues(
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
                                // The web's "Back to All Deals" hop.
                                if (pageId != "flash-sale") {
                                    Text(
                                        "← Back to All Deals",
                                        color = Color.White.copy(alpha = 0.85f),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                        modifier = Modifier
                                            .clickable { openPage("flash-sale", "") }
                                            .padding(bottom = 8.dp),
                                    )
                                }
                                Text(
                                    meta.name,
                                    color = Color.White,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Black,
                                )
                                Spacer(Modifier.size(6.dp))
                                Text(
                                    meta.subtitle,
                                    color = Color.White.copy(alpha = 0.92f),
                                    fontSize = 13.sp,
                                    lineHeight = 18.sp,
                                )
                            }
                        }
                    }

                    // Offline banner — the rows below are the SAVED deals.
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
                                    "Showing saved deals — reconnect for the live list",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }

                    if (state.deals.isEmpty()) {
                        // The web's honest empty state, verbatim.
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 48.dp, start = 24.dp, end = 24.dp),
                            ) {
                                Icon(
                                    Icons.Outlined.LocalFireDepartment,
                                    null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(44.dp),
                                )
                                Spacer(Modifier.size(12.dp))
                                Text(
                                    "No active deals right now",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                                Spacer(Modifier.size(6.dp))
                                Text(
                                    "Check back soon for new promotions!",
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    } else {
                        items(state.deals, key = { it.productId ?: it.id ?: it.hashCode().toString() }) { deal ->
                            val pid = deal.productId ?: deal.id ?: return@items
                            DealBrowseCard(
                                deal = DealBrowseDeal(key = pid, deal = deal),
                                wished = pid in state.wishedIds,
                                onToggleWishlist = { vm.toggleWishlist(pid) },
                                onOpen = { openPage("product-detail", "productId=$pid") },
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * The web's deal card (generic-deals-page.tsx): square thumbnail, -N% badge
 * top-LEFT, heart top-RIGHT, 2-line name, deal price + strikethrough
 * original, the t285 nowrap MOQ/claimed row, the 1..50 stock urgency gate,
 * supplier row.
 */
@Composable
private fun DealBrowseCard(
    deal: DealBrowseDeal,
    wished: Boolean,
    onToggleWishlist: () -> Unit,
    onOpen: () -> Unit,
) {
    val context = LocalContext.current
    val url = remember(deal.key) { resolveDealImage(deal.deal) }
    val discount = discountPercent(deal.deal)
    val original = deal.deal.originalPrice ?: 0.0
    val stock = deal.deal.remainingStock ?: deal.deal.totalStock ?: 0.0

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        modifier = Modifier.clickable(onClick = onOpen),
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
                        contentDescription = deal.deal.effectiveName,
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                        Icon(
                            Icons.Outlined.LocalFireDepartment,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(28.dp),
                        )
                    }
                }
                if (discount > 0) {
                    // The web's -N% badge: top-left, primary pill.
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(8.dp),
                    ) {
                        Text(
                            "-$discount%",
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                }
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
                    deal.deal.effectiveName ?: "Deal product",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 15.sp,
                )
                Spacer(Modifier.size(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        formatBdt(deal.deal.dealPrice ?: 0.0),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = Color(0xFFC8102E),
                    )
                    if (original > 0) {
                        Spacer(Modifier.width(6.dp))
                        Text(
                            formatBdt(original),
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textDecoration = TextDecoration.LineThrough,
                        )
                    }
                }
                Spacer(Modifier.size(4.dp))
                // t285: each phrase stays whole — never wrapped mid-phrase.
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "MOQ:\u00A0${formatCount(deal.deal.moq)}\u00A0${deal.deal.unit ?: "pcs"}",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "${formatCount(deal.deal.soldCount)}\u00A0claimed",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
                if (stock > 0 && stock <= 50) {
                    Spacer(Modifier.size(2.dp))
                    Text(
                        "Only ${formatCount(stock)} left at deal price",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFFD97706),
                    )
                }
                Spacer(Modifier.size(6.dp))
                Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(4.dp)) {
                    Text(
                        deal.deal.supplierName?.takeIf { it.isNotBlank() } ?: "Verified Supplier",
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

/** Stable per-row identity for the grid + callbacks (productId wins, like the web). */
data class DealBrowseDeal(
    val key: String,
    val deal: DealItemDto,
)

private fun resolveDealImage(deal: DealItemDto): String? {
    val raw = deal.effectiveImage ?: return null
    if (raw.startsWith("http")) return raw
    val base = com.zylod.wholesale.data.api.ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}
