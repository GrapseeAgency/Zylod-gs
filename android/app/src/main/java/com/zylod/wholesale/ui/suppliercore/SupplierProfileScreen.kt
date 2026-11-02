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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.SupplierCoreCustomerInsights
import com.zylod.wholesale.data.api.SupplierCoreDashboardData
import com.zylod.wholesale.data.api.SupplierCoreProductPerfRow

/**
 * t268 — SHARED typed Supplier Profile screen (pageId "supplier-profile" —
 * the ui/screens delegate calls THIS, so the page keeps its own
 * SupplierProfileViewModel). THE SHARED-ENDPOINT TWO-LENS DESIGN: this page
 * and the supplier dashboard read the SAME wire payload (GET api/supplier/
 * dashboard) through two page-owned ViewModels — the t267 delegation
 * doctrine (one endpoint, pageIds as lenses) applied to a full typed
 * screen. This lens renders the profile: the identity card (company +
 * verification badge + star rating — memberSince is NOT in this payload,
 * so no membership line is invented), the product-performance book (sales /
 * revenue / rating), the customer-insights block and the store-stats row.
 * Honest loading / not-seller / offline / empty states; theme colors only.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@Composable
fun SupplierProfileScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierProfileViewModel = viewModel(key = "native-supplier-core-$pageId") {
        SupplierProfileViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-pull on EVERY entry (t208 parity) — the silent refresh keeps visible
    // data mounted instead of a spinner swap.
    LaunchedEffect(Unit) { vm.refresh() }

    SupplierCorePageScaffold(title = "Supplier Profile", onBack = onBack) {
        when {
            state.loading -> SupplierCoreCenterSpinner()
            state.notSeller -> SupplierCoreGate(openPage = openPage, onRetry = vm::retry)
            state.error != null -> SupplierCoreOfflineEmpty(
                message = "No profile saved yet — connect once to save it",
                onRetry = vm::retry,
            )
            else -> {
                val data = state.data
                if (data == null) {
                    SupplierCoreOfflineEmpty(
                        message = "No profile saved yet — connect once to save it",
                        onRetry = vm::retry,
                    )
                } else {
                    ProfileList(state = state, data = data)
                }
            }
        }
    }
}

@Composable
private fun ProfileList(state: SupplierProfileUiState, data: SupplierCoreDashboardData) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when {
            state.offline -> item(key = "sprof-offline", contentType = "banner") {
                SupplierCoreBanner("Connection lost — showing the last loaded profile")
            }
            state.offlineFromCache -> item(key = "sprof-cache", contentType = "banner") {
                SupplierCoreBanner("Offline — showing saved profile")
            }
        }
        if (state.refreshing) {
            item(key = "sprof-refreshing", contentType = "progress") { SupplierCoreRefreshingBar() }
        }
        item(key = "sprof-identity", contentType = "identity") {
            IdentityCard(data)
        }
        item(key = "sperf-section", contentType = "section") {
            SectionCard(title = "Product performance") {
                if (data.productPerformance.isEmpty()) {
                    SupplierCoreEmptyState("No product performance to show yet.")
                } else {
                    Column {
                        data.productPerformance.forEach { row -> PerfRow(row) }
                    }
                }
            }
        }
        item(key = "sprof-insights", contentType = "section") {
            data.customerInsights?.let { insights -> InsightsCard(insights) }
        }
        item(key = "sprof-store", contentType = "section") {
            data.storeStats?.let { store ->
                SectionCard(title = "Store stats") {
                    Text(
                        "${supplierCoreCount(store.messages)} unread messages · " +
                            "${supplierCoreCount(store.quotes)} quoted RFQs",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
        item(key = "sprof-spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** Identity card: company (bold) + verification badge + star rating. */
@Composable
private fun IdentityCard(data: SupplierCoreDashboardData) {
    val supplier = data.supplier
    val ratingLabel = remember(supplier) { "★ ${supplierCoreRating(supplier?.ratingAvg)}" }
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(
                supplier?.companyName ?: "Your Store",
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 6.dp),
            ) {
                SupplierCoreStatusBadge(
                    supplier?.verificationStatus ?: "unknown",
                    supplier?.verificationStatus.orEmpty(),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    ratingLabel,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** One titled card — every profile section renders as exactly one. */
@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(
                title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(6.dp))
            content()
        }
    }
}

/** One performance row: name + category + sales + revenue + star rating. */
@Composable
private fun PerfRow(row: SupplierCoreProductPerfRow) {
    val line = remember(row) {
        "sales ${supplierCoreQty(row.sales)} · ${supplierCoreMoney(row.revenue)} · " +
            "★ ${supplierCoreRating(row.rating)}"
    }
    Column(Modifier.padding(top = 4.dp)) {
        Text(
            row.name ?: "Product",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            "${row.category ?: "General"} · $line",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * Customer-insights card — the same row style the dashboard lens renders
 * (new/repeat buyers line + top-region rows).
 */
@Composable
private fun InsightsCard(insights: SupplierCoreCustomerInsights) {
    SectionCard(title = "Customer insights") {
        Text(
            "${supplierCoreCount(insights.newBuyers)} new · " +
                "${supplierCoreCount(insights.repeatBuyers)} repeat buyers",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.height(4.dp))
        if (insights.topRegions.isEmpty()) {
            SupplierCoreEmptyState("No buyer regions to rank yet.")
        } else {
            Column {
                insights.topRegions.forEach { region ->
                    Text(
                        "${region.region ?: "Unknown"} — " +
                            "${supplierCoreCount(region.orders)} orders · ${region.percentage}%",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
    }
}
