package com.zylod.wholesale.ui.wishlist

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.Button
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.ColorPainter
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
import com.zylod.wholesale.data.api.WishlistItemDto
import com.zylod.wholesale.ui.rewards.RewardsAuthGate
import com.zylod.wholesale.ui.rewards.RewardsChip
import com.zylod.wholesale.ui.rewards.RewardsEmptyCard
import com.zylod.wholesale.ui.rewards.RewardsErrorCard
import com.zylod.wholesale.ui.rewards.RewardsOfflineBanner
import com.zylod.wholesale.ui.rewards.RewardsSkeleton

/**
 * The web's honest stock palette (wishlist-page.tsx green/amber/red text
 * tokens), parsed once — the t259 tint convention (the screen owns colors).
 */
private val StockGreen = Color(0xFF16A34A)
private val StockAmber = Color(0xFFD97706)
private val StockRed = Color(0xFFDC2626)

/**
 * SHARED typed wishlist-analytics surface (pageId wishlist-analytics).
 *
 * WEB TRUTH: chunk-misc.ts:184 maps this pageId onto wishlist-page.tsx —
 * the SAME component the "wishlist" pageId uses — so the surface IS the
 * tabbed stock book, not a metrics dashboard: the "My Wishlist (n)" header
 * count, the All Items / In Stock / Price Drop tabs (the web's own tokens),
 * the four-way sort (Recently Added / Price Low-High / Price High-Low /
 * Rating — client-side, the route takes no params), rows with the MOQ chip
 * + the honest stock badge (0 → Out of Stock, ≤ MOQ → Low Stock, else In
 * Stock — wishlist-page.tsx:56-58 verbatim), the per-row trash (DELETE
 * api/wishlist/{itemId}, no confirm, exactly the web's handler) and the
 * row tap into the PDP.
 *
 * NO metrics are invented: the wire carries no oldPrice, so the Price Drop
 * tab honestly renders the empty state; no stats endpoint exists behind
 * this pageId on the web. The web's row-level Add-to-Cart composes a full
 * product re-fetch + cart-store add — the native routes the same intent to
 * the PDP where the real cart contract lives (documented deviation).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WishlistAnalyticsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: WishlistAnalyticsViewModel = viewModel(key = "native-wishlist-analytics-$pageId") {
        WishlistAnalyticsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            AnalyticsTopBar(
                title = if (state.loading) "My Wishlist" else "My Wishlist (${state.rows.size})",
                onBack = onBack,
            )
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.needsAuth -> RewardsAuthGate(
                    // wishlist-page.tsx needsAuth copy, verbatim.
                    title = "Sign in to see your wishlist",
                    body = "Items you save will show up here once you are signed in.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> AnalyticsBody(state = state, vm = vm, openPage = openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AnalyticsTopBar(title: String, onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                title,
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
}

@Composable
private fun AnalyticsBody(
    state: WishlistAnalyticsUiState,
    vm: WishlistAnalyticsViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val visible = displayedWishlistRows(state.rows, state.tab, state.sort)
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        state.actionError?.let { message ->
            item(key = "action-err", contentType = "note") {
                InlineAnalyticsNote(text = message, onDismiss = vm::consumeActionError)
            }
        }
        state.refreshError?.let { message ->
            item(key = "refresh-err", contentType = "note") {
                InlineAnalyticsNote(text = message, onDismiss = null)
            }
        }
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") {
                RewardsOfflineBanner("Offline — showing your last saved wishlist")
            }
        }
        item(key = "tabs", contentType = "chips") {
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf(
                    WishlistAnalyticsUiState.TAB_ALL to "All Items",
                    WishlistAnalyticsUiState.TAB_IN_STOCK to "In Stock",
                    WishlistAnalyticsUiState.TAB_PRICE_DROP to "Price Drop",
                ).forEach { (token, label) ->
                    RewardsChip(
                        label = label,
                        selected = state.tab == token,
                        onClick = { vm.setTab(token) },
                    )
                }
            }
        }
        item(key = "sort", contentType = "chips") {
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf(
                    WishlistAnalyticsUiState.SORT_RECENT to "Recently Added",
                    WishlistAnalyticsUiState.SORT_PRICE_ASC to "Price Low-High",
                    WishlistAnalyticsUiState.SORT_PRICE_DESC to "Price High-Low",
                    WishlistAnalyticsUiState.SORT_RATING to "Rating",
                ).forEach { (token, label) ->
                    RewardsChip(
                        label = label,
                        selected = state.sort == token,
                        onClick = { vm.setSort(token) },
                    )
                }
            }
        }
        when {
            state.loading -> item(key = "skeleton", contentType = "skeleton") { RewardsSkeleton() }
            visible.isEmpty() -> item(key = "empty", contentType = "empty") {
                // The web's empty state — both for a truly empty wishlist and
                // for a tab that filters everything out (Price Drop always
                // does: the wire carries no oldPrice).
                RewardsEmptyCard(
                    icon = Icons.Outlined.FavoriteBorder,
                    title = "Your wishlist is empty",
                    body = "Save items you like here to review or buy them later.",
                )
                Button(
                    onClick = { openPage("home", "") },
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                        .height(44.dp),
                ) {
                    Text("Explore Products", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
            else -> {
                visible.forEach { row ->
                    item(key = "wl-${row.id ?: row.productId ?: "row"}", contentType = "wishlist-row") {
                        AnalyticsRow(row = row, removing = state.removingId == row.id, onRemove = {
                            row.id?.let(vm::removeRow)
                        }, openPage = openPage)
                    }
                }
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

@Composable
private fun AnalyticsRow(
    row: WishlistItemDto,
    removing: Boolean,
    onRemove: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val product = row.product
    val productId = row.productId ?: product?.id
    val name = product?.name ?: "Unnamed product"
    val imageUrl = remember(product?.thumbnailUrl) { resolveAnalyticsImageUrl(product?.thumbnailUrl) }
    val stockStatus = wishlistStockStatus(
        product?.stockQuantity ?: 0,
        (product?.moq ?: 1).takeIf { it > 0 },
    )
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(productId != null) { openPage("product-detail", "productId=$productId") },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(10.dp)) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(72.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
            ) {
                if (imageUrl != null) {
                    // colorScheme is a @Composable getter — read it OUTSIDE remember.
                    val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
                    val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
                    AsyncImage(
                        model = remember(imageUrl) { ImageRequest.Builder(context).data(imageUrl).crossfade(200).build() },
                        contentDescription = name,
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Text(
                        "No Image",
                        fontSize = 9.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    product?.supplier?.companyName?.takeIf(String::isNotBlank) ?: "Unknown supplier",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 2.dp),
                ) {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(4.dp),
                    ) {
                        Text(
                            "MOQ: ${product?.moq ?: 1}",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                    val stockColor = when (stockStatus) {
                        "IN_STOCK" -> StockGreen
                        "LOW_STOCK" -> StockAmber
                        else -> StockRed
                    }
                    Text(
                        wishlistStockLabel(stockStatus),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = stockColor,
                    )
                }
                Text(
                    wishlistBdtLabel(product?.basePrice),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (removing) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            } else {
                IconButton(onClick = onRemove) {
                    Icon(
                        Icons.Outlined.DeleteOutline,
                        "Remove from wishlist",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}

/** Inline verbatim failure note (row trash / refresh failures). */
@Composable
private fun InlineAnalyticsNote(text: String, onDismiss: (() -> Unit)?) {
    val color = MaterialTheme.colorScheme.error
    Surface(
        color = color.copy(alpha = 0.08f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier.padding(start = 12.dp, top = 4.dp, bottom = 4.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = color,
                modifier = Modifier.weight(1f),
            )
            if (onDismiss != null) {
                TextButton(onClick = onDismiss) {
                    Text("Dismiss", fontSize = 11.sp, color = color, fontWeight = FontWeight.Bold)
                }
            } else {
                Spacer(Modifier.width(8.dp))
            }
        }
    }
}

private fun resolveAnalyticsImageUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val base = com.zylod.wholesale.data.api.ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}
