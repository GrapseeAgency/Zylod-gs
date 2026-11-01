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
 * Reviews surfaces — the REAL endpoints behind the three native review
 * pageIds (t254: all-reviews + product-reviews-list render the shared
 * review list, rate-products renders the write-review form). All routes
 * were verified against src/app/api/reviews/route.ts:
 *
 *  - GET api/reviews?productId=<id> (PUBLIC): 400 when the query parameter
 *    is missing; 200 { success, data: [ReviewDto] } — the product's
 *    top-level reviews (replyToId: null) ordered createdAt DESC, take 100.
 *    Each row is the handler's exact camelCase projection: id, productId,
 *    rating, comment, images (the stored JSON array, parsed server-side —
 *    empty when the review has none), verifiedPurchase (computed from the
 *    buyer's REAL order history), createdAt (ISO instant) and buyerName
 *    (businessName || fullName, server fallback "Buyer").
 *
 *  - POST api/reviews (Bearer-authenticated buyer-only, rate limit 5/min
 *    → 429 { error: "Too many requests. Try again in <n>s." }): body
 *    { productId, rating 1-5 integer, title?, comment?, durability? }.
 *    The native form deliberately OMITS the `images` field — the route
 *    only accepts urls already under /uploads/review-media/ and there is
 *    no native upload client, so sending anything would be a guaranteed
 *    400 ("Review images must be uploaded through the media upload
 *    endpoint first"). REAL failures the buyer can hit: 400 "A real
 *    productId is required to review" / "Rating must be an integer
 *    between 1 and 5" / "Review text is required"; 404 "Product not
 *    found — you can only review real catalog products"; 409 "You have
 *    already reviewed this product — one review per buyer per product."
 *    (Task 74: one review per buyer per product); 401 for signed-out and
 *    non-buyer sessions ("You must be signed in as a buyer to write a
 *    review" family). Success 201 { success, data: { id,
 *    verifiedPurchase } } — the minimal created-review projection the
 *    route actually returns.
 *
 *  - Product context (product-reviews-page.tsx's header resolution, ported
 *    verbatim): `productId ? /api/products/${productId} :
 *    /api/products?limit=1` — the SAME public product routes the rest of
 *    the app already reads, declared here as duplicate-path GETs with a
 *    dedicated tolerant projection ([ReviewProductDto], the exact fields
 *    the web header card maps: name, ratingAvg, reviewCount, first image).
 *    Retrofit allows duplicate paths across interfaces; the existing
 *    product DTOs stay untouched.
 *
 * AUTH: like every other authed API in this client (AddressesApi,
 * ReturnsApi, ChatApi …) there is NO per-call @Header — the shared
 * ApiClient OkHttp client attaches the Bearer token and owns the
 * 401→refresh→retry chain; the public GET routes simply ignore the
 * header when one is present.
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every field is
 * nullable-with-default so shape drift degrades into tolerant mappers
 * instead of failing the whole screen's parse; every nested type is
 * itself @Serializable; unknown siblings are ignored by the shared Json
 * parser.
 */
interface ReviewsApi {
    /** GET api/reviews?productId= — the product's top-level reviews. */
    @GET("api/reviews")
    suspend fun list(@Query("productId") productId: String): Response<ApiEnvelope<List<ReviewDto>>>

    /** POST api/reviews — create; 201 with { id, verifiedPurchase }. */
    @POST("api/reviews")
    suspend fun create(@Body body: CreateReviewBody): Response<ApiEnvelope<CreatedReviewDto>>

    /** GET api/products/{id} — the review header's product context. */
    @GET("api/products/{id}")
    suspend fun productContext(@Path("id") id: String): Response<ApiEnvelope<ReviewProductDto>>

    /** GET api/products?limit=1 — the fallback product when no id is given. */
    @GET("api/products")
    suspend fun firstProduct(@Query("limit") limit: Int = 1): Response<ApiEnvelope<List<ReviewProductDto>>>
}

/* ─── review rows ────────────────────────────────────────────────────────── */

/**
 * One review row — the GET handler's exact projection. `comment` is the
 * single stored text field (the route folds title + durability context
 * into it on create); `images` is the parsed server-side JSON array.
 */
@Immutable
@Serializable
data class ReviewDto(
    val id: String? = null,
    val productId: String? = null,
    val rating: Int = 0,
    val comment: String? = null,
    val images: List<String> = emptyList(),
    val verifiedPurchase: Boolean = false,
    val createdAt: String? = null,
    val buyerName: String? = null,
) {
    /** Stable identity for keyed collections (review id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "review-${hashCode()}"
}

/**
 * Outgoing create body — the web write-review-page's exact payload MINUS
 * `images`: no field is declared here at all (explicitNulls would drop a
 * null, but the omission is structural — the native app has no upload
 * client and never pretends otherwise). title/comment/durability are
 * omitted from the wire (explicitNulls) when blank, mirroring the web
 * `|| undefined` fallbacks; productId/rating are always sent (the
 * ViewModel validates them before the call).
 */
@Immutable
@Serializable
data class CreateReviewBody(
    val productId: String,
    val rating: Int,
    val title: String? = null,
    val comment: String? = null,
    val durability: String? = null,
)

/** POST success payload — the route's verbatim created-review projection. */
@Immutable
@Serializable
data class CreatedReviewDto(
    val id: String? = null,
    val verifiedPurchase: Boolean = false,
)

/* ─── product context (header card) ──────────────────────────────────────── */

/**
 * The product as product-reviews-page.tsx's header card consumes it:
 * identity, the rating summary (ratingAvg/reviewCount with the web's
 * snake_case fallback chain handled in the mapper) and the first image
 * row. Every field tolerant — a drifted row degrades to an empty header.
 */
@Immutable
@Serializable
data class ReviewProductDto(
    val id: String? = null,
    val name: String? = null,
    val ratingAvg: Double = 0.0,
    val reviewCount: Int = 0,
    val images: List<ReviewProductImageDto> = emptyList(),
) {
    /** Stable identity for keyed collections (product id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "review-product-${hashCode()}"
}

/** One product-image row — the web maps `img.url ?? img.imageUrl`. */
@Immutable
@Serializable
data class ReviewProductImageDto(
    val url: String? = null,
    val imageUrl: String? = null,
)
