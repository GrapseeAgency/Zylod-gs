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
 * THE SEARCH DISCOVERY surfaces (t282) — the real routes behind the native
 * search screen's history/trending rails, verified against
 * src/app/api/search/history/route.ts and src/app/api/search/popular/route.ts
 * (the exact endpoints search-home-page.tsx:62/:77 fetch):
 *
 *  - GET api/search/history — AUTHENTICATED: the caller's searchHistory rows
 *    (searchedAt DESC, take 30) as raw rows {id, userId, query, searchedAt,…}.
 *    401 for guests — the native screen keeps its device-local recents in
 *    that case (the web renders an empty history list for guests; the local
 *    recents are the honest device-side equivalent, never mixed into the
 *    server rows).
 *  - DELETE api/search/history?term= — remove every row matching one query;
 *    no param clears the caller's whole history (200 { success, message }).
 *  - GET api/search/popular?limit=&category= — PUBLIC: popularSearches rows
 *    ordered trendingScore desc then searchCount desc, selected columns only.
 *    { success, data: [...], total }.
 *  - POST api/search/popular {query} — PUBLIC recording: upsert + increment.
 *    200 { success, data: { query, searchCount } } (the native fires this
 *    fire-and-forget on every explicit submit, web parity).
 *
 * DELIBERATE NON-DECLARATION: POST api/search/history does NOT exist (the
 * history route is GET/DELETE only — history rows are written server-side
 * elsewhere); nothing records through it.
 */
interface SearchDiscoveryApi {

    /** GET api/search/history — the signed-in caller's search rows. */
    @GET("api/search/history")
    suspend fun history(): Response<ApiEnvelope<List<SearchHistoryRowDto>>>

    /** DELETE api/search/history?term= — one query (no param = clear all). */
    @DELETE("api/search/history")
    suspend fun clearHistory(@Query("term") term: String? = null): Response<WishlistMessageEnvelope>

    /** GET api/search/popular?limit= — the trending searches (public). */
    @GET("api/search/popular")
    suspend fun popular(@Query("limit") limit: Int = 10): Response<PopularSearchesEnvelope>

    /** POST api/search/popular — record/increment one query (public). */
    @POST("api/search/popular")
    suspend fun recordPopular(@Body body: PopularSearchRecordBody): Response<PopularSearchRecordEnvelope>
}

/* ─── rows ───────────────────────────────────────────────────────────────── */

/**
 * One searchHistory row as GET api/search/history answers it — the raw
 * prisma row (the route returns the rows whole). Only the columns the
 * screen consumes are declared; ignoreUnknownKeys drops the rest.
 */
@Immutable
@Serializable
data class SearchHistoryRowDto(
    val id: String? = null,
    val query: String? = null,
    val searchedAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "search-history-${hashCode()}"

    /** The non-blank query text (blank rows are skipped by the mapper). */
    val effectiveQuery: String?
        get() = query?.takeIf(String::isNotBlank)
}

/** Envelope of GET api/search/popular — { success, data, total }. */
@Immutable
@Serializable
data class PopularSearchesEnvelope(
    val success: Boolean = false,
    val data: List<PopularSearchDto> = emptyList(),
    val total: Int = 0,
    val error: String? = null,
)

/**
 * One popularSearches row — the route's exact select (route.ts:21-29):
 * id, query, searchCount, clickCount, trendingScore, category,
 * lastSearchedAt.
 */
@Immutable
@Serializable
data class PopularSearchDto(
    val id: String? = null,
    val query: String? = null,
    val searchCount: Int = 0,
    val clickCount: Int = 0,
    val trendingScore: Double = 0.0,
    val category: String? = null,
    val lastSearchedAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "popular-search-${hashCode()}"

    /** The non-blank query text (blank rows are skipped by the mapper). */
    val effectiveQuery: String?
        get() = query?.takeIf(String::isNotBlank)
}

/** Outgoing POST api/search/popular body — { query } (always serialized). */
@Immutable
@Serializable
data class PopularSearchRecordBody(val query: String)

/** Envelope of the POST 200 — data echoes { query, searchCount }. */
@Immutable
@Serializable
data class PopularSearchRecordEnvelope(
    val success: Boolean = false,
    val data: PopularSearchRecordedData? = null,
    val error: String? = null,
)

/** The POST echo payload (upsert result projection). */
@Immutable
@Serializable
data class PopularSearchRecordedData(
    val query: String? = null,
    val searchCount: Int = 0,
)
