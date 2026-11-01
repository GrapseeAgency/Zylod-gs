package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Wishlist / favorites / sharing surfaces (t262) — the REAL routes behind the
 * twelve native wishlist pageIds (buyer-favorites, favorite-products,
 * favorite-categories, favorite-suppliers, saved-searches, wishlist-detail,
 * wishlist-share, wishlist-share-page, wishlist-shared, shared-wishlist,
 * shared-wishlist-detail, wishlist-analytics). Every route below was verified
 * against its src/app/api handler AND the SPA component each pageId actually
 * loads (src/lib/page-chunks/chunk-wishlist.ts, chunk-misc.ts, chunk-search.ts):
 *
 *  - GET api/wishlist (t233's [WishlistApi] in CommerceApis.kt, NOT redeclared)
 *    — authenticated, cursor envelope, rows = wishlists + product (supplier
 *    companyName/verificationStatus, priceTiers take 3). The web
 *    wishlist-page.tsx (which the "wishlist-analytics" pageId loads via
 *    chunk-misc.ts:184) consumes exactly this.
 *  - GET api/wishlist/[itemId] (wishlist/[itemId]/route.ts GET) — the
 *    authenticated single row behind the "wishlist-detail" pageId
 *    (wishlist-detail-page.tsx's only fetch). Owner-scoped
 *    (`where: { id, buyerId }`) → 404 'Wishlist item not found' for a
 *    foreign/unknown id (no existence leak). data = the raw row + the FULL
 *    product include (supplier id/companyName/verificationStatus/ratingAvg,
 *    priceTiers, images take 5) + the buyer's personal `note`.
 *  - PATCH api/wishlist/[itemId] — the note save ({ note } body →
 *    updateMany; the 200 data is the updateMany COUNT, not the row).
 *  - DELETE api/wishlist/[itemId] — remove by ROW id (the wishlist-page.tsx
 *    trash button and wishlist-detail-page.tsx Remove action), 200
 *    { success, message: 'Removed from wishlist' }.
 *  - GET api/wishlist/share (wishlist/share/route.ts GET) — the signed-in
 *    buyer's LATEST wishlistShares row (data is null when never shared —
 *    the web's "You haven't shared your wishlist yet." state).
 *  - POST api/wishlist/share — create/rotate the share link. Body
 *    { expiresIn?, allowAddToCart, showPrices } (the web component sends
 *    only the two booleans); the server upserts one share per buyer,
 *    mints a 32-hex crypto token and answers 200
 *    { success, data: share, message: 'Share link created' }. Rate limit
 *    10/60s.
 *  - DELETE api/wishlist/share — revoke (deleteMany by buyer), 200
 *    { success, message: 'Share link revoked' }.
 *  - GET api/wishlist/shared?token= (wishlist/shared/route.ts) — PUBLIC:
 *    NO authenticateRequest call at all (a shared link must work
 *    signed-out; the native shared viewer never gates on the session —
 *    the shared OkHttp client may attach a Bearer header and the route
 *    simply ignores it, the same wire result as the web's header-less
 *    fetch). 400 'Token required'; 404 'Share link not found or expired'
 *    (unknown token OR expiresAt in the past). Each successful view
 *    increments viewCount server-side. data = { owner: { name, avatarUrl,
 *    companyName }, items: [row + product select (basePrice/currency
 *    ONLY when showPrices)], settings: { allowAddToCart, showPrices } }.
 *  - GET api/favorites (favorites/route.ts — GET ONLY) — the signed-in
 *    buyer's wishlist rows re-ranked by product ratingAvg desc then
 *    createdAt desc, take 50, product select + priceTiers take 1. This is
 *    the REAL feed of the "favorite-products" pageId
 *    (favorite-products-page.tsx's only fetch). 401 'Authentication
 *    required' otherwise.
 *  - GET api/buyer/followed-categories (buyer/followed-categories/route.ts)
 *    — the followed-categories rows of THIS buyer + category
 *    { id, name, slug, iconUrl, isActive }, newest-first. The REAL feed of
 *    the "favorite-categories" pageId (favorite-categories-page.tsx). 401
 *    otherwise.
 *  - POST api/categories/[id]/favorite body { notifyOnNew } — follow /
 *    update the bell toggle (upsert; 404 'Category not found', 200
 *    { success, data, message: 'Following category' }).
 *  - DELETE api/categories/[id]/favorite — unfollow (200
 *    { success, message: 'Unfollowed category' }).
 *  - GET api/buyer/favorite-suppliers (buyer/favorite-suppliers/route.ts) —
 *    the favoriteSuppliers rows of THIS buyer + supplier
 *    { id, companyName, verificationStatus, ratingAvg, ratingCount,
 *    createdAt }, newest-first. The REAL feed of BOTH "favorite-suppliers"
 *    AND "buyer-favorites" (chunk-misc.ts:121 maps buyer-favorites onto the
 *    SAME favorite-suppliers-page component). 401 otherwise.
 *  - DELETE api/suppliers/[id]/favorite — unfollow a supplier (200
 *    { success, message }). The GET half of this route (is-following
 *    probe) is deliberately NOT declared: no t262 surface polls a single
 *    supplier's follow state.
 *  - GET api/search/saved (search/saved/route.ts GET) — saved
 *    searchFilters: the user's OWN rows + the public isDefault ones when
 *    signed in, ONLY the public defaults when signed out (auth is
 *    OPTIONAL — the "saved-searches" page renders signed-out, mirroring
 *    the web). 500 'Failed to fetch saved searches' on server error.
 *  - DELETE api/search/saved/[id] — owner-scoped deleteMany (401
 *    'Authentication required'; 200 { success, message: 'Saved search
 *    deleted' }).
 *
 * DELIBERATE NON-DECLARATIONS (t259 doctrine — nothing is declared that no
 * t262 screen calls, and nothing is invented where the web has no route):
 *
 *  - api/save-for-later + api/save-for-later/[itemId] (GET/POST/DELETE)
 *    are REAL routes on the web — but NO t262 pageId hosts them: the
 *    twelve seed-only screens map to wishlist/favorites/share/shared/saved-search
 *    components only ("save-for-later" / "save-for-later-detail" are
 *    separate pageIds outside this batch). Per the t259 skip-doctrine the
 *    routes stay undeclared until a native pageId actually renders them —
 *    declaring them now would be dead surface area. (The t233 wishlist
 *    meta's "Save for Later" RELATED LINK routes to the save-for-later
 *    pageId, which still renders its curated content — unchanged.)
 *  - POST api/search/saved (create a saved search) is real but the web's
 *    saved-searches-page never calls it (creation lives on the search
 *    page, not in this batch's twelve ids) — GET/DELETE only here.
 *  - POST api/wishlist (the wishlist ADD — t233's WishlistApi.add) and
 *    DELETE api/wishlist?productId= (t233's WishlistApi.remove) stay on
 *    the EXISTING CommerceApis.kt interface — one wishlist write surface,
 *    never redeclared (the favorites screen's remove sends the SAME
 *    ?productId= call through that accessor).
 *  - api/wishlist/[itemId] GET/PATCH/DELETE ARE new here (a new
 *    WishlistItemApi interface — the t233 interface's row-id-less contract
 *    cannot host them without changing its shipped shape).
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every response field is
 * nullable-with-default so shape drift degrades into the screen mappers;
 * bodies give their server-required fields NO Kotlin default (the
 * ReturnSubmitBody convention — always serialized). Timestamps are ISO
 * strings verbatim; money is the raw Double the routes emit.
 */
interface WishlistItemApi {

    /**
     * GET api/wishlist/{itemId} — one owned wishlist row + the full product
     * include (images, priceTiers, supplier with verificationStatus) + the
     * personal note. 404 'Wishlist item not found' for foreign/unknown ids.
     */
    @GET("api/wishlist/{itemId}")
    suspend fun item(@Path("itemId") itemId: String): Response<ApiEnvelope<WishlistItemDetailDto>>

    /** PATCH api/wishlist/{itemId} — save the buyer's personal note. */
    @PATCH("api/wishlist/{itemId}")
    suspend fun updateNote(
        @Path("itemId") itemId: String,
        @Body body: WishlistNotePatchBody,
    ): Response<WishlistNotePatchEnvelope>

    /** DELETE api/wishlist/{itemId} — remove by row id (wishlist-page trash). */
    @DELETE("api/wishlist/{itemId}")
    suspend fun removeItem(@Path("itemId") itemId: String): Response<WishlistMessageEnvelope>
}

interface WishlistShareApi {

    /** GET api/wishlist/share — the buyer's latest share row (null = never shared). */
    @GET("api/wishlist/share")
    suspend fun share(): Response<WishlistShareEnvelope>

    /** POST api/wishlist/share — create/rotate the link with the two settings. */
    @POST("api/wishlist/share")
    suspend fun createShare(@Body body: WishlistShareCreateBody): Response<WishlistShareEnvelope>

    /** DELETE api/wishlist/share — revoke every share row of this buyer. */
    @DELETE("api/wishlist/share")
    suspend fun revokeShare(): Response<WishlistMessageEnvelope>
}

interface SharedWishlistApi {

    /**
     * GET api/wishlist/shared?token= — PUBLIC shared wishlist read (no auth
     * on the route; see the interface KDoc). 400/404 carry verbatim texts.
     */
    @GET("api/wishlist/shared")
    suspend fun shared(@Query("token") token: String): Response<SharedWishlistEnvelope>
}

interface FavoritesApi {

    /** GET api/favorites — the buyer's wishlist rows ranked by product rating. */
    @GET("api/favorites")
    suspend fun favorites(): Response<ApiEnvelope<List<FavoriteRowDto>>>
}

interface CategoryFollowApi {

    /** GET api/buyer/followed-categories — the categories THIS buyer follows. */
    @GET("api/buyer/followed-categories")
    suspend fun followedCategories(): Response<ApiEnvelope<List<FollowedCategoryRowDto>>>

    /** POST api/categories/{id}/favorite — follow / flip the notifyOnNew bell. */
    @POST("api/categories/{id}/favorite")
    suspend fun followCategory(
        @Path("id") categoryId: String,
        @Body body: CategoryFollowBody,
    ): Response<CategoryFollowEnvelope>

    /** DELETE api/categories/{id}/favorite — unfollow. */
    @DELETE("api/categories/{id}/favorite")
    suspend fun unfollowCategory(@Path("id") categoryId: String): Response<WishlistMessageEnvelope>
}

interface SupplierFollowApi {

    /** GET api/buyer/favorite-suppliers — the suppliers THIS buyer follows. */
    @GET("api/buyer/favorite-suppliers")
    suspend fun favoriteSuppliers(): Response<ApiEnvelope<List<FavoriteSupplierRowDto>>>

    /** DELETE api/suppliers/{id}/favorite — unfollow a supplier. */
    @DELETE("api/suppliers/{id}/favorite")
    suspend fun unfollowSupplier(@Path("id") supplierId: String): Response<WishlistMessageEnvelope>
}

interface SavedSearchesApi {

    /** GET api/search/saved — own + public-default saved searches (auth optional). */
    @GET("api/search/saved")
    suspend fun savedSearches(): Response<ApiEnvelope<List<SavedSearchDto>>>

    /** DELETE api/search/saved/{id} — owner-scoped removal. */
    @DELETE("api/search/saved/{id}")
    suspend fun deleteSavedSearch(@Path("id") id: String): Response<WishlistMessageEnvelope>
}

/* ─── GET/PATCH/DELETE api/wishlist/[itemId] (wishlist-detail) ───────────── */

/**
 * One wishlists row as GET api/wishlist/[itemId] answers it — the raw prisma
 * row + the FULL product include the detail route adds (unlike the list
 * route's slimmer select). [note] is the buyer's own personal note (the
 * PATCH target).
 */
@Immutable
@Serializable
data class WishlistItemDetailDto(
    val id: String? = null,
    val buyerId: String? = null,
    val productId: String? = null,
    val note: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val product: WishlistDetailProductDto? = null,
) {
    /** Stable identity for keyed collections (row id, product id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: productId?.takeIf(String::isNotBlank)
            ?: "wishlist-item-${hashCode()}"
}

/** The full product projection GET api/wishlist/[itemId] nests on rows. */
@Immutable
@Serializable
data class WishlistDetailProductDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val basePrice: Double = 0.0,
    val currency: String? = null,
    val unit: String? = null,
    val moq: Int = 1,
    val stockQuantity: Int = 0,
    val ratingAvg: Double = 0.0,
    val reviewCount: Int = 0,
    val thumbnailUrl: String? = null,
    val isActive: Boolean? = null,
    val images: List<ProductImageDto> = emptyList(),
    val supplier: WishlistDetailSupplierDto? = null,
    val priceTiers: List<PriceTierDto> = emptyList(),
) {
    /** First real image (imageUrl rows) falling back to the thumbnail. */
    val firstImage: String?
        get() = images.filter { !it.imageUrl.isNullOrBlank() }.minByOrNull { it.sortOrder }?.imageUrl
            ?: thumbnailUrl
}

/** The supplier projection inside the wishlist detail include. */
@Immutable
@Serializable
data class WishlistDetailSupplierDto(
    val id: String? = null,
    val companyName: String? = null,
    val verificationStatus: String? = null,
    val ratingAvg: Double = 0.0,
) {
    /** The web's isVerified gate (favorite/detail components' exact test). */
    val isVerified: Boolean
        get() = verificationStatus == "VERIFIED" || verificationStatus == "APPROVED"
}

/** Outgoing PATCH api/wishlist/[itemId] body — { note } (always serialized). */
@Immutable
@Serializable
data class WishlistNotePatchBody(val note: String)

/**
 * Envelope of the PATCH api/wishlist/[itemId] 200 — data is the prisma
 * updateMany result ({ count }), NOT the row (the web ignores it; declared
 * for wire fidelity).
 */
@Immutable
@Serializable
data class WishlistNotePatchEnvelope(
    val success: Boolean = false,
    val data: WishlistNoteCountDto? = null,
    val error: String? = null,
)

/** The updateMany count the PATCH 200 carries as its data. */
@Immutable
@Serializable
data class WishlistNoteCountDto(val count: Int = 0)

/**
 * Envelope of the DELETE answers across the wishlist/follow routes —
 * { success, message } (message verbatim: 'Removed from wishlist',
 * 'Unfollowed category', 'Saved search deleted', 'Share link revoked', …).
 * Error answers land in errorBody and are parsed with [parseErrorBody].
 */
@Immutable
@Serializable
data class WishlistMessageEnvelope(
    val success: Boolean = false,
    val message: String? = null,
    val error: String? = null,
)

/* ─── GET/POST/DELETE api/wishlist/share ─────────────────────────────────── */

/**
 * One wishlistShares row as the share routes carry it. [token] is the
 * 32-hex crypto token the share URL is built around; [viewCount]/
 * [lastViewedAt] are the server-tracked numbers the web's Share Status card
 * renders; [expiresAt] is null for a never-expiring link.
 */
@Immutable
@Serializable
data class WishlistShareDto(
    val id: String? = null,
    val buyerId: String? = null,
    val token: String? = null,
    val expiresAt: String? = null,
    val allowAddToCart: Boolean = true,
    val showPrices: Boolean = true,
    val viewCount: Int = 0,
    val lastViewedAt: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

/** Envelope of GET/POST api/wishlist/share — data is null when never shared. */
@Immutable
@Serializable
data class WishlistShareEnvelope(
    val success: Boolean = false,
    val data: WishlistShareDto? = null,
    val message: String? = null,
    val error: String? = null,
)

/**
 * Outgoing POST api/wishlist/share body — the two settings the web
 * component always sends (server defaults `?? true` when absent; the
 * native always sends both, so they carry NO Kotlin default). The API's
 * optional expiresIn is never sent by the web's share page and stays
 * undeclared here.
 */
@Immutable
@Serializable
data class WishlistShareCreateBody(
    val allowAddToCart: Boolean,
    val showPrices: Boolean,
)

/* ─── GET api/wishlist/shared?token= (PUBLIC) ────────────────────────────── */

/** Envelope of the PUBLIC GET api/wishlist/shared (data null on 400/404). */
@Immutable
@Serializable
data class SharedWishlistEnvelope(
    val success: Boolean = false,
    val data: SharedWishlistPayload? = null,
    val error: String? = null,
)

/**
 * data of GET api/wishlist/shared — { owner, items, settings } (the route's
 * exact shape). Prices on [items] exist ONLY when [SharedWishlistSettingsDto.showPrices]
 * is true (the route conditionally omits basePrice/currency from the select).
 */
@Immutable
@Serializable
data class SharedWishlistPayload(
    val owner: SharedWishlistOwnerDto? = null,
    val items: List<SharedWishlistItemDto> = emptyList(),
    val settings: SharedWishlistSettingsDto? = null,
)

/** The share owner projection (users select on wishlist/shared/route.ts:12). */
@Immutable
@Serializable
data class SharedWishlistOwnerDto(
    val name: String? = null,
    val avatarUrl: String? = null,
    val companyName: String? = null,
)

/**
 * The share settings block — the two gates the shared viewers honor.
 * Defaults false mirror the web's `settings?.showPrices` undefined → hidden
 * behavior when the block is absent.
 */
@Immutable
@Serializable
data class SharedWishlistSettingsDto(
    val allowAddToCart: Boolean = false,
    val showPrices: Boolean = false,
)

/** One wishlists row inside the shared payload. */
@Immutable
@Serializable
data class SharedWishlistItemDto(
    val id: String? = null,
    val buyerId: String? = null,
    val productId: String? = null,
    val createdAt: String? = null,
    val product: SharedWishlistProductDto? = null,
) {
    /** Stable identity for keyed collections (row id, product id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: productId?.takeIf(String::isNotBlank)
            ?: "shared-item-${hashCode()}"
}

/**
 * The product select of the shared route — basePrice/currency ride only
 * when the share shows prices (nullable here for that reason), stockQuantity
 * feeds the honest out-of-stock rendering.
 */
@Immutable
@Serializable
data class SharedWishlistProductDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val basePrice: Double? = null,
    val currency: String? = null,
    val unit: String? = null,
    val moq: Int = 1,
    val thumbnailUrl: String? = null,
    val stockQuantity: Int = 0,
    val supplier: SharedWishlistSupplierDto? = null,
) {
    /** The productId an item tap routes to (row productId → product id). */
    val effectiveId: String?
        get() = id?.takeIf(String::isNotBlank)
}

/** The supplier projection inside the shared product select. */
@Immutable
@Serializable
data class SharedWishlistSupplierDto(
    val companyName: String? = null,
    val verificationStatus: String? = null,
)

/* ─── GET api/favorites (favorite-products) ──────────────────────────────── */

/**
 * One favorites row as GET api/favorites answers it — a wishlists row
 * (re-ranked by product ratingAvg) + the product select the route ships
 * (soldCount included, priceTiers take 1).
 */
@Immutable
@Serializable
data class FavoriteRowDto(
    val id: String? = null,
    val buyerId: String? = null,
    val productId: String? = null,
    val createdAt: String? = null,
    val product: FavoriteProductDto? = null,
) {
    /** Stable identity for keyed collections (row id, product id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: productId?.takeIf(String::isNotBlank)
            ?: "favorite-${hashCode()}"

    /** The productId the web maps (`p.id || r.productId`) — row tap + remove target. */
    val effectiveProductId: String?
        get() = product?.id?.takeIf(String::isNotBlank) ?: productId?.takeIf(String::isNotBlank)
}

/** The product projection GET api/favorites nests on rows. */
@Immutable
@Serializable
data class FavoriteProductDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val basePrice: Double = 0.0,
    val currency: String? = null,
    val unit: String? = null,
    val moq: Int = 1,
    val stockQuantity: Int = 0,
    val ratingAvg: Double = 0.0,
    val reviewCount: Int = 0,
    val thumbnailUrl: String? = null,
    val soldCount: Int = 0,
    val supplier: FavoriteProductSupplierDto? = null,
    val priceTiers: List<PriceTierDto> = emptyList(),
) {
    /** The web's `hasBulkPricing` — any tier row present (take 1 on this route). */
    val hasBulkPricing: Boolean get() = priceTiers.isNotEmpty()
}

/** The supplier projection inside the favorites product select. */
@Immutable
@Serializable
data class FavoriteProductSupplierDto(
    val companyName: String? = null,
    val verificationStatus: String? = null,
    val ratingAvg: Double = 0.0,
) {
    /** The web's isVerified gate (favorite-products-page.tsx:90 exact test). */
    val isVerified: Boolean
        get() = verificationStatus == "VERIFIED" || verificationStatus == "APPROVED"
}

/* ─── followed categories (favorite-categories) ──────────────────────────── */

/** One followedCategories row as GET api/buyer/followed-categories answers it. */
@Immutable
@Serializable
data class FollowedCategoryRowDto(
    val id: String? = null,
    val buyerId: String? = null,
    val categoryId: String? = null,
    val notifyOnNew: Boolean = false,
    val createdAt: String? = null,
    val category: FollowedCategoryDto? = null,
) {
    /** Stable identity for keyed collections (row id, category id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: categoryId?.takeIf(String::isNotBlank)
            ?: "followed-category-${hashCode()}"

    /** The categoryId the unfollow/bell routes need (category id → row field). */
    val effectiveCategoryId: String?
        get() = category?.id?.takeIf(String::isNotBlank) ?: categoryId?.takeIf(String::isNotBlank)
}

/** The category select GET api/buyer/followed-categories nests on rows. */
@Immutable
@Serializable
data class FollowedCategoryDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val iconUrl: String? = null,
    val isActive: Boolean? = null,
)

/** Outgoing POST api/categories/[id]/favorite body — { notifyOnNew }. */
@Immutable
@Serializable
data class CategoryFollowBody(val notifyOnNew: Boolean)

/**
 * Envelope of the POST api/categories/[id]/favorite 200 —
 * { success, data: the followedCategories row, message: 'Following
 * category' }. The row's columns ride as JsonElement (the screen only
 * needs success + the verbatim message).
 */
@Immutable
@Serializable
data class CategoryFollowEnvelope(
    val success: Boolean = false,
    val data: JsonElement? = null,
    val message: String? = null,
    val error: String? = null,
)

/* ─── favorite suppliers (favorite-suppliers + buyer-favorites) ──────────── */

/**
 * One favoriteSuppliers row as GET api/buyer/favorite-suppliers answers it
 * — the exact shape favorite-suppliers-page.tsx:12 documents.
 */
@Immutable
@Serializable
data class FavoriteSupplierRowDto(
    val id: String? = null,
    val buyerId: String? = null,
    val supplierId: String? = null,
    val createdAt: String? = null,
    val supplier: FavoriteSupplierDto? = null,
) {
    /** Stable identity for keyed collections (row id, supplier id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: supplierId?.takeIf(String::isNotBlank)
            ?: "favorite-supplier-${hashCode()}"

    /** The supplierId the unfollow route + row taps need (web: s.id || r.supplierId). */
    val effectiveSupplierId: String?
        get() = supplier?.id?.takeIf(String::isNotBlank) ?: supplierId?.takeIf(String::isNotBlank)
}

/** The supplier select GET api/buyer/favorite-suppliers nests on rows. */
@Immutable
@Serializable
data class FavoriteSupplierDto(
    val id: String? = null,
    val companyName: String? = null,
    val verificationStatus: String? = null,
    val ratingAvg: Double = 0.0,
    val ratingCount: Int = 0,
    val createdAt: String? = null,
) {
    /** The web's isVerified gate (favorite-suppliers-page.tsx:64 exact test). */
    val isVerified: Boolean
        get() = verificationStatus == "APPROVED" || verificationStatus == "VERIFIED"
}

/* ─── saved searches (saved-searches) ────────────────────────────────────── */

/** One searchFilters row as GET api/search/saved answers it. */
@Immutable
@Serializable
data class SavedSearchDto(
    val id: String? = null,
    val userId: String? = null,
    val name: String? = null,
    /** JSON string the web parses per row (see WishlistExtraModels.parseSavedFilter). */
    val filterConfig: String? = null,
    val isDefault: Boolean = false,
    val createdAt: String? = null,
    val updatedAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "saved-search-${hashCode()}"
}
