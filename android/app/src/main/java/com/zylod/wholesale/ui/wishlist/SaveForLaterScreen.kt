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
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.PauseCircleOutline
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import com.zylod.wholesale.data.api.SaveForLaterRowDto
import com.zylod.wholesale.data.api.apiQty
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * t282 page metadata — the "Save For Later" pageId. The old row streamed
 * api/wishlist?limit=50 (WISHLIST rows under this title); the pageId now
 * renders the REAL /api/save-for-later rows with the web page's actions.
 */
data object SaveForLaterTypedPageMeta : NativePageMeta() {
    override val pageId = "save-for-later"
    override val title = "Save For Later"
    override val category = "Account & Profile"
    override val kind = NativePageKind.WISHLIST
    override val endpoint = "api/save-for-later" // authenticated; raw rows + product select
    override val summary =
        "Items you saved from your cart — GET api/save-for-later. Move a row back to the " +
            "cart (POST api/cart then the row's DELETE) or remove it outright."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Requires sign-in — guests see the in-screen sign-in CTA.",
        "Move to Cart sends POST api/cart {productId, quantity} (saved qty, never below MOQ) and deletes the row only after the cart write succeeds.",
        "Offline, the last saved list renders from the device cache.",
    )
    override val related = listOf(
        NativePageLink("cart", "Cart"),
        NativePageLink("wishlist", "Wishlist"),
        NativePageLink("recently-viewed", "Recently Viewed"),
    )
}

/**
 * NATIVE Save For Later (t282) — the real saved-for-later list with the web
 * page's actions: per-row Remove + Move to Cart, top-bar Clear all. The
 * WishlistScreen state machine (loading / needsAuth / error / list).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SaveForLaterScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: SaveForLaterViewModel = viewModel { SaveForLaterViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Save For Later",
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
                        if (state.bulkBusy) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp).padding(end = 12.dp), strokeWidth = 2.dp)
                        } else {
                            TextButton(onClick = vm::clearAll, enabled = !state.bulkBusy) {
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
                else -> SavedList(state = state, onRemove = vm::remove, onMove = vm::moveToCart, openPage = openPage)
            }
        }
    }
}

@Composable
private fun SavedList(
    state: SaveForLaterUiState,
    onRemove: (SaveForLaterRowDto) -> Unit,
    onMove: (SaveForLaterRowDto) -> Unit,
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
            Column {
                Text(
                    if (state.items.size == 1) "1 saved item" else "${state.items.size} saved items",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                // The web page's info banner: "Items moved here from your cart".
                Text(
                    "Items moved here from your cart",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
        if (state.items.isEmpty()) {
            item(key = "empty", contentType = "empty") {
                Text(
                    "Nothing saved for later — items you save from your cart will appear here.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            state.items.forEach { row ->
                item(key = "sfl-${row.stableKey}", contentType = "save-for-later-row") {
                    SavedRow(row, state.busyId == row.id, state.busyId != null || state.bulkBusy, onRemove, onMove, openPage)
                }
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

@Composable
private fun SavedRow(
    row: SaveForLaterRowDto,
    busy: Boolean,
    anyBusy: Boolean,
    onRemove: (SaveForLaterRowDto) -> Unit,
    onMove: (SaveForLaterRowDto) -> Unit,
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
        Column(Modifier.padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
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
                            contentScale = ContentScale.Fit, // t277-1d: product art never crops
                            modifier = Modifier.fillMaxSize(),
                        )
                    } else {
                        Icon(Icons.Outlined.ShoppingBag, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                    }
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        product?.name ?: "Saved item",
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
                        Text(
                            "  ·  Qty ${row.moveQty.apiQty()}",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                if (busy) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    IconButton(onClick = { onRemove(row) }, enabled = !anyBusy) {
                        Icon(
                            Icons.Outlined.DeleteOutline,
                            "Remove saved item",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
            ) {
                OutlinedButton(
                    onClick = { onRemove(row) },
                    enabled = !anyBusy,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.weight(1f).height(38.dp),
                ) {
                    Text("Remove", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = { onMove(row) },
                    enabled = !anyBusy,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.weight(2f).height(38.dp),
                ) {
                    Icon(Icons.Outlined.ShoppingCart, null, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Move to Cart", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
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
            Icon(Icons.Outlined.PauseCircleOutline, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(36.dp))
        }
        Text(
            "Sign in to see your saved items",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Items you save from your cart stay with your account across devices.",
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
                "You're offline — showing your last saved items",
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
            "Can't load your saved items",
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
