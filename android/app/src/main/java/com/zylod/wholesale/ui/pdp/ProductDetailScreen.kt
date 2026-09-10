package com.zylod.wholesale.ui.pdp

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color as BitmapColor
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Policy
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
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
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.zylod.wholesale.data.api.PriceTierDto
import com.zylod.wholesale.data.api.ProductDetailDto
import com.zylod.wholesale.data.api.ReviewDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.components.InfoTile
import com.zylod.wholesale.ui.components.SkeletonBox
import com.zylod.wholesale.ui.components.StarRow
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.text.NumberFormat
import java.util.Locale

/**
 * Product detail — faithful Compose port of src/components/mobile/
 * mobile-product-detail-page.tsx (the frozen port basis, spec §3.9) with the
 * desktop page's sticky buy bar (product-detail-page.tsx:1628-1668), the
 * Android system share sheet (documented native deviation from the web's
 * constructed social-URL dialog) and the QR dialog (qrcode.react → zxing).
 * Cart / wishlist / buy-now actions run through [ProductDetailViewModel];
 * MOQ + stock validation lives there and surfaces through toasts.
 */
@Composable
fun ProductDetailScreen(
    productId: String,
    onBack: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: ProductDetailViewModel = viewModel(key = "pdp-$productId") {
        ProductDetailViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    var showQr by remember { mutableStateOf(false) }
    var shareRequested by remember { mutableStateOf(false) }

    LaunchedEffect(productId) { vm.load(productId) }

    // VM toasts: MOQ / stock / cart-sync / order messages (web sonner parity).
    LaunchedEffect(state.toast) {
        state.toast?.let { snackbar.showSnackbar(it); vm.consumeToast() }
    }
    LaunchedEffect(state.wishlistNeedsLogin) {
        if (state.wishlistNeedsLogin) {
            snackbar.showSnackbar("Sign in to save items to your wishlist")
            vm.consumeWishlistNeedsLogin()
        }
    }
    // Share → Android system share sheet.
    LaunchedEffect(shareRequested) {
        if (!shareRequested) return@LaunchedEffect
        shareRequested = false
        val product = state.product ?: return@LaunchedEffect
        val url = productUrl(product.id, state.serverUrl, context)
        val text = "Check out ${product.name} - ${formatBdt(vm.applicablePrice())} on Zylod — " +
            "Bangladesh's B2B Wholesale Marketplace!\n$url"
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        context.startActivity(Intent.createChooser(send, "Share product"))
    }

    val listState = rememberLazyListState()
    // Sticky buy bar mirrors product-detail-page.tsx:258 — visible once the
    // main action row (LazyColumn item index 2) has scrolled out of view.
    val showStickyBar by remember {
        derivedStateOf { listState.firstVisibleItemIndex > ACTION_ITEM_INDEX }
    }
    val product = state.product

    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        Column(Modifier.fillMaxSize()) {
            PdpTopBar(
                onBack = onBack,
                onShare = { shareRequested = true },
                onQr = { showQr = true },
            )

            when {
                state.loading -> PdpSkeleton()
                state.error != null -> PdpError(state.error.orEmpty()) { vm.load(productId) }
                product != null -> LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    item(key = "gallery") { Gallery(product) }
                    item(key = "info") { ProductInfo(product, state, vm) }
                    item(key = "actions") {
                        ActionRow(
                            product = product,
                            justAdded = state.justAdded,
                            buyingNow = state.buyingNow,
                            onAddToCart = vm::addToCart,
                            onBuyNow = vm::buyNow,
                        )
                    }
                    item(key = "tabs") { TabsSection(product, state.specifications) }
                    item(key = "supplier") { SupplierCard(product, openPage) }
                    item { Spacer(Modifier.height(20.dp)) }
                }
            }
        }

        // Sticky buy bar (desktop product-detail-page.tsx:1628-1668).
        AnimatedVisibility(
            visible = showStickyBar && state.orderConfirmation == null && state.error == null && !state.loading,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            StickyBuyBar(state = state, vm = vm)
        }

        SnackbarHost(
            hostState = snackbar,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = if (showStickyBar) 84.dp else 16.dp),
        )
    }

    if (showQr && product != null) {
        QrDialog(
            productName = product.name,
            url = productUrl(product.id, state.serverUrl, context),
            onDismiss = { showQr = false },
        )
    }

    // Buy-now result — order confirmation dialog (web orderDialog parity).
    state.orderConfirmation?.let { order ->
        val extra = LocalZylodExtra.current
        AlertDialog(
            onDismissRequest = { vm.dismissOrderConfirmation() },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.CheckCircle,
                        null,
                        tint = extra.success,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("Order Placed!", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            },
            text = {
                Column {
                    Text(
                        "Your order has been placed successfully.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(10.dp))
                    ConfirmLine("Order number", order.orderNumber ?: "—")
                    ConfirmLine("Total", formatBdt(order.totalAmount))
                    ConfirmLine("Payment", order.paymentStatus?.replaceFirstChar { it.uppercase() } ?: "COD")
                    order.estimatedDelivery?.let { ConfirmLine("Estimated delivery", it) }
                }
            },
            confirmButton = {
                TextButton(onClick = { vm.dismissOrderConfirmation() }) {
                    Text("Continue Shopping", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                }
            },
            shape = RoundedCornerShape(14.dp),
        )
    }
}

/** LazyColumn item index of the main Add/Buy row (sticky-bar threshold). */
private const val ACTION_ITEM_INDEX = 2

/** Deep link the SPA consumes on boot — ?page=product-detail&productId=<id>. */
private fun productUrl(productId: String, serverUrl: String, context: android.content.Context): String {
    val base = serverUrl.ifBlank { ServerConfig.cached(context) ?: "https://zylod.com" }
    return base.trimEnd('/') + "/?page=product-detail&productId=" + android.net.Uri.encode(productId)
}

@Composable
private fun PdpTopBar(onBack: () -> Unit, onShare: () -> Unit, onQr: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shadowElevation = 2.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            // No statusBarsPadding — the root scaffold already insets content.
            modifier = Modifier
                .height(48.dp)
                .padding(horizontal = 4.dp),
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = MaterialTheme.colorScheme.onSurface)
            }
            Spacer(Modifier.width(4.dp))
            Text(
                "Product Details",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onShare) {
                Icon(Icons.Outlined.Share, "Share", tint = MaterialTheme.colorScheme.onSurface, modifier = Modifier.size(18.dp))
            }
            IconButton(onClick = onQr) {
                Icon(Icons.Outlined.QrCode2, "QR code", tint = MaterialTheme.colorScheme.onSurface, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun Gallery(product: ProductDetailDto) {
    val images = product.galleryImages
    val pagerState = rememberPagerState(pageCount = { images.size })
    Box(Modifier.background(MaterialTheme.colorScheme.surfaceContainer)) {
        if (images.isEmpty()) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f),
            ) {
                Icon(
                    Icons.Outlined.Inventory2,
                    null,
                    tint = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.size(56.dp),
                )
            }
        } else {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f),
            ) { page ->
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(resolveImageUrl(images[page]))
                        .crossfade(200)
                        .build(),
                    contentDescription = "${product.name} image ${page + 1}",
                    contentScale = ContentScale.Contain,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                )
            }
            if (images.size > 1) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 12.dp),
                ) {
                    images.indices.forEach { index ->
                        val active = pagerState.currentPage == index
                        Box(
                            Modifier
                                .size(width = if (active) 16.dp else 8.dp, height = 8.dp)
                                .background(
                                    if (active) {
                                        MaterialTheme.colorScheme.primary
                                    } else {
                                        MaterialTheme.colorScheme.outline
                                    },
                                    RoundedCornerShape(50),
                                ),
                        )
                    }
                }
            }
        }
        if (product.isCustomizable) {
            BadgeChip("Customizable", Modifier.align(Alignment.TopStart).padding(12.dp))
        }
        if (product.stockQuantity == 0) {
            BadgeChip(
                "Out of Stock",
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(12.dp),
                destructive = true,
            )
        }
    }
}

@Composable
private fun BadgeChip(text: String, modifier: Modifier = Modifier, destructive: Boolean = false) {
    Surface(
        shape = RoundedCornerShape(6.dp),
        color = if (destructive) {
            MaterialTheme.colorScheme.error
        } else {
            MaterialTheme.colorScheme.surfaceContainerHighest
        },
        border = if (destructive) null else BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = modifier,
    ) {
        Text(
            text,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            color = if (destructive) {
                MaterialTheme.colorScheme.onError
            } else {
                MaterialTheme.colorScheme.onSurface
            },
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}

@Composable
private fun ProductInfo(
    product: ProductDetailDto,
    state: PdpUiState,
    vm: ProductDetailViewModel,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
    ) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Text(
                    product.name,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 24.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                WishlistHeart(wishlisted = state.wishlisted, onToggle = vm::toggleWishlist)
            }

            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                StarRow(rating = product.ratingAvg.toInt().coerceIn(0, 5), starSize = 14)
                Spacer(Modifier.width(6.dp))
                Text(
                    "${product.ratingAvg} (${product.reviewCount} reviews)",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (product.soldCount > 0) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "• ${compact(product.soldCount)} sold",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // Applicable price (variant override → active tier → base).
            Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(top = 10.dp)) {
                Text(
                    formatBdt(vm.applicablePrice()),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "/ ${product.unit ?: "piece"}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (product.priceTiers.isNotEmpty()) {
                TierTable(
                    tiers = product.priceTiers,
                    quantity = state.quantity,
                    basePrice = product.basePrice,
                    unit = product.unit ?: "piece",
                )
            }

            if (product.variants.isNotEmpty()) {
                Text(
                    "Variants",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 14.dp),
                )
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    items(product.variants.size) { index ->
                        val variant = product.variants[index]
                        val selected = state.selectedVariantId == variant.id
                        val outOfStock = variant.stockQuantity == 0
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = when {
                                selected -> MaterialTheme.colorScheme.primary
                                outOfStock -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                                else -> MaterialTheme.colorScheme.surfaceVariant
                            },
                            border = BorderStroke(
                                1.dp,
                                if (selected) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
                                },
                            ),
                            modifier = Modifier.clickable(enabled = !outOfStock) { vm.selectVariant(variant.id) },
                        ) {
                            Text(
                                variant.variantValue ?: variant.variantName ?: variant.id,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = when {
                                    selected -> MaterialTheme.colorScheme.onPrimary
                                    outOfStock -> MaterialTheme.colorScheme.outline
                                    else -> MaterialTheme.colorScheme.onSurface
                                },
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            )
                        }
                    }
                }
            }

            // Quantity selector — MOQ floor enforced by the VM (mobile web steps ±10).
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 14.dp),
            ) {
                Text(
                    "Quantity (MOQ: ${product.moq})",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                QuantityStepper(
                    quantity = state.quantity,
                    enabled = product.stockQuantity > 0,
                    onAdjust = vm::adjustQuantity,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    product.unit ?: "piece",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun WishlistHeart(wishlisted: Boolean, onToggle: () -> Unit) {
    val scale = remember { Animatable(1f) }
    LaunchedEffect(wishlisted) {
        scale.snapTo(0.72f)
        scale.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium))
    }
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(36.dp)
            .clickable(onClick = onToggle),
    ) {
        Icon(
            if (wishlisted) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
            if (wishlisted) "Remove from wishlist" else "Add to wishlist",
            tint = if (wishlisted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .size(22.dp)
                .graphicsLayer { scaleX = scale.value; scaleY = scale.value },
        )
    }
}

/** Tier table with the active row highlighted (mobile-product-detail-page.tsx:296-333). */
@Composable
private fun TierTable(tiers: List<PriceTierDto>, quantity: Int, basePrice: Double, unit: String) {
    val extra = LocalZylodExtra.current
    Column(Modifier.padding(top = 14.dp)) {
        Text(
            "TIERED PRICING",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.8.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Surface(
            shape = RoundedCornerShape(8.dp),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
        ) {
            Column {
                Row(
                    Modifier
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                        .fillMaxWidth(),
                ) {
                    Text(
                        "Quantity",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                            .weight(1f),
                    )
                    Text(
                        "Price / $unit",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.End,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    )
                }
                tiers.forEachIndexed { index, tier ->
                    val active = quantity >= tier.minQty && (tier.maxQty == null || quantity <= tier.maxQty)
                    val discount = if (basePrice > 0) ((1 - tier.pricePerUnit / basePrice) * 100).toInt() else 0
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                if (active) {
                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.06f)
                                } else {
                                    Color.Transparent
                                },
                            ),
                    ) {
                        Text(
                            "${tier.minQty}${tier.maxQty?.let { "-$it" } ?: "+"} $unit",
                            fontSize = 12.sp,
                            modifier = Modifier
                                .padding(horizontal = 12.dp, vertical = 10.dp)
                                .weight(1f),
                        )
                        Text(
                            formatBdt(tier.pricePerUnit),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        if (discount > 0) {
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "$discount% OFF",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Medium,
                                color = extra.success,
                                modifier = Modifier
                                    .background(extra.success.copy(alpha = 0.08f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                    }
                    if (index != tiers.lastIndex) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                    }
                }
            }
        }
    }
}

@Composable
private fun QuantityStepper(quantity: Int, enabled: Boolean, onAdjust: (Int) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.border(
            1.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = 0.6f),
            RoundedCornerShape(8.dp),
        ),
    ) {
        TextButton(onClick = { onAdjust(-10) }, enabled = enabled) {
            Text("−10", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(
            quantity.toString(),
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            modifier = Modifier.width(44.dp),
        )
        TextButton(onClick = { onAdjust(10) }, enabled = enabled) {
            Text("+10", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun ActionRow(
    product: ProductDetailDto,
    justAdded: Boolean,
    buyingNow: Boolean,
    onAddToCart: () -> Unit,
    onBuyNow: () -> Unit,
) {
    val outOfStock = product.stockQuantity == 0
    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Button(
            onClick = onAddToCart,
            enabled = !outOfStock,
            shape = MaterialTheme.shapes.small,
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.primary),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary),
            modifier = Modifier
                .weight(1f)
                .height(44.dp),
        ) {
            if (justAdded) {
                Icon(Icons.Filled.CheckCircle, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("In Cart ✓", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            } else {
                Icon(Icons.Outlined.ShoppingCart, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Add to Cart", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Button(
            onClick = onBuyNow,
            enabled = !outOfStock && !buyingNow,
            shape = MaterialTheme.shapes.small,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .weight(1.5f)
                .height(44.dp),
        ) {
            Text(
                if (buyingNow) "Placing…" else "Buy Now",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

private enum class PdpTab(val label: String) {
    DETAILS("Details"),
    SPECS("Specs"),
    REVIEWS("Reviews"),
    QA("Q&A"),
}

@Composable
private fun TabsSection(product: ProductDetailDto, specifications: Map<String, String>) {
    var selected by remember { mutableIntStateOf(0) }
    val tabs = PdpTab.entries
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
    ) {
        Column {
            TabRow(
                selectedTabIndex = selected,
                containerColor = Color.Transparent,
                // Underline indicator — the web's framer-motion layoutId bar.
                indicator = { tabPositions ->
                    Box(
                        Modifier
                            .tabIndicatorOffset(tabPositions[selected])
                            .padding(horizontal = 12.dp)
                            .height(2.dp)
                            .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50)),
                    )
                },
                divider = {},
            ) {
                tabs.forEachIndexed { index, tab ->
                    Tab(
                        selected = selected == index,
                        onClick = { selected = index },
                        text = {
                            Text(
                                tab.label + if (tab == PdpTab.REVIEWS) " (${product.reviewCount})" else "",
                                fontSize = 12.sp,
                                fontWeight = if (selected == index) FontWeight.SemiBold else FontWeight.Medium,
                                color = if (selected == index) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                },
                            )
                        },
                    )
                }
            }
            Column(Modifier.padding(horizontal = 16.dp, vertical = 16.dp)) {
                when (tabs[selected]) {
                    PdpTab.DETAILS -> DetailsTab(product)
                    PdpTab.SPECS -> SpecsTab(specifications)
                    PdpTab.REVIEWS -> ReviewsTab(product)
                    PdpTab.QA -> QaTab(product)
                }
            }
        }
    }
}

@Composable
private fun DetailsTab(product: ProductDetailDto) {
    Column {
        Text(
            product.description ?: "No description available.",
            fontSize = 13.sp,
            lineHeight = 20.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(top = 16.dp),
        ) {
            InfoTile(
                "In Stock",
                "${NumberFormat.getIntegerInstance().format(product.stockQuantity)} ${product.unit ?: "piece"}",
                Modifier.weight(1f),
            )
            InfoTile("Min. Order", "${product.moq} ${product.unit ?: "piece"}", Modifier.weight(1f))
        }
        product.brand?.takeIf { it.isNotBlank() }?.let { brand ->
            InfoTile("Brand", brand, Modifier.fillMaxWidth().padding(top = 12.dp))
        }
    }
}

@Composable
private fun SpecsTab(specifications: Map<String, String>) {
    if (specifications.isEmpty()) {
        EmptyTabText("No specifications available.")
        return
    }
    Column {
        specifications.entries.forEachIndexed { index, entry ->
            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp)) {
                Text(
                    entry.key,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    entry.value,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.End,
                    modifier = Modifier.weight(1.4f),
                )
            }
            if (index != specifications.size - 1) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            }
        }
    }
}

@Composable
private fun ReviewsTab(product: ProductDetailDto) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(product.ratingAvg.toString(), fontSize = 28.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.width(10.dp))
            Column {
                StarRow(rating = product.ratingAvg.toInt().coerceIn(0, 5), starSize = 12)
                Text(
                    "${product.reviewCount} reviews",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
        HorizontalDivider(
            Modifier.padding(vertical = 12.dp),
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f),
        )
        if (product.reviews.isEmpty()) {
            EmptyTabText("No reviews yet. Be the first to review this product!")
            return
        }
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            product.reviews.take(10).forEach { review -> ReviewCard(review) }
        }
    }
}

@Composable
private fun ReviewCard(review: ReviewDto) {
    val extra = LocalZylodExtra.current
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(28.dp)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), CircleShape),
                ) {
                    Text(
                        (review.buyer?.buyerProfile?.fullName ?: "A").take(1).uppercase(),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        review.buyer?.buyerProfile?.fullName ?: "Anonymous",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        StarRow(rating = review.rating.coerceIn(0, 5), starSize = 10)
                        review.createdAt?.let {
                            Spacer(Modifier.width(6.dp))
                            Text(it.take(10), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            review.comment?.let {
                Text(
                    it,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            if (review.verifiedPurchase) {
                Text(
                    "✓ Verified purchase",
                    fontSize = 10.sp,
                    color = extra.success,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            review.replies.forEach { reply ->
                Surface(
                    color = MaterialTheme.colorScheme.surfaceContainer,
                    shape = RoundedCornerShape(6.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)),
                    modifier = Modifier
                        .padding(top = 8.dp, start = 24.dp)
                        .fillMaxWidth(),
                ) {
                    Column(Modifier.padding(8.dp)) {
                        Text(
                            "${reply.buyer?.buyerProfile?.fullName ?: "Seller"} replied:",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                        )
                        Text(
                            reply.comment ?: "",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            }
        }
    }
}

/** Q&A — the /qa sub-fetch is optional and not wired in Phase 1 (spec §3.9);
 *  the supplier storefront remains the question channel. */
@Composable
private fun QaTab(product: ProductDetailDto) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
    ) {
        Icon(
            Icons.Outlined.Policy,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(30.dp),
        )
        Text(
            "No published questions yet.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            "Ask about ${product.name} from the supplier's storefront.",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
private fun EmptyTabText(text: String) {
    Text(
        text,
        fontSize = 12.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
    )
}

@Composable
private fun SupplierCard(product: ProductDetailDto, openPage: (String, String) -> Unit) {
    val supplier = product.supplier ?: return
    val extra = LocalZylodExtra.current
    val verified = supplier.verificationStatus == "approved"
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
    ) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(40.dp)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), CircleShape),
                ) {
                    Icon(Icons.Outlined.Storefront, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            supplier.companyName ?: "Supplier",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        if (!verified) {
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "UNVERIFIED",
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.5.sp,
                                color = extra.warning,
                                modifier = Modifier
                                    .background(extra.warning.copy(alpha = 0.12f), RoundedCornerShape(4.dp))
                                    .padding(horizontal = 5.dp, vertical = 2.dp),
                            )
                        }
                    }
                    Text(
                        supplier.city ?: "—",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Button(
                    onClick = { openPage("supplier-profile", "supplierId=${supplier.id}") },
                    shape = MaterialTheme.shapes.small,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.primary),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    modifier = Modifier.height(30.dp),
                ) {
                    Text("Visit Store", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(top = 12.dp),
            ) {
                InfoTile("Rating", supplier.ratingAvg.toString(), Modifier.weight(1f))
                InfoTile("Reviews", supplier.ratingCount.toString(), Modifier.weight(1f))
                InfoTile("Product reviews", product.reviewCount.toString(), Modifier.weight(1f))
            }
        }
    }
}

/** Sticky bar (product-detail-page.tsx:1628-1668): total + Buy Now. */
@Composable
private fun StickyBuyBar(state: PdpUiState, vm: ProductDetailViewModel) {
    val product = state.product ?: return
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.97f),
        shadowElevation = 8.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    formatBdt(vm.applicablePrice() * state.quantity),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    "${state.quantity} ${product.unit ?: "piece"} × ${formatBdt(vm.applicablePrice())}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Button(
                onClick = vm::buyNow,
                enabled = product.stockQuantity > 0 && !state.buyingNow,
                shape = MaterialTheme.shapes.small,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier.height(44.dp),
            ) {
                Text(
                    if (state.buyingNow) "Placing…" else "Buy Now",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

/** PDP skeleton mirroring MobileProductDetailPage L175-185 (loading-skeletons):
 *  gallery block, title line, subtitle line, info card, action card. */
@Composable
private fun PdpSkeleton() {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        SkeletonBox(Modifier.fillMaxWidth().aspectRatio(1f), corner = 12)
        Spacer(Modifier.height(14.dp))
        SkeletonBox(Modifier.fillMaxWidth(0.75f).height(26.dp))
        Spacer(Modifier.height(10.dp))
        SkeletonBox(Modifier.fillMaxWidth(0.5f).height(14.dp))
        Spacer(Modifier.height(16.dp))
        SkeletonBox(Modifier.fillMaxWidth().height(96.dp), corner = 12)
        Spacer(Modifier.height(12.dp))
        SkeletonBox(Modifier.fillMaxWidth().height(64.dp), corner = 12)
    }
}

@Composable
private fun PdpError(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxSize().padding(32.dp),
    ) {
        Icon(Icons.Outlined.Inventory2, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(44.dp))
        Spacer(Modifier.height(14.dp))
        Text(message, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(50),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier.padding(top = 18.dp),
        ) {
            Text("Retry", fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun QrDialog(productName: String, url: String, onDismiss: () -> Unit) {
    val qrBitmap = remember(url) { generateQrBitmap(url, QR_SIZE) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Product QR Code", fontSize = 16.sp, fontWeight = FontWeight.Bold) },
        text = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    productName,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(12.dp))
                if (qrBitmap != null) {
                    Image(
                        bitmap = qrBitmap.asImageBitmap(),
                        contentDescription = "QR code linking to this product",
                        modifier = Modifier.size(220.dp),
                    )
                } else {
                    Text("Could not generate the QR code.", fontSize = 12.sp, color = MaterialTheme.colorScheme.error)
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    "Scan to open this product on Zylod",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Done", color = MaterialTheme.colorScheme.primary) }
        },
        shape = RoundedCornerShape(14.dp),
    )
}

private const val QR_SIZE = 420

/** qrcode.react port — zxing QRCodeWriter → ARGB bitmap. Pure black-on-white
 *  modules are required for scannability (not a theme choice). */
private fun generateQrBitmap(content: String, size: Int): Bitmap? = try {
    val matrix = QRCodeWriter().encode(
        content,
        BarcodeFormat.QR_CODE,
        size,
        size,
        mapOf(EncodeHintType.MARGIN to 0),
    )
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    for (x in 0 until size) {
        for (y in 0 until size) {
            bitmap.setPixel(
                x,
                y,
                if (matrix.get(x, y)) BitmapColor.BLACK else BitmapColor.WHITE,
            )
        }
    }
    bitmap
} catch (_: Exception) {
    null
}

private fun resolveImageUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    // Relative server paths resolve against the cached base (spec §6.5).
    val base = ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}

private fun formatBdt(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + NumberFormat.getIntegerInstance().format(value.toLong())
    else "৳" + String.format(Locale.US, "%.2f", value)

private fun compact(count: Int): String =
    if (count >= 1000) String.format(Locale.US, "%.1fk", count / 1000.0) else count.toString()
