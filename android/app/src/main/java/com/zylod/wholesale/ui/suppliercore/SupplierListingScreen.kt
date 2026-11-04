package com.zylod.wholesale.ui.suppliercore

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import com.zylod.wholesale.data.api.SupplierCoreListingProduct
import com.zylod.wholesale.data.api.SupplierCorePublicSupplier
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * t269 — SHARED typed Supplier Listing screen (pageId "supplier-listing" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * SupplierListingViewModel). The PUBLIC supplier storefront lens, web
 * SupplierProductsPage parity: the profile card (initials logo box,
 * company name + verified badge, warehouse MapPin line, the 2-cell
 * rating/listings stats strip, Contact Supplier), the category chip row
 * derived from the loaded products (only when >= 2 distinct names), the
 * product rows (Coil image, name, category, ৳ price / unit, MOQ + Sold)
 * with the id-dedupe-safe Load More pagination, the products error banner
 * and the honest no-supplier-selected / 404 / offline / empty states. The
 * supplierId comes from the query (supplierId= || id=); a blank query
 * renders the landing state — never fabricated data. Theme colors only.
 */
@Composable
fun SupplierListingScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierListingViewModel = viewModel(key = "native-supplier-core-$pageId") {
        SupplierListingViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity); keyed on the query so a supplier
    // switch re-parses the id and resets the page (per-supplier cache key).
    LaunchedEffect(query) { vm.refresh(query) }

    SupplierCorePageScaffold(title = "Supplier Products", onBack = onBack) {
        when {
            // No supplier selected — the honest landing state (web parity).
            state.supplierId.isBlank() -> SupplierListingLanding(openPage)
            state.loading -> SupplierCoreCenterSpinner()
            // 404: the route's own error text is the state (never invented
            // copy). Retry stays one tap away.
            state.notFoundMessage != null -> SupplierNotFoundState(
                message = state.notFoundMessage.orEmpty(),
                onRetry = vm::retry,
            )
            state.error != null -> SupplierCoreOfflineEmpty(
                message = "No supplier page saved yet — open it once online to save it",
                onRetry = vm::retry,
            )
            else -> SupplierListingList(
                state = state,
                onRetry = vm::retry,
                onLoadMore = vm::loadMore,
                onSelectCategory = vm::setCategory,
                openPage = openPage,
            )
        }
    }
}

/** Blank query — "No supplier selected" + the way out (web parity). */
@Composable
private fun SupplierListingLanding(openPage: (pageId: String, query: String) -> Unit) {
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
                .background(
                    MaterialTheme.colorScheme.surfaceContainer,
                    RoundedCornerShape(50),
                )
                .border(
                    BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
                    RoundedCornerShape(50),
                ),
        ) {
            Icon(
                Icons.Outlined.Storefront,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "No supplier selected",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Open a supplier profile to browse their live product listings.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("suppliers", "") },
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Explore Suppliers", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Unknown supplier id — the SERVER'S OWN parsed text + Retry (storefront). */
@Composable
private fun SupplierNotFoundState(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        SupplierCoreEmptyState(message)
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

@Composable
private fun SupplierListingList(
    state: SupplierListingUiState,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit,
    onSelectCategory: (String) -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val profile = state.profile
    // Category chips — derived from THIS supplier's real loaded products.
    val categoryNames = remember(state.products) {
        state.products.mapNotNull { it.category?.name?.takeIf(String::isNotBlank) }.distinct()
    }
    val chipOptions = remember(categoryNames) {
        if (categoryNames.size < 2) {
            emptyList()
        } else {
            listOf("all" to "All Products") + categoryNames.map { it to it }
        }
    }
    val visibleProducts = remember(state.products, state.activeCategory) {
        if (state.activeCategory == "all") {
            state.products
        } else {
            state.products.filter { it.category?.name == state.activeCategory }
        }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when {
            state.offline -> item(key = "slist-offline", contentType = "banner") {
                SupplierCoreBanner("Connection lost — showing the last loaded listings")
            }
            state.offlineFromCache -> item(key = "slist-cache", contentType = "banner") {
                SupplierCoreBanner("Offline — showing saved listings")
            }
        }
        if (state.refreshing) {
            item(key = "slist-refreshing", contentType = "progress") { SupplierCoreRefreshingBar() }
        }
        if (profile != null) {
            item(key = "slist-profile", contentType = "profile") {
                ProfileCard(profile, openPage)
            }
        }
        state.productsError?.let { message ->
            item(key = "slist-error", contentType = "errorCard") {
                ProductsErrorCard(message, onRetry)
            }
        }
        if (chipOptions.isNotEmpty()) {
            item(key = "slist-chips", contentType = "filter") {
                SupplierCoreChipRow(chipOptions, state.activeCategory, onSelect = onSelectCategory)
            }
        }
        item(key = "slist-count", contentType = "header") {
            Text(
                "All Products (${supplierCoreCount(state.total)})",
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        if (visibleProducts.isEmpty()) {
            item(key = "slist-empty", contentType = "empty") {
                SupplierCoreEmptyState(
                    if (state.products.isEmpty()) {
                        "No products listed yet — this supplier hasn't published any approved listings. Their products will appear here as soon as they go live."
                    } else {
                        "No products in this category — try the All Products filter to see everything this supplier lists."
                    },
                )
            }
        } else {
            items(
                visibleProducts,
                key = { "slist-${it.id ?: it.hashCode()}" },
                contentType = { "slist-row" },
            ) { row ->
                ListingProductCard(row)
            }
        }
        // Load More — real pagination; hidden once every page is appended.
        if (!state.loadingMore && state.page < state.totalPages) {
            item(key = "slist-loadmore", contentType = "loadMore") {
                val remaining = (state.total - state.products.size).coerceAtLeast(0)
                OutlinedButton(
                    onClick = onLoadMore,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp),
                ) {
                    Text(
                        "Load More ($remaining remaining)",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
        if (state.loadingMore) {
            item(key = "slist-loadingmore", contentType = "progress") {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(36.dp),
                ) {
                    CircularProgressIndicator(Modifier.size(22.dp))
                }
            }
        }
        item(key = "slist-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * The supplier profile card: initials logo box (Storefront fallback),
 * company + verified badge, verification sub-line, MapPin warehouse line,
 * the rating/listings stats strip and Contact Supplier.
 */
@Composable
private fun ProfileCard(
    profile: SupplierCorePublicSupplier,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val initials = remember(profile) {
        profile.companyName?.trim()?.split(Regex("\\s+"))
            ?.filter(String::isNotBlank)?.take(2)
            ?.map { word -> word.first().uppercaseChar() }?.joinToString("")
            .orEmpty()
    }
    val approved = profile.verificationStatus == "approved"
    val location = remember(profile) {
        listOf(profile.warehouseCity, profile.warehouseDistrict)
            .filter { it?.isNotBlank() == true }
            .joinToString(", ")
    }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(64.dp)
                        .background(
                            MaterialTheme.colorScheme.surfaceVariant,
                            RoundedCornerShape(16.dp),
                        ),
                ) {
                    if (initials.isNotBlank()) {
                        Text(
                            initials,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        Icon(
                            Icons.Outlined.Storefront,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            profile.companyName ?: "Supplier",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        if (approved) {
                            Spacer(Modifier.width(6.dp))
                            Icon(
                                Icons.Filled.CheckCircle,
                                "Verified supplier",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                    Text(
                        if (approved) {
                            "Verified supplier"
                        } else {
                            "Verification status: ${profile.verificationStatus ?: "unknown"}"
                        },
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
            if (location.isNotBlank()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    Icon(
                        Icons.Outlined.LocationOn,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        location,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            StatsStrip(profile)
            Spacer(Modifier.height(10.dp))
            Button(
                onClick = {
                    // t278 WRONG-RECIPIENT FIX: this button opened the
                    // live-SUPPORT chat ("Zylod Live Support") — the message
                    // landed with the support team and the supplier never saw
                    // it. It now opens the buyer↔supplier DM thread
                    // (chat-detail), which create-or-reuses the conversation
                    // against THIS supplier's real user id.
                    openPage(
                        "chat-detail",
                        "supplierUserId=${profile.userId.orEmpty()}&supplierName=${java.net.URLEncoder.encode(profile.companyName.orEmpty(), Charsets.UTF_8.name())}",
                    )
                },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp),
            ) {
                Icon(Icons.Outlined.Email, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Contact Supplier", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** The 2-cell metric strip — star rating (or the honest no-ratings line). */
@Composable
private fun StatsStrip(profile: SupplierCorePublicSupplier) {
    val rated = profile.ratingCount > 0
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(vertical = 10.dp)) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.weight(1f),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.Star,
                        null,
                        tint = LocalZylodExtra.current.warning,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        if (rated) supplierCoreRating(profile.ratingAvg) else "—",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Text(
                    if (rated) "Rating (${supplierCoreCount(profile.ratingCount)})" else "No ratings yet",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.6.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.weight(1f),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.Inventory2,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        supplierCoreCount(profile.productCount),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Text(
                    "Active Listings",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.6.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

/** Products fetch failed while the profile renders — banner card + retry. */
@Composable
private fun ProductsErrorCard(message: String, onRetry: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.Start,
            modifier = Modifier.padding(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.ErrorOutline,
                    null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    "Couldn't load products",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Text(
                message,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 6.dp),
            )
            OutlinedButton(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .padding(top = 10.dp)
                    .height(36.dp),
            ) {
                Text("Try Again", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** One listing row: image, name, category, ৳ price / unit, MOQ + Sold. */
@Composable
private fun ListingProductCard(row: SupplierCoreListingProduct) {
    val imageUrl = remember(row) {
        row.images.firstOrNull()?.imageUrl ?: row.thumbnailUrl
    }
    val priceLine = remember(row) {
        "${supplierCoreMoney(row.basePrice)} / ${row.unit?.takeIf(String::isNotBlank) ?: "pcs"}"
    }
    val metaLine = remember(row) {
        "MOQ ${supplierCoreQty(row.moq)} · Sold ${supplierCoreQty(row.soldCount)}"
    }
    val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
    val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(10.dp)) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
            ) {
                if (imageUrl != null) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(imageUrl)
                            .crossfade(200)
                            .build(),
                        contentDescription = row.name ?: "Product image",
                        placeholder = placeholder,
                        error = placeholder,
                        contentScale = ContentScale.Fit, // t277-1d: product art never crops (web object-contain parity)
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Icon(
                        Icons.Outlined.Inventory2,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    row.name ?: "Product",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                row.category?.name?.takeIf(String::isNotBlank)?.let { category ->
                    Text(
                        category,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Text(
                    priceLine,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Text(
                    metaLine,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}
