package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Returns surfaces — the REAL endpoints behind the three native return
 * pageIds (t253: return-management, returns-exchange, warranty-claims all
 * render the shared return-request flow). Both routes were verified against
 * their src/app/api handlers:
 *
 *  - GET api/orders/{orderId} (orders/[id]/route.ts, Bearer-authenticated):
 *    the SAME route the t252 tracking surface calls, but the return flow
 *    consumes a DIFFERENT projection of it — return-request-page.tsx reads
 *    subOrders[].items[] (id/productId/quantity/unitPrice/totalPrice plus
 *    the product { id, name, thumbnailUrl, unit, slug } and variant
 *    { id, variantName, variantValue } briefs the route `include`s). That
 *    is why this interface declares its own duplicate-path GET with a
 *    dedicated DTO family below instead of widening [TrackedOrderDto]
 *    (Retrofit allows duplicate paths across interfaces; t252's tracking
 *    DTOs stay untouched on OrdersApi).
 *
 *  - POST api/orders/{orderId}/return (orders/[id]/return/route.ts,
 *    Bearer-authenticated, rate limit 5/min → 429): body
 *    { items: [{ itemId, reason, quantity, comments }], shippingMethod }
 *    — return-request-page.tsx sends the items array; the native surface
 *    also carries the route's REAL shippingMethod field, which accepts
 *    exactly two values server-side ("dropoff" kept, everything else
 *    coerced to "pickup" — the t253 contract sends the selected value
 *    verbatim). Validation limits that can reach the buyer as 400/409:
 *    non-empty items (max 50), a non-blank reason per item (≤ 500 chars),
 *    whole quantity ≥ 1 (≤ 100000 and ≤ the ordered quantity), items must
 *    belong to the order's DELIVERED sub-orders, paid order only, no
 *    duplicate open return, returns.windowDays window. Success 200:
 *    { success, data: ReturnConfirmationDto, message } — the confirmation
 *    carries the real RTN number + the server-computed estimatedRefund.
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every field is
 * nullable-with-default so shape drift degrades into tolerant mappers
 * instead of failing the whole screen's parse; every nested object is
 * itself @Serializable; unknown siblings (shippingAddress, payments,
 * tracking, buyerId …) are ignored by the shared Json parser.
 */
interface ReturnsApi {
    /**
     * GET api/orders/{orderId} — the return-flow projection: the order's
     * items with product/variant briefs. 404 for a foreign/phantom id,
     * 401 when the session is gone (the shared client has already tried
     * one token refresh by then).
     */
    @GET("api/orders/{orderId}")
    suspend fun orderForReturn(@Path("orderId") orderId: String): Response<ReturnOrderEnvelope>

    /**
     * POST api/orders/{orderId}/return — files the real returnRequests row
     * (status 'pending'; nothing is scheduled, no order status flips).
     * [body] carries the selected items plus the shippingMethod selection.
     */
    @POST("api/orders/{orderId}/return")
    suspend fun submitReturn(
        @Path("orderId") orderId: String,
        @Body body: ReturnSubmitBody,
    ): Response<ReturnSubmitEnvelope>
}

/* ─── order for return (GET api/orders/{orderId}) ────────────────────────── */

/** Return-flow envelope — same wrapper shape as the tracking route. */
@Immutable
@Serializable
data class ReturnOrderEnvelope(
    val success: Boolean = false,
    val data: ReturnOrderDto? = null,
    val error: String? = null,
)

/**
 * The order as return-request-page.tsx consumes it: identity + payment
 * badge + placedAt for the progress card, and the flat item list the page
 * derives via subOrders.flatMap(so => so.items).
 */
@Immutable
@Serializable
data class ReturnOrderDto(
    val id: String? = null,
    val orderNumber: String? = null,
    val totalAmount: Double = 0.0,
    val paymentStatus: String? = null,
    val placedAt: String? = null,
    val subOrders: List<ReturnSubOrderDto> = emptyList(),
) {
    /** Stable identity for keyed collections (order id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "return-order-${hashCode()}"
}

/** One per-supplier shipment — the return flow only reads its items. */
@Immutable
@Serializable
data class ReturnSubOrderDto(
    val id: String? = null,
    val status: String? = null,
    val supplier: ReturnSupplierBriefDto? = null,
    val items: List<ReturnOrderItemDto> = emptyList(),
) {
    /** Stable identity for keyed collections (sub-order id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "return-sub-${hashCode()}"
}

/** The supplier brief the detail route embeds on each sub-order. */
@Immutable
@Serializable
data class ReturnSupplierBriefDto(
    val companyName: String? = null,
)

/**
 * One returnable line item — the exact projection the web page's
 * OrderItem interface reads (quantity is the ordered quantity that caps
 * the stepper; unitPrice drives the estimated-refund line).
 */
@Immutable
@Serializable
data class ReturnOrderItemDto(
    val id: String? = null,
    val productId: String? = null,
    val quantity: Double = 0.0,
    val unitPrice: Double = 0.0,
    val totalPrice: Double = 0.0,
    val product: ReturnProductBriefDto? = null,
    val variant: ReturnVariantBriefDto? = null,
) {
    /** Stable identity for keyed collections (item id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "return-item-${hashCode()}"
}

/** Product brief the orders/[id] route `include`s for each item. */
@Immutable
@Serializable
data class ReturnProductBriefDto(
    val id: String? = null,
    val name: String? = null,
    val thumbnailUrl: String? = null,
    val unit: String? = null,
    val slug: String? = null,
)

/** Variant brief the orders/[id] route `include`s for each item. */
@Immutable
@Serializable
data class ReturnVariantBriefDto(
    val id: String? = null,
    val variantName: String? = null,
    val variantValue: String? = null,
)

/* ─── submit return (POST api/orders/{orderId}/return) ───────────────────── */

/**
 * Outgoing body — the web page's payload plus the route's shippingMethod
 * field: one entry per selected item, `comments` omitted (explicitNulls)
 * when the shared comment box is blank, quantity defaulting to 1 like the
 * web `quantities[id] || 1`. [shippingMethod] has NO Kotlin default so it
 * is always serialized — the two server-accepted values are "pickup" and
 * "dropoff" (route.ts: `shippingMethod === 'dropoff' ? 'dropoff' :
 * 'pickup'`).
 */
@Immutable
@Serializable
data class ReturnSubmitBody(
    val items: List<ReturnItemBody> = emptyList(),
    val shippingMethod: String,
)

/** One selected item of the outgoing return body. */
@Immutable
@Serializable
data class ReturnItemBody(
    val itemId: String? = null,
    val reason: String? = null,
    val quantity: Int = 1,
    val comments: String? = null,
)

/**
 * Submit response — NOT the shared [ApiEnvelope] shape: the route adds a
 * top-level `message` sibling ("Return request submitted. It is pending
 * review by the Zylod team — you will see the decision on this order.")
 * next to success/data, and failures arrive as { error }.
 */
@Immutable
@Serializable
data class ReturnSubmitEnvelope(
    val success: Boolean = false,
    val data: ReturnConfirmationDto? = null,
    val message: String? = null,
    val error: String? = null,
)

/**
 * The real created returnRequests row + its per-item rows (verbatim
 * handler projection): the RTN number, the server-computed refund
 * estimate (BDT) and the 'pending' status. Nothing here is invented —
 * the web page does not even render it (it navigates straight to the
 * return-detail view), the native flow keeps the same behavior.
 */
@Immutable
@Serializable
data class ReturnConfirmationDto(
    val id: String? = null,
    val returnNumber: String? = null,
    val orderId: String? = null,
    val orderNumber: String? = null,
    val status: String? = null,
    val shippingMethod: String? = null,
    val estimatedRefund: Double = 0.0,
    val refundCurrency: String? = null,
    val items: List<ReturnConfirmItemDto> = emptyList(),
    val createdAt: String? = null,
)

/** One persisted returnRequestItems row of the confirmation. */
@Immutable
@Serializable
data class ReturnConfirmItemDto(
    val id: String? = null,
    val orderItemId: String? = null,
    val reason: String? = null,
    val quantity: Int = 1,
    val comments: String? = null,
)
