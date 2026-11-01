package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import retrofit2.Response
import retrofit2.http.GET

/**
 * t266 — SELLER OPERATIONS surface: the eight GET endpoints behind the typed
 * seller pageIds (payouts / revenue / analytics / inventory / customer
 * insights / reviews / shipping settings / verification status). Every shape
 * below was read from its route handler under src/app/api/supplier (the
 * single source of truth), NOT invented:
 *
 *  - GET api/supplier/payouts   — payouts/route.ts. requireUserType
 *    ['supplier','admin'], 401-first; no supplier profile → 403 JSON error
 *    (SUPPLIER_PROFILE_REQUIRED). No query params. Response { success,
 *    data: { summary: { totalPaid, pendingAmount, completedCount,
 *    pendingCount }, payouts: [...] } } — the sellerPayouts rows, newest
 *    first, capped at 100.
 *  - GET api/supplier/revenue   — revenue/route.ts. Same auth shape. No
 *    query params. Response { success, data: { summary, dailySeries,
 *    ledger } } — orderItem rows on the supplier's products (subOrder not
 *    cancelled/returned), commission/net are honest nulls on the wire.
 *  - GET api/supplier/analytics — analytics/route.ts. Same auth shape. No
 *    query params. Response { success, data: { overview, salesPerformance
 *    (30 fixed day buckets), trafficSources (always [] — no tracking
 *    source), topProducts (top 5 by revenue), restockDemand } }.
 *  - GET api/supplier/inventory — inventory/route.ts. Same auth shape.
 *    Query all=true is ADMIN-ONLY (ignored otherwise) — the native seller
 *    screen sends no params. Response { success, data: { items,
 *    summary } } — products with variants nested, ordered by stockQuantity
 *    ascending.
 *  - GET api/supplier/customers — customers/route.ts. Same auth shape. No
 *    query params. Response { success, data: { summary, customers } } —
 *    buyer aggregates over the supplier's own subOrders, top 100 by spend.
 *  - GET api/supplier/reviews   — reviews/route.ts. Same auth shape. NO
 *    status/rating query param exists (checked), so the screen renders the
 *    merged newest-first rail without a filter chip row. Response {
 *    success, data: { averageRating, totalReviews, storeAverageRating,
 *    storeTotalReviews, reviews } } — kind 'product' (db.reviews) merged
 *    with kind 'store' (supplierReviews), capped at 50 combined.
 *  - GET api/supplier/shipping  — shipping/route.ts. Same auth shape. No
 *    query params. Response { success, data: { configs, zones } } — the
 *    sellerShippingConfigs rows plus the model's zone enum list.
 *  - GET api/supplier/verification — verification/route.ts. Same auth
 *    shape. No query params. Response { success, data: [documents],
 *    progress: { verifiedRequired, totalRequired, percent, requiredTypes }
 *    } — NOTE: data is a bare ARRAY here (not an object like the other
 *    seven) and progress rides the envelope root.
 *
 * Every call returns Response<T> (AdminOpsApi convention — never a bare
 * DTO), so HTTP failures and envelope failures stay distinguishable and the
 * shared OkHttp client's Bearer header plus the 401-refresh-authenticator
 * chain apply unchanged. 401 = signed out; 403 = session without a
 * supplier profile — both render the screens' honest not-seller gate.
 *
 * NUMERIC TYPING (AdminApi convention): every Prisma Float column (amount,
 * fee, unitPrice, totalPrice, subtotal, baseRate, ratePerKg, stockQuantity,
 * moq, priceOverride, gmv, aov) is Double so fractional JSON numbers never
 * break parsing; counts and the Int rating stay Int. Every field is
 * optional-with-default so shape drift degrades gracefully instead of
 * failing the whole screen's parse. All nested JSON object types are
 * pre-declared as their own @Serializable classes below.
 */
interface SellerOpsApi {

    @GET("api/supplier/payouts")
    suspend fun payouts(): Response<SellerOpsPayoutsEnvelope>

    @GET("api/supplier/revenue")
    suspend fun revenue(): Response<SellerOpsRevenueEnvelope>

    @GET("api/supplier/analytics")
    suspend fun analytics(): Response<SellerOpsAnalyticsEnvelope>

    @GET("api/supplier/inventory")
    suspend fun inventory(): Response<SellerOpsInventoryEnvelope>

    @GET("api/supplier/customers")
    suspend fun customers(): Response<SellerOpsCustomersEnvelope>

    @GET("api/supplier/reviews")
    suspend fun reviews(): Response<SellerOpsReviewsEnvelope>

    @GET("api/supplier/shipping")
    suspend fun shipping(): Response<SellerOpsShippingEnvelope>

    @GET("api/supplier/verification")
    suspend fun verification(): Response<SellerOpsVerificationEnvelope>
}

/* ── payouts (GET api/supplier/payouts) ─────────────────────────────────── */

@Immutable
@Serializable
data class SellerOpsPayoutsEnvelope(
    val success: Boolean = false,
    val data: SellerOpsPayoutsData? = null,
)

@Immutable
@Serializable
data class SellerOpsPayoutsData(
    val summary: SellerOpsPayoutSummary? = null,
    val payouts: List<SellerOpsPayoutRow> = emptyList(),
)

@Immutable
@Serializable
data class SellerOpsPayoutSummary(
    val totalPaid: Double = 0.0,
    val pendingAmount: Double = 0.0,
    val completedCount: Int = 0,
    val pendingCount: Int = 0,
)

/** sellerPayouts row (route maps the nine fields the screen renders). */
@Immutable
@Serializable
data class SellerOpsPayoutRow(
    val id: String? = null,
    val amount: Double = 0.0,
    /** bank_transfer | bkash | nagad | upay | rocket. */
    val method: String? = null,
    /** pending | processing | completed | failed. */
    val status: String? = null,
    /** The seller's withdrawal target, verbatim at request time. */
    val destination: String? = null,
    /** Admin-stamped transfer reference (TRXID) at completion. */
    val reference: String? = null,
    val fee: Double = 0.0,
    val processedAt: String? = null,
    val createdAt: String? = null,
)

/* ── revenue (GET api/supplier/revenue) ─────────────────────────────────── */

@Immutable
@Serializable
data class SellerOpsRevenueEnvelope(
    val success: Boolean = false,
    val data: SellerOpsRevenueData? = null,
)

@Immutable
@Serializable
data class SellerOpsRevenueData(
    val summary: SellerOpsRevenueSummary? = null,
    val dailySeries: List<SellerOpsRevenueDay> = emptyList(),
    val ledger: List<SellerOpsRevenueLedgerRow> = emptyList(),
)

/** Fee/payout sources do not exist yet — those four arrive as real nulls. */
@Immutable
@Serializable
data class SellerOpsRevenueSummary(
    val gross: Double = 0.0,
    val recognized: Double = 0.0,
    val commissionFees: Double? = null,
    val deliveryDeductions: Double? = null,
    val netRevenue: Double? = null,
    val availableForPayout: Double? = null,
)

/** One grouped day: "2025-01-05" + the day's gross. */
@Immutable
@Serializable
data class SellerOpsRevenueDay(
    val date: String? = null,
    val gross: Double = 0.0,
)

/** One ledger line — the orderItem joined to its subOrder + order. */
@Immutable
@Serializable
data class SellerOpsRevenueLedgerRow(
    val id: String? = null,
    val orderNumber: String? = null,
    /** The parent order's real paymentStatus ('paid' = recognized). */
    val paymentStatus: String? = null,
    /** The parent subOrder's real fulfillment status. */
    val fulfillmentStatus: String? = null,
    val date: String? = null,
    val productName: String? = null,
    val quantity: Double = 0.0,
    val unitPrice: Double = 0.0,
    val gross: Double = 0.0,
    val commission: Double? = null,
    val net: Double? = null,
)

/* ── analytics (GET api/supplier/analytics) ─────────────────────────────── */

@Immutable
@Serializable
data class SellerOpsAnalyticsEnvelope(
    val success: Boolean = false,
    val data: SellerOpsAnalyticsData? = null,
)

@Immutable
@Serializable
data class SellerOpsAnalyticsData(
    val overview: SellerOpsAnalyticsOverview? = null,
    val salesPerformance: List<SellerOpsAnalyticsDay> = emptyList(),
    /** Always [] on the wire (no tracking source) — kept as raw elements. */
    val trafficSources: List<JsonElement> = emptyList(),
    val topProducts: List<SellerOpsTopProduct> = emptyList(),
    val restockDemand: SellerOpsRestockDemand? = null,
)

/** conversionRate/pageViews have no tracking source — real nulls. */
@Immutable
@Serializable
data class SellerOpsAnalyticsOverview(
    val gmv: Double = 0.0,
    val totalOrders: Int = 0,
    val unitsSold: Double = 0.0,
    val aov: Double = 0.0,
    val conversionRate: Double? = null,
    val pageViews: Int? = null,
)

/** One of the 30 fixed day buckets: "2025-01-05" + that day's BDT gross. */
@Immutable
@Serializable
data class SellerOpsAnalyticsDay(
    val date: String? = null,
    val bdt: Double = 0.0,
)

/** Top product by revenue (route caps at 5). */
@Immutable
@Serializable
data class SellerOpsTopProduct(
    val id: String? = null,
    val name: String? = null,
    val unitsSold: Double = 0.0,
    val revenue: Double = 0.0,
)

/** Restock-watch demand (Task 66): active stockAlerts on the supplier's products. */
@Immutable
@Serializable
data class SellerOpsRestockDemand(
    val totalWatchers: Int = 0,
    val products: List<SellerOpsRestockProduct> = emptyList(),
)

@Immutable
@Serializable
data class SellerOpsRestockProduct(
    val productId: String? = null,
    val productName: String? = null,
    val stockQuantity: Double = 0.0,
    val unit: String? = null,
    val isActive: Boolean = false,
    val watchers: Int = 0,
    /** Pinned variant labels buyers watch (Task 65). */
    val variantLabels: List<String> = emptyList(),
)

/* ── inventory (GET api/supplier/inventory) ─────────────────────────────── */

@Immutable
@Serializable
data class SellerOpsInventoryEnvelope(
    val success: Boolean = false,
    val data: SellerOpsInventoryData? = null,
)

@Immutable
@Serializable
data class SellerOpsInventoryData(
    val items: List<SellerOpsInventoryItem> = emptyList(),
    val summary: SellerOpsInventorySummary? = null,
)

/** Product stock row with variants nested (route's select shape). */
@Immutable
@Serializable
data class SellerOpsInventoryItem(
    val id: String? = null,
    val name: String? = null,
    val sku: String? = null,
    val unit: String? = null,
    val stockQuantity: Double = 0.0,
    val moq: Double = 0.0,
    val thumbnailUrl: String? = null,
    val isActive: Boolean = false,
    val isApproved: Boolean = false,
    val updatedAt: String? = null,
    /** Seller-tuned low-stock line; null = platform default (20). */
    val stockAlertThreshold: Double? = null,
    val category: SellerOpsInventoryCategory? = null,
    /** Supplier attribution (admin audit) — null for plain seller sessions. */
    val supplier: SellerOpsInventorySupplier? = null,
    val variants: List<SellerOpsInventoryVariant> = emptyList(),
)

@Immutable
@Serializable
data class SellerOpsInventoryCategory(
    val name: String? = null,
)

@Immutable
@Serializable
data class SellerOpsInventorySupplier(
    val id: String? = null,
    val companyName: String? = null,
    val verificationStatus: String? = null,
)

@Immutable
@Serializable
data class SellerOpsInventoryVariant(
    val id: String? = null,
    val variantName: String? = null,
    val variantValue: String? = null,
    val sku: String? = null,
    val stockQuantity: Double = 0.0,
    val priceOverride: Double? = null,
)

@Immutable
@Serializable
data class SellerOpsInventorySummary(
    val totalSkus: Int = 0,
    val totalVariantSkus: Int = 0,
    val lowStockCount: Int = 0,
    val outOfStockCount: Int = 0,
    val totalInventoryUnits: Double = 0.0,
)

/* ── customers (GET api/supplier/customers) ─────────────────────────────── */

@Immutable
@Serializable
data class SellerOpsCustomersEnvelope(
    val success: Boolean = false,
    val data: SellerOpsCustomersData? = null,
)

@Immutable
@Serializable
data class SellerOpsCustomersData(
    val summary: SellerOpsCustomersSummary? = null,
    val customers: List<SellerOpsCustomerRow> = emptyList(),
)

/** avgOrdersPerCustomer is null only when there is nobody yet. */
@Immutable
@Serializable
data class SellerOpsCustomersSummary(
    val totalCustomers: Int = 0,
    val repeatCustomers: Int = 0,
    val avgOrdersPerCustomer: Double? = null,
    val lifetimeValue: Double = 0.0,
)

/** Buyer aggregate over the supplier's own subOrders (top 100 by spend). */
@Immutable
@Serializable
data class SellerOpsCustomerRow(
    val buyerId: String? = null,
    /** businessName || fullName || email — the route's display fallback. */
    val displayName: String? = null,
    val email: String? = null,
    val ordersCount: Int = 0,
    val totalSpent: Double = 0.0,
    val deliveredCount: Int = 0,
    val openCount: Int = 0,
    val repeat: Boolean = false,
    val firstOrderAt: String? = null,
    val lastOrderAt: String? = null,
)

/* ── reviews (GET api/supplier/reviews) ─────────────────────────────────── */

@Immutable
@Serializable
data class SellerOpsReviewsEnvelope(
    val success: Boolean = false,
    val data: SellerOpsReviewsData? = null,
)

@Immutable
@Serializable
data class SellerOpsReviewsData(
    /** Headline aggregates stay the PRODUCT rating (marketplace-facing). */
    val averageRating: Double = 0.0,
    val totalReviews: Int = 0,
    val storeAverageRating: Double = 0.0,
    val storeTotalReviews: Int = 0,
    val reviews: List<SellerOpsReviewRow> = emptyList(),
)

/** One merged review — kind picks the product rail vs the store rail. */
@Immutable
@Serializable
data class SellerOpsReviewRow(
    val id: String? = null,
    /** product | store. */
    val kind: String? = null,
    val supplierId: String? = null,
    val rating: Int = 0,
    val comment: String? = null,
    /** Store-rail rows are verified by construction (route sets true). */
    val verifiedPurchase: Boolean = false,
    val createdAt: String? = null,
    /** Product rail only — null on store rows. */
    val productName: String? = null,
    val productId: String? = null,
    val productThumbnail: String? = null,
    /** businessName || fullName || "Anonymous buyer". */
    val buyerName: String? = null,
)

/* ── shipping (GET api/supplier/shipping) ───────────────────────────────── */

@Immutable
@Serializable
data class SellerOpsShippingEnvelope(
    val success: Boolean = false,
    val data: SellerOpsShippingData? = null,
)

@Immutable
@Serializable
data class SellerOpsShippingData(
    val configs: List<SellerOpsShippingConfig> = emptyList(),
    /** The model's real zone enum (dhaka … mymensingh + all). */
    val zones: List<String> = emptyList(),
)

/** sellerShippingConfigs row — [supplierId, zone] unique on the wire. */
@Immutable
@Serializable
data class SellerOpsShippingConfig(
    val id: String? = null,
    val supplierId: String? = null,
    /** dhaka | chittagong | rajshahi | sylhet | khulna | barishal | rangpur | mymensingh | all. */
    val zone: String? = null,
    val baseRate: Double = 0.0,
    val ratePerKg: Double = 0.0,
    /** Free-shipping threshold; null = never free. */
    val freeAboveAmount: Double? = null,
    /** Free-text estimate (e.g. "2-4 days"); null = not set. */
    val estimatedDays: String? = null,
    val isActive: Boolean = true,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

/* ── verification (GET api/supplier/verification) ───────────────────────── */

/**
 * Bare-ARRAY data on this one (unlike the other seven envelopes) + the
 * progress object rides the envelope root, exactly as the route answers.
 */
@Immutable
@Serializable
data class SellerOpsVerificationEnvelope(
    val success: Boolean = false,
    val data: List<SellerOpsVerificationDoc> = emptyList(),
    val progress: SellerOpsVerificationProgress? = null,
)

/** sellerVerificationDocuments row (route returns the full model rows). */
@Immutable
@Serializable
data class SellerOpsVerificationDoc(
    val id: String? = null,
    val supplierId: String? = null,
    /** nid_front | nid_back | trade_license | tin_certificate | bank_statement | utility_bill. */
    val documentType: String? = null,
    val fileName: String? = null,
    val fileUrl: String? = null,
    /** The model stores the size as a STRING (bytes). */
    val fileSize: String? = null,
    /** pending | under_review | verified | rejected. */
    val status: String? = null,
    val rejectionReason: String? = null,
    val uploadedAt: String? = null,
    val reviewedAt: String? = null,
)

/** Honest progress: only verified rows count, and only required types. */
@Immutable
@Serializable
data class SellerOpsVerificationProgress(
    val verifiedRequired: Int = 0,
    val totalRequired: Int = 0,
    val percent: Int = 0,
    /** trade_license, tin_certificate, nid_front, bank_statement. */
    val requiredTypes: List<String> = emptyList(),
)
