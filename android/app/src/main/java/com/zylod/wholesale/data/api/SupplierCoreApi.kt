package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * t267 — SUPPLIER-CORE surface: the five GET endpoints behind the typed
 * supplier pageIds (supplier-orders / supplier-products / supplier-samples /
 * supplier-warehouse / suppliers directory). Every shape below was read
 * from its route handler (the single source of truth), NOT invented:
 *
 *  - GET api/supplier/orders   — supplier/orders/route.ts.
 *    requireUserType(['supplier','admin']), 401 signed-out; a session
 *    without a supplier profile → 404 "No supplier profile found for this
 *    account" (NOTE: 404, not 403, on this one route). The status query
 *    param is validated against the real subOrder statuses (pending,
 *    confirmed, packed, shipped, delivered, cancelled, returned — an
 *    unknown token yields an empty list). Response { success, orders } —
 *    the supplier's subOrders, newest first, capped at 100, each with the
 *    parent order's number/paymentStatus, the buyer display fallback, the
 *    moqPackCount pack total (summed item quantities) and the item lines.
 *  - GET api/supplier/products — supplier/products/route.ts.
 *    requireUserType(['supplier','admin']), 401 signed-out; a session
 *    WITHOUT a supplier profile answers success:true with an EMPTY items
 *    list (honest empty, never an error — this route does not gate). The
 *    status param is validated against active | inactive | pending |
 *    approved | out_of_stock and page is 1-based with a fixed limit of 20.
 *    Response { success, data: { items, total, page, limit, totalPages } }
 *    — the FULL Prisma products rows plus category, priceTiers and
 *    variants; the DTOs model only the fields the screen renders
 *    (ignoreUnknownKeys eats the rest).
 *  - GET api/supplier/samples  — supplier/samples/route.ts.
 *    authenticateRequest → 401; resolveSupplierProfile → 403
 *    (SUPPLIER_PROFILE_REQUIRED). No query params. Response { success,
 *    data: { samples, stats } } — the supplier's sampleOrders newest
 *    first, with the joined product mini-shape, the buyer display name and
 *    the immutable creation-time address snapshot (fromSnapshot:true when
 *    the live address row is gone), plus derived stats.
 *  - GET api/supplier/warehouses — supplier/warehouses/route.ts.
 *    authenticateRequest → 401; profile resolution → 403. No params.
 *    Response { success, data: [rows], count } — the supplier's
 *    warehouseLocations through the shapeOwner projection (active first,
 *    then oldest first).
 *  - GET api/suppliers         — suppliers/route.ts. PUBLIC (no auth —
 *    the Bearer header the shared client attaches is simply ignored).
 *    sort: newest | rating | products; page 1-based; limit fixed 20.
 *    Response { success, data: [...], pagination: { page, limit, total,
 *    totalPages } } — supplierProfiles with the review/product counts and
 *    the owner account's status.
 *
 * Every call returns Response<T> (SellerOpsApi convention — never a bare
 * DTO), so HTTP failures and envelope failures stay distinguishable and the
 * shared OkHttp client's Bearer header plus the 401-refresh-authenticator
 * chain apply unchanged. 401 = signed out; 403 = session without a
 * supplier profile; 404 (orders only) = same missing-profile case — all
 * render the screens' honest not-seller gate.
 *
 * NUMERIC TYPING (SellerOpsApi convention): every Prisma Float/Int column
 * that can arrive fractional (moq, basePrice, stockQuantity, priceOverride,
 * quantity, price, totalAmount, moqPackCount, minQty, maxQty, samplePrice,
 * lat, lng) is Double so fractional JSON numbers never break parsing;
 * counts and the derived stats stay Int. Every field is
 * optional-with-default so shape drift degrades gracefully instead of
 * failing the whole screen's parse. All nested JSON object types are
 * pre-declared as their own @Serializable classes below.
 */
interface SupplierCoreApi {

    @GET("api/supplier/orders")
    suspend fun orders(@Query("status") status: String?): Response<SupplierCoreOrdersEnvelope>

    @GET("api/supplier/products")
    suspend fun products(
        @Query("status") status: String?,
        @Query("page") page: Int?,
    ): Response<SupplierCoreProductsEnvelope>

    @GET("api/supplier/samples")
    suspend fun samples(): Response<SupplierCoreSamplesEnvelope>

    @GET("api/supplier/warehouses")
    suspend fun warehouses(): Response<SupplierCoreWarehousesEnvelope>

    @GET("api/suppliers")
    suspend fun suppliers(
        @Query("page") page: Int?,
        @Query("sort") sort: String?,
    ): Response<SupplierCoreDirectoryEnvelope>

    @GET("api/supplier/dashboard")
    suspend fun dashboard(): Response<SupplierCoreDashboardEnvelope>

    @GET("api/supplier/storefront")
    suspend fun storefront(): Response<SupplierCoreStorefrontEnvelope>

    @GET("api/supplier/queries")
    suspend fun queries(@Query("status") status: String?): Response<SupplierCoreQueriesEnvelope>
}

/* ── orders (GET api/supplier/orders) ───────────────────────────────────── */

@Immutable
@Serializable
data class SupplierCoreOrdersEnvelope(
    val success: Boolean = false,
    val orders: List<SupplierCoreOrderRow> = emptyList(),
)

/** One subOrder for the supplier, joined to its parent order + buyer. */
@Immutable
@Serializable
data class SupplierCoreOrderRow(
    val id: String? = null,
    /** The PARENT order id — the fulfillment APIs resolve through it. */
    val orderId: String? = null,
    val orderNumber: String? = null,
    /** ISO instant of the subOrder creation ("2025-01-05T10:00:00.000Z"). */
    val createdAt: String? = null,
    /** pending | confirmed | packed | shipped | delivered | cancelled | returned. */
    val status: String? = null,
    /** The parent order's real paymentStatus. */
    val paymentStatus: String? = null,
    /** businessName falling back to the buyer's display name (route rule). */
    val buyerCompanyName: String? = null,
    /** fullName || "Buyer" (route rule). */
    val buyerName: String? = null,
    /** Summed item quantities — the pack count (Prisma Float). */
    val moqPackCount: Double = 0.0,
    /** The subOrder subtotal. */
    val totalAmount: Double = 0.0,
    val items: List<SupplierCoreOrderItem> = emptyList(),
)

@Immutable
@Serializable
data class SupplierCoreOrderItem(
    /** product.name || "Product" (route rule). */
    val name: String? = null,
    val imageUrl: String? = null,
    val quantity: Double = 0.0,
    /** The line total (orderItem.totalPrice). */
    val price: Double = 0.0,
    val unit: String? = null,
)

/* ── products (GET api/supplier/products) ───────────────────────────────── */

@Immutable
@Serializable
data class SupplierCoreProductsEnvelope(
    val success: Boolean = false,
    val data: SupplierCoreProductsData? = null,
)

@Immutable
@Serializable
data class SupplierCoreProductsData(
    val items: List<SupplierCoreProductRow> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 20,
    val totalPages: Int = 0,
)

/**
 * The rendered subset of the FULL Prisma products row (the wire carries
 * more — images/videos/etc. — and ignoreUnknownKeys drops the rest).
 */
@Immutable
@Serializable
data class SupplierCoreProductRow(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val description: String? = null,
    val brand: String? = null,
    val sku: String? = null,
    val unit: String? = null,
    val moq: Double = 0.0,
    val basePrice: Double = 0.0,
    val currency: String? = null,
    val stockQuantity: Double = 0.0,
    val isApproved: Boolean = false,
    val isActive: Boolean = false,
    val thumbnailUrl: String? = null,
    val createdAt: String? = null,
    val category: SupplierCoreProductCategory? = null,
    val priceTiers: List<SupplierCorePriceTier> = emptyList(),
    val variants: List<SupplierCoreProductVariant> = emptyList(),
)

@Immutable
@Serializable
data class SupplierCoreProductCategory(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
)

/** Wholesale price tier — maxQty null = the open-ended top tier. */
@Immutable
@Serializable
data class SupplierCorePriceTier(
    val minQty: Double = 0.0,
    val maxQty: Double? = null,
    val pricePerUnit: Double = 0.0,
)

@Immutable
@Serializable
data class SupplierCoreProductVariant(
    val id: String? = null,
    val variantName: String? = null,
    val variantValue: String? = null,
    val stockQuantity: Double = 0.0,
    /** Null = the variant sells at the product base price. */
    val priceOverride: Double? = null,
)

/* ── samples (GET api/supplier/samples) ─────────────────────────────────── */

@Immutable
@Serializable
data class SupplierCoreSamplesEnvelope(
    val success: Boolean = false,
    val data: SupplierCoreSamplesData? = null,
)

@Immutable
@Serializable
data class SupplierCoreSamplesData(
    val samples: List<SupplierCoreSampleRow> = emptyList(),
    val stats: SupplierCoreSampleStats? = null,
)

/** Derived counts over the SAME list (route computes .length filters). */
@Immutable
@Serializable
data class SupplierCoreSampleStats(
    val total: Int = 0,
    val requested: Int = 0,
    val shipped: Int = 0,
    val delivered: Int = 0,
    val cancelled: Int = 0,
)

/** One sampleOrder with the joined product mini-shape + buyer + snapshot. */
@Immutable
@Serializable
data class SupplierCoreSampleRow(
    val id: String? = null,
    val quantity: Double = 0.0,
    val status: String? = null,
    val samplePrice: Double = 0.0,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val product: SupplierCoreSampleProduct? = null,
    /** buyer fullName — real null when the buyer row is gone. */
    val buyerName: String? = null,
    /** Immutable creation-time address snapshot — null when never captured. */
    val shippingAddress: SupplierCoreAddressSnapshot? = null,
    /** True when shippingAddress is the snapshot (Task 87 read path). */
    val fromSnapshot: Boolean = false,
)

@Immutable
@Serializable
data class SupplierCoreSampleProduct(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val thumbnail: String? = null,
    val unit: String? = null,
    val basePrice: Double = 0.0,
)

/**
 * Mirrors buildAddressSnapshot (src/lib/addresses.ts) — the exact eleven
 * string fields captured at sample-request creation time.
 */
@Immutable
@Serializable
data class SupplierCoreAddressSnapshot(
    val label: String? = null,
    val companyName: String? = null,
    val contactName: String? = null,
    val contactPhone: String? = null,
    val addressLine1: String? = null,
    val addressLine2: String? = null,
    val city: String? = null,
    val district: String? = null,
    val postalCode: String? = null,
    val country: String? = null,
    val capturedAt: String? = null,
)

/* ── warehouses (GET api/supplier/warehouses) ───────────────────────────── */

/** Bare-ARRAY data + a root count, exactly as the route answers. */
@Immutable
@Serializable
data class SupplierCoreWarehousesEnvelope(
    val success: Boolean = false,
    val data: List<SupplierCoreWarehouseRow> = emptyList(),
    val count: Int = 0,
)

/** shapeOwner projection of a warehouseLocations row. */
@Immutable
@Serializable
data class SupplierCoreWarehouseRow(
    val id: String? = null,
    val name: String? = null,
    val addressLine1: String? = null,
    val addressLine2: String? = null,
    val city: String? = null,
    val district: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val isActive: Boolean = false,
    val createdAt: String? = null,
)

/* ── suppliers directory (GET api/suppliers) ────────────────────────────── */

@Immutable
@Serializable
data class SupplierCoreDirectoryEnvelope(
    val success: Boolean = false,
    val data: List<SupplierCoreSupplierRow> = emptyList(),
    val pagination: SupplierCorePagination? = null,
)

@Immutable
@Serializable
data class SupplierCorePagination(
    val page: Int = 1,
    val limit: Int = 20,
    val total: Int = 0,
    val totalPages: Int = 0,
)

/** One supplierProfiles row with the joined counts + owner account status. */
@Immutable
@Serializable
data class SupplierCoreSupplierRow(
    val id: String? = null,
    val userId: String? = null,
    val companyName: String? = null,
    /** verified | pending | under_review | rejected … (model enum states). */
    val verificationStatus: String? = null,
    val ratingAvg: Double = 0.0,
    /** Count of supplierReviews (route _count). */
    val ratingCount: Int = 0,
    /** Count of active + approved products (route _count). */
    val productCount: Int = 0,
    /** warehouseAddress city — "" when the supplier has none (route rule). */
    val city: String? = null,
    val district: String? = null,
    val createdAt: String? = null,
    /** The owner account's status — "suspended" renders its own badge. */
    val accountStatus: String? = null,
)

/* ── t268 deep-rail DTOs (dashboard / storefront / queries) ──────────────── */

/**
 * t268 — SUPPLIER DEEP-RAIL surface: three more GET endpoints behind the
 * typed supplier pageIds (supplier-dashboard, the supplier-profile lens,
 * supplier-storefront and supplier-queries). Shapes read from the route
 * handlers (the single source of truth), NOT invented:
 *
 *  - GET api/supplier/dashboard — supplier/dashboard/route.ts.
 *    requireUserType(['supplier','admin']) → 401 ONLY ("Supplier
 *    authentication required") — this route NEVER 403s: a session without
 *    a supplier profile falls back to user-keyed scoping and still answers
 *    success (possibly with zero rows). No query params. Response
 *    { success, data: { stats, supplier, recentSubOrders, topProducts,
 *    productPerformance, inventoryAlerts, monthlyRevenue,
 *    pendingVerifications, customerInsights, storeStats } }:
 *      stats — totalProducts, totalOrders, pendingOrders, lowStockCount
 *      (Int counts) + totalRevenueBDT, pendingPaymentBDT,
 *      thisMonthRevenue (Double money, 'paid' subOrders minus
 *      cancelled/returned; unpaid volume reported separately as
 *      pendingPaymentBDT), totalBuyers (distinct buyer ids).
 *      supplier — companyName, verificationStatus, ratingAvg Double,
 *      supplierId String|null (the profile id; null without a profile).
 *      recentSubOrders (max 8, newest first) — id, orderNumber (parent
 *      order's number falling back to the subOrder id), date ISO, status,
 *      totalAmount Double (subtotal + shipping), itemCount Int,
 *      primaryItemName (first item's product name, "Products" fallback).
 *      topProducts (max 5 by soldCount) — id, name, basePrice Double,
 *      stockQuantity Double, soldCount Double, category ("General"
 *      fallback).
 *      productPerformance (max 5 by soldCount) — id, name, sales Double
 *      (soldCount), revenue Double (summed orderItem totals), rating
 *      Double (product ratingAvg), category.
 *      inventoryAlerts (low-stock stockQuantity ≤ 10, take 10) — id, name,
 *      currentStock Double, threshold Double (the product moq), severity
 *      'critical' (stock 0) or 'warning'.
 *      monthlyRevenue — exactly 6 entries { month 'Jan'-style short label,
 *      revenue Double (rounded) }, oldest → newest, 'paid' subOrders only.
 *      pendingVerifications — sellerVerificationDocuments filtered to
 *      pending | under_review: id, type (documentType), status, date
 *      'YYYY-MM-DD' (uploadedAt day key).
 *      customerInsights — newBuyers Int, repeatBuyers Int (buyers with
 *      one vs multiple subOrders over the last 200) + topRegions (max 5,
 *      shipping-address cities): region, orders Int, percentage Int.
 *      storeStats — messages Int (UNREAD messages in this supplier's
 *      conversations, Task 136), quotes Int (RFQs this supplier has
 *      quoted on).
 *  - GET api/supplier/storefront — supplier/storefront/route.ts. PUBLIC:
 *    with a signed-in seller session and NO explicit supplierId the route
 *    answers the caller's OWN storefront; a guest with none gets 404 JSON
 *    { error } ("No storefront specified — pass ?supplierId= to view a
 *    store", or "Supplier not found" for an unknown id). The Kotlin client
 *    sends no query params — own store via session. Response
 *    { success, data: { id, companyName, verificationStatus, ratingAvg,
 *    ratingCount, memberSince ISO, storeCustomization | null, products
 *    (max 24, isActive + isApproved only, FULL product rows + priceTiers
 *    — reuse SupplierCoreProductRow), certificationRollup, warehouses
 *    (shapeOwner projection — reuse SupplierCoreWarehouseRow), reviews
 *    (max 50, newest first), counts: { products, supplierReviews } } }.
 *      storeCustomization is the RAW sellerStoreCustomizations row (only
 *      the rendered fields are modeled; ignoreUnknownKeys eats the rest).
 *      certificationRollup — the Task 96 trust rollup over the supplier's
 *      PUBLIC products: total, active, expiringSoon, expired counts,
 *      issuers [String] and recent (max 6): id, certName, issuedBy,
 *      issuedAt ISO, expiresAt String|null, status ('active' |
 *      'expiring_soon' | 'expired'), productId, productName.
 *      reviews — id, rating Int, comment String|null, createdAt, buyerName
 *      (businessName || fullName || "Verified buyer" — never the
 *      reviewer's email/phone), mine Bool (true only for the viewer's own
 *      review). NOTE: the wire also carries a duplicate "_count" key with
 *      the same shape as counts — deliberately NOT modeled; the underscore
 *      prefix is an ordinary unknown key (ignoreUnknownKeys=true in
 *      ApiClient.json) and is dropped.
 *  - GET api/supplier/queries — supplier/queries/route.ts.
 *    requireUserType(['supplier','admin']) → 401; resolveSupplierProfile
 *    → 403 (SUPPLIER_PROFILE_REQUIRED). Query param status= has NO server
 *    validation — the schema's real values are open | replied | resolved
 *    | closed, and the chip row sends ONLY those tokens or omits the
 *    param. Response { success, data: [rows] } — data is a BARE ARRAY of
 *    sellerCustomerQueries rows (take 100, newest first) with the buyer
 *    and product names resolved server-side: id, buyerId, buyerName
 *    (businessName || fullName || "Anonymous buyer"), productId
 *    String|null, productName String|null, queryType (product_question |
 *    pre_order | custom_request | complaint per the schema comment),
 *    subject, lastMessage (the query's message), status, replyMessage
 *    String|null, createdAt ISO.
 *
 * Same contract as the t267 cluster: Response<T> wrappers (never a bare
 * DTO), every field optional-with-default so shape drift degrades
 * gracefully, Prisma Float columns as Double, counts as Int, and every
 * nested JSON object pre-declared as its own @Serializable class. All
 * names stay SupplierCore-prefixed — verified collision-free.
 */

/* ── dashboard (GET api/supplier/dashboard) ─────────────────────────────── */

@Immutable
@Serializable
data class SupplierCoreDashboardEnvelope(
    val success: Boolean = false,
    val data: SupplierCoreDashboardData? = null,
)

/** The whole dashboard payload — cached whole-page as one snapshot. */
@Immutable
@Serializable
data class SupplierCoreDashboardData(
    val stats: SupplierCoreDashboardStats? = null,
    val supplier: SupplierCoreDashboardSupplier? = null,
    val recentSubOrders: List<SupplierCoreRecentSubOrder> = emptyList(),
    val topProducts: List<SupplierCoreTopProductRow> = emptyList(),
    val productPerformance: List<SupplierCoreProductPerfRow> = emptyList(),
    val inventoryAlerts: List<SupplierCoreInventoryAlertRow> = emptyList(),
    val monthlyRevenue: List<SupplierCoreMonthRevenue> = emptyList(),
    val pendingVerifications: List<SupplierCorePendingVerification> = emptyList(),
    val customerInsights: SupplierCoreCustomerInsights? = null,
    val storeStats: SupplierCoreStoreStats? = null,
)

/** Derived counts + money aggregates (route Promise.all block). */
@Immutable
@Serializable
data class SupplierCoreDashboardStats(
    val totalProducts: Int = 0,
    val totalOrders: Int = 0,
    val pendingOrders: Int = 0,
    val lowStockCount: Int = 0,
    val totalRevenueBDT: Double = 0.0,
    val pendingPaymentBDT: Double = 0.0,
    val thisMonthRevenue: Double = 0.0,
    val totalBuyers: Int = 0,
)

/** The signed-in supplier's profile mini-shape (or user-keyed fallback). */
@Immutable
@Serializable
data class SupplierCoreDashboardSupplier(
    val companyName: String? = null,
    val verificationStatus: String? = null,
    val ratingAvg: Double = 0.0,
    /** The canonical supplierProfiles.id — null without a profile row. */
    val supplierId: String? = null,
)

/** One recent subOrder for the dashboard rail (max 8, newest first). */
@Immutable
@Serializable
data class SupplierCoreRecentSubOrder(
    val id: String? = null,
    /** Parent order number, falling back to the subOrder id (route rule). */
    val orderNumber: String? = null,
    /** ISO instant of the subOrder creation. */
    val date: String? = null,
    val status: String? = null,
    /** subtotal + shippingCost (route math). */
    val totalAmount: Double = 0.0,
    val itemCount: Int = 0,
    /** First item's product name — "Products" fallback (route rule). */
    val primaryItemName: String? = null,
)

/** One top product by soldCount (max 5). */
@Immutable
@Serializable
data class SupplierCoreTopProductRow(
    val id: String? = null,
    val name: String? = null,
    val basePrice: Double = 0.0,
    val stockQuantity: Double = 0.0,
    val soldCount: Double = 0.0,
    /** category.name — "General" fallback (route rule). */
    val category: String? = null,
)

/** One product-performance row: sales + booked revenue + rating (max 5). */
@Immutable
@Serializable
data class SupplierCoreProductPerfRow(
    val id: String? = null,
    val name: String? = null,
    /** products.soldCount (route names it "sales"). */
    val sales: Double = 0.0,
    /** Summed orderItem.totalPrice for the product. */
    val revenue: Double = 0.0,
    /** products.ratingAvg. */
    val rating: Double = 0.0,
    /** category.name — "General" fallback (route rule). */
    val category: String? = null,
)

/** One low-stock alert — currentStock ≤ 10; 'critical' when stock is 0. */
@Immutable
@Serializable
data class SupplierCoreInventoryAlertRow(
    val id: String? = null,
    val name: String? = null,
    val currentStock: Double = 0.0,
    /** The product's moq doubles as the restock threshold (route rule). */
    val threshold: Double = 0.0,
    /** 'critical' | 'warning' (route rule). */
    val severity: String? = null,
)

/** One month of paid revenue — exactly six entries, oldest first. */
@Immutable
@Serializable
data class SupplierCoreMonthRevenue(
    /** en-US short month label ("Jan"…"Dec") from the route. */
    val month: String? = null,
    val revenue: Double = 0.0,
)

/** One pending/under_review sellerVerificationDocument. */
@Immutable
@Serializable
data class SupplierCorePendingVerification(
    val id: String? = null,
    /** The documentType string. */
    val type: String? = null,
    /** pending | under_review (route filter). */
    val status: String? = null,
    /** 'YYYY-MM-DD' day key of uploadedAt. */
    val date: String? = null,
)

/** Buyer-mix block over the last 200 subOrders (route math). */
@Immutable
@Serializable
data class SupplierCoreCustomerInsights(
    /** Buyers with exactly one subOrder. */
    val newBuyers: Int = 0,
    /** Buyers with more than one subOrder. */
    val repeatBuyers: Int = 0,
    /** Top shipping-address cities (max 5, by order count). */
    val topRegions: List<SupplierCoreRegionRow> = emptyList(),
)

/** One shipping-city rollup row. */
@Immutable
@Serializable
data class SupplierCoreRegionRow(
    val region: String? = null,
    val orders: Int = 0,
    /** Share of the sampled subOrders, rounded (route math). */
    val percentage: Int = 0,
)

/** Unread-message + quoted-RFQ counters (Task 136 honest numbers). */
@Immutable
@Serializable
data class SupplierCoreStoreStats(
    val messages: Int = 0,
    val quotes: Int = 0,
)

/* ── storefront (GET api/supplier/storefront) ───────────────────────────── */

@Immutable
@Serializable
data class SupplierCoreStorefrontEnvelope(
    val success: Boolean = false,
    val data: SupplierCoreStorefrontData? = null,
)

/** The PUBLIC storefront projection (Task 96/98/105 shape). */
@Immutable
@Serializable
data class SupplierCoreStorefrontData(
    val id: String? = null,
    val companyName: String? = null,
    val verificationStatus: String? = null,
    val ratingAvg: Double = 0.0,
    val ratingCount: Int = 0,
    /** ISO instant of the supplierProfiles.createdAt. */
    val memberSince: String? = null,
    /** Raw sellerStoreCustomizations row — null when never customized. */
    val storeCustomization: SupplierCoreStoreCustomization? = null,
    /** Public listings only (isActive + isApproved), max 24 + priceTiers. */
    val products: List<SupplierCoreProductRow> = emptyList(),
    val certificationRollup: SupplierCoreCertRollup? = null,
    /** Active ship-from locations (shapeOwner projection). */
    val warehouses: List<SupplierCoreWarehouseRow> = emptyList(),
    /** Newest-first, max 50, display names only. */
    val reviews: List<SupplierCoreStorefrontReview> = emptyList(),
    val counts: SupplierCoreCounts? = null,
)

/** Rendered subset of the raw sellerStoreCustomizations Prisma row. */
@Immutable
@Serializable
data class SupplierCoreStoreCustomization(
    val bannerUrl: String? = null,
    val logoUrl: String? = null,
    val theme: String? = null,
    val layout: String? = null,
    val font: String? = null,
    val showRatings: Boolean = false,
    val showContactInfo: Boolean = false,
    val showCategories: Boolean = false,
)

/** The Task 96 storefront trust rollup over the PUBLIC products. */
@Immutable
@Serializable
data class SupplierCoreCertRollup(
    val total: Int = 0,
    val active: Int = 0,
    val expiringSoon: Int = 0,
    val expired: Int = 0,
    /** Distinct trimmed issuer names, sorted (route rule). */
    val issuers: List<String> = emptyList(),
    /** Newest six certifications with real product attribution. */
    val recent: List<SupplierCoreCertRow> = emptyList(),
)

/** One productCertifications row as the storefront rollup carries it. */
@Immutable
@Serializable
data class SupplierCoreCertRow(
    val id: String? = null,
    val certName: String? = null,
    val issuedBy: String? = null,
    /** ISO instant of issuedAt. */
    val issuedAt: String? = null,
    /** ISO instant — null when the cert has no expiry on file. */
    val expiresAt: String? = null,
    /** 'active' | 'expiring_soon' | 'expired' (certificationStatus). */
    val status: String? = null,
    val productId: String? = null,
    val productName: String? = null,
)

/** One supplierReview as the PUBLIC projection carries it (Task 105). */
@Immutable
@Serializable
data class SupplierCoreStorefrontReview(
    val id: String? = null,
    val rating: Int = 0,
    val comment: String? = null,
    /** ISO instant of createdAt. */
    val createdAt: String? = null,
    /** businessName || fullName || "Verified buyer" (route rule). */
    val buyerName: String? = null,
    /** True only when the caller's own buyer id authored the review. */
    val mine: Boolean = false,
)

/** Route _count projection: public listings + supplier reviews. */
@Immutable
@Serializable
data class SupplierCoreCounts(
    val products: Int = 0,
    val supplierReviews: Int = 0,
)

/* ── queries (GET api/supplier/queries) ─────────────────────────────────── */

/** Bare-ARRAY data, exactly as the route answers (no count wrapper). */
@Immutable
@Serializable
data class SupplierCoreQueriesEnvelope(
    val success: Boolean = false,
    val data: List<SupplierCoreQueryRow> = emptyList(),
)

/** One sellerCustomerQueries row with the resolved buyer/product names. */
@Immutable
@Serializable
data class SupplierCoreQueryRow(
    val id: String? = null,
    val buyerId: String? = null,
    /** businessName || fullName || "Anonymous buyer" (route rule). */
    val buyerName: String? = null,
    val productId: String? = null,
    /** Resolved product name — null when unset or the row is gone. */
    val productName: String? = null,
    /** product_question | pre_order | custom_request | complaint (schema). */
    val queryType: String? = null,
    val subject: String? = null,
    /** The query's message body (route names it lastMessage). */
    val lastMessage: String? = null,
    /** open | replied | resolved | closed (schema values). */
    val status: String? = null,
    /** The supplier's reply — null until replied. */
    val replyMessage: String? = null,
    /** ISO instant of createdAt. */
    val createdAt: String? = null,
)
