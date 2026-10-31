package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * Logistics surfaces — the REAL endpoints behind the nine native logistics
 * pageIds (t252: order-tracking/track-package/track-consignment,
 * delivery-options, warehouse-locator/fulfillment-center,
 * shipping-calculator, logistics hub, pickup-points). Every route was
 * verified against its src/app/api handler:
 *
 *  - GET api/delivery-methods — PUBLIC (no auth needed). 200
 *    { success, data: [DeliveryMethodDto] } — the admin-configured rows of
 *    the deliveryMethods table (isActive only, sortOrder asc). An
 *    unconfigured site is an HONEST empty list — the UI must never invent
 *    couriers or prices.
 *  - GET api/warehouses?q=<query> — PUBLIC (rate-limited). 200
 *    { success, data: [WarehouseDto], districts: [String], count, total } —
 *    the real warehouseLocations rows of ACTIVE suppliers with an APPROVED
 *    verification status (max 100, district/createdAt order). A non-empty
 *    q is an honest lowercase contains-filter across name/city/district/
 *    companyName/addressLine1 server-side; districts is the sorted unique
 *    list over ALL rows (not just the filtered ones).
 *  - GET api/shipping/quote?district=&weightKg=&subtotal= — PUBLIC (the
 *    Task 94 zone-book engine, lib/shipping.ts computeQuote). 200
 *    { success, district, weightKg, subtotal, count, data: [QuoteOptionDto] }
 *    — options sorted by what the buyer pays, with freeAbove crossings
 *    honored (price 0 + freeShipping true + basePrice preserved for display).
 *    400 { error } when district is missing or weightKg is not a number in
 *    [0, 100000]; an uncovered district is an HONEST empty list.
 *
 * The TrackedOrderDto family below also lives here (it is the payload of
 * the t252 tracking surface) even though its endpoint is declared on the
 * EXISTING [OrdersApi] in CommerceApis.kt — the route is
 * GET api/orders/{orderId} (src/app/api/orders/[id]/route.ts,
 * Bearer-authenticated): 200 { success, data: TrackedOrderDto } with
 * subOrders embedding the supplier company name and the trackingHistory
 * (gps_ping rows excluded, trackedAt DESC); 404 for a foreign/phantom id.
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every field is
 * nullable-with-default so shape drift degrades into the tolerant mappers
 * in ui/logistics/LogisticsModels.kt instead of failing the whole screen's
 * parse; every nested object is itself @Serializable. All three public
 * routes ignore an Authorization header if the shared client attaches one.
 */
interface LogisticsApi {
    /** GET api/delivery-methods — PUBLIC; the admin-configured methods. */
    @GET("api/delivery-methods")
    suspend fun deliveryMethods(): Response<ApiEnvelope<List<DeliveryMethodDto>>>

    /**
     * GET api/warehouses — PUBLIC directory read; [q] mirrors the web q=
     * param verbatim (empty/null → the unfiltered first 100 rows).
     */
    @GET("api/warehouses")
    suspend fun warehouses(@Query("q") q: String? = null): Response<WarehousesEnvelope>

    /**
     * GET api/shipping/quote — PUBLIC zone-book quote. [weightKg] is
     * REQUIRED (400 when absent/invalid); [subtotal] is optional on the
     * wire (omitted when null → server treats it as 0) and is what unlocks
     * the freeAbove crossings.
     */
    @GET("api/shipping/quote")
    suspend fun shippingQuote(
        @Query("district") district: String,
        @Query("weightKg") weightKg: Double,
        @Query("subtotal") subtotal: Double? = null,
    ): Response<QuoteEnvelope>
}

/* ─── delivery methods (GET api/delivery-methods) ────────────────────────── */

/**
 * One admin-configured delivery method (verbatim handler projection —
 * note the snake_case `estimated_delivery` / `badge_variant` pair; the
 * handler hard-codes badge_variant to "default"). price is a number (৳).
 */
@Immutable
@Serializable
data class DeliveryMethodDto(
    val id: String? = null,
    val name: String? = null,
    val description: String? = null,
    @SerialName("estimated_delivery") val estimatedDelivery: String? = null,
    val price: Double = 0.0,
    val badge: String? = null,
    @SerialName("badge_variant") val badgeVariant: String? = null,
    val icon: String? = null,
) {
    /** Stable identity for keyed collections (method id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "delivery-method-${hashCode()}"
}

/* ─── warehouses (GET api/warehouses) ────────────────────────────────────── */

/**
 * One public ship-from row (verbatim handler projection): the warehouse's
 * own fields joined with the owning supplier's company name, rating and
 * verification status. Every string is nullable-tolerant except the row's
 * stable identity, which falls back to a hash key.
 */
@Immutable
@Serializable
data class WarehouseDto(
    val id: String? = null,
    val name: String? = null,
    val city: String? = null,
    val district: String? = null,
    val addressLine1: String? = null,
    val addressLine2: String? = null,
    val supplierId: String? = null,
    val companyName: String? = null,
    val ratingAvg: Double? = null,
    val ratingCount: Int? = null,
    val verificationStatus: String? = null,
) {
    /** Stable identity for keyed collections (warehouse id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "warehouse-${hashCode()}"
}

/**
 * Warehouses response — NOT the shared [ApiEnvelope] shape: the handler
 * adds top-level `districts` / `count` / `total` siblings next to `data`.
 */
@Immutable
@Serializable
data class WarehousesEnvelope(
    val success: Boolean = false,
    val data: List<WarehouseDto> = emptyList(),
    val districts: List<String> = emptyList(),
    val count: Int = 0,
    val total: Int = 0,
    val error: String? = null,
)

/* ─── shipping quote (GET api/shipping/quote) ────────────────────────────── */

/**
 * One quote option (lib/shipping.ts QuoteOption verbatim): the rate's own
 * [basePrice], what the buyer actually pays ([price], 0 when the
 * freeAbove threshold waived it) and the honest display pair
 * (freeShipping + freeAbove) the screens render as the waiver note.
 */
@Immutable
@Serializable
data class QuoteOptionDto(
    val rateId: String? = null,
    val zoneId: String? = null,
    val zoneName: String? = null,
    val methodId: String? = null,
    val methodName: String? = null,
    val methodDescription: String? = null,
    val estimatedDays: String? = null,
    val basePrice: Double = 0.0,
    val price: Double = 0.0,
    val freeShipping: Boolean = false,
    val freeAbove: Double? = null,
) {
    /** Stable identity for keyed collections (rate id, hash fallback). */
    val stableKey: String
        get() = rateId?.takeIf(String::isNotBlank) ?: "quote-${hashCode()}"
}

/**
 * Quote response — NOT the shared [ApiEnvelope] shape: the handler echoes
 * the resolved inputs (district / weightKg / subtotal) plus `count` as
 * top-level siblings of `data`.
 */
@Immutable
@Serializable
data class QuoteEnvelope(
    val success: Boolean = false,
    val district: String? = null,
    val weightKg: Double? = null,
    val subtotal: Double? = null,
    val count: Int = 0,
    val data: List<QuoteOptionDto> = emptyList(),
    val error: String? = null,
)

/* ─── order tracking (GET api/orders/{orderId} on OrdersApi) ─────────────── */

/**
 * One tracked order — the exact projection track-order-page.tsx consumes
 * from GET api/orders/{orderId} (orders/[id]/route.ts `data` object; the
 * handler also sends buyerId/totalAmount/promotion/shippingAddress/
 * payments, which the tracking surface does not render and the shared
 * Json parser ignores). placedAt/updatedAt are UTC ISO instants.
 */
@Immutable
@Serializable
data class TrackedOrderDto(
    val id: String? = null,
    val orderNumber: String? = null,
    val paymentStatus: String? = null,
    val placedAt: String? = null,
    val updatedAt: String? = null,
    val subOrders: List<TrackedSubOrderDto> = emptyList(),
) {
    /** Stable identity for keyed collections (order id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "tracked-order-${hashCode()}"
}

/**
 * One per-supplier shipment inside a tracked order. `tracking` is the
 * sub-order's trackingHistory (gps_ping excluded, trackedAt DESC) — may be
 * empty; the timeline renders that honestly.
 */
@Immutable
@Serializable
data class TrackedSubOrderDto(
    val id: String? = null,
    val status: String? = null,
    val trackingNumber: String? = null,
    val estimatedDelivery: String? = null,
    val supplier: TrackedSupplierDto? = null,
    val tracking: List<TrackingEventDto> = emptyList(),
) {
    /** Stable identity for keyed collections (sub-order id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "tracked-sub-${hashCode()}"
}

/** The supplier brief the detail route embeds on each sub-order. */
@Immutable
@Serializable
data class TrackedSupplierDto(
    val companyName: String? = null,
)

/**
 * One tracking event (verbatim handler projection of a trackingHistory
 * row). trackedAt is a UTC ISO instant; lat/lng are nullable numbers the
 * timeline declares-but-does-not-render (no live GPS feed exists).
 */
@Immutable
@Serializable
data class TrackingEventDto(
    val id: String? = null,
    val status: String? = null,
    val location: String? = null,
    val note: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val trackedAt: String? = null,
) {
    /** Stable identity for keyed collections (event id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "track-event-${hashCode()}"
}
