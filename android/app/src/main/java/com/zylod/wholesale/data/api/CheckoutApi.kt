package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * t273 — the CHECKOUT money-path surfaces behind ui/checkout/ (the typed
 * ports of checkout-page.tsx + order-confirmation-page.tsx). Routes verified
 * against the server contracts the batch was briefed with:
 *
 *  - POST api/orders — creates the order from the buyer's cart. The client
 *    NEVER sends prices: the body carries only shippingAddressId,
 *    paymentMethod, the optional couponCode, the optional per-supplier
 *    shippingChoices (omitted entirely when empty — explicitNulls=false on
 *    the shared Json instance drops the null key, matching the web
 *    spread-omits) and the item list of EXACTLY productId/variantId/quantity
 *    (the web Zod schema ignores anything else — the web client sends a
 *    supplierId that never reaches the server, so native does not send it).
 *    Success is 201 { success, data: { orderId, orderNumber, totalAmount,
 *    shippingFee, paymentStatus, paymentMethod, couponApplied,
 *    promotionApplied } }; every failure ladder branch (401/402/409/400/403)
 *    is mirrored verbatim in CheckoutViewModel.placeOrder.
 *  - GET api/shipping/quote — per-supplier courier options for the selected
 *    address district + shipment weight + goods subtotal. Answers
 *    { success, data: [ { methodId, methodName, estimatedDays, basePrice,
 *    price, freeShipping, freeAbove } ] }.
 *  - POST api/coupons/validate — { code, orderAmount } in; answers
 *    { success, valid, data: { code, discountType, discountAmount } }.
 *  - GET api/orders/{orderId} — the SAME route OrdersApi.order already
 *    serves for tracking, redeclared here ONLY so the confirmation surface
 *    parses its own typed projection (CheckoutSuccessOrder: sub-orders with
 *    supplier briefs + line items + product briefs). Never redeclared
 *    anywhere else.
 *
 * Every route rides the shared OkHttp client (Bearer header attached
 * dynamically + the 401-refresh chain) — never attach Authorization here.
 * All money fields are Prisma Doubles (JSON numbers) with Double?/defaults
 * so a fractional amount or an absent column never breaks a parse.
 */
interface CheckoutApi {

    @POST("api/orders")
    suspend fun createOrder(@Body payload: CheckoutCreatePayload): Response<CheckoutCreateEnvelope>

    @GET("api/shipping/quote")
    suspend fun quote(
        @Query("district") district: String,
        @Query("weightKg") weightKg: String,
        @Query("subtotal") subtotal: String,
    ): Response<CheckoutQuoteEnvelope>

    @POST("api/coupons/validate")
    suspend fun validateCoupon(@Body payload: CheckoutCouponValidatePayload): Response<CheckoutCouponValidateEnvelope>

    @GET("api/orders/{orderId}")
    suspend fun orderForConfirmation(@Path("orderId") orderId: String): Response<CheckoutSuccessEnvelope>
}

/* ─── t273 DTOs — Checkout-prefixed, unique across the codebase ──────────── */

/** One POST api/orders items[] row — the web Zod schema's exact three fields. */
@Serializable
data class CheckoutCreateItem(
    val productId: String,
    val variantId: String? = null,
    val quantity: Double,
)

/** One POST api/orders shippingChoices[] row (supplierId → chosen methodId). */
@Serializable
data class CheckoutShippingChoice(
    val supplierId: String,
    val methodId: String,
)

/**
 * POST api/orders body. `shippingChoices` stays null (and is OMITTED from
 * the wire by explicitNulls=false) whenever no method was picked — the key
 * never serializes as an empty list. Same omit-when-absent semantics for
 * couponCode. No price fields exist here by contract.
 */
@Serializable
data class CheckoutCreatePayload(
    val shippingAddressId: String,
    val paymentMethod: String,
    val couponCode: String? = null,
    val shippingChoices: List<CheckoutShippingChoice>? = null,
    val items: List<CheckoutCreateItem>,
)

/** couponApplied of the 201 body — the code the order actually kept. */
@Immutable
@Serializable
data class CheckoutCouponApplied(
    val code: String,
    val discount: Double,
)

/** promotionApplied of the 201 body — the auto-applied platform promotion. */
@Immutable
@Serializable
data class CheckoutPromotionApplied(
    val name: String,
    val discount: Double,
)

/** data of the 201 POST api/orders body — the receipt the success panel renders. */
@Immutable
@Serializable
data class CheckoutCreatedOrder(
    val orderId: String? = null,
    val orderNumber: String? = null,
    val totalAmount: Double? = null,
    val shippingFee: Double? = null,
    val paymentStatus: String? = null,
    val paymentMethod: String? = null,
    val couponApplied: CheckoutCouponApplied? = null,
    val promotionApplied: CheckoutPromotionApplied? = null,
)

/** POST api/orders envelope — success+data on 201, error text on failures. */
@Serializable
data class CheckoutCreateEnvelope(
    val success: Boolean = false,
    val data: CheckoutCreatedOrder? = null,
)

/** One GET api/shipping/quote data row — a courier option for one supplier. */
@Immutable
@Serializable
data class CheckoutQuoteOption(
    val methodId: String,
    val methodName: String,
    val estimatedDays: String? = null,
    /** The rate-book price before any free-shipping rule (strikethrough when free). */
    val basePrice: Double = 0.0,
    /** What the buyer is actually charged today. */
    val price: Double = 0.0,
    val freeShipping: Boolean = false,
    val freeAbove: Double? = null,
)

/** GET api/shipping/quote envelope — data is the courier-option list. */
@Serializable
data class CheckoutQuoteEnvelope(
    val success: Boolean = false,
    val data: List<CheckoutQuoteOption>? = null,
)

/** POST api/coupons/validate body — orderAmount is the CURRENT cart subtotal. */
@Serializable
data class CheckoutCouponValidatePayload(
    val code: String,
    val orderAmount: Double,
)

/** data of a VALID coupon response — discountAmount is off this cart. */
@Immutable
@Serializable
data class CheckoutCouponValidated(
    val code: String,
    val discountType: String? = null,
    val discountAmount: Double? = null,
)

/** POST api/coupons/validate envelope — valid=false mirrors the web's rejection. */
@Serializable
data class CheckoutCouponValidateEnvelope(
    val success: Boolean = false,
    val valid: Boolean = false,
    val data: CheckoutCouponValidated? = null,
)

/** GET api/orders/{orderId} product brief inside items[] — display fields only. */
@Immutable
@Serializable
data class CheckoutSuccessProductBrief(
    val name: String? = null,
    val thumbnailUrl: String? = null,
    val unit: String? = null,
)

/** One line item of a sub-order on the confirmation wire. */
@Immutable
@Serializable
data class CheckoutSuccessItem(
    val id: String,
    val quantity: Double = 0.0,
    val unitPrice: Double? = null,
    val totalPrice: Double? = null,
    val product: CheckoutSuccessProductBrief? = null,
)

/** GET api/orders/{orderId} supplier brief inside subOrders[]. */
@Immutable
@Serializable
data class CheckoutSuccessSupplierBrief(
    val companyName: String? = null,
)

/** One per-supplier sub-order of the confirmation wire. */
@Immutable
@Serializable
data class CheckoutSuccessSubOrder(
    val id: String,
    val subtotal: Double = 0.0,
    val shippingCost: Double = 0.0,
    val status: String? = null,
    val estimatedDelivery: String? = null,
    val supplier: CheckoutSuccessSupplierBrief? = null,
    val items: List<CheckoutSuccessItem> = emptyList(),
)

/**
 * data of GET api/orders/{orderId} for the confirmation screen — the typed
 * projection of the SAME route OrdersApi.order serves (the shared Json
 * parser ignores the extra tracking/timeline fields that route includes).
 */
@Immutable
@Serializable
data class CheckoutSuccessOrder(
    val id: String,
    val orderNumber: String,
    val totalAmount: Double = 0.0,
    val paymentStatus: String? = null,
    val placedAt: String? = null,
    val subOrders: List<CheckoutSuccessSubOrder> = emptyList(),
)

/** GET api/orders/{orderId} envelope. */
@Serializable
data class CheckoutSuccessEnvelope(
    val success: Boolean = false,
    val data: CheckoutSuccessOrder? = null,
)

/**
 * Minimal session-user projection parsed from SessionManager.userJson() —
 * the COD verification gate (a buyer with NEITHER a verified email NOR a
 * verified phone is locked out of Cash on Delivery). Mirrors the private
 * SupplierFormsSessionUser usage; every field defaults so shape drift
 * degrades instead of failing the parse.
 */
@Serializable
data class CheckoutSessionUser(
    val userType: String? = null,
    val isEmailVerified: Boolean = false,
    val isPhoneVerified: Boolean = false,
)

/** Every t273 error body: the flat error line (flat `error` key). */
@Serializable
data class CheckoutErrorDto(val error: String? = null)

/**
 * Parses a t273 error body with the shared lenient Json instance and returns
 * the server's own message (parseSupplierFormsError mirror, unwrapped to the
 * String? the checkout ladder needs). Null on absent/unparsable input — the
 * caller substitutes its verbatim HTTP fallback.
 */
fun parseCheckoutError(raw: String?): String? {
    if (raw.isNullOrBlank()) return null
    return runCatching { ApiClient.json.decodeFromString(CheckoutErrorDto.serializer(), raw) }
        .getOrNull()
        ?.error
        ?.takeIf(String::isNotBlank)
}
