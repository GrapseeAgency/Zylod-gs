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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Storefront
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
import com.zylod.wholesale.data.api.FavoriteRowDto
import com.zylod.wholesale.data.api.FavoriteSupplierRowDto
import com.zylod.wholesale.data.api.FollowedCategoryRowDto
import com.zylod.wholesale.ui.rewards.RewardsAuthGate
import com.zylod.wholesale.ui.rewards.RewardsChip
import com.zylod.wholesale.ui.rewards.RewardsEmptyCard
import com.zylod.wholesale.ui.rewards.RewardsErrorCard
import com.zylod.wholesale.ui.rewards.RewardsOfflineBanner
import com.zylod.wholesale.ui.rewards.RewardsSkeleton

/**
 * SHARED typed favorites surface (pageIds buyer-favorites +
 * favorite-suppliers + favorite-products + favorite-categories), layout
 * branched by the pageId exactly as src/lib/page-chunks maps them:
 *
 *  - buyer-favorites / favorite-suppliers → favorite-suppliers-page.tsx:
 *    the followed-supplier cards (initials avatar, company name, location,
 *    Verified badge, rating + count, View Catalog row), the sort cycling
 *    tokens (Recently Added / Top Rated / Most Products — client-side, the
 *    route takes no sort param) and the heart unfollow with the web's
 *    optimistic flow and verbatim result notes.
 *  - favorite-products → favorite-products-page.tsx: the ranked favorites
 *    feed (GET api/favorites) with its own four sort chips, supplier +
 *    verified line, rating row, price and the heart REMOVE through DELETE
 *    api/wishlist?productId= (the web's own data-layer note: favorites ==
 *    wishlist). Batch-select/compare and the grid/list toggle are web-view
 *    chrome around the same rows — the native routes buying to the PDP
 *    (documented deviation, no half-mirrored cart call).
 *  - favorite-categories → favorite-categories-page.tsx: the notification
 *    banner, the followed-category cards with the notifyOnNew bell toggle
 *    (POST api/categories/{id}/favorite) and the Unfollow action (DELETE
 *    api/categories/{id}/favorite), both with the web's exact toasts.
 *
 * Honest loading / sign-in / empty / error / offline states — nothing
 * fabricated; rows render the wire's own values verbatim.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FavoritesScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: FavoritesViewModel = viewModel(key = "native-favorites-$pageId") {
        FavoritesViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            FavoritesTopBar(
                title = when (state.variant) {
                    FavoritesVariant.PRODUCTS -> "Favorite Products"
                    FavoritesVariant.CATEGORIES -> "Favorite Categories"
                    FavoritesVariant.SUPPLIERS -> "Favorite Suppliers"
                },
                onBack = onBack,
            )
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.needsAuth -> FavoritesAuthGate(variant = state.variant, openPage = openPage)
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> FavoritesBody(state = state, vm = vm, openPage = openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FavoritesTopBar(title: String, onBack: (() -> Unit)?) {
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

/** The web's per-component sign-in copy, verbatim. */
@Composable
private fun FavoritesAuthGate(
    variant: FavoritesVariant,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val (title, body) = when (variant) {
        // favorite-suppliers-page.tsx AccountGate copy (buyer-favorites shares it).
        FavoritesVariant.SUPPLIERS -> "Sign in to view your favorite suppliers" to
            "The suppliers you follow are saved to your account. Sign in to see the real list."
        // favorite-products-page.tsx needsAuth copy.
        FavoritesVariant.PRODUCTS -> "Sign in to see your favorites" to
            "Products you heart will show up here once you are signed in."
        // favorite-categories-page.tsx needsAuth copy.
        FavoritesVariant.CATEGORIES -> "Sign in to see your followed categories" to
            "Follow categories to get notified about new arrivals."
    }
    RewardsAuthGate(title = title, body = body, onSignIn = { openPage("login", "") })
}

@Composable
private fun FavoritesBody(
    state: FavoritesUiState,
    vm: FavoritesViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Verbatim action results / failures (the web's toast texts).
        state.actionMessage?.let { message ->
            item(key = "action-ok", contentType = "note") {
                InlineFavoritesNote(text = message, success = true, onDismiss = vm::consumeActionMessage)
            }
        }
        state.actionError?.let { message ->
            item(key = "action-err", contentType = "note") {
                InlineFavoritesNote(text = message, success = false, onDismiss = vm::consumeActionError)
            }
        }
        // Verbatim refresh failure — last good data stays on screen.
        state.refreshError?.let { message ->
            item(key = "refresh-err", contentType = "note") {
                InlineFavoritesNote(text = message, success = false, onDismiss = null)
            }
        }
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") {
                RewardsOfflineBanner("Offline — showing your last saved favorites")
            }
        }
        when (state.variant) {
            FavoritesVariant.SUPPLIERS -> suppliersItems(state, vm, openPage)
            FavoritesVariant.PRODUCTS -> productsItems(state, vm, openPage)
            FavoritesVariant.CATEGORIES -> categoriesItems(state, vm, openPage)
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/* ─── suppliers variant (buyer-favorites / favorite-suppliers) ───────────── */

private fun LazyListScope.suppliersItems(
    state: FavoritesUiState,
    vm: FavoritesViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    item(key = "sort-suppliers", contentType = "chips") {
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(
                FavoritesUiState.SUPPLIER_SORT_RECENT,
                FavoritesUiState.SUPPLIER_SORT_TOP_RATED,
                FavoritesUiState.SUPPLIER_SORT_MOST_PRODUCTS,
            ).forEach { token ->
                RewardsChip(
                    label = token,
                    selected = state.supplierSort == token,
                    onClick = { vm.setSupplierSort(token) },
                )
            }
        }
    }
    item(key = "count-suppliers", contentType = "meta") {
        Text(
            if (state.supplierRows.size == 1) "1 followed supplier" else "${state.supplierRows.size} followed suppliers",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    when {
        state.loading -> item(key = "skeleton", contentType = "skeleton") { RewardsSkeleton() }
        state.supplierRows.isEmpty() -> item(key = "empty", contentType = "empty") {
            RewardsEmptyCard(
                icon = Icons.Outlined.Storefront,
                title = "No favorite suppliers yet",
                body = "Tap the Follow button on any supplier profile to add them here.",
            )
            Button(
                onClick = { openPage("suppliers", "") },
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp)
                    .height(44.dp),
            ) {
                Text("Browse Suppliers", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
        else -> {
            sortedSupplierRows(state.supplierRows, state.supplierSort).forEach { row ->
                item(key = "sup-${row.stableKey}", contentType = "supplier-row") {
                    SupplierFollowRow(
                        row = row,
                        removing = state.removingSupplierId == row.stableKey,
                        onUnfollow = { vm.unfollowSupplier(row.stableKey) },
                        openPage = openPage,
                    )
                }
            }
        }
    }
}

@Composable
private fun SupplierFollowRow(
    row: FavoriteSupplierRowDto,
    removing: Boolean,
    onUnfollow: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val supplier = row.supplier
    val name = supplier?.companyName?.takeIf(String::isNotBlank) ?: "Unknown supplier"
    val initials = name.take(2).uppercase()
    val supplierId = row.effectiveSupplierId
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(supplierId != null) { openPage("seller-profile", "supplierId=$supplierId") },
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(48.dp)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), RoundedCornerShape(12.dp)),
                ) {
                    Text(
                        initials,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Spacer(Modifier.width(10.dp))
                Text(
                    name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (removing) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    IconButton(onClick = onUnfollow) {
                        Icon(
                            Icons.Outlined.Favorite,
                            "Unfollow $name",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "Bangladesh",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (supplier?.isVerified == true) {
                    Icon(
                        Icons.Outlined.CheckCircle,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(12.dp),
                    )
                    Text(
                        "Verified",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(
                    Icons.Outlined.Star,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    "${supplier?.ratingAvg ?: 0.0}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "(${supplier?.ratingCount ?: 0})",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(8.dp))
            Surface(
                color = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(supplierId != null) { openPage("seller-storefront", "supplierId=$supplierId") },
            ) {
                Text(
                    "View Catalog",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(vertical = 10.dp),
                )
            }
        }
    }
}

/* ─── products variant (favorite-products) ───────────────────────────────── */

private fun LazyListScope.productsItems(
    state: FavoritesUiState,
    vm: FavoritesViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    item(key = "sort-products", contentType = "chips") {
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(
                FavoritesUiState.PRODUCT_SORT_RATING,
                FavoritesUiState.PRODUCT_SORT_PRICE_ASC,
                FavoritesUiState.PRODUCT_SORT_PRICE_DESC,
                FavoritesUiState.PRODUCT_SORT_NEWEST,
            ).forEach { token ->
                RewardsChip(
                    label = token,
                    selected = state.productSort == token,
                    onClick = { vm.setProductSort(token) },
                )
            }
        }
    }
    item(key = "count-products", contentType = "meta") {
        Text(
            if (state.productRows.size == 1) "1 favorite product" else "${state.productRows.size} favorite products",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    when {
        state.loading -> item(key = "skeleton", contentType = "skeleton") { RewardsSkeleton() }
        state.productRows.isEmpty() -> item(key = "empty", contentType = "empty") {
            RewardsEmptyCard(
                icon = Icons.Outlined.FavoriteBorder,
                title = "No favorite products",
                body = "Products you heart will show up here.",
            )
        }
        else -> {
            sortedProductRows(state.productRows, state.productSort).forEach { row ->
                item(key = "fav-${row.stableKey}", contentType = "favorite-row") {
                    FavoriteProductRow(
                        row = row,
                        removing = state.removingProductId == row.stableKey,
                        onRemove = { vm.removeFavoriteProduct(row.stableKey) },
                        openPage = openPage,
                    )
                }
            }
        }
    }
}

@Composable
private fun FavoriteProductRow(
    row: FavoriteRowDto,
    removing: Boolean,
    onRemove: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val product = row.product
    val productId = row.effectiveProductId
    val name = product?.name?.takeIf(String::isNotBlank) ?: "Unnamed product"
    val imageUrl = remember(product?.thumbnailUrl) { resolveImageUrl(product?.thumbnailUrl) }
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
                    .size(64.dp)
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
                        contentScale = ContentScale.Fit, // t277-1d: product art never crops (web object-contain parity)
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
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        product?.supplier?.companyName?.takeIf(String::isNotBlank) ?: "Unknown supplier",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (product?.supplier?.isVerified == true) {
                        Icon(
                            Icons.Outlined.CheckCircle,
                            null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(11.dp),
                        )
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(
                        Icons.Outlined.Star,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(11.dp),
                    )
                    Text(
                        "${product?.ratingAvg ?: 0.0}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Text(
                    wishlistBdtLabel(product?.basePrice),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            if (removing) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            } else {
                IconButton(onClick = onRemove) {
                    Icon(
                        Icons.Outlined.Favorite,
                        "Remove from favorites",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}

/* ─── categories variant (favorite-categories) ───────────────────────────── */

private fun LazyListScope.categoriesItems(
    state: FavoritesUiState,
    vm: FavoritesViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    item(key = "banner", contentType = "banner") {
        Surface(
            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.05f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)),
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                "Get updates on new arrivals in your favorite categories",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(12.dp),
            )
        }
    }
    when {
        state.loading -> item(key = "skeleton", contentType = "skeleton") { RewardsSkeleton() }
        state.categoryRows.isEmpty() -> item(key = "empty", contentType = "empty") {
            RewardsEmptyCard(
                icon = Icons.Outlined.GridView,
                title = "No favorite categories yet",
                body = "Follow categories to get notified about new arrivals.",
            )
            Button(
                onClick = { openPage("category-browser", "") },
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp)
                    .height(44.dp),
            ) {
                Text("Browse Categories", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
        else -> {
            item(key = "count-categories", contentType = "meta") {
                Text(
                    if (state.categoryRows.size == 1) "1 followed category" else "${state.categoryRows.size} followed categories",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            state.categoryRows.forEach { row ->
                item(key = "cat-${row.stableKey}", contentType = "category-row") {
                    FollowedCategoryRow(
                        row = row,
                        pendingBell = state.pendingBells[row.stableKey],
                        removing = state.removingCategoryId == row.stableKey,
                        onToggleBell = { vm.toggleBell(row.stableKey) },
                        onUnfollow = { vm.unfollowCategory(row.stableKey) },
                        openPage = openPage,
                    )
                }
            }
            item(key = "explore", contentType = "section") {
                Column {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Explore More",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceContainer,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp)
                            .clickable { openPage("category-browser", "") },
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp),
                        ) {
                            Icon(
                                Icons.Outlined.GridView,
                                null,
                                tint = MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.size(14.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Explore All Categories",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FollowedCategoryRow(
    row: FollowedCategoryRowDto,
    pendingBell: Boolean?,
    removing: Boolean,
    onToggleBell: () -> Unit,
    onUnfollow: () -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val category = row.category
    val name = category?.name?.takeIf(String::isNotBlank) ?: "Unnamed category"
    val slug = category?.slug.orEmpty()
    val notificationsOn = pendingBell ?: row.notifyOnNew
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(slug.isNotBlank()) { openPage("category-products", "categorySlug=$slug") },
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        name,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    // The web's own mapping pins productsCount to 0 for every
                    // row (favorite-categories-page.tsx:45) — "0 products" is
                    // what the page really renders; mirrored verbatim.
                    Text(
                        "0 products",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (pendingBell != null) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    IconButton(onClick = onToggleBell) {
                        Icon(
                            Icons.Outlined.Notifications,
                            if (notificationsOn) "Notifications on for this category" else "Notifications off",
                            tint = if (notificationsOn) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }
            Spacer(Modifier.height(6.dp))
            if (removing) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                    Text(
                        "Unfollowing…",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onUnfollow),
                ) {
                    Text(
                        "Unfollow",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 8.dp),
                    )
                }
            }
        }
    }
}

/* ─── shared row pieces ──────────────────────────────────────────────────── */

/** Inline verbatim result note (the web's toast texts, screen-local). */
@Composable
private fun InlineFavoritesNote(text: String, success: Boolean, onDismiss: (() -> Unit)?) {
    val color = if (success) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
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

private fun resolveImageUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val base = com.zylod.wholesale.data.api.ServerConfig.cached(com.zylod.wholesale.ZylodApp.instance) ?: return null
    return base.trimEnd('/') + raw
}
