package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * Seller (supplier) surface — the REAL GET endpoints behind the native
 * Seller Dashboard (pageId "seller-dashboard", RouteOwnership native row).
 * Only endpoints that verifiably exist server-side are declared here:
 *
 *  - GET api/supplier/dashboard — src/app/api/supplier/dashboard/route.ts.
 *    { success, data: { stats, supplier, recentSubOrders, topProducts,
 *    productPerformance, inventoryAlerts, monthlyRevenue, pendingVerifications,
 *    customerInsights, storeStats } } — the native screen renders stats,
 *    supplier, recentSubOrders, topProducts and inventoryAlerts (the rest are
 *    ignored by the shared lenient Json instance).
 *  - GET api/supplier/products — src/app/api/supplier/products/route.ts (GET
 *    handler). { success, data: { items, total, page, limit, totalPages } };
 *    items are full prisma product rows, so the DTO here is a deliberate
 *    SUBSET (ignoreUnknownKeys drops the rest). Optional ?status/?search
 *    filters match the handler's contract (active/inactive/pending/approved/
 *    out_of_stock).
 *  - GET api/supplier/orders — src/app/api/supplier/orders/route.ts.
 *    { success, orders: [...] } — NOTE the rows ride the TOP-LEVEL "orders"
 *    key, not "data" (unlike every other envelope in this app); newest-first,
 *    take 100, optional ?status filter over real subOrder statuses.
 *
 * AUTH: every handler is requireUserType(['supplier','admin']) — buyers and
 * anonymous callers get an honest 401 which the VM maps to its not-seller
 * state. No custom auth code here: the shared ApiClient OkHttp client
 * attaches the Bearer session token and runs the 401→refresh→retry chain.
 *
 * NUMERIC TYPING (DealsApi convention): Prisma Float columns reach Kotlin as
 * fractional JSON numbers — moq/stockQuantity/soldCount (products),
 * subtotal/shippingCost (revenue sums), quantity/price (order lines) and the
 * ratingAvg are typed Double so `12.5` or `100.0` never breaks parsing.
 * Whole-number aggregates (Prisma count/Int columns) stay Int.
 */
interface SellerApi {
    @GET("api/supplier/dashboard")
    suspend fun dashboard(): Response<SellerDashboardEnvelope>

    @GET("api/supplier/products")
    suspend fun products(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("status") status: String? = null,
        @Query("search") search: String? = null,
    ): Response<SellerProductsEnvelope>

    @GET("api/supplier/orders")
    suspend fun orders(@Query("status") status: String? = null): Response<SellerOrdersEnvelope>
}

/* ─── GET api/supplier/dashboard ─────────────────────────────────────────── */

/** Envelope of GET api/supplier/dashboard — also the on-disk offline cache payload. */
@Serializable
data class SellerDashboardEnvelope(
    val success: Boolean = false,
    val data: SellerDashboardDataDto? = null,
    val error: String? = null,
)

@Immutable
@Serializable
data class SellerDashboardDataDto(
    val stats: SellerStatsDto? = null,
    val supplier: SellerStoreDto? = null,
    val recentSubOrders: List<SellerSubOrderDto> = emptyList(),
    val topProducts: List<SellerTopProductDto> = emptyList(),
    val inventoryAlerts: List<SellerInventoryAlertDto> = emptyList(),
)

/**
 * The dashboard KPI tile numbers, verbatim from the handler's `stats` object:
 * revenue figures are Prisma Float `_sum` aggregates (subtotal + shippingCost)
 * over paid, non-cancelled subOrders; counts are real table counts.
 */
@Immutable
@Serializable
data class SellerStatsDto(
    val totalProducts: Int = 0,
    val totalOrders: Int = 0,
    val pendingOrders: Int = 0,
    val lowStockCount: Int = 0,
    val totalRevenueBDT: Double = 0.0,
    val pendingPaymentBDT: Double = 0.0,
    val thisMonthRevenue: Double = 0.0,
    val totalBuyers: Int = 0,
)

/** The session supplier's store identity (supplierProfiles row subset). */
@Immutable
@Serializable
data class SellerStoreDto(
    val companyName: String? = null,
    val verificationStatus: String? = null,
    val ratingAvg: Double? = null,
    val supplierId: String? = null,
)

/**
 * One dashboard recent-order row (handler's recentSubOrders map: the 8 newest
 * subOrders with their parent orderNumber). Every field optional-with-default
 * so shape drift degrades gracefully instead of failing the whole parse.
 */
@Immutable
@Serializable
data class SellerSubOrderDto(
    val id: String? = null,
    val orderNumber: String? = null,
    val date: String? = null,
    val status: String? = null,
    val totalAmount: Double? = null,
    val itemCount: Int? = null,
    val primaryItemName: String? = null,
) {
    /** Stable identity for LazyColumn keys (subOrder id → orderNumber → hash). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: orderNumber?.takeIf(String::isNotBlank)
            ?: "sub-${hashCode()}"
}

/** Top-sellers-by-soldCount row (handler's topProducts map). */
@Immutable
@Serializable
data class SellerTopProductDto(
    val id: String? = null,
    val name: String? = null,
    val basePrice: Double? = null,
    val stockQuantity: Double? = null,
    val soldCount: Double? = null,
    val category: String? = null,
) {
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "top-${hashCode()}"
}

/** Low-stock alert row (handler's inventoryAlerts map: stockQuantity <= 10). */
@Immutable
@Serializable
data class SellerInventoryAlertDto(
    val id: String? = null,
    val name: String? = null,
    val currentStock: Double? = null,
    val threshold: Double? = null,
    val severity: String? = null,
) {
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "alert-${hashCode()}"
}

/* ─── GET api/supplier/products ──────────────────────────────────────────── */

@Serializable
data class SellerProductsEnvelope(
    val success: Boolean = false,
    val data: SellerProductsPageDto? = null,
    val error: String? = null,
)

/** Handler's `data` page object: { items, total, page, limit, totalPages }. */
@Immutable
@Serializable
data class SellerProductsPageDto(
    val items: List<SellerProductDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 20,
    val totalPages: Int = 0,
)

/**
 * The session supplier's own product row — a deliberate SUBSET of the full
 * prisma include (category/priceTiers/images/videos/variants): only the
 * fields a seller list tile needs. Float columns (moq, stockQuantity,
 * soldCount, basePrice) are Double per the DealsApi convention.
 */
@Immutable
@Serializable
data class SellerProductDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val basePrice: Double? = null,
    val moq: Double? = null,
    val unit: String? = null,
    val currency: String? = null,
    val stockQuantity: Double? = null,
    val stockAlertThreshold: Double? = null,
    val isActive: Boolean? = null,
    val isApproved: Boolean? = null,
    val thumbnailUrl: String? = null,
    val soldCount: Double? = null,
    val ratingAvg: Double? = null,
    val reviewCount: Int? = null,
    val category: SellerCategoryBriefDto? = null,
    val images: List<SellerImageBriefDto> = emptyList(),
) {
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "product-${hashCode()}"

    /** Same contract as ProductDto.firstImage: sorted images → thumbnailUrl. */
    val firstImage: String?
        get() = images.filter { !it.imageUrl.isNullOrBlank() }.minByOrNull { it.sortOrder }?.imageUrl
            ?: thumbnailUrl
}

@Immutable
@Serializable
data class SellerCategoryBriefDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
)

@Immutable
@Serializable
data class SellerImageBriefDto(
    val imageUrl: String? = null,
    val sortOrder: Int = 0,
)

/* ─── GET api/supplier/orders ────────────────────────────────────────────── */

/**
 * Envelope of GET api/supplier/orders — the handler responds
 * { success, orders } with the rows at the TOP LEVEL (verified in
 * supplier/orders/route.ts:101), not nested under `data`.
 */
@Serializable
data class SellerOrdersEnvelope(
    val success: Boolean = false,
    val orders: List<SellerOrderDto> = emptyList(),
    val error: String? = null,
)

/**
 * One seller subOrder row (the handler's map, newest-first take 100):
 * `orderId` is the PARENT order id (t229 — the detail/fulfillment routes
 * resolve the parent order), `moqPackCount` is Σ item quantity (a Float sum —
 * Double here) and `totalAmount` is the subOrder subtotal.
 */
@Immutable
@Serializable
data class SellerOrderDto(
    val id: String? = null,
    val orderId: String? = null,
    val orderNumber: String? = null,
    val createdAt: String? = null,
    val status: String? = null,
    val paymentStatus: String? = null,
    val buyerCompanyName: String? = null,
    val buyerName: String? = null,
    val moqPackCount: Double? = null,
    val totalAmount: Double? = null,
    val items: List<SellerOrderItemDto> = emptyList(),
) {
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: orderId?.takeIf(String::isNotBlank)
            ?: orderNumber?.takeIf(String::isNotBlank)
            ?: "order-${hashCode()}"
}

@Immutable
@Serializable
data class SellerOrderItemDto(
    val name: String? = null,
    val imageUrl: String? = null,
    val quantity: Double? = null,
    val price: Double? = null,
    val unit: String? = null,
)
