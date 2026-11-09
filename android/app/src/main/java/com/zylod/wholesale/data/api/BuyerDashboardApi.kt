package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.GET

/**
 * THE BUYER DASHBOARD surface (t282) — GET api/buyer/dashboard, verified
 * against src/app/api/buyer/dashboard/route.ts. The buyer's real stats,
 * recent orders, 6-month spending chart, favorite suppliers (order-item
 * derived), wishlist items, recent searches, coupon savings count and the
 * merged recent-activity feed — the exact payload buyer-dashboard-page.tsx
 * consumes. 401 'Authentication required' for guests (the screen renders
 * the honest sign-in CTA, OrdersScreen convention).
 *
 * WIRE NOTES (dc74841 lesson): every field is nullable-with-default so
 * shape drift degrades into the screen mappers instead of failing the whole
 * parse; money is the raw Double the route emits; timestamps are ISO strings.
 */
interface BuyerDashboardApi {

    /** GET api/buyer/dashboard — the signed-in buyer's aggregated dashboard. */
    @GET("api/buyer/dashboard")
    suspend fun dashboard(): Response<BuyerDashboardEnvelope>
}

/** Envelope of GET api/buyer/dashboard — data null on 401/500. */
@Immutable
@Serializable
data class BuyerDashboardEnvelope(
    val success: Boolean = false,
    val data: BuyerDashboardDto? = null,
    val error: String? = null,
)

/**
 * data of GET api/buyer/dashboard — the route's exact top-level shape
 * (route.ts:163-203): stats, recentOrders, spendingData, favoriteSuppliers,
 * wishlistItems, recentSearches, couponSavings, recentActivity.
 */
@Immutable
@Serializable
data class BuyerDashboardDto(
    val stats: BuyerDashboardStatsDto? = null,
    val recentOrders: List<BuyerDashboardOrderDto> = emptyList(),
    val spendingData: List<BuyerSpendingPointDto> = emptyList(),
    val favoriteSuppliers: List<BuyerFavoriteSupplierDto> = emptyList(),
    val wishlistItems: List<BuyerDashboardWishlistItemDto> = emptyList(),
    val recentSearches: List<BuyerRecentSearchDto> = emptyList(),
    val couponSavings: Int = 0,
    val recentActivity: List<BuyerRecentActivityDto> = emptyList(),
)

/** The stats block (route.ts:166-172) — the five numbers the web renders. */
@Immutable
@Serializable
data class BuyerDashboardStatsDto(
    val totalOrders: Int = 0,
    val totalSpentBDT: Double = 0.0,
    val activeOrders: Int = 0,
    val wishlistCount: Int = 0,
    val totalSavingsBDT: Double = 0.0,
)

/**
 * One recent order (route.ts:173-184) — flat projection: first-item summary
 * + supplier + thumbnail baked server-side, status is the paymentStatus.
 */
@Immutable
@Serializable
data class BuyerDashboardOrderDto(
    val id: String? = null,
    val orderNumber: String? = null,
    val date: String? = null,
    val status: String? = null,
    val paymentStatus: String? = null,
    val totalAmount: Double = 0.0,
    val itemCount: Int = 0,
    val summary: String? = null,
    val supplier: String? = null,
    val thumbnailUrl: String? = null,
) {
    /** Stable identity for keyed collections (order id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "dashboard-order-${hashCode()}"

    /** The orderId the order-detail route needs. */
    val effectiveOrderId: String?
        get() = id?.takeIf(String::isNotBlank)
}

/** One spending-chart point (route.ts:151) — short month label + rounded amount. */
@Immutable
@Serializable
data class BuyerSpendingPointDto(
    val month: String? = null,
    val amount: Double = 0.0,
)

/** One favorite supplier (route.ts:119-138) — order-count ranked, top 5. */
@Immutable
@Serializable
data class BuyerFavoriteSupplierDto(
    val id: String? = null,
    val name: String? = null,
    val location: String? = null,
    val rating: Double = 0.0,
    val orderCount: Int = 0,
) {
    /** Stable identity for keyed collections (supplier id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "dashboard-supplier-${hashCode()}"
}

/** One wishlist preview row (route.ts:187-195). */
@Immutable
@Serializable
data class BuyerDashboardWishlistItemDto(
    val id: String? = null,
    val productId: String? = null,
    val name: String? = null,
    val price: Double = 0.0,
    val moq: Double = 1.0,
    val supplier: String? = null,
    val thumbnailUrl: String? = null,
) {
    /** The productId the tile routes to (productId → row id fallback). */
    val effectiveProductId: String?
        get() = productId?.takeIf(String::isNotBlank) ?: id?.takeIf(String::isNotBlank)
}

/** One recent search (route.ts:196-200) — the chip the web renders. */
@Immutable
@Serializable
data class BuyerRecentSearchDto(
    val id: String? = null,
    val query: String? = null,
    val date: String? = null,
) {
    /** The non-blank query text (chips skip blank rows). */
    val effectiveQuery: String?
        get() = query?.takeIf(String::isNotBlank)
}

/** One recent-activity entry (route.ts:154-161) — type order|wishlist. */
@Immutable
@Serializable
data class BuyerRecentActivityDto(
    val type: String? = null,
    val text: String? = null,
    val time: String? = null,
)
