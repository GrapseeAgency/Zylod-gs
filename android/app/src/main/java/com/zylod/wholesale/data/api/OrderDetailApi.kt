package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * t274 — the typed BUYER ORDER-DETAIL surfaces behind ui/orderdetail/ (the
 * Kotlin port of order-detail-page.tsx). Routes verified against the server
 * contracts under src/app/api/orders/[id] (route.ts plus the cancel,
 * payment-submit, payments/initiate and receipt sub-routes):
 *
 *  - GET api/orders/{orderId} — the full detail projection: payments[] (newest
 *    first), per-supplier subOrders[] each with items[] (product + variant
 *    briefs) and tracking[] (trackingHistory minus gps_ping, newest first),
 *    the shippingAddress (live row OR the order-time snapshot — Task 87) and
 *    the promotion stamp (Task 100). 401 = not signed in, 404 = not visible,
 *    403 = foreign order.
 *  - POST api/orders/{orderId}/cancel — buyer self-service cancellation
 *    (whole order when the body is omitted, one shipment when subOrderIds is
 *    sent). Guards mirrored verbatim: 409 already-cancelled / packed-shipped,
 *    400 foreign shipment ids. Success answers the honest counts the web
 *    toast renders: subOrdersCancelled, remainingActive, paymentsVoided and
 *    the adjusted totalAmount/totalBefore pair.
 *  - POST api/orders/{orderId}/payment-submit — the manual payment leg
 *    (Task 56-b): { method, transactionId, brand?, senderNumber?, note?,
 *    amount? }. Server guards: 409 order already paid/partial-closed, 409
 *    transaction-id reuse (global), 400 amount > total, 400 Zod pattern
 *    failures — the client mirrors the web's own regexes BEFORE calling.
 *  - POST api/orders/{orderId}/payments/initiate — the receiving-account
 *    instructions for the two transfer methods (bank_transfer /
 *    mobile_banking). Reuses an existing pending payment for the method, so
 *    repeated opens never stack rows; 503 = unset env accounts, shown
 *    verbatim.
 *  - GET api/orders/{orderId}/receipt — the money-moved receipt (Task 128-c),
 *    gated behind paymentStatus paid|partial.
 *
 * Every route rides the shared OkHttp client (Bearer header attached
 * dynamically + the 401-refresh chain) — never attach Authorization here.
 * All money fields are Prisma Doubles (JSON numbers) with Double?/defaults
 * so a fractional amount or an absent column never breaks a parse.
 */
interface OrderDetailApi {

    @GET("api/orders/{orderId}")
    suspend fun order(@Path("orderId") orderId: String): Response<OrderDetailEnvelope>

    @POST("api/orders/{orderId}/cancel")
    suspend fun cancel(
        @Path("orderId") orderId: String,
        @Body payload: OrderDetailCancelPayload?,
    ): Response<OrderDetailCancelEnvelope>

    @POST("api/orders/{orderId}/payment-submit")
    suspend fun submitPayment(
        @Path("orderId") orderId: String,
        @Body payload: OrderDetailPaymentSubmitPayload,
    ): Response<OrderDetailPaymentSubmitEnvelope>

    @POST("api/orders/{orderId}/payments/initiate")
    suspend fun initiate(
        @Path("orderId") orderId: String,
        @Body payload: OrderDetailInitiatePayload,
    ): Response<OrderDetailInitiateEnvelope>

    @GET("api/orders/{orderId}/receipt")
    suspend fun receipt(@Path("orderId") orderId: String): Response<OrderDetailReceiptEnvelope>
}

/* ─── t274 DTOs — OrderDetail-prefixed, unique across the codebase ───────── */

/** data of GET api/orders/{orderId} — the full buyer-facing projection. */
@Immutable
@Serializable
data class OrderDetailOrder(
    val id: String,
    val orderNumber: String? = null,
    val buyerId: String? = null,
    val totalAmount: Double = 0.0,
    /** Task 100: the platform campaign stamp (snapshot survives deletion). */
    val promotionName: String? = null,
    val promotionDiscount: Double? = null,
    val paymentStatus: String? = null,
    val placedAt: String? = null,
    val updatedAt: String? = null,
    val shippingAddress: OrderDetailAddress? = null,
    val payments: List<OrderDetailPayment> = emptyList(),
    val subOrders: List<OrderDetailSubOrder> = emptyList(),
)

/**
 * Task 87 — one address shape from two sources: the live address-book row
 * while it exists, else the immutable order-time snapshot (fromSnapshot
 * rides only on the snapshot branch).
 */
@Immutable
@Serializable
data class OrderDetailAddress(
    val id: String? = null,
    val label: String? = null,
    val addressLine1: String? = null,
    val addressLine2: String? = null,
    val city: String? = null,
    val district: String? = null,
    val postalCode: String? = null,
    val fromSnapshot: Boolean = false,
)

/** One payments row (newest first). status: pending|success|failed. */
@Immutable
@Serializable
data class OrderDetailPayment(
    val id: String,
    val method: String? = null,
    val amount: Double = 0.0,
    val status: String? = null,
    val transactionId: String? = null,
    val paidAt: String? = null,
)

/** Supplier brief inside subOrders[]. */
@Immutable
@Serializable
data class OrderDetailSupplierBrief(
    val companyName: String? = null,
    val ratingAvg: Double? = null,
    val ratingCount: Int? = null,
)

/** Product brief inside items[] — display fields only. */
@Immutable
@Serializable
data class OrderDetailProductBrief(
    val id: String? = null,
    val name: String? = null,
    val thumbnailUrl: String? = null,
    val unit: String? = null,
    val slug: String? = null,
)

/** Variant brief inside items[] — the chosen option pair. */
@Immutable
@Serializable
data class OrderDetailVariantBrief(
    val id: String? = null,
    val variantName: String? = null,
    val variantValue: String? = null,
)

/** One line item of a sub-order. */
@Immutable
@Serializable
data class OrderDetailItem(
    val id: String,
    val productId: String? = null,
    val quantity: Int = 0,
    val unitPrice: Double? = null,
    val totalPrice: Double? = null,
    val product: OrderDetailProductBrief? = null,
    val variant: OrderDetailVariantBrief? = null,
)

/**
 * One orderTracking row (Task 80): seller transitions
 * (pending→confirmed→packed→shipped→delivered/cancelled/returned) and
 * driver-GPS milestones (picked_up/in_transit/out_for_delivery) share the
 * table; gps_ping rows are filtered server-side.
 */
@Immutable
@Serializable
data class OrderDetailTracking(
    val id: String,
    val status: String? = null,
    val location: String? = null,
    val note: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val trackedAt: String? = null,
)

/** One per-supplier shipment of the order. */
@Immutable
@Serializable
data class OrderDetailSubOrder(
    val id: String,
    val supplierId: String? = null,
    val supplier: OrderDetailSupplierBrief? = null,
    val subtotal: Double = 0.0,
    val shippingCost: Double = 0.0,
    /** The courier the buyer picked (null when none — the field rides on newer wires only). */
    val shippingMethodName: String? = null,
    val status: String? = null,
    val trackingNumber: String? = null,
    val estimatedDelivery: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val items: List<OrderDetailItem> = emptyList(),
    val tracking: List<OrderDetailTracking> = emptyList(),
)

/** GET api/orders/{orderId} envelope. */
@Serializable
data class OrderDetailEnvelope(
    val success: Boolean = false,
    val data: OrderDetailOrder? = null,
)

/* ─── Cancel (Task 57-a / 58) ────────────────────────────────────────────── */

/**
 * POST cancel body. Null (omitted by explicitNulls=false) cancels every
 * shipment still pending|confirmed; a list scopes the cancel to those ids.
 */
@Serializable
data class OrderDetailCancelPayload(
    val subOrderIds: List<String>? = null,
)

/** data of a 200 cancel — the honest counts the web toast renders. */
@Immutable
@Serializable
data class OrderDetailCancelled(
    val subOrdersCancelled: Int = 0,
    val remainingActive: Int = 0,
    val paymentsVoided: Int = 0,
    val totalAmount: Double? = null,
    val totalBefore: Double? = null,
)

/** POST cancel envelope — error text carries the verbatim 409 guard lines. */
@Serializable
data class OrderDetailCancelEnvelope(
    val success: Boolean = false,
    val data: OrderDetailCancelled? = null,
)

/* ─── Manual payment submission (Task 56-b) ─────────────────────────────── */

/**
 * POST payment-submit body. method maps to the REAL payments.method enum
 * (cod|bank_transfer|card|mobile_banking|wallet); bKash/Nagad/Rocket are
 * mobile_banking + a brand, exactly as the web sends. amount stays null
 * (server truth = full total) except on a PARTIAL order, where the buyer
 * pays the remaining due.
 */
@Serializable
data class OrderDetailPaymentSubmitPayload(
    val method: String,
    val transactionId: String,
    val brand: String? = null,
    val senderNumber: String? = null,
    val note: String? = null,
    val amount: Double? = null,
)

/** data of a 201 payment-submit — the created pending verification. */
@Immutable
@Serializable
data class OrderDetailPaymentSubmitted(
    val paymentId: String? = null,
    val status: String? = null,
    val orderNumber: String? = null,
)

/** POST payment-submit envelope. */
@Serializable
data class OrderDetailPaymentSubmitEnvelope(
    val success: Boolean = false,
    val data: OrderDetailPaymentSubmitted? = null,
)

/* ─── Receiving-account instructions (Task 128-a) ────────────────────────── */

/** POST payments/initiate body — only the two transfer methods are covered. */
@Serializable
data class OrderDetailInitiatePayload(
    val method: String,
)

/**
 * data of a 200 initiate — instructions is the env-built receiving-account
 * map (bank name, account number, …); keys vary by deployment, so the rail
 * renders the entries it gets and never invents rows.
 */
@Immutable
@Serializable
data class OrderDetailInitiated(
    val paymentId: String? = null,
    val orderNumber: String? = null,
    val amount: Double? = null,
    val method: String? = null,
    val instructions: Map<String, String>? = null,
    val note: String? = null,
)

/** POST payments/initiate envelope — 503 answers carry the verbatim error. */
@Serializable
data class OrderDetailInitiateEnvelope(
    val success: Boolean = false,
    val data: OrderDetailInitiated? = null,
)

/* ─── Receipt (Task 128-c) ───────────────────────────────────────────────── */

/** data of GET api/orders/{orderId}/receipt — the money-moved snapshot. */
@Immutable
@Serializable
data class OrderDetailReceipt(
    val orderNumber: String? = null,
    val orderDate: String? = null,
    val paymentMethod: String? = null,
    val paymentStatus: String? = null,
    val items: List<OrderDetailReceiptItem> = emptyList(),
    val subtotal: Double = 0.0,
    val shipping: Double = 0.0,
    val tax: Double = 0.0,
    val total: Double = 0.0,
    val currency: String? = null,
    val buyer: OrderDetailReceiptBuyer? = null,
    val shippingAddress: OrderDetailReceiptAddress? = null,
)

@Immutable
@Serializable
data class OrderDetailReceiptItem(
    val productName: String? = null,
    val sku: String? = null,
    val quantity: Int = 0,
    val unitPrice: Double = 0.0,
    val total: Double = 0.0,
)

@Immutable
@Serializable
data class OrderDetailReceiptBuyer(
    val name: String? = null,
    val businessName: String? = null,
)

@Immutable
@Serializable
data class OrderDetailReceiptAddress(
    val address: String? = null,
    val city: String? = null,
    val district: String? = null,
    val country: String? = null,
)

/** GET receipt envelope. */
@Serializable
data class OrderDetailReceiptEnvelope(
    val success: Boolean = false,
    val data: OrderDetailReceipt? = null,
)

/** Every t274 error body: the flat error line (flat `error` key). */
@Serializable
data class OrderDetailErrorDto(val error: String? = null)

/**
 * Parses a t274 error body with the shared lenient Json instance and returns
 * the server's own message (parseCheckoutError mirror). Null on
 * absent/unparsable input — the caller substitutes its verbatim HTTP
 * fallback.
 */
fun parseOrderDetailError(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    return runCatching { ApiClient.json.decodeFromString(OrderDetailErrorDto.serializer(), raw) }
        .getOrNull()
        ?.error
        ?.takeIf(String::isNotBlank)
}
