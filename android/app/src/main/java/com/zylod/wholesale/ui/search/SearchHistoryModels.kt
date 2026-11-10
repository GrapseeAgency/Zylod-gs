package com.zylod.wholesale.ui.search

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.PopularSearchDto
import com.zylod.wholesale.data.api.SearchHistoryRowDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * Typed domain layer for the native Search History / Recently Searched /
 * Trending Searches / Popular Searches screens (t301). PURE KOTLIN — no
 * Android imports beyond logging: the mappers run on the verified wire DTOs
 * declared in SearchDiscoveryApi.kt, and the offline snapshots store the
 * DOMAIN rows (byte-consistent with the online render — CouponsModels
 * doctrine).
 */

/** One server searchHistory row (GET api/search/history). */
@Serializable
data class SearchHistoryRow(
    val id: String,
    val query: String,
    val searchedAt: String?,
) {
    val stableKey: String
        get() = id.ifBlank { "history-${hashCode()}" }
}

/** One popularSearches row (GET api/search/popular?limit=40). */
@Serializable
data class PopularSearchRow(
    val id: String,
    val query: String,
    val searchCount: Int,
    val clickCount: Int,
    val trendingScore: Double,
    val category: String?,
    val lastSearchedAt: String?,
) {
    val stableKey: String
        get() = id.ifBlank { "popular-${hashCode()}" }
}

fun SearchHistoryRowDto.toRow(): SearchHistoryRow? {
    val q = effectiveQuery ?: return null
    return SearchHistoryRow(
        id = id?.takeIf(String::isNotBlank) ?: stableKey,
        query = q,
        searchedAt = searchedAt,
    )
}

fun PopularSearchDto.toRow(): PopularSearchRow? {
    val q = effectiveQuery ?: return null
    return PopularSearchRow(
        id = id?.takeIf(String::isNotBlank) ?: stableKey,
        query = q,
        searchCount = searchCount,
        clickCount = clickCount,
        trendingScore = trendingScore,
        category = category?.takeIf(String::isNotBlank),
        lastSearchedAt = lastSearchedAt,
    )
}

/** Offline snapshots — one prefs file, two keys (house "native_*_cache"). */
@Serializable
data class SearchHistoryCacheEnvelope(
    val savedAt: Long = 0L,
    val history: List<SearchHistoryRow> = emptyList(),
)

@Serializable
data class PopularSearchCacheEnvelope(
    val savedAt: Long = 0L,
    val popular: List<PopularSearchRow> = emptyList(),
)

object SearchDiscoveryCacheStore {
    private const val TAG = "ZylodSearchHistory"
    private const val PREFS = "zylod_config"
    private const val HISTORY_KEY = "native_search_history_cache"
    private const val POPULAR_KEY = "native_search_popular_cache"

    fun readHistory(context: Context): SearchHistoryCacheEnvelope? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(HISTORY_KEY, null) ?: return null
        ApiClient.json.decodeFromString(SearchHistoryCacheEnvelope.serializer(), raw)
    }.onFailure { Log.w(TAG, "history cache read failed: ${it.message}") }.getOrNull()

    fun writeHistory(context: Context, envelope: SearchHistoryCacheEnvelope) {
        runCatching {
            val raw = ApiClient.json.encodeToString(SearchHistoryCacheEnvelope.serializer(), envelope)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(HISTORY_KEY, raw).apply()
        }.onFailure { Log.w(TAG, "history cache write failed: ${it.message}") }
    }

    fun readPopular(context: Context): PopularSearchCacheEnvelope? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(POPULAR_KEY, null) ?: return null
        ApiClient.json.decodeFromString(PopularSearchCacheEnvelope.serializer(), raw)
    }.onFailure { Log.w(TAG, "popular cache read failed: ${it.message}") }.getOrNull()

    fun writePopular(context: Context, envelope: PopularSearchCacheEnvelope) {
        runCatching {
            val raw = ApiClient.json.encodeToString(PopularSearchCacheEnvelope.serializer(), envelope)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(POPULAR_KEY, raw).apply()
        }.onFailure { Log.w(TAG, "popular cache write failed: ${it.message}") }
    }
}
