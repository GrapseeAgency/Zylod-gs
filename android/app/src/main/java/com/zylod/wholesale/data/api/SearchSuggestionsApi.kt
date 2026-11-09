package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * LIVE SEARCH TYPEAHEAD (t297) — the real route behind the web home's search
 * bar dropdown, verified against src/app/api/search/suggestions/route.ts
 * (mobile-search-bar.tsx:79 fetches `api/search/suggestions?q=…&limit=8`
 * with a 300 ms debounce):
 *
 *  GET api/search/suggestions?q=&limit= — PUBLIC, no auth. Four real DB
 *  sources fan out in one round trip:
 *   - products     : name/brand/sku contains q, active+approved, soldCount
 *                    desc, take limit — selected as
 *                    { id, name, basePrice, thumbnailUrl, category { name } }.
 *   - categories   : name contains q, take 4 — { id, name, slug }.
 *   - suppliers    : companyName contains q, take 4 — { id, companyName,
 *                    ratingAvg }.
 *   - fallbackSuggestions : popularSearches rows whose query contains q
 *                    (trendingScore desc, searchCount desc), as plain
 *                    strings; when everything else is empty the route
 *                    substitutes top-selling product name prefixes — the
 *                    web's own fallback logic, honored verbatim client-side.
 *
 *  Empty q answers the empty structure (200, success true) — the caller
 *  never fabricates rows; blank q simply clears the dropdown.
 *
 * The web renders suggestions in THIS order (mobile-search-bar.tsx:84-121):
 * fallbackSuggestions first, then products, then categories, then suppliers
 * — the native mapper keeps the exact order.
 */
interface SearchSuggestionsApi {

    /** GET api/search/suggestions?q=&limit= — the live typeahead (public). */
    @GET("api/search/suggestions")
    suspend fun suggestions(
        @Query("q") query: String,
        @Query("limit") limit: Int = 8,
    ): Response<SuggestionsEnvelope>
}

/** Envelope of GET api/search/suggestions — { success, data }. */
@Immutable
@Serializable
data class SuggestionsEnvelope(
    val success: Boolean = false,
    val data: SuggestionsData? = null,
    val error: String? = null,
)

/** The route's data payload — four real sources, the web's exact shape. */
@Immutable
@Serializable
data class SuggestionsData(
    val products: List<SuggestionProductDto> = emptyList(),
    val categories: List<SuggestionCategoryDto> = emptyList(),
    val suppliers: List<SuggestionSupplierDto> = emptyList(),
    val fallbackSuggestions: List<String> = emptyList(),
)

/**
 * One suggested product — the route's exact select: id, name, basePrice,
 * thumbnailUrl, category { name }.
 */
@Immutable
@Serializable
data class SuggestionProductDto(
    val id: String? = null,
    val name: String? = null,
    val basePrice: Double? = null,
    val thumbnailUrl: String? = null,
    val category: SuggestionCategoryRefDto? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "suggestion-product-${hashCode()}"

    val effectiveId: String?
        get() = id?.takeIf(String::isNotBlank)

    val effectiveName: String?
        get() = name?.takeIf(String::isNotBlank)
}

/** The product suggestion's category projection — { name } only. */
@Immutable
@Serializable
data class SuggestionCategoryRefDto(val name: String? = null)

/** One suggested category — the route's exact select: id, name, slug. */
@Immutable
@Serializable
data class SuggestionCategoryDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "suggestion-category-${hashCode()}"

    val effectiveId: String?
        get() = id?.takeIf(String::isNotBlank)

    val effectiveName: String?
        get() = name?.takeIf(String::isNotBlank)
}

/** One suggested supplier — the route's exact select: id, companyName, ratingAvg. */
@Immutable
@Serializable
data class SuggestionSupplierDto(
    val id: String? = null,
    val companyName: String? = null,
    val ratingAvg: Double? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "suggestion-supplier-${hashCode()}"

    val effectiveId: String?
        get() = id?.takeIf(String::isNotBlank)

    val effectiveName: String?
        get() = companyName?.takeIf(String::isNotBlank)
}
