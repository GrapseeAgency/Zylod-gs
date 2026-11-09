package com.zylod.wholesale.ui.wishlist

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.NavigateNext
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.History
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
import com.zylod.wholesale.data.api.RecentlyViewedRowDto
import com.zylod.wholesale.data.api.apiQty
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * t282 page metadata — Kotlin registry entry for the recently-viewed
 * pageIds. The old bullets claimed "no obvious endpoint feeds this page"
 * while GET api/products/recently-viewed existed all along; both pageIds
 * now stream the REAL browsingHistory (the web maps recently-viewed AND
 * recently-viewed-products onto the same component — the native does the
 * same through this screen).
 */
data object RecentlyViewedTypedPageMeta : NativePageMeta() {
    override val pageId = "recently-viewed"
    override val title = "Recently Viewed"
    override val category = "Search & Navigation"
    override val kind = NativePageKind.WISHLIST
    override val endpoint = "api/products/recently-viewed?limit=20" // authenticated, cursor envelope
    override val summary =
        "Your real viewing history from GET api/products/recently-viewed — newest-first, " +
            "tap through to the PDP, remove one row or clear everything (owner-scoped)."
    override val tabHint = ""
    override val bullets = listOf(
        "Requires sign-in — guests see the in-screen sign-in CTA (the API is 401 by design; no client-side fake history).",
        "Removal calls DELETE api/products/recently-viewed?productId=… and rolls back visibly on failure; the top-bar action clears everything.",
        "Offline, the last saved history renders from the device cache.",
    )
    override val related = listOf(
        NativePageLink("wishlist", "Wishlist"),
        NativePageLink("search-results", "Search Results"),
        NativePageLink("all-products", "All Products"),
    )
}

/**
 * The "recently-viewed-products" alias — the web maps BOTH ids onto the same
 * recently-viewed-page component (chunk-misc.ts:251), so the native does the
 * same through [RecentlyViewedScreen]. The old stub meta claimed the page
 * streams "api/products?limit=20&page=1" — the whole catalog mislabeled as
 * the caller's history; this meta states the real endpoint.
 */
data object RecentlyViewedProductsTypedPageMeta : NativePageMeta() {
    override val pageId = "recently-viewed-products"
    override val title = "Recently Viewed Products"
    override val category = "Search & Navigation"
    override val kind = NativePageKind.WISHLIST
    override val endpoint = "api/products/recently-viewed?limit=20" // authenticated, cursor envelope
    override val summary =
        "Your real viewing history from GET api/products/recently-viewed — the same rail the " +
            "recently-viewed pageId renders (the web maps both ids onto one component)."
    override val tabHint = ""
    override val bullets = listOf(
        "Requires sign-in — the API is 401 by design; no client-side fake history.",
        "One row per product view, newest-first — a re-visit bumps the row to the top.",
        "Offline, the last saved history renders from the device cache.",
    )
    override val related = listOf(
        NativePageLink("recently-viewed", "Recently Viewed"),
        NativePageLink("wishlist", "Wishlist"),
        NativePageLink("all-products", "All Products"),
    )
}

/**
 * NATIVE Recently Viewed (t282) — the real browsingHistory rail. Sign-in
 * gate for guests; newest-first rows with viewed time; per-row remove,
 * top-bar Clear all, cursor Load More; the WishlistScreen state machine
 * (loading / needsAuth / error / list) verbatim.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecentlyViewedScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: RecentlyViewedViewModel = viewModel { RecentlyViewedViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Recently Viewed",
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
                actions = {
                    if (state.items.isNotEmpty()) {
                        if (state.clearing) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp).padding(end = 12.dp), strokeWidth = 2.dp)
                        } else {
                            TextButton(onClick = vm::clearAll, enabled = !state.clearing) {
                                Text(
                                    "Clear all",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
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
                state.needsAuth -> NeedsAuthState(openPage = openPage)
                state.error != null -> ErrorState(onRetry = vm::refresh)
                else -> HistoryList(state = state, onRemove = vm::remove, onLoadMore = vm::loadMore, openPage = openPage)
            }
        }
    }
}

@Composable
private fun HistoryList(
    state: RecentlyViewedUiState,
    onRemove: (String) -> Unit,
    onLoadMore: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { OfflineBanner() }
        }
        item(key = "meta", contentType = "meta") {
            Text(
                if (state.items.size == 1) "1 product in your viewing history" else "${state.items.size} products in your viewing history",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state.items.isEmpty()) {
            item(key = "empty", contentType = "empty") {
                Text(
                    "No viewing history yet — products you open will appear here.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            state.items.forEach { row ->
                item(key = "rv-${row.stableKey}", contentType = "recently-viewed-row") {
                    HistoryRow(row, state.removingId == row.effectiveProductId, onRemove, openPage)
                }
            }
            if (state.hasMore) {
                item(key = "load-more", contentType = "load-more") {
                    Box(Modifier.fillMaxWidth().padding(top = 4.dp), contentAlignment = Alignment.Center) {
                        if (state.loadingMore) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            TextButton(onClick = onLoadMore) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("Load more", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    Icon(Icons.AutoMirrored.Outlined.NavigateNext, null, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

@Composable
private fun HistoryRow(
    row: RecentlyViewedRowDto,
    removing: Boolean,
    onRemove: (String) -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val product = row.product
    val productId = row.effectiveProductId
    val imageUrl = remember(product?.thumbnailUrl) { resolveUrl(product?.thumbnailUrl) }
    Surface(
        shape = RoundedCornerShape(12.dp),
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
                    .size(56.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(10.dp)),
            ) {
                if (imageUrl != null) {
                    // colorScheme is a @Composable getter — read it OUTSIDE remember.
                    val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
                    val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
                    AsyncImage(
                        model = remember(imageUrl) { ImageRequest.Builder(context).data(imageUrl).crossfade(200).build() },
                        contentDescription = product?.name,
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Fit, // t277-1d: product art never crops (web object-contain parity)
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Icon(Icons.Outlined.History, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                }
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    product?.name ?: "Viewed product",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    buildString {
                        product?.supplier?.companyName?.let { append("$it · ") }
                        append("MOQ ${(product?.moq ?: 1.0).apiQty()}")
                    },
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                    Text(
                        formatBdt(product?.basePrice ?: 0.0),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    row.viewedAt?.let {
                        Text(
                            "  ·  Viewed ${relativeDays(it)}",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            if (removing) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            } else {
                IconButton(onClick = { productId?.let(onRemove) }) {
                    Icon(
                        Icons.Outlined.DeleteOutline,
                        "Remove from history",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}

/** The web save-for-later page's loose time-ago vocabulary, applied to views.
 *  t297-fix: java.text stack (API-24-safe) — java.time.Instant/ChronoUnit
 *  here would NoClassDefFoundError on Android 7.x (minSdk 24, no
 *  coreLibraryDesugaring); days are computed from the UTC-parsed epoch. */
private fun relativeDays(iso: String): String {
    val days = runCatching {
        val cut = iso.substringBefore('.').substringBefore('Z').trim()
        if (cut.length < 19) return "recently"
        val parser = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
        parser.timeZone = java.util.TimeZone.getTimeZone("UTC")
        val parsed = parser.parse(cut) ?: return "recently"
        val diffMs = System.currentTimeMillis() - parsed.time
        (diffMs / 86_400_000L).toInt()
    }.getOrDefault(-1)
    return when {
        days < 0 -> "recently"
        days <= 0 -> "today"
        days == 1 -> "yesterday"
        else -> "$days days ago"
    }
}

@Composable
private fun NeedsAuthState(openPage: (pageId: String, query: String) -> Unit) {
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
            Icon(Icons.Outlined.History, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(36.dp))
        }
        Text(
            "Sign in to see your recently viewed products",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Your viewing history lives on your account — it follows you across devices.",
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
private fun OfflineBanner() {
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
                "You're offline — showing your last saved history",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun ErrorState(onRetry: () -> Unit) {
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
            "Can't load your viewing history",
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

private fun resolveUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val base = com.zylod.wholesale.data.api.ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}
