package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * t282 — the RECENTLY-VIEWED circuit (SPA pageIds "recently-viewed" and
 * "recently-viewed-products"), the last major buyer surface the native app
 * rendered as curated bullets while the web shipped the real thing.
 *
 * Every route below was verified against src/app/api/products/recently-viewed/
 * route.ts (Task 104's browsingHistory rail — the file's own header doc is the
 * contract):
 *
 *  - GET api/products/recently-viewed?limit=&cursor= — AUTHENTICATED (guests
 *    are 401 BY DESIGN: "a client-side only history would be a second source
 *    of truth"). Rows are the caller's browsingHistory entries newest-first,
 *    cursor-paginated (take limit+1, pop, meta.nextCursor = last id when
 *    hasMore). limit is clamped server-side to 50. Each row carries the
 *    product select: id/name/slug/basePrice/currency/unit/moq/stockQuantity/
 *    ratingAvg/reviewCount/thumbnailUrl/isActive/maxOrderQty/bundleSize/
 *    weightKg + supplier {id, companyName, isVerified} (the route ALREADY
 *    computes isVerified = verificationStatus === 'approved') + priceTiers
 *    take 3 (minQty asc). Envelope { success, data, meta: {count, hasMore,
 *    nextCursor} }.
 *  - POST api/products/recently-viewed  body { productId } — record a view.
 *    201 { success, data: { productId, viewedAt }, message: 'View recorded' }.
 *    The server upserts on buyerId+productId (a re-visit bumps viewedAt),
 *    refuses hidden/pending products with the SAME 404 as phantoms, and
 *    prunes history beyond the 100-row cap. The web PDP fires this
 *    fire-and-forget; the native PDP does exactly the same (a failure must
 *    never disturb the product screen).
 *  - DELETE api/products/recently-viewed?productId= — remove ONE history row
 *    (owner-scoped deleteMany; a foreign productId is an honest 0-row no-op
 *    with the deletedCount in the body). NO productId param clears ALL of the
 *    caller's rows (message 'History cleared' vs 'Removed from history').
 *
 * DELIBERATE NON-DECLARATIONS (the t259 doctrine): the recently-searched /
 * browsing-history pageIds stay on their existing registry rows — no native
 * surface in this batch calls them.
 *
 * WIRE NOTES (dc74841 lesson): every response field is nullable-with-default
 * so shape drift degrades into the screen mappers; the outgoing POST body
 * gives its server-required field NO Kotlin default (always serialized).
 * Timestamps are ISO strings verbatim; money is the raw Double the route
 * emits. MOQ/stock ride as Double like every other catalog route (apiQty
 * renders them).
 */
interface RecentlyViewedApi {

    /**
     * GET api/products/recently-viewed — the signed-in buyer's history,
     * newest-first. [limit] caps the page (server clamps to 50); [cursor]
     * continues a previous page (meta.nextCursor), null = first page.
     */
    @GET("api/products/recently-viewed")
    suspend fun list(
        @Query("limit") limit: Int = 20,
        @Query("cursor") cursor: String? = null,
    ): Response<RecentlyViewedEnvelope>

    /** POST api/products/recently-viewed — record a view (fire-and-forget). */
    @POST("api/products/recently-viewed")
    suspend fun record(@Body body: RecentlyViewedRecordBody): Response<RecentlyViewedRecordEnvelope>

    /**
     * DELETE api/products/recently-viewed — [productId] non-null removes that
     * one row; null clears the caller's ENTIRE history (both owner-scoped).
     */
    @DELETE("api/products/recently-viewed")
    suspend fun remove(@Query("productId") productId: String? = null): Response<RecentlyViewedMessageEnvelope>
}

/* ─── GET api/products/recently-viewed ───────────────────────────────────── */

/** Envelope of GET api/products/recently-viewed — cursor pagination in meta. */
@Immutable
@Serializable
data class RecentlyViewedEnvelope(
    val success: Boolean = false,
    val data: List<RecentlyViewedRowDto> = emptyList(),
    val meta: RecentlyViewedPageMetaDto? = null,
    val error: String? = null,
)

/** { count, hasMore, nextCursor } — nextCursor is null on the last page. */
@Immutable
@Serializable
data class RecentlyViewedPageMetaDto(
    val count: Int = 0,
    val hasMore: Boolean = false,
    val nextCursor: String? = null,
)

/**
 * One browsingHistory row as the GET answers it — viewedAt + the product
 * projection (the route's exact shapeRow, field for field).
 */
@Immutable
@Serializable
data class RecentlyViewedRowDto(
    val id: String? = null,
    val viewedAt: String? = null,
    val product: RecentlyViewedProductDto? = null,
) {
    /** Stable identity for keyed collections (row id, product id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: product?.id?.takeIf(String::isNotBlank)
            ?: "recently-viewed-${hashCode()}"

    /** The productId a row tap routes to (product id — the row IS the view). */
    val effectiveProductId: String?
        get() = product?.id?.takeIf(String::isNotBlank)
}

/** The product select the recently-viewed route nests on every row. */
@Immutable
@Serializable
data class RecentlyViewedProductDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val basePrice: Double = 0.0,
    val currency: String? = null,
    val unit: String? = null,
    val moq: Double = 1.0,
    val stockQuantity: Double = 0.0,
    val ratingAvg: Double = 0.0,
    val reviewCount: Int = 0,
    val thumbnailUrl: String? = null,
    val isActive: Boolean? = null,
    val maxOrderQty: Double? = null,
    val bundleSize: Double? = null,
    val weightKg: Double? = null,
    val supplier: RecentlyViewedSupplierDto? = null,
    val priceTiers: List<PriceTierDto> = emptyList(),
) {
    /** The web's hasBulkPricing — any tier row present (take 3 on this route). */
    val hasBulkPricing: Boolean get() = priceTiers.isNotEmpty()
}

/**
 * The supplier projection inside the recently-viewed product select — the
 * route pre-computes [isVerified] (verificationStatus === 'approved'), the
 * same vocabulary the PDP + storefront render.
 */
@Immutable
@Serializable
data class RecentlyViewedSupplierDto(
    val id: String? = null,
    val companyName: String? = null,
    val isVerified: Boolean = false,
)

/* ─── POST api/products/recently-viewed ──────────────────────────────────── */

/** Outgoing POST body — { productId } (server-required, always serialized). */
@Immutable
@Serializable
data class RecentlyViewedRecordBody(val productId: String)

/** 201 envelope — data echoes { productId, viewedAt } (the PDP ignores it). */
@Immutable
@Serializable
data class RecentlyViewedRecordEnvelope(
    val success: Boolean = false,
    val data: RecentlyViewedRecordedDto? = null,
    val message: String? = null,
    val error: String? = null,
)

/** { productId, viewedAt } of the 201 — declared for wire fidelity. */
@Immutable
@Serializable
data class RecentlyViewedRecordedDto(
    val productId: String? = null,
    val viewedAt: String? = null,
)

/* ─── DELETE api/products/recently-viewed ────────────────────────────────── */

/**
 * Envelope of the DELETE answers — { success, deletedCount, message } with
 * the route's verbatim texts ('Removed from history' / 'History cleared').
 */
@Immutable
@Serializable
data class RecentlyViewedMessageEnvelope(
    val success: Boolean = false,
    val deletedCount: Int = 0,
    val message: String? = null,
    val error: String? = null,
)
