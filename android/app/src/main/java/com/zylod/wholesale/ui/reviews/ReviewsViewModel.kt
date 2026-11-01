package com.zylod.wholesale.ui.reviews

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ReviewDto
import com.zylod.wholesale.data.api.ReviewsApi
import com.zylod.wholesale.data.api.ReviewProductDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer

/**
 * Reviews-list VM — GET api/reviews?productId= (ReviewsApi.list) as the
 * payload of record for BOTH native pageIds ("all-reviews" and
 * "product-reviews-list" — the web SPA serves both from the SAME
 * product-reviews-page.tsx component, src/lib/page-chunks). The product
 * header is resolved with the web page's EXACT two-branch fetch:
 * `productId ? /api/products/${productId} : /api/products?limit=1` —
 * including the fallback product fetch when the entry query carries no
 * id (the reviews list then targets the resolved product's id).
 *
 *  - PUBLIC route: no sign-in gate — the web page renders for guests too
 *    (the shared OkHttp client still attaches the Bearer token when a
 *    session exists; the route ignores it).
 *  - FILTERS (web parity): the four pills — All / With Photos / Verified
 *    Only / 5 Star — are client-side projections of the same rows; the
 *    empty card distinguishes "No reviews yet" from "No reviews match
 *    this filter" exactly like the web.
 *  - FAILURE: honest error card + Retry when nothing renderable; the last
 *    saved snapshot (SharedPreferences "zylod_config",
 *    "native_reviews_list_cache_<pageId>") renders with the offline banner
 *    otherwise.
 *
 * ROW CONTENT is the web page's exact projection: buyerName with the
 * server's own "Buyer" fallback re-applied, the initial-letter avatar,
 * the "Verified Buyer" badge on verifiedPurchase, the relative date
 * (today / yesterday / N days|weeks|months|years ago — the web helper
 * ported 1:1), the 1-5 star row, the comment, and the photo strip when
 * the review carries images. The web's Helpful/Report footer buttons are
 * deliberately NOT ported: the GET payload carries no helpfulCount and
 * no API exists for either action — rendering a local-only toggle would
 * be a fake interaction (the same honesty rule that killed the fake
 * reviews in the t229 web fix).
 */
data class ReviewRow(
    /** Stable LazyColumn key (review id, hash fallback). */
    val key: String,
    val id: String,
    /** buyerName || "Buyer" (the server fallback, re-applied client-side). */
    val buyerName: String,
    /** buyerName.first().uppercase() — the web avatar circle. */
    val initial: String,
    /** Clamped 0-5 for the star row (0 renders an empty row, honestly). */
    val rating: Int,
    /** comment || "" — the single stored text field. */
    val comment: String,
    /** Web relativeDate(): "today", "3 days ago", "" when unparsable. */
    val dateLabel: String,
    /** verifiedPurchase → the "Verified Buyer" badge. */
    val verified: Boolean,
    /** Non-blank image urls — the photo strip renders only when non-empty. */
    val images: List<String>,
)

/** The web header card's product projection (name/image/rating summary). */
data class ProductHeaderRow(
    val id: String,
    /** name || "Unnamed product" (web fallback). */
    val name: String,
    val ratingAvg: Double,
    val reviewCount: Int,
    /** First non-blank image url (url ?? imageUrl chain) — null drops the img. */
    val imageUrl: String?,
)

/** The four client-side filter pills (web filter keys verbatim). */
object ReviewFilters {
    const val ALL = "all"
    const val PHOTOS = "photos"
    const val VERIFIED = "verified"
    const val FIVE_STAR = "5star"
    val ALL_KEYS = listOf(ALL, PHOTOS, VERIFIED, FIVE_STAR)
}

data class ReviewsUiState(
    /** Resolving product + fetching the list (skeletons while empty). */
    val loading: Boolean = true,
    /** Null → the header card does not render (web: header is optional). */
    val product: ProductHeaderRow? = null,
    /** The REAL review rows in server order (createdAt DESC, take 100). */
    val reviews: List<ReviewRow> = emptyList(),
    /** Selected filter pill key (web activeFilter, default "all"). */
    val filter: String = ReviewFilters.ALL,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** The visible list came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
) {
    /** The pill projection — web filteredReviews useMemo. */
    val filtered: List<ReviewRow>
        get() = when (filter) {
            ReviewFilters.PHOTOS -> reviews.filter { it.images.isNotEmpty() }
            ReviewFilters.VERIFIED -> reviews.filter { it.verified }
            ReviewFilters.FIVE_STAR -> reviews.filter { it.rating == 5 }
            else -> reviews
        }

    /** Empty-card copy fork (web: reviews.length === 0 vs filter miss). */
    val hasAnyReviews: Boolean get() = reviews.isNotEmpty()
}

class ReviewsViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ReviewsUiState())
    val state: StateFlow<ReviewsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(query: String?) {
        if (initJob?.isActive == true) return
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = true,
                error = null,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchAll(query) }
    }

    /** Filter pill tap (web setActiveFilter). */
    fun setFilter(key: String) {
        _state.update { it.copy(filter = key) }
    }

    private suspend fun fetchAll(query: String?) {
        try {
            Log.i(TAG, "fetch reviews pageId=$pageId")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.reviewsApi(base)

            // Product context — the web page's exact two-branch resolution.
            val queriedId = productIdFromQuery(query)
            val header = if (queriedId != null) {
                fetchProduct(api, queriedId)
            } else {
                fetchFirstProduct(api)
            }
            if (header != null) {
                _state.update { it.copy(product = header) }
            }
            val targetId = queriedId
                ?: header?.id?.takeIf(String::isNotBlank)
                ?: ""

            if (targetId.isBlank()) {
                // No id resolvable at all — the web keeps rendering with an
                // empty list; honest here means the degrade path (cache or
                // the real failure), never a fake "No reviews yet".
                degrade("Could not resolve a product for these reviews.")
                return
            }

            val response = api.list(targetId)
            val payload = response.body()
            val rows = payload?.data
                ?.takeIf { response.isSuccessful && payload?.success == true }
                ?.map { it.toRow() }
                .orEmpty()
            if (!response.isSuccessful || payload?.success != true) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the reviews for this product (HTTP ${response.code()})."
                Log.w(TAG, "reviews error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "reviews loaded rows=${rows.size}")
            _state.update {
                it.copy(
                    loading = false,
                    reviews = rows,
                    error = null,
                    offlineFromCache = false,
                )
            }
            persistCache(payload?.data.orEmpty())
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "reviews fetch failed: ${e.message}")
            degrade("Network error while loading the reviews. Check your connection and retry.")
        }
    }

    /** GET api/products/{id} — header only; a failure drops the card (web parity). */
    private suspend fun fetchProduct(api: ReviewsApi, productId: String): ProductHeaderRow? = try {
        val response = api.productContext(productId)
        val payload = response.body()
        payload?.data
            ?.takeIf { response.isSuccessful && payload?.success == true }
            ?.toHeader()
    } catch (e: Exception) {
        Log.w(TAG, "product context failed: ${e.message}")
        null
    }

    /** GET api/products?limit=1 — the web fallback product for the header. */
    private suspend fun fetchFirstProduct(api: ReviewsApi): ProductHeaderRow? = try {
        val response = api.firstProduct()
        val payload = response.body()
        payload?.data
            ?.takeIf { response.isSuccessful && payload?.success == true }
            ?.firstOrNull()
            ?.toHeader()
    } catch (e: Exception) {
        Log.w(TAG, "fallback product failed: ${e.message}")
        null
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved list
     * cache; with none, the honest error card. Mapped on the MAIN thread
     * after the IO cache read (RfqModels convention).
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            ReviewsCacheStore.read(appContext, ReviewsCacheKeys.list(pageId), CachedReviews.serializer())
        }
        val rows = cached?.rows.orEmpty().map { it.toRow() }
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cache rows=${rows.size}")
            _state.value = _state.value.copy(
                loading = false,
                reviews = rows,
                error = null,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the list's wire DTOs — the offline render matches the live one. */
    private fun persistCache(rows: List<ReviewDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            ReviewsCacheStore.write(
                appContext,
                ReviewsCacheKeys.list(pageId),
                CachedReviews.serializer(),
                CachedReviews(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodReviews"
    }
}

/* ─── mappers (the web page's exact projections) ─────────────────────────── */

/** Wire row → render row (web realReviews map, ReviewItem projection). */
internal fun ReviewDto.toRow() = ReviewRow(
    key = stableKey,
    id = id?.takeIf(String::isNotBlank) ?: stableKey,
    buyerName = buyerName?.takeIf(String::isNotBlank) ?: "Buyer",
    initial = (buyerName?.takeIf(String::isNotBlank) ?: "Buyer")
        .trim()
        .firstOrNull()
        ?.uppercase(Locale.US)
        ?: "?",
    rating = rating.coerceIn(0, 5),
    comment = comment.orEmpty(),
    dateLabel = relativeDateLabel(createdAt),
    verified = verifiedPurchase,
    images = images.filter { it.isNotBlank() },
)

/** Wire product row → header card (web ProductInfo mapping incl. fallbacks). */
internal fun ReviewProductDto.toHeader() = ProductHeaderRow(
    id = id.orEmpty(),
    name = name?.takeIf(String::isNotBlank) ?: "Unnamed product",
    ratingAvg = ratingAvg,
    reviewCount = reviewCount,
    imageUrl = images.firstNotNullOfOrNull { row ->
        row.url?.takeIf(String::isNotBlank) ?: row.imageUrl?.takeIf(String::isNotBlank)
    },
)

/**
 * Web relativeDate() ported 1:1: "today" (<1 day, future dates included),
 * "yesterday", "N days ago", "N week(s) ago", "N month(s) ago",
 * "N year(s) ago"; "" when the instant is absent/unparsable.
 */
internal fun relativeDateLabel(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching { reviewsIsoParser.parse(iso.take(19)) }.getOrNull() ?: return ""
    val diffMs = System.currentTimeMillis() - parsed.time
    val diffDays = diffMs / (1000L * 60L * 60L * 24L)
    return when {
        diffDays < 1 -> "today"
        diffDays == 1L -> "yesterday"
        diffDays < 7 -> "$diffDays days ago"
        diffDays < 30 -> {
            val weeks = diffDays / 7
            if (weeks > 1L) "$weeks weeks ago" else "1 week ago"
        }
        diffDays < 365 -> {
            val months = diffDays / 30
            if (months > 1L) "$months months ago" else "1 month ago"
        }
        else -> {
            val years = diffDays / 365
            if (years > 1L) "$years years ago" else "1 year ago"
        }
    }
}

/** ISO instants on the reviews wire: "2024-05-05T10:00:00.000Z". */
private val reviewsIsoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

/**
 * Extracts a product id from the page's entry query, mirroring the web's
 * `pageParams.productId || pageParams.id || ''` resolution over the
 * native key=value query convention: "productId=x" first, then a bare
 * "&id=x" pair, then a bare single token without any "=". Null when
 * nothing usable is present.
 */
fun productIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val named = Regex("productId=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!named.isNullOrBlank()) return named
    val bare = Regex("(?:^|&)id=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!bare.isNullOrBlank()) return bare
    return raw.takeIf { !it.contains('=') }
}

/* ─── offline cache (t253 AddressCacheStore convention) ──────────────────── */

/** The device-saved reviews keys — SharedPreferences "zylod_config". */
internal object ReviewsCacheKeys {
    const val PREFS = "zylod_config"

    /** One snapshot per pageId on the reviews-list surface family. */
    fun list(pageId: String): String = "native_reviews_list_cache_$pageId"
}

/** Reviews-list snapshot (the raw wire DTOs — offline render matches live). */
@kotlinx.serialization.Serializable
data class CachedReviews(val rows: List<ReviewDto> = emptyList())

/**
 * On-device saved payloads — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the [ReviewsCacheKeys] keys.
 */
internal object ReviewsCacheStore {
    private const val TAG = "ZylodReviews"

    fun <T> read(context: Context, key: String, serializer: KSerializer<T>): T? = runCatching {
        val raw = context.getSharedPreferences(ReviewsCacheKeys.PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(serializer, raw)
    }.onFailure { Log.w(TAG, "reviews cache read failed: ${it.message}") }.getOrNull()

    fun <T> write(context: Context, key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            val raw = ApiClient.json.encodeToString(serializer, value)
            context.getSharedPreferences(ReviewsCacheKeys.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
        }.onFailure { Log.w(TAG, "reviews cache write failed: ${it.message}") }
    }
}
