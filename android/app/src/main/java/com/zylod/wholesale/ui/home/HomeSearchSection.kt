package com.zylod.wholesale.ui.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.AddAPhoto
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Business
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Event
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Factory
import androidx.compose.material.icons.outlined.FlashOn
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.RequestQuote
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Sell
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.ui.wallet.formatBdt
import kotlinx.coroutines.delay

/**
 * t297 — the HOME FRONT DOOR, web-mobile parity (mobile-home-page.tsx +
 * mobile-search-bar.tsx + mobile-promo-icon-grid.tsx). The web home's most
 * prominent affordances, now native Compose with zero fabricated data:
 *
 *  1. [HomeSearchSection] — a real text field with LIVE typeahead from GET
 *     api/search/suggestions (the exact endpoint mobile-search-bar.tsx:79
 *     debounces at 300 ms), rendered in the web's own suggestion order:
 *     fallback terms → products → categories → suppliers. Product rows show
 *     the real thumbnail + ৳ price, suppliers the real rating, and every row
 *     navigates to its real page (product-detail / category-products /
 *     suppliers / search-results — the last runs the typed Search screen,
 *     which records the trending term itself). Under the bar, the web's six
 *     search-tool chips (Photo / QR / Barcode / Advanced / RFQ / Voice) map
 *     to REAL native pages — the web's own TOOL_PAGE table.
 *  2. [HomeQuickAccess] — the web's Quick Access card: eight primary tiles
 *     in a horizontal rail + a "+12 More" tile opening the All-Services
 *     bottom sheet (4-col grid, spring-damped ModalBottomSheet). Every tile
 *     targets a real registry pageId — the web's own PRIMARY_LINKS /
 *     MORE_LINKS tables, verified against NativePageRegistry.
 *  3. [HomeHeaderRow] — the brand row gains the web top-nav's notification
 *     bell with the real unread badge (GET api/notifications unreadCount,
 *     only fetched for signed-in sessions — guests show a plain bell).
 */
sealed interface HomeSuggestion {
    data class Product(
        val id: String,
        val name: String,
        val price: Double?,
        val thumbnailUrl: String?,
        val categoryName: String?,
    ) : HomeSuggestion

    data class Category(val id: String, val name: String, val slug: String?) : HomeSuggestion
    data class Supplier(val id: String, val name: String, val rating: Double?) : HomeSuggestion
    data class Term(val term: String) : HomeSuggestion
}

/** The web's SEARCH_TOOLS × TOOL_PAGE (mobile-search-bar.tsx:21-38) verbatim. */
private data class SearchTool(val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val pageId: String)

private val SEARCH_TOOLS = listOf(
    SearchTool("Photo Search", Icons.Outlined.AddAPhoto, "image-search"),
    SearchTool("QR Scan", Icons.Outlined.QrCode2, "barcode-scanner"),
    SearchTool("Barcode Scan", Icons.Outlined.QrCode2, "barcode-scanner"),
    SearchTool("Advanced Search", Icons.Outlined.Tune, "search-home"),
    SearchTool("RFQ", Icons.Outlined.RequestQuote, "rfq-list"),
    SearchTool("Voice Search", Icons.Outlined.Mic, "voice-search"),
)

/** One Quick-Access tile — the web's QuickLink table as data. */
private data class QuickTile(val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val tint: Color, val bg: Color, val pageId: String)

private val RED_BG = Color(0xFFFFCDD2)
private val ORANGE_BG = Color(0xFFFFE0B2)
private val GREEN_BG = Color(0xFFC8E6C9)
private val PURPLE_BG = Color(0xFFE1BEE7)
private val TEAL_BG = Color(0xFFB2DFDB)
private val DARK_BG = Color(0xFF262626)
private val RED = Color(0xFFC8102E)

private val PRIMARY_LINKS = listOf(
    QuickTile("Explore", Icons.Outlined.Explore, RED, RED_BG, "explore"),
    QuickTile("Trending", Icons.Outlined.TrendingUp, Color(0xFFE53935), RED_BG, "trending-products"),
    QuickTile("Flash Sale", Icons.Outlined.FlashOn, Color(0xFFF57C00), ORANGE_BG, "flash-sale"),
    QuickTile("Daily Deals", Icons.Outlined.Event, Color(0xFFE53935), RED_BG, "daily-deals"),
    QuickTile("New Arrivals", Icons.Outlined.AutoAwesome, Color(0xFFC62828), RED_BG, "new-arrivals"),
    QuickTile("Clearance", Icons.Outlined.Sell, Color(0xFFC62828), RED_BG, "clearance"),
    QuickTile("Seasonal", Icons.Outlined.CardGiftcard, Color(0xFF2E7D32), GREEN_BG, "seasonal-offers"),
    QuickTile("Brands", Icons.Outlined.Business, Color(0xFF6A1B9A), PURPLE_BG, "brand-showcase"),
)

private val MORE_LINKS = listOf(
    QuickTile("Categories", Icons.Outlined.GridView, RED, DARK_BG, "category-browser"),
    QuickTile("Coupons", Icons.Outlined.LocalOffer, Color(0xFFC62828), RED_BG, "coupons"),
    QuickTile("Suppliers", Icons.Outlined.Storefront, Color(0xFFE53935), RED_BG, "suppliers"),
    QuickTile("Trade Assurance", Icons.Outlined.VerifiedUser, RED, DARK_BG, "suppliers"),
    QuickTile("Easy Payments", Icons.Outlined.AccountBalanceWallet, Color(0xFF388E3C), GREEN_BG, "checkout"),
    QuickTile("Fast Shipping", Icons.Outlined.LocalShipping, Color(0xFF6A1B9A), PURPLE_BG, "orders"),
    QuickTile("Top Deals", Icons.Outlined.LocalFireDepartment, Color(0xFFF57C00), ORANGE_BG, "top-deals"),
    QuickTile("Bulk Orders", Icons.Outlined.Inventory2, Color(0xFF00695C), TEAL_BG, "bulk-order"),
    QuickTile("RFQ", Icons.Outlined.RequestQuote, RED, DARK_BG, "rfq-list"),
    QuickTile("Support", Icons.Outlined.SupportAgent, RED, RED_BG, "support"),
    QuickTile("Cross-border", Icons.Outlined.Public, RED, DARK_BG, "cross-border"),
    QuickTile("Factory Direct", Icons.Outlined.Factory, Color(0xFF388E3C), GREEN_BG, "factory-direct"),
)

/** Brand row + the real unread-notification bell (web top-nav parity). */
@Composable
fun HomeHeaderRow(unread: Int, openPage: (pageId: String, query: String) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            "Zylod",
            fontSize = 24.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = { openPage("notifications", "") }, modifier = Modifier.size(40.dp)) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    Icons.Outlined.Notifications,
                    contentDescription = "Notifications",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(22.dp),
                )
                if (unread > 0) {
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(top = 2.dp),
                    ) {
                        Text(
                            if (unread > 99) "99+" else "$unread",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.padding(horizontal = 3.dp, vertical = 1.dp),
                        )
                    }
                }
            }
        }
    }
}

/** The home search bar + live suggestions + tool chips (one in-flow section). */
@Composable
fun HomeSearchSection(
    query: String,
    suggestions: List<HomeSuggestion>,
    loading: Boolean,
    onQueryChange: (String) -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val keyboard = LocalSoftwareKeyboardController.current
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    // Grace period on focus loss (180 ms) so a suggestion tap always lands
    // before the panel collapses — the standard typeahead race guard.
    var dropdownOpen by remember { mutableStateOf(false) }
    LaunchedEffect(focused) {
        if (focused) {
            dropdownOpen = true
        } else {
            delay(180)
            dropdownOpen = false
        }
    }
    val submit = {
        val q = query.trim()
        if (q.isNotEmpty()) {
            keyboard?.hide()
            openPage("search-results", "query=${android.net.Uri.encode(q)}")
        }
        Unit
    }
    val showPanel = dropdownOpen && query.isNotBlank() && (loading || suggestions.isNotEmpty())

    Column(modifier = Modifier.animateContentSize()) {
        Surface(
            shape = RoundedCornerShape(14.dp),
            color = MaterialTheme.colorScheme.surfaceContainer,
            border = BorderStroke(1.dp, if (focused) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                Icon(
                    Icons.Outlined.Search,
                    contentDescription = null,
                    tint = if (focused) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                Box(Modifier.weight(1f)) {
                    if (query.isEmpty()) {
                        Text(
                            "Search products, suppliers...",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                        )
                    }
                    BasicTextField(
                        value = query,
                        onValueChange = onQueryChange,
                        singleLine = true,
                        textStyle = TextStyle(
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurface,
                        ),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = { submit() }),
                        interactionSource = interaction,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                if (query.isNotEmpty()) {
                    IconButton(onClick = { onQueryChange("") }, modifier = Modifier.size(24.dp)) {
                        Icon(
                            Icons.Outlined.Close,
                            contentDescription = "Clear search",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
                Spacer(Modifier.width(4.dp))
                IconButton(onClick = { openPage("image-search", "") }, modifier = Modifier.size(30.dp)) {
                    Icon(
                        Icons.Outlined.AddAPhoto,
                        contentDescription = "Photo search",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }

        // Suggestions panel — in-flow expansion (pushes the feed smoothly),
        // real rows only: the loading dot row while the typeahead is in
        // flight, nothing rendered when the API answers empty (web parity).
        AnimatedVisibility(
            visible = showPanel,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut(),
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceContainer,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
            ) {
                Column(modifier = Modifier.padding(vertical = 4.dp)) {
                    if (loading && suggestions.isEmpty()) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 14.dp),
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        }
                    } else {
                        suggestions.forEach { suggestion ->
                            SuggestionRow(suggestion, openPage)
                        }
                    }
                }
            }
        }

        // Tool chips — visible while the field is NOT focused (web behavior:
        // the tools row hides the moment the suggestions take over).
        AnimatedVisibility(visible = !focused, enter = fadeIn(), exit = fadeOut()) {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.padding(top = 8.dp),
            ) {
                items(SEARCH_TOOLS, key = { it.label }) { tool ->
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = MaterialTheme.colorScheme.surfaceContainerHigh,
                        modifier = Modifier.clickable { openPage(tool.pageId, "") },
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        ) {
                            Icon(tool.icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(12.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(tool.label, fontSize = 10.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SuggestionRow(suggestion: HomeSuggestion, openPage: (pageId: String, query: String) -> Unit) {
    val context = LocalContext.current
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                when (suggestion) {
                    is HomeSuggestion.Product -> openPage("product-detail", "productId=${suggestion.id}")
                    is HomeSuggestion.Category ->
                        openPage("category-products", "category=${android.net.Uri.encode(suggestion.slug ?: suggestion.id)}")
                    is HomeSuggestion.Supplier -> openPage("suppliers", "")
                    is HomeSuggestion.Term ->
                        openPage("search-results", "query=${android.net.Uri.encode(suggestion.term)}")
                }
            }
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        SuggestionLeading(suggestion, context)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                when (suggestion) {
                    is HomeSuggestion.Product -> suggestion.name
                    is HomeSuggestion.Category -> suggestion.name
                    is HomeSuggestion.Supplier -> suggestion.name
                    is HomeSuggestion.Term -> suggestion.term
                },
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                when (suggestion) {
                    is HomeSuggestion.Product -> suggestion.categoryName ?: "Product"
                    is HomeSuggestion.Category -> suggestion.slug ?: "Category"
                    is HomeSuggestion.Supplier ->
                        "Rating: ${suggestion.rating?.let { String.format(java.util.Locale.US, "%.1f", it) } ?: "N/A"}"
                    is HomeSuggestion.Term -> "Trending search"
                },
                fontSize = 9.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (suggestion is HomeSuggestion.Product && suggestion.price != null) {
            Text(
                formatBdt(suggestion.price),
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.width(4.dp))
        }
        Icon(
            Icons.Outlined.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(14.dp),
        )
    }
}

@Composable
private fun SuggestionLeading(suggestion: HomeSuggestion, context: android.content.Context) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(34.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)),
    ) {
        when (suggestion) {
            is HomeSuggestion.Product -> {
                val url = remember(suggestion.thumbnailUrl) { resolveUrl(suggestion.thumbnailUrl) }
                if (url != null) {
                    val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
                    val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
                    AsyncImage(
                        model = remember(url) { ImageRequest.Builder(context).data(url).crossfade(200).build() },
                        contentDescription = suggestion.name,
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxWidth().height(34.dp),
                    )
                } else {
                    Icon(
                        Icons.Outlined.Inventory2,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
            is HomeSuggestion.Category -> Icon(Icons.Outlined.Search, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(15.dp))
            is HomeSuggestion.Supplier -> Icon(Icons.Outlined.Storefront, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(15.dp))
            is HomeSuggestion.Term -> Icon(Icons.Outlined.TrendingUp, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(15.dp))
        }
    }
}

/** The web's Quick Access card: primary rail + "+12 More" All-Services sheet. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeQuickAccess(openPage: (pageId: String, query: String) -> Unit) {
    var sheetOpen by remember { mutableStateOf(false) }
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Quick Access",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "More",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable { sheetOpen = true },
                )
            }
            Spacer(Modifier.height(10.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                items(PRIMARY_LINKS, key = { it.label }) { tile ->
                    QuickTileCell(tile, openPage)
                }
                item(key = "more") {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .width(68.dp)
                            .clickable { sheetOpen = true },
                    ) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = MaterialTheme.colorScheme.surfaceContainerHigh,
                            modifier = Modifier.size(44.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    "+${MORE_LINKS.size}",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "More",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
    }

    if (sheetOpen) {
        ModalBottomSheet(
            onDismissRequest = { sheetOpen = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "All Services",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = { sheetOpen = false }, modifier = Modifier.size(32.dp)) {
                        Icon(
                            Icons.Outlined.Close,
                            contentDescription = "Close",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                MORE_LINKS.chunked(4).forEachIndexed { rowIndex, rowTiles ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(0.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = if (rowIndex == MORE_LINKS.chunked(4).lastIndex) 24.dp else 14.dp),
                    ) {
                        rowTiles.forEach { tile ->
                            Box(Modifier.weight(1f)) { QuickTileCell(tile, openPage, wide = true) }
                        }
                        repeat(4 - rowTiles.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickTileCell(tile: QuickTile, openPage: (pageId: String, query: String) -> Unit, wide: Boolean = false) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(68.dp)
            .clickable { openPage(tile.pageId, "") }
            .padding(vertical = if (wide) 2.dp else 0.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = tile.bg,
            modifier = Modifier.size(44.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(tile.icon, contentDescription = tile.label, tint = tile.tint, modifier = Modifier.size(20.dp))
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(
            tile.label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = if (wide) 2 else 1,
            overflow = TextOverflow.Ellipsis,
            lineHeight = 12.sp,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}
