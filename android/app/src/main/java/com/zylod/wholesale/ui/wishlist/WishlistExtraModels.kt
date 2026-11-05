package com.zylod.wholesale.ui.wishlist

import android.content.Context
import android.util.Log
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.FavoriteRowDto
import com.zylod.wholesale.data.api.FavoriteSupplierRowDto
import com.zylod.wholesale.data.api.FollowedCategoryRowDto
import com.zylod.wholesale.data.api.SavedSearchDto
import com.zylod.wholesale.data.api.SharedWishlistItemDto
import com.zylod.wholesale.data.api.SharedWishlistPayload
import com.zylod.wholesale.data.api.WishlistItemDetailDto
import com.zylod.wholesale.data.api.WishlistShareDto
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlinx.serialization.KSerializer

/**
 * Shared pure-Kotlin model layer for the t262 wishlist/favorites surfaces —
 * ui-states, the wire→state mappers, the offline cache keys and the web's
 * own display helpers. NO Compose imports here (ComplaintModels doctrine):
 * the screens own colors and fonts, this file owns text and state shapes.
 *
 * CACHE doctrine (ComplaintCacheKeys/FinanceCacheStore convention): every
 * list/detail surface saves its last successful payload into SharedPreferences
 * "zylod_config" under its own key and renders that snapshot (with an honest
 * offline banner) when the network fails — never a fabricated placeholder row.
 *
 * The save-for-later routes (api/save-for-later[+/itemId]) are deliberately
 * NOT declared and have NO cache key here: none of the twelve t262 pageIds
 * hosts a save-for-later surface (see WishlistApi.kt's non-declaration note).
 */
object WishlistCacheKeys {
    /** The ONE prefs file the whole native shell uses. */
    const val PREFS = "zylod_config"

    /** Last successful GET api/favorites list (the favorite-products feed). */
    const val FAVORITES = "native_favorites_cache"

    /** Last successful GET api/buyer/favorite-suppliers list (both supplier ids). */
    const val SUPPLIER_FOLLOWS = "native_supplier_follows_cache"

    /** Last successful GET api/buyer/followed-categories list. */
    const val CATEGORY_FOLLOWS = "native_category_follows_cache"

    /** Prefix for the per-token PUBLIC shared-wishlist caches: key + token. */
    const val SHARED_WISHLIST_PREFIX = "native_shared_wishlist_cache_"

    /** Last successful GET api/wishlist/share row (the share-management state). */
    const val WISHLIST_SHARE = "native_wishlist_share_cache"

    /** Last successful GET api/wishlist list under the analytics tabs. */
    const val WISHLIST_TABS = "native_wishlist_tabs_cache"

    /** Prefix for the per-item wishlist detail caches: key + the wishlist row id. */
    const val WISHLIST_ITEM_PREFIX = "native_wishlist_item_cache_"

    /** Last successful GET api/search/saved list. */
    const val SAVED_SEARCHES = "native_saved_searches_cache"

    /** Per-token shared-wishlist cache key. */
    fun sharedWishlist(token: String): String = "$SHARED_WISHLIST_PREFIX$token"

    /** Per-item wishlist detail cache key. */
    fun wishlistItem(itemId: String): String = "$WISHLIST_ITEM_PREFIX$itemId"
}

/**
 * On-device saved wishlist payloads — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the [WishlistCacheKeys] keys.
 * Generic read/write over the caller's serializer (ComplaintCacheStore
 * convention).
 */
object WishlistCacheStore {
    private const val TAG = "ZylodWishlistExtra"

    fun <T> read(context: Context, key: String, serializer: KSerializer<T>): T? = runCatching {
        val raw = context.getSharedPreferences(WishlistCacheKeys.PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(serializer, raw)
    }.onFailure { Log.w(TAG, "wishlist cache read failed ($key): ${it.message}") }.getOrNull()

    fun <T> write(context: Context, key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            val raw = ApiClient.json.encodeToString(serializer, value)
            context.getSharedPreferences(WishlistCacheKeys.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
        }.onFailure { Log.w(TAG, "wishlist cache write failed ($key): ${it.message}") }
    }
}

/* ─── saved payloads (one per cached surface) ────────────────────────────── */

/** Saved favorites list snapshot (GET api/favorites). */
@kotlinx.serialization.Serializable
data class CachedFavoriteRows(val rows: List<FavoriteRowDto> = emptyList())

/** Saved favorite-suppliers list snapshot (GET api/buyer/favorite-suppliers). */
@kotlinx.serialization.Serializable
data class CachedSupplierFollows(val rows: List<FavoriteSupplierRowDto> = emptyList())

/** Saved followed-categories list snapshot (GET api/buyer/followed-categories). */
@kotlinx.serialization.Serializable
data class CachedCategoryFollows(val rows: List<FollowedCategoryRowDto> = emptyList())

/** Saved shared-wishlist payload, pinned to the token it was fetched for. */
@kotlinx.serialization.Serializable
data class CachedSharedWishlist(
    val token: String = "",
    val payload: SharedWishlistPayload? = null,
)

/** Saved wishlist share row (GET/POST api/wishlist/share). */
@kotlinx.serialization.Serializable
data class CachedWishlistShare(val share: WishlistShareDto? = null)

/** Saved wishlist list snapshot under the analytics tabs (GET api/wishlist). */
@kotlinx.serialization.Serializable
data class CachedWishlistRows(val rows: List<com.zylod.wholesale.data.api.WishlistItemDto> = emptyList())

/** Saved wishlist-detail snapshot, pinned to the wishlist row id it was fetched for. */
@kotlinx.serialization.Serializable
data class CachedWishlistItem(
    val itemId: String = "",
    val detail: WishlistItemDetailDto? = null,
)

/** Saved saved-searches list snapshot (GET api/search/saved). */
@kotlinx.serialization.Serializable
data class CachedSavedSearches(val rows: List<SavedSearchDto> = emptyList())

/* ─── web display helpers (the SPA components' own mappers) ──────────────── */

/**
 * The web's stock-status derivation (wishlist-page.tsx:56-58 EXACT): 0 =
 * OUT_OF_STOCK, ≤ moq (moq || 10 fallback) = LOW_STOCK, else IN_STOCK.
 */
fun wishlistStockStatus(stockQuantity: Double, moq: Double?): String = when {
    stockQuantity <= 0 -> "OUT_OF_STOCK"
    stockQuantity <= (if (moq != null && moq > 0) moq else 10.0) -> "LOW_STOCK"
    else -> "IN_STOCK"
}

/** The wishlist-page tab labels for the three stock tokens. */
fun wishlistStockLabel(status: String): String = when (status) {
    "IN_STOCK" -> "In Stock"
    "LOW_STOCK" -> "Low Stock"
    else -> "Out of Stock"
}

/**
 * "৳1,200" / "৳1,200.50" — the native BDT rendering used by the typed
 * wishlist surfaces (WishlistScreen.formatBdt parity; the web's raw `$` prefix
 * is its own display bug — the routes emit BDT wholesale prices).
 */
fun wishlistBdtLabel(value: Double?): String {
    val v = value ?: 0.0
    return if (v % 1.0 == 0.0) {
        "৳" + java.text.NumberFormat.getIntegerInstance().format(v.toLong())
    } else {
        "৳" + String.format(Locale.US, "%.2f", v)
    }
}

/**
 * "May 5, 2026" — the share-management Last-Viewed date (the web's
 * toLocaleDateString on shareData.lastViewedAt; null renders "Never" in the
 * screen, never an invented date).
 */
fun wishlistDateLabel(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val parsed = runCatching { utcIsoParser.parse(iso.take(19)) }.getOrNull() ?: return null
    return wishlistDateFormat.format(parsed)
}

private val utcIsoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

private val wishlistDateFormat = SimpleDateFormat("MMM d, yyyy", Locale.US)

/**
 * Parsed saved-search filter (saved-searches-page.tsx:18-24 shape). The web
 * JSON.parses filterConfig per row and swallows failures to {} — same here:
 * unparsable configs render the name only, never a fabricated filter.
 */
data class SavedSearchFilter(
    val query: String? = null,
    val category: String? = null,
    val minPrice: String? = null,
    val maxPrice: String? = null,
    val moq: String? = null,
)

/** The web's per-row filterConfig parse (JSON.parse in try/catch → {}). */
fun parseSavedFilter(config: String?): SavedSearchFilter {
    val raw = config?.takeIf(String::isNotBlank) ?: return SavedSearchFilter()
    return runCatching {
        val o = ApiClient.json.parseToJsonElement(raw)
            as? kotlinx.serialization.json.JsonObject
            ?: return SavedSearchFilter()
        fun field(key: String): String? =
            (o[key] as? kotlinx.serialization.json.JsonPrimitive)?.content?.takeIf(String::isNotBlank)
        SavedSearchFilter(
            query = field("query"),
            category = field("category"),
            minPrice = field("minPrice"),
            maxPrice = field("maxPrice"),
            moq = field("moq"),
        )
    }.getOrDefault(SavedSearchFilter())
}

/* ─── entry-query parsing (complaintIdFromQuery convention) ──────────────── */

/**
 * The wishlist row id an entry query pins: "itemId=x", "id=x", or a bare
 * token — the same convention the web's WishlistDetailPage applies
 * (pageParams.itemId). NO id → null; the screen shows its honest id-less
 * state, never a fabricated fallback id.
 */
fun wishlistItemIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val named = Regex("itemId=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!named.isNullOrBlank()) return named
    val bare = Regex("(?:^|&)id=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!bare.isNullOrBlank()) return bare
    return raw.takeIf { !it.contains('=') }
}

/**
 * The share token an entry query pins: "token=x", "shareToken=x", or a bare
 * token — the web's `pageParams?.token || pageParams?.shareToken`
 * (shared-wishlist-detail-page.tsx:37). NO token → null.
 */
fun shareTokenFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val token = Regex("token=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!token.isNullOrBlank()) return token
    val shareToken = Regex("shareToken=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!shareToken.isNullOrBlank()) return shareToken
    return raw.takeIf { !it.contains('=') }
}

/**
 * Whether the entry query pins OWNER mode on the shared page — the web's
 * `pageParams?.mode === 'owner'` branch (shared-wishlist-page.tsx:28).
 */
fun sharedWishlistOwnerMode(query: String?): Boolean =
    query?.trim()?.contains(Regex("(?:^|&)mode=owner(?:&|$)")) == true

/**
 * The share URL the native app hands out — the web builds
 * `${window.location.origin}/shared?token=…`; the native composes the same
 * path against the RESOLVED API origin (the deeplink host the server
 * config points at), so a copied link opens the same public web page.
 */
fun shareUrlFor(baseUrl: String?, token: String?): String? {
    val origin = baseUrl?.trimEnd('/')?.takeIf(String::isNotBlank) ?: return null
    val t = token?.takeIf(String::isNotBlank) ?: return null
    return "$origin/shared?token=$t"
}

/* ─── ui states ──────────────────────────────────────────────────────────── */

/**
 * State of the pageId-keyed favorites surface (buyer-favorites AND
 * favorite-suppliers AND favorite-products AND favorite-categories). The
 * three row kinds map the web's component split exactly:
 *
 *  - buyer-favorites / favorite-suppliers → favorite-suppliers-page.tsx
 *    (chunk-misc.ts:121 + chunk-wishlist.ts:33): followed suppliers, sort
 *    chips, per-row unfollow.
 *  - favorite-products → favorite-products-page.tsx: ranked favorites,
 *    sort chips, per-row remove through DELETE api/wishlist?productId=.
 *  - favorite-categories → favorite-categories-page.tsx: followed
 *    categories, the notifyOnNew bell toggle, per-row unfollow.
 */
data class FavoritesUiState(
    val loading: Boolean = true,
    /** The variant this pageId renders (derived once, see [FavoritesVariant]). */
    val variant: FavoritesVariant = FavoritesVariant.SUPPLIERS,
    val supplierRows: List<FavoriteSupplierRowDto> = emptyList(),
    val productRows: List<FavoriteRowDto> = emptyList(),
    val categoryRows: List<FollowedCategoryRowDto> = emptyList(),
    /** The active supplier sort token (the web's own three options). */
    val supplierSort: String = SUPPLIER_SORT_RECENT,
    /** The active product sort token (the web's own four options). */
    val productSort: String = PRODUCT_SORT_NEWEST,
    /** The visible rows are SAVED data (in-memory or disk cache). */
    val offline: Boolean = false,
    /** Signed out (no token, or 401 after the refresh attempt — the web gate). */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** Verbatim refresh failure — last good data stays on screen. */
    val refreshError: String? = null,
    /** Supplier id currently being unfollowed (progress on its card). */
    val removingSupplierId: String? = null,
    /** Category id currently being unfollowed (progress on its card). */
    val removingCategoryId: String? = null,
    /** Product id currently being removed (progress on its card). */
    val removingProductId: String? = null,
    /** Verbatim action result (the web's toast text) — inline note. */
    val actionMessage: String? = null,
    /** Verbatim action failure — inline note. */
    val actionError: String? = null,
    /** Optimistically-flipped bell states (categoryId → notifyOnNew) while in flight. */
    val pendingBells: Map<String, Boolean> = emptyMap(),
) {
    companion object {
        /** The web's supplier sort tokens (favorite-suppliers-page.tsx:33). */
        const val SUPPLIER_SORT_RECENT = "Recently Added"
        const val SUPPLIER_SORT_TOP_RATED = "Top Rated"
        const val SUPPLIER_SORT_MOST_PRODUCTS = "Most Products"

        /** The web's product sort tokens (favorite-products-page.tsx:137). */
        const val PRODUCT_SORT_RATING = "Rating"
        const val PRODUCT_SORT_PRICE_ASC = "Price Low-High"
        const val PRODUCT_SORT_PRICE_DESC = "Price High-Low"
        const val PRODUCT_SORT_NEWEST = "Newest"
    }
}

/** Which of the three web components this favorites pageId renders. */
enum class FavoritesVariant { SUPPLIERS, PRODUCTS, CATEGORIES }

/** Resolves the variant from the pageId (the page-chunks mapping, verbatim). */
fun favoritesVariantFor(pageId: String): FavoritesVariant = when (pageId) {
    "favorite-products" -> FavoritesVariant.PRODUCTS
    "favorite-categories" -> FavoritesVariant.CATEGORIES
    else -> FavoritesVariant.SUPPLIERS
}

/** Verbatim supplier list for the variant — the sorted in-memory rows. */
fun sortedSupplierRows(
    rows: List<FavoriteSupplierRowDto>,
    sort: String,
): List<FavoriteSupplierRowDto> = when (sort) {
    FavoritesUiState.SUPPLIER_SORT_TOP_RATED ->
        rows.sortedByDescending { it.supplier?.ratingAvg ?: 0.0 }
    // The web sorts by productsCount — which its own mapping pins to 0 for
    // every row, so this token re-orders nothing there either (honest parity).
    FavoritesUiState.SUPPLIER_SORT_MOST_PRODUCTS -> rows
    else -> rows // "Recently Added" = the server's createdAt desc order
}

/** Verbatim product list for the variant — the sorted in-memory rows. */
fun sortedProductRows(
    rows: List<FavoriteRowDto>,
    sort: String,
): List<FavoriteRowDto> = when (sort) {
    FavoritesUiState.PRODUCT_SORT_PRICE_ASC -> rows.sortedBy { it.product?.basePrice ?: 0.0 }
    FavoritesUiState.PRODUCT_SORT_PRICE_DESC -> rows.sortedByDescending { it.product?.basePrice ?: 0.0 }
    FavoritesUiState.PRODUCT_SORT_RATING -> rows.sortedByDescending { it.product?.ratingAvg ?: 0.0 }
    else -> rows // "Newest" = the server's ranking order
}

/**
 * State of the share-management surface (pageIds wishlist-share +
 * wishlist-share-page — BOTH load the same wishlist-share-page component).
 */
data class ShareUiState(
    val loading: Boolean = true,
    val share: WishlistShareDto? = null,
    val allowAddToCart: Boolean = true,
    val showPrices: Boolean = true,
    /** Signed out (no token, or 401/403 after the refresh attempt — the web gate). */
    val needsAuth: Boolean = false,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    val creating: Boolean = false,
    /** Verbatim POST/DELETE failure — inline note. */
    val actionError: String? = null,
    /** Verbatim 200 message of the last create/revoke — inline note. */
    val actionMessage: String? = null,
) {
    /** The web's Share Status chip: a share row exists → Active. */
    val isActive: Boolean get() = share != null
}

/**
 * State of the PUBLIC shared-wishlist viewer (pageIds wishlist-shared +
 * shared-wishlist + shared-wishlist-detail — the first two load
 * shared-wishlist-page.tsx, the third shared-wishlist-detail-page.tsx).
 * The token branch is NEVER session-gated: the route is public and works
 * signed-out. [needsAuth] is the OWNER branch's gate only (the web's
 * "Sign in to share your wishlist" AccountGate).
 */
data class SharedWishlistUiState(
    val loading: Boolean = true,
    /** False → the entry query carried no token (the web's empty viewer). */
    val hasToken: Boolean = false,
    /** The web's owner branch (`mode=owner` in the entry query). */
    val ownerMode: Boolean = false,
    /** Owner-branch gate: a signed-out owner cannot read api/wishlist/share. */
    val needsAuth: Boolean = false,
    val token: String = "",
    val payload: SharedWishlistPayload? = null,
    /** 400/404/network text — verbatim server text or the web's own sentence. */
    val error: String? = null,
    /** The owner-mode share row (GET api/wishlist/share) for the link box. */
    val ownerShare: WishlistShareDto? = null,
) {
    /** The web's header composition: "${owner.name}'s Wishlist" else "Shared Wishlist". */
    val ownerName: String?
        get() = payload?.owner?.companyName?.takeIf(String::isNotBlank)
            ?: payload?.owner?.name?.takeIf(String::isNotBlank)

    /** Prices render only when the share's settings allow them (web gate). */
    val showPrices: Boolean
        get() = payload?.settings?.showPrices == true

    /** Add-to-cart affordance renders only when the share allows it (web gate). */
    val allowAddToCart: Boolean
        get() = payload?.settings?.allowAddToCart == true
}

/**
 * State of the wishlist-analytics surface (pageId wishlist-analytics —
 * chunk-misc.ts:184 maps it onto the SAME wishlist-page component the
 * "wishlist" pageId uses: the tabbed stock book, NOT a metrics dashboard;
 * no stats endpoint exists on the web and none is invented here).
 */
data class WishlistAnalyticsUiState(
    val loading: Boolean = true,
    /** Raw rows as the wire carries them (wishlists + product). */
    val rows: List<com.zylod.wholesale.data.api.WishlistItemDto> = emptyList(),
    /** The active stock tab (ALL | IN_STOCK | PRICE_DROP — the web's own tokens). */
    val tab: String = TAB_ALL,
    /** The active sort (RECENT | PRICE_ASC | PRICE_DESC | RATING). */
    val sort: String = SORT_RECENT,
    /** The visible rows are SAVED data (in-memory or disk cache). */
    val offline: Boolean = false,
    /** Signed out (no token, or 401 after the refresh attempt — the web gate). */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** Verbatim refresh failure — last good data stays on screen. */
    val refreshError: String? = null,
    /** Wishlist row id currently being removed (progress on its card). */
    val removingId: String? = null,
    /** Verbatim action failure — inline note. */
    val actionError: String? = null,
) {
    companion object {
        /** The web's tab tokens (wishlist-page.tsx:34). */
        const val TAB_ALL = "ALL"
        const val TAB_IN_STOCK = "IN_STOCK"
        const val TAB_PRICE_DROP = "PRICE_DROP"

        /** The web's sort tokens (wishlist-page.tsx:35). */
        const val SORT_RECENT = "RECENT"
        const val SORT_PRICE_ASC = "PRICE_ASC"
        const val SORT_PRICE_DESC = "PRICE_DESC"
        const val SORT_RATING = "RATING"
    }
}

/**
 * The tab-filtered, sorted view — wishlist-page.tsx:109-126 verbatim: the
 * PRICE_DROP tab filters oldPrice > price, and the wire never carries an
 * oldPrice (the web maps `oldPrice: undefined` on every row), so that tab
 * honestly renders the empty state — never a fabricated discount.
 */
fun displayedWishlistRows(
    rows: List<com.zylod.wholesale.data.api.WishlistItemDto>,
    tab: String,
    sort: String,
): List<com.zylod.wholesale.data.api.WishlistItemDto> {
    val filtered = when (tab) {
        WishlistAnalyticsUiState.TAB_IN_STOCK ->
            rows.filter {
                wishlistStockStatus(
                    it.product?.stockQuantity ?: 0.0,
                    (it.product?.moq ?: 1.0).takeIf { m -> m > 0.0 },
                ) == "IN_STOCK"
            }
        // The wire never carries an oldPrice (the web maps undefined on every
        // row), so this tab always filters to an honest empty list.
        WishlistAnalyticsUiState.TAB_PRICE_DROP -> emptyList()
        else -> rows
    }
    return when (sort) {
        WishlistAnalyticsUiState.SORT_PRICE_ASC ->
            filtered.sortedBy { it.product?.basePrice ?: 0.0 }
        WishlistAnalyticsUiState.SORT_PRICE_DESC ->
            filtered.sortedByDescending { it.product?.basePrice ?: 0.0 }
        WishlistAnalyticsUiState.SORT_RATING ->
            filtered.sortedByDescending { it.product?.ratingAvg ?: 0.0 }
        else -> filtered // RECENT = the server's createdAt desc order
    }
}

/** State of the wishlist-detail surface (pageId wishlist-detail). */
data class WishlistDetailUiState(
    val loading: Boolean = true,
    /** False → the entry query carried no wishlist row id (the web's not-found card). */
    val hasId: Boolean = false,
    val itemId: String = "",
    val detail: WishlistItemDetailDto? = null,
    /** Definitive HTTP 404 → the honest "Wishlist item not found" card. */
    val notFound: Boolean = false,
    /** Signed out (no token, or 401 after the refresh attempt). */
    val needsAuth: Boolean = false,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** The visible detail came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    val note: String = "",
    val savingNote: Boolean = false,
    /** Verbatim note-save failure — inline note. */
    val noteError: String? = null,
    /** Verbatim note-save success — inline note (consumed on dismiss). */
    val noteMessage: String? = null,
    val removing: Boolean = false,
    /** Verbatim remove failure — inline note. */
    val removeError: String? = null,
)

/** State of the saved-searches surface (pageId saved-searches). */
data class SavedSearchesUiState(
    val loading: Boolean = true,
    val rows: List<SavedSearchDto> = emptyList(),
    /** The visible rows are SAVED data (in-memory or disk cache). */
    val offline: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** Saved-search id currently being deleted (progress on its card). */
    val deletingId: String? = null,
    /** Verbatim action failure — inline note (DELETE needs a session). */
    val actionError: String? = null,
    /** The local "Alert enabled" confirmation (the web's toast, verbatim). */
    val alertMessage: String? = null,
)
