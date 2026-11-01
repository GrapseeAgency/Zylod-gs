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
