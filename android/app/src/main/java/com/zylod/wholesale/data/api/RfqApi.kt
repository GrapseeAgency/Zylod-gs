package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Buyer RFQ surface — the REAL endpoints behind the native RFQ list
 * (pageId "rfq-list"). Every route was verified against the src/app/api/rfq
 * handlers:
 *
 *  - GET api/rfq?role=buyer[&status][&page][&limit] — rfq/route.ts. The
 *    buyer branch scopes rows by the authenticated user's buyerId (any
 *    logged-in user may call it; role=buyer selects the buyer listing).
 *    status filters the REAL rfqs.status enum (open|quoted|awarded|closed|
 *    expired), page/limit paginate (limit clamped ≤ 50 server-side; this
 *    API asks 20). Response: { success, data: [row], pagination } with the
 *    pagination object a TOP-LEVEL sibling of data — exactly the shared
 *    [ApiEnvelope] shape (Dtos.kt), so it parses into
 *    ApiEnvelope<List<RfqRowDto>> for free.
 *  - GET api/rfq/{id} — rfq/[id]/route.ts. Detail payload, NO pagination.
 *    404 for a missing OR non-owned id (same body: "RFQ request not found").
 *  - PATCH api/rfq/{id}/quotes/{quoteId} — rfq/[id]/quotes/[quoteId]/
 *    route.ts. Buyer award action: body EXACTLY { action: "accept"|"reject"
 *    } → { success, data: { quote, rfqStatus } }. 409s: "Cannot <action>
 *    quotes on an RFQ with status \"<status>\"" and "Quote already
 *    <status>" — surfaced verbatim by the VM.
 *  - POST api/rfq/{id}/convert-order — rfq/[id]/convert-order/route.ts.
 *    Converts an awarded RFQ into a real order; body { shippingAddressId? }
 *    (strict destructuring — an empty JSON object is valid) → 201
 *    { success, data: { orderId, orderNumber, totalAmount, quantity,
 *    unitPrice } }. 409s include "Cannot convert an RFQ with status
 *    \"<status>\"", "No accepted quote on this RFQ" and "This RFQ has
 *    already been converted to order <num>".
 *
 * Every endpoint returns Response<ApiEnvelope<T>> (AdminApi convention —
 * never a bare DTO), so HTTP failures and envelope failures stay
 * distinguishable and the shared OkHttp client's Bearer header plus the
 * 401-refresh-authenticator chain apply unchanged. Auth failure = 401
 * { error: "Authentication required" } → the VM's honest needsAuth state.
 *
 * WIRE NOTES (verified against the handlers):
 *  - The LIST row embeds up to 5 RAW quotes (no supplier object) plus
 *    quoteCount — the REAL total, so the card can say "N quotes" even when
 *    the embedded array is truncated.
 *  - The DETAIL payload adds supplier briefs on every quote
 *    (supplier.displayName), the buyerName string and — once awarded —
 *    convertedOrder { id, orderNumber }.
 *  - The convertedOrderId/convertedOrderNumber pair on the row mirrors
 *    convertedOrder on the detail (both typed; both optional).
 *
 * NUMERIC TYPING (AdminApi/DealsApi convention): Prisma Float columns
 * (quantity, targetPrice, pricePerUnit, totalPrice, money in the convert
 * response) are Double so fractional JSON numbers never break parsing;
 * count aggregates and deliveryDays stay Int. Every field is
 * optional-with-default so shape drift degrades gracefully instead of
 * failing the whole screen's parse.
 */
interface RfqApi {
    @GET("api/rfq")
    suspend fun list(
        // role=buyer selects the buyer listing (handler scopes by buyerId).
        @Query("role") role: String = "buyer",
        // open|quoted|awarded|closed|expired; null omits the param (all).
        @Query("status") status: String? = null,
        @Query("page") page: Int = 1,
        // Server clamp ≤ 50; 20 matches the admin surfaces' page size.
        @Query("limit") limit: Int = 20,
    ): Response<ApiEnvelope<List<RfqRowDto>>>

    @GET("api/rfq/{id}")
    suspend fun detail(@Path("id") id: String): Response<ApiEnvelope<RfqDetailDto>>

    /**
     * Buyer award action on one supplier quote — body EXACTLY
     * { action: "accept" | "reject" } (the handler destructures only
     * `action`; anything else is ignored server-side, so the request DTO
     * carries just that field).
     */
    @PATCH("api/rfq/{id}/quotes/{quoteId}")
    suspend fun awardQuote(
        @Path("id") id: String,
        @Path("quoteId") quoteId: String,
        @Body body: RfqAwardRequest,
    ): Response<ApiEnvelope<RfqAwardDataDto>>

    /**
     * Convert an awarded RFQ into a real order. Body { shippingAddressId? }
     * — optional, strict destructuring; the native flow sends an empty
     * object (the VM posts [RfqConvertRequest] with a null address id,
     * serialized as {} by the explicitNulls=false Json).
     */
    @POST("api/rfq/{id}/convert-order")
    suspend fun convertToOrder(
        @Path("id") id: String,
        @Body body: RfqConvertRequest,
    ): Response<ApiEnvelope<RfqConvertDataDto>>
}

/* ─── GET api/rfq (buyer list row) ───────────────────────────────────────── */

/**
 * One buyer RFQ list row (the handler's map over the prisma include):
 * items + up to 5 embedded quotes + quoteCount (the REAL total), the
 * conversion pair once awarded, and the raw status enum
 * open|quoted|awarded|closed|expired.
 */
@Immutable
@Serializable
data class RfqRowDto(
    val id: String? = null,
    val buyerId: String? = null,
    val title: String? = null,
    val description: String? = null,
    val categorySlug: String? = null,
    val quantity: Double? = null,
    val unit: String? = null,
    val targetPrice: Double? = null,
    val deliveryCity: String? = null,
    val deadline: String? = null,
    val status: String? = null,
    val productId: String? = null,
    val convertedOrderId: String? = null,
    val convertedOrderNumber: String? = null,
    val items: List<RfqItemDto> = emptyList(),
    val quotes: List<RfqQuoteDto> = emptyList(),
    val quoteCount: Int = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null,
) {
    /** Stable identity for LazyColumn keys (rfq id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "rfq-${hashCode()}"
}

/** One line item embedded in an RFQ row/detail (verbatim handler map). */
@Immutable
@Serializable
data class RfqItemDto(
    val id: String? = null,
    val rfqId: String? = null,
    val productName: String? = null,
    val specifications: String? = null,
    val quantity: Double? = null,
    val unit: String? = null,
    val targetPrice: Double? = null,
)

/**
 * One RAW quote embedded in the LIST row — the ≤5-array variant WITHOUT the
 * supplier brief (only the detail endpoint enriches quotes with supplier).
 */
@Immutable
@Serializable
data class RfqQuoteDto(
    val id: String? = null,
    val rfqId: String? = null,
    val supplierId: String? = null,
    val pricePerUnit: Double? = null,
    val totalPrice: Double? = null,
    val deliveryDays: Int? = null,
    val message: String? = null,
    val status: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for LazyColumn keys inside the expanded card. */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "quote-${hashCode()}"
}

/* ─── GET api/rfq/{id} (detail) ──────────────────────────────────────────── */

/**
 * The detail payload — same shape as the list row PLUS the per-quote
 * supplier briefs ([RfqDetailQuoteDto]), buyerName and the conversion
 * object once an accepted quote became an order.
 */
@Immutable
@Serializable
data class RfqDetailDto(
    val id: String? = null,
    val buyerId: String? = null,
    val title: String? = null,
    val description: String? = null,
    val categorySlug: String? = null,
    val quantity: Double? = null,
    val unit: String? = null,
    val targetPrice: Double? = null,
    val deliveryCity: String? = null,
    val deadline: String? = null,
    val status: String? = null,
    val productId: String? = null,
    val convertedOrderId: String? = null,
    val convertedOrderNumber: String? = null,
    val buyerName: String? = null,
    val items: List<RfqItemDto> = emptyList(),
    val quotes: List<RfqDetailQuoteDto> = emptyList(),
    val quoteCount: Int = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val convertedOrder: RfqConvertedOrderDto? = null,
)

/** Detail quote — the raw fields PLUS supplier.displayName. */
@Immutable
@Serializable
data class RfqDetailQuoteDto(
    val id: String? = null,
    val rfqId: String? = null,
    val supplierId: String? = null,
    val pricePerUnit: Double? = null,
    val totalPrice: Double? = null,
    val deliveryDays: Int? = null,
    val message: String? = null,
    val status: String? = null,
    val createdAt: String? = null,
    val supplier: RfqSupplierDto? = null,
) {
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "dquote-${hashCode()}"
}

/** Supplier brief embedded in detail quotes (display name only, verbatim). */
@Immutable
@Serializable
data class RfqSupplierDto(
    val displayName: String? = null,
)

/** The conversion object on an awarded/converted detail payload. */
@Immutable
@Serializable
data class RfqConvertedOrderDto(
    val id: String? = null,
    val orderNumber: String? = null,
)

/* ─── PATCH api/rfq/{id}/quotes/{quoteId} (award) ────────────────────────── */

/** Award request — the handler destructures EXACTLY { action }. */
@Immutable
@Serializable
data class RfqAwardRequest(
    val action: String,
)

/** Award success data: the updated quote + the RFQ's new status. */
@Immutable
@Serializable
data class RfqAwardDataDto(
    val quote: RfqAwardQuoteDto? = null,
    val rfqStatus: String? = null,
)

/**
 * The quote echoed by the award PATCH — raw fields, no supplier brief (the
 * award handler re-serializes the quotes row, not the detail projection).
 */
@Immutable
@Serializable
data class RfqAwardQuoteDto(
    val id: String? = null,
    val rfqId: String? = null,
    val supplierId: String? = null,
    val pricePerUnit: Double? = null,
    val totalPrice: Double? = null,
    val deliveryDays: Int? = null,
    val message: String? = null,
    val status: String? = null,
    val createdAt: String? = null,
)

/* ─── POST api/rfq/{id}/convert-order ────────────────────────────────────── */

/** Convert request — { shippingAddressId? }; null serializes as {} (strict). */
@Immutable
@Serializable
data class RfqConvertRequest(
    val shippingAddressId: String? = null,
)

/**
 * Convert success data (HTTP 201): the created order's identity plus the
 * accepted-quote economics the handler echoes back.
 */
@Immutable
@Serializable
data class RfqConvertDataDto(
    val orderId: String? = null,
    val orderNumber: String? = null,
    val totalAmount: Double? = null,
    val quantity: Double? = null,
    val unitPrice: Double? = null,
)
