package com.zylod.wholesale.ui.suppliercore

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.data.api.SupplierCoreCertRollup
import com.zylod.wholesale.data.api.SupplierCoreCertRow
import com.zylod.wholesale.data.api.SupplierCorePriceTier
import com.zylod.wholesale.data.api.SupplierCoreProductRow
import com.zylod.wholesale.data.api.SupplierCoreStorefrontData
import com.zylod.wholesale.data.api.SupplierCoreStorefrontReview
import com.zylod.wholesale.data.api.SupplierCoreWarehouseRow
import androidx.compose.ui.layout.ContentScale

/**
 * t268 — SHARED typed Supplier Storefront screen (pageId
 * "supplier-storefront" — the ui/screens delegate calls THIS, so the page
 * keeps its own SupplierStorefrontViewModel). Real data only, from the
 * PUBLIC GET api/supplier/storefront (own store via session — the client
 * sends no query params): the identity header (logo + company + verification
 * badge + star rating + member-since), the customization banner (Coil
 * AsyncImage, only when the wire carries a URL — the URL is guarded
 * non-null), the public product listings with their wholesale tiers, the
 * Task 96 certification trust rollup (only when the wire counts > 0), the
 * Task 98 active warehouse rail and the Task 105 newest-first reviews with
 * the "You" chip on the viewer's own row. A 404 renders the SERVER'S OWN
 * parsed error text as the honest empty state — no invented "register as a
 * supplier" copy. Theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SupplierStorefrontScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierStorefrontViewModel = viewModel(key = "native-supplier-core-$pageId") {
        SupplierStorefrontViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SupplierCorePageScaffold(title = "Supplier Storefront", onBack = onBack) {
        when {
            state.loading -> SupplierCoreCenterSpinner()
            // 404: the route's own error text is the state (guest with no
            // store of their own). Retry stays one tap away.
            state.notFoundMessage != null -> Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 32.dp),
            ) {
                SupplierCoreEmptyState(state.notFoundMessage.orEmpty())
                Button(
                    onClick = vm::retry,
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
            state.error != null -> SupplierCoreOfflineEmpty(
                message = "No storefront saved yet — connect once to save it",
                onRetry = vm::retry,
            )
            else -> {
                val data = state.data
                if (data == null) {
                    SupplierCoreOfflineEmpty(
                        message = "No storefront saved yet — connect once to save it",
                        onRetry = vm::retry,
                    )
                } else {
                    StorefrontList(state = state, data = data)
                }
            }
        }
    }
}

@Composable
private fun StorefrontList(state: SupplierStorefrontUiState, data: SupplierCoreStorefrontData) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when {
            state.offline -> item(key = "sfront-offline", contentType = "banner") {
                SupplierCoreBanner("Connection lost — showing the last loaded storefront")
            }
            state.offlineFromCache -> item(key = "sfront-cache", contentType = "banner") {
                SupplierCoreBanner("Offline — showing saved storefront")
            }
        }
        if (state.refreshing) {
            item(key = "sfront-refreshing", contentType = "progress") { SupplierCoreRefreshingBar() }
        }
        item(key = "sfront-header", contentType = "identity") {
            HeaderCard(data)
        }
        // Customization banner — rendered ONLY when the wire carries a URL
        // (the guard is the contract; a missing banner is simply skipped).
        data.storeCustomization?.bannerUrl?.let { bannerUrl ->
            item(key = "sfront-banner", contentType = "bannerImage") {
                val placeholderColor = MaterialTheme.colorScheme.surfaceVariant
                val placeholder = remember(placeholderColor) { ColorPainter(placeholderColor) }
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(bannerUrl)
                        .crossfade(200)
                        .build(),
                    contentDescription = "${data.companyName ?: "Store"} banner",
                    placeholder = placeholder,
                    error = placeholder,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp)
                        .clip(RoundedCornerShape(12.dp)),
                )
            }
        }
        // Products — the public listings rail.
        item(key = "sfront-products-title", contentType = "header") {
            SectionTitle("Products")
        }
        if (data.products.isEmpty()) {
            item(key = "sfront-products-empty", contentType = "empty") {
                SupplierCoreEmptyState("No public listings yet — approved products appear here.")
            }
        } else {
            items(
                data.products,
                key = { "sfront-p-${it.id ?: it.hashCode()}" },
                contentType = { "sfront-product" },
            ) { row ->
                ProductCard(row)
            }
        }
        // Certifications — only when the rollup exists and counts something.
        val rollup = data.certificationRollup
        if (rollup != null && rollup.total > 0) {
            item(key = "sfront-certs", contentType = "section") {
                CertCard(rollup)
            }
        }
        // Warehouses — the active ship-from rail.
        item(key = "sfront-warehouses-title", contentType = "header") {
            SectionTitle("Warehouses")
        }
        if (data.warehouses.isEmpty()) {
            item(key = "sfront-warehouses-empty", contentType = "empty") {
                SupplierCoreEmptyState("No warehouse locations published.")
            }
        } else {
            item(key = "sfront-warehouses", contentType = "section") {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    data.warehouses.forEach { row -> WarehouseCard(row) }
                }
            }
        }
        // Reviews — newest first, the viewer's own row badged "You".
        item(key = "sfront-reviews-title", contentType = "header") {
            SectionTitle("Reviews")
        }
        if (data.reviews.isEmpty()) {
            item(key = "sfront-reviews-empty", contentType = "empty") {
                SupplierCoreEmptyState("No reviews yet.")
            }
        } else {
            items(
                data.reviews,
                key = { "sfront-r-${it.id ?: it.hashCode()}" },
                contentType = { "sfront-review" },
            ) { row ->
                ReviewCard(row)
            }
        }
        item(key = "sfront-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** Identity header: logo (when present) + company + badge + rating + since. */
@Composable
private fun HeaderCard(data: SupplierCoreStorefrontData) {
    val ratingLabel = remember(data) {
        "★ ${supplierCoreRating(data.ratingAvg)} (${supplierCoreCount(data.ratingCount)})"
    }
    val sinceLabel = remember(data) { supplierCoreDate(data.memberSince) }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val logoUrl = data.storeCustomization?.logoUrl
                if (logoUrl != null) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(logoUrl)
                            .crossfade(200)
                            .build(),
                        contentDescription = "Store logo",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .size(56.dp)
                            .clip(RoundedCornerShape(12.dp)),
                    )
                    Spacer(Modifier.width(12.dp))
                }
                Text(
                    data.companyName ?: "Store",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 6.dp),
            ) {
                SupplierCoreStatusBadge(
                    data.verificationStatus ?: "unknown",
                    data.verificationStatus.orEmpty(),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    ratingLabel,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (sinceLabel.isNotBlank()) {
                Text(
                    "Member since $sinceLabel",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/** Plain 13sp section title (the LazyColumn header idiom). */
@Composable
private fun SectionTitle(title: String) {
    Text(
        title,
        fontSize = 13.sp,
        fontWeight = FontWeight.Black,
        color = MaterialTheme.colorScheme.onSurface,
        modifier = Modifier.padding(top = 2.dp),
    )
}

/** One public listing: name/price header + MOQ/stock + first two tiers. */
@Composable
private fun ProductCard(row: SupplierCoreProductRow) {
    val priceLabel = remember(row) { supplierCoreMoney(row.basePrice) }
    val unitLabel = remember(row) { row.unit?.takeIf(String::isNotBlank) ?: "unit" }
    val stockLabel = remember(row) { "stock ${supplierCoreQty(row.stockQuantity)}" }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.name ?: "Product",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    priceLabel,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Text(
                "per $unitLabel · $stockLabel",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
            row.priceTiers.take(2).forEach { tier -> TierLine(tier) }
        }
    }
}

/** "minQty+ → ৳pricePerUnit" — the real wholesale ladder line. */
@Composable
private fun TierLine(tier: SupplierCorePriceTier) {
    val line = remember(tier) {
        "${supplierCoreQty(tier.minQty)}+ → ${supplierCoreMoney(tier.pricePerUnit)}"
    }
    Text(
        line,
        fontSize = 11.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(top = 2.dp),
    )
}

/** The Task 96 trust rollup card: counts line + issuers + recent rows. */
@Composable
private fun CertCard(rollup: SupplierCoreCertRollup) {
    val summary = remember(rollup) {
        "${rollup.total} certs · ${rollup.active} active · " +
            "${rollup.expiringSoon} expiring soon · ${rollup.expired} expired"
    }
    val issuerLine = remember(rollup) { rollup.issuers.joinToString(separator = ", ") }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            SectionTitle("Certifications")
            Text(
                summary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 4.dp),
            )
            if (issuerLine.isNotBlank()) {
                Text(
                    "Issued by $issuerLine",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            rollup.recent.forEach { row -> CertRow(row) }
        }
    }
}

/** One recent certification: name + issuer + status badge. */
@Composable
private fun CertRow(row: SupplierCoreCertRow) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(top = 4.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                row.certName ?: "Certificate",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                row.issuedBy ?: "Unknown issuer",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.width(8.dp))
        SupplierCoreStatusBadge(row.status ?: "unknown", row.status.orEmpty())
    }
}

/** One ACTIVE ship-from location: name + city/district + active badge. */
@Composable
private fun WarehouseCard(row: SupplierCoreWarehouseRow) {
    val place = remember(row) {
        listOfNotNull(row.city?.takeIf(String::isNotBlank), row.district?.takeIf(String::isNotBlank))
            .joinToString(separator = ", ")
    }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(12.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    row.name ?: "Warehouse",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (place.isNotBlank()) {
                    Text(
                        place,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (row.isActive) {
                SupplierCoreStatusBadge("active", "active")
            }
        }
    }
}

/** One review: stars + comment + buyer + date + the viewer's "You" chip. */
@Composable
private fun ReviewCard(row: SupplierCoreStorefrontReview) {
    val stars = remember(row) { "★ ${row.rating}/5" }
    val date = remember(row) { supplierCoreDate(row.createdAt) }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stars,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.weight(1f))
                if (row.mine) {
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                        shape = RoundedCornerShape(50),
                    ) {
                        Text(
                            "You",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                }
            }
            row.comment?.takeIf(String::isNotBlank)?.let { comment ->
                Text(
                    comment,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 4.dp),
            ) {
                Text(
                    row.buyerName ?: "Verified buyer",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (date.isNotBlank()) {
                    Text(
                        date,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
