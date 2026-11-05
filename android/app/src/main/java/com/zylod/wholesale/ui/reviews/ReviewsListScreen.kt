package com.zylod.wholesale.ui.reviews

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.text.NumberFormat
import java.util.Locale

/**
 * SHARED typed reviews screen (pageIds all-reviews + product-reviews-list —
 * the ui/screens delegates call THIS with their pageId, so every page keeps
 * its own ReviewsViewModel instance through the pageId-keyed factory).
 *
 * Data truth: GET api/reviews?productId= via [ReviewsViewModel] — the REAL
 * top-level reviews (createdAt DESC, take 100), with the product header
 * resolved exactly like product-reviews-page.tsx (`productId ?
 * /api/products/${id} : /api/products?limit=1`). Structure mirrors the web
 * page 1:1: the tappable product header card (image, name, "4.8 (N
 * reviews)" summary, Package-icon placeholder → the proven Inventory2),
 * the four filter pills, the sort line + Write-a-Review jump, the review
 * cards (initial avatar, "Verified Buyer" badge, relative date, 5-star
 * row, comment, photo strip) and the honest empty/fork ("No reviews yet"
 * vs "No reviews match this filter"). Nothing is fabricated: no fake
 * Helpful counters, no Report toast, no invented sort order (the honest
 * "Newest first" labels the wire's real createdAt-DESC ordering where the
 * web's static "Most Relevant" text claimed one).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewsListScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ReviewsViewModel = viewModel(key = "native-reviews-$pageId") {
        ReviewsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (TrackOrderScreen parity) — a freshly
    // submitted review shows up in the list on the way back.
    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            ReviewsTopBar(title = reviewsTitleFor(pageId), onBack = onBack)
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                // First-launch failure with nothing renderable: error card.
                state.error != null -> {
                    val errorMessage = state.error
                    ReviewsErrorCard(message = errorMessage.orEmpty(), onRetry = { vm.load(query) })
                }
                // Resolving product + list: the web page's header skeleton.
                state.loading -> ReviewsSkeleton()
                else -> ReviewsContent(state = state, vm = vm, openPage = openPage)
            }
        }
    }
}

private fun reviewsTitleFor(pageId: String): String = when (pageId) {
    "all-reviews" -> "All Reviews"
    else -> "Product Reviews List"
}

/* ─── top bar ────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReviewsTopBar(title: String, onBack: (() -> Unit)?) {
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

/* ─── content ────────────────────────────────────────────────────────────── */

@Composable
private fun ReviewsContent(
    state: ReviewsUiState,
    vm: ReviewsViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (state.offlineFromCache) {
            OfflineBanner("Offline — showing the last saved reviews")
        }
        // Optional header (web: renders only when the product fetch landed).
        state.product?.let { product -> ProductHeaderCard(product, openPage) }
        FilterPills(selected = state.filter, onSelect = vm::setFilter)
        SortLine(productId = state.product?.id, openPage = openPage)
        when {
            state.filtered.isEmpty() && !state.hasAnyReviews ->
                EmptyReviewsCard(productId = state.product?.id, openPage = openPage)
            state.filtered.isEmpty() -> NoFilterMatchCard()
            else -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                state.filtered.forEach { row -> ReviewCard(row = row) }
            }
        }
    }
}

/** The web product snippet header card (tappable → the native PDP). */
@Composable
private fun ProductHeaderCard(
    product: ProductHeaderRow,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val url = remember(product.imageUrl) { resolveImageUrl(product.imageUrl) }
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = { openPage("product-detail", "productId=${product.id}") }),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(12.dp))
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
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Icon(
                        Icons.Outlined.Inventory2,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(24.dp),
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    product.name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                // t279 honesty: a star rating cannot exist with zero reviews
                // (the old render showed "4.6 (0 reviews)" for seed rows).
                if (product.reviewCount > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                        Icon(
                            Icons.Filled.Star,
                            null,
                            tint = LocalZylodExtra.current.warning,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            String.format(Locale.US, "%.1f", product.ratingAvg),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = LocalZylodExtra.current.warning,
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            "(${NumberFormat.getIntegerInstance(Locale.US).format(product.reviewCount)} reviews)",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    Text(
                        "No reviews yet",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
    }
}

/** The web's four filter pills (client-side projections of the same rows). */
@Composable
private fun FilterPills(selected: String, onSelect: (String) -> Unit) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
    ) {
        ReviewFilters.ALL_KEYS.forEach { key ->
            val active = selected == key
            Surface(
                color = if (active) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.surfaceContainer
                },
                shape = RoundedCornerShape(50),
                border = if (active) {
                    null
                } else {
                    BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f))
                },
                modifier = Modifier.clip(RoundedCornerShape(50)).clickable(onClick = { onSelect(key) }),
            ) {
                Text(
                    reviewFilterLabel(key),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (active) {
                        MaterialTheme.colorScheme.onPrimary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                )
            }
        }
    }
}

private fun reviewFilterLabel(key: String): String = when (key) {
    ReviewFilters.PHOTOS -> "With Photos"
    ReviewFilters.VERIFIED -> "Verified Only"
    ReviewFilters.FIVE_STAR -> "5 Star"
    else -> "All Reviews"
}

/**
 * Sort line + Write-a-Review jump. The web's static "Most Relevant" label
 * is rendered here as the wire's real ordering (GET api/reviews is
 * createdAt DESC) — a sort the data does not follow is never claimed.
 */
@Composable
private fun SortLine(
    productId: String?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Text(
            "Sort by: ",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            "Newest first",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.weight(1f))
        TextButton(onClick = { openPage("rate-products", "productId=${productId.orEmpty()}") }) {
            Text(
                "Write a Review",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/** One review card — the web ReviewItem projection. */
@Composable
private fun ReviewCard(row: ReviewRow) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            // Author info + stars (web header row).
            Row(verticalAlignment = Alignment.Top) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(36.dp)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.08f), RoundedCornerShape(50)),
                ) {
                    Text(
                        row.initial,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            row.buyerName,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        if (row.verified) {
                            Spacer(Modifier.width(6.dp))
                            Surface(
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
                                shape = RoundedCornerShape(50),
                            ) {
                                Text(
                                    "Verified Buyer",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                )
                            }
                        }
                    }
                    if (row.dateLabel.isNotBlank()) {
                        Text(
                            row.dateLabel,
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    repeat(5) { i ->
                        Icon(
                            if (i < row.rating) Icons.Filled.Star else Icons.Outlined.Star,
                            null,
                            tint = if (i < row.rating) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.outlineVariant
                            },
                            modifier = Modifier.size(12.dp),
                        )
                    }
                }
            }
            // Review text (the single stored comment field).
            if (row.comment.isNotBlank()) {
                Text(
                    row.comment,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            // Attached photos — only the REAL uploaded review media.
            if (row.images.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                ) {
                    row.images.forEach { raw ->
                        val url = resolveImageUrl(raw)
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                        ) {
                            if (url != null) {
                                AsyncImage(
                                    model = url,
                                    contentDescription = "Customer upload",
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize(),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Web parity empty book fork 1: no reviews on the product at all. */
@Composable
private fun EmptyReviewsCard(
    productId: String?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(56.dp)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.08f), RoundedCornerShape(50)),
            ) {
                Icon(
                    Icons.Filled.Star,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp),
                )
            }
            Text(
                "No reviews yet",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                "Be the first to share your experience with this product.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            if (!productId.isNullOrBlank()) {
                Button(
                    onClick = { openPage("rate-products", "productId=$productId") },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier.height(40.dp),
                ) {
                    Text("Write the First Review", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/** Web parity empty fork 2: reviews exist but this pill filtered them out. */
@Composable
private fun NoFilterMatchCard() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "No reviews match this filter",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
            )
            Text(
                "Try a different filter to see more reviews.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** Resolving the list — header skeleton + two pulsing review cards. */
@Composable
private fun ReviewsSkeleton() {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp),
        ) {}
        repeat(2) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp),
            ) {}
        }
        Text(
            "Loading reviews…",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

/**
 * Honest failure card (load errors): red-tinted, warning icon, the error
 * text, and a Retry that re-runs the full fetch.
 */
@Composable
private fun ReviewsErrorCard(message: String, onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = error,
                )
            }
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .height(36.dp),
            ) {
                Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Amber banner over the cached snapshot — the TrackOrderScreen banner style. */
@Composable
private fun OfflineBanner(text: String) {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(text, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

/** Relative server paths resolve against the cached base (DealsScreen idiom). */
private fun resolveImageUrl(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    val server = ServerConfig.cached(ZylodApp.instance) ?: return null
    return server.trimEnd('/') + raw
}
