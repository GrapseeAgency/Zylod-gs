package com.zylod.wholesale.ui.deals

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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.FlashOn
import androidx.compose.material.icons.outlined.LocalOffer
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.data.api.DealItemDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import kotlin.math.roundToInt

/**
 * NATIVE Hot Deals (v2.4.8 — the "flash-deals"/"daily-deals"/"hot-deals"/
 * "deals" pageIds moved from WebView to this Compose screen through
 * RouteOwnership, ending the last Tier-1 page rendered by the SPA).
 *
 * Structure mirrors OrdersScreen: Scaffold + TopAppBar + one sectioned
 * LazyColumn (Flash on top, Daily below), honest loading / offline / empty
 * states, sp+FontWeight type styles, theme colors only.
 *
 * Smoothness contract (owner: "heavenly smooth"):
 *  - every row has a STABLE key (section-prefixed deal id) and a stable
 *    contentType, so appends reuse rather than re-compose visible cards;
 *  - auto-append is a snapshotFlow over LazyListState.layoutInfo (runs per
 *    scroll frame inside the flow, ZERO allocations in composition) and
 *    fires when the last row is within ~400px of the viewport end;
 *  - thumbnails are Coil AsyncImage with crossfade + a matching
 *    surfaceVariant ColorPainter placeholder — no letter flash, no jank.
 *
 * BACK CONTRACT: this screen installs NO BackHandler. It is a tab-like
 * destination (bottom bar visible, deals tab highlighted, onBack == null):
 * system Back pops the NavHost entry back to Home, and the bottom-bar Home
 * tap lands on Home via ZylodRoot's popBackStack(HOME_ROUTE) t229g path.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DealsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: DealsViewModel = viewModel { DealsViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Orders/Cart: the VM survives on the saved back stack
    // (tab-like destination) — re-pull on EVERY entry so deals that started
    // or expired while the user was elsewhere appear at once. The VM's
    // silent-refresh keeps the visible list mounted during the re-pull.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Hot Deals",
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
                // First launch offline: nothing fetched AND nothing saved —
                // a themed empty state with Retry, never a white screen.
                state.error != null -> DealsSavedEmpty(onRetry = vm::refresh)
                else -> DealsList(state = state, onLoadMore = vm::loadMore, openPage = openPage)
            }
        }
    }
}

/**
 * Auto-append distance: page N+1 is requested while the last row is within
 * ~400px of the viewport end (raw px, per the owner brief) — roughly a third
 * of a phone screen, so the next window is in flight before the user sees
 * the seam.
 */
private const val LOAD_MORE_THRESHOLD_PX = 400

@Composable
private fun DealsList(
    state: DealsUiState,
    onLoadMore: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val listState = rememberLazyListState()

    // Robust infinite scroll: ONE snapshotFlow over the lazy list layout.
    // Emits the px of content below the last visible row — but ONLY when the
    // genuinely last item of the list is on screen (otherwise MAX_VALUE), so
    // scrolling mid-list never triggers. VM-side guards make the collect a
    // no-op while a page is in flight or the sections are exhausted. The
    // lambda allocates nothing (primitives only) — it runs inside the flow,
    // never during composition.
    LaunchedEffect(listState) {
        snapshotFlow {
            val info = listState.layoutInfo
            val last = info.visibleItemsInfo.lastOrNull()
            when {
                last == null -> Int.MAX_VALUE
                last.index < info.totalItemsCount - 1 -> Int.MAX_VALUE
                else -> info.viewportEndOffset - (last.offset + last.size)
            }
        }.collect { pxBelowLastItem ->
            if (pxBelowLastItem <= LOAD_MORE_THRESHOLD_PX) onLoadMore()
        }
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { OfflineBanner() }
        }
        item(key = "meta", contentType = "meta") {
            Text(
                "${state.flashDeals.size} flash • ${state.dailyDeals.size} daily deals",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        dealsSection(
            headerKey = "flash-header",
            emptyKey = "flash-empty",
            title = "Flash Deals",
            icon = Icons.Outlined.FlashOn,
            emptyText = "No flash deals live right now — check back soon.",
            deals = state.flashDeals,
            keyPrefix = "flash",
            openPage = openPage,
        )
        dealsSection(
            headerKey = "daily-header",
            emptyKey = "daily-empty",
            title = "Daily Deals",
            icon = Icons.Outlined.CalendarToday,
            emptyText = "No daily deals today — new ones drop every morning.",
            deals = state.dailyDeals,
            keyPrefix = "daily",
            openPage = openPage,
        )
        if (state.loadingMore) {
            item(key = "footer-loading", contentType = "footer") {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 10.dp),
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                }
            }
        }
        if (!state.canLoadMore && !state.loadingMore &&
            (state.flashDeals.isNotEmpty() || state.dailyDeals.isNotEmpty())
        ) {
            item(key = "footer-end", contentType = "footer") {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "You've seen all of today's deals",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** Flash/Daily section: themed header + keyed rows (or an honest empty line). */
private fun LazyListScope.dealsSection(
    headerKey: String,
    emptyKey: String,
    title: String,
    icon: ImageVector,
    emptyText: String,
    deals: List<DealItemDto>,
    keyPrefix: String,
    openPage: (pageId: String, query: String) -> Unit,
) {
    item(key = headerKey, contentType = "header") {
        SectionHeader(title, icon, deals.size)
    }
    if (deals.isEmpty()) {
        item(key = emptyKey, contentType = "empty") {
            Text(
                emptyText,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    } else {
        items(
            deals,
            // Section-prefixed deal id — stable across appends and unique
            // even if one product ran both a flash and a daily deal.
            key = { "$keyPrefix-${it.stableKey}" },
            contentType = { "deal" },
        ) { deal ->
            DealCard(deal, openPage)
        }
    }
}

@Composable
private fun SectionHeader(title: String, icon: ImageVector, count: Int) {
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
            if (count == 1) "1 live" else "$count live",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * One deal card — the whole card opens the NATIVE PDP through the existing
 * Destination.Product path (openPage("product-detail", "productId=…")).
 */
@Composable
private fun DealCard(
    deal: DealItemDto,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val productId = deal.productId.orEmpty()
    // remember{} for derived values — no per-recomposition reformatting.
    val priceLabel = remember(deal) { formatBdt(deal.effectivePrice) }
    val originalLabel = remember(deal) {
        deal.originalPrice?.takeIf { it > deal.effectivePrice }?.let(::formatBdt)
    }
    val urgency = remember(deal) { urgencyLine(deal) }
    val subtitle = remember(deal) {
        listOfNotNull(
            deal.supplierName?.takeIf(String::isNotBlank),
            deal.categoryName?.takeIf(String::isNotBlank),
        ).joinToString(" • ")
    }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            // OrdersScreen card contract: the whole card is the tap target;
            // a deal without a product id has nowhere honest to go.
            (if (productId.isBlank()) Modifier else Modifier.clickable {
                openPage("product-detail", "productId=$productId")
            })
                .padding(12.dp),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                DealThumbnail(deal)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TypeChip(deal.type)
                        DiscountBadge(deal.discountPercent)
                    }
                    Text(
                        deal.productName.orEmpty().ifBlank { "--" },
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 17.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    if (subtitle.isNotBlank()) {
                        Text(
                            subtitle,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
            ) {
                Text(
                    priceLabel,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
                originalLabel?.let {
                    Text(
                        it,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textDecoration = TextDecoration.LineThrough,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
                Spacer(Modifier.weight(1f))
                urgency?.let { (text, low) ->
                    Text(
                        text,
                        fontSize = 11.sp,
                        fontWeight = if (low) FontWeight.Bold else FontWeight.Medium,
                        color = if (low) LocalZylodExtra.current.warning else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

/** 84dp thumbnail: Coil crossfade + MATCHING placeholder (no letter flash). */
@Composable
private fun DealThumbnail(deal: DealItemDto) {
    val context = LocalContext.current
    val url = remember(deal.productThumbnail) { resolveImageUrl(deal.productThumbnail) }
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.size(84.dp),
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
                contentDescription = deal.productName,
                placeholder = placeholder,
                error = placeholder,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                Icon(
                    Icons.Outlined.LocalOffer,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(24.dp),
                )
            }
        }
    }
}

@Composable
private fun TypeChip(label: String?) {
    val text = label?.trim()?.uppercase().orEmpty()
    if (text.isEmpty()) return
    Surface(shape = RoundedCornerShape(6.dp), color = MaterialTheme.colorScheme.primaryContainer) {
        Text(
            text,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.8.sp,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

/** Discount badge — warning pair from the theme extras (no hex outside ui/theme). */
@Composable
private fun DiscountBadge(percent: Double?) {
    if (percent == null || percent < 0.5) return
    Surface(shape = RoundedCornerShape(6.dp), color = LocalZylodExtra.current.warning) {
        Text(
            "-${percent.roundToInt()}%",
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.8.sp,
            color = LocalZylodExtra.current.onWarning,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

/** Urgency line: (text, isLowStock) — low stock renders in the warning color. */
private fun urgencyLine(deal: DealItemDto): Pair<String, Boolean>? {
    val remaining = deal.remainingStock?.roundToInt()
    val total = deal.totalStock?.roundToInt()
    return when {
        remaining != null && remaining <= 0 -> "Sold out" to false
        remaining != null && total != null && total > 0 && remaining <= total * 0.2 -> "Only $remaining left" to true
        deal.soldCount != null && deal.soldCount > 0 -> "${deal.soldCount.roundToInt()} sold" to false
        else -> null
    }
}

/** Offline banner over SAVED deals — theme warning pair, OrdersScreen banner style. */
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
                "You're offline — showing your last saved deals",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/**
 * First launch with no connection and NO saved deals: themed empty state
 * with Retry — never a white screen.
 */
@Composable
private fun DealsSavedEmpty(onRetry: () -> Unit) {
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
            "No deals saved yet — connect once to save them",
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
 * Deal thumbnails are RELATIVE server paths ("/images/products/x.png") —
 * resolve against the persisted last-known server base (same contract as
 * CartScreen/PDP §6.5; Coil cannot fetch a scheme-less path).
 */
private fun resolveImageUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val server = ServerConfig.cached(ZylodApp.instance) ?: return null
    return server.trimEnd('/') + raw
}

private fun formatBdt(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + java.text.NumberFormat.getIntegerInstance().format(value.toLong())
    else "৳" + String.format(java.util.Locale.US, "%.2f", value)

private val DealItemDto.effectivePrice: Double
    get() = dealPrice ?: originalPrice ?: 0.0
