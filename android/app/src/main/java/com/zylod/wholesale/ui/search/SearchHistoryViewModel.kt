package com.zylod.wholesale.ui.search

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
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
 * Native Search History VM (t301) — ONE pageId-keyed VM behind the four
 * seed-stub pageIds, wire-exact with the web pages they serve:
 *
 *  - HISTORY mode ("search-history", "recently-searched" — the web's
 *    search-history-page / recently-searched-page):
 *      · signed in: GET api/search/history rows, DELETE api/search/history?term=
 *        per row, DELETE api/search/history (clear all);
 *      · GUESTS: the web page does NOT gate — it falls back to the browser's
 *        device-local recents. The native fallback reads the SAME device
 *        store the search home writes ("zylod_config"/"native_search_recent",
 *        SearchViewModel's RecentQueries JSON), and deletes mutate it
 *        locally — no fake server rows, no hard sign-in wall.
 *  - POPULAR mode ("trending-searches", "popular-searches" — the web's
 *    popular-searches-page): GET api/search/popular?limit=40 (public), the
 *    page's own slice(0, 30), category chips filtered from the rows' own
 *    category values, tap → search-results.
 *
 * Doctrine: optimistic delete with rollback on failure; offline renders the
 * saved rows under the warning banner; the ONE page-level loader is the M3
 * spinner; the UI never invents data — every row comes from the wire, the
 * device store, or the saved cache.
 */
enum class SearchHistoryMode { HISTORY, POPULAR }

data class SearchHistoryUiState(
    val loading: Boolean = true,
    /** HISTORY rows (signed in) — empty for guests (they see localRecent). */
    val history: List<SearchHistoryRow> = emptyList(),
    /** Device-local recents (guests — the web's device-local fallback). */
    val localRecent: List<String> = emptyList(),
    /** POPULAR rows (public), already sliced to the web page's 30. */
    val popular: List<PopularSearchRow> = emptyList(),
    /** Distinct row categories for the popular filter chips. */
    val popularCategories: List<String> = emptyList(),
    val selectedCategory: String? = null,
    /** query text of the row being deleted (optimistic, rollback-safe). */
    val deletingTerm: String? = null,
    val clearingAll: Boolean = false,
    val offline: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved cache). */
    val error: String? = null,
) {
    /** The rows actually shown after the category filter (POPULAR mode). */
    val visiblePopular: List<PopularSearchRow>
        get() = if (selectedCategory == null) popular
        else popular.filter { it.category == selectedCategory }

    val hasContent: Boolean
        get() = history.isNotEmpty() || localRecent.isNotEmpty() || popular.isNotEmpty()
}

class SearchHistoryViewModel(
    private val appContext: Context,
    pageId: String,
) : ViewModel() {

    private val mode: SearchHistoryMode =
        if (pageId == "trending-searches" || pageId == "popular-searches") {
            SearchHistoryMode.POPULAR
        } else {
            SearchHistoryMode.HISTORY
        }

    private val _state = MutableStateFlow(SearchHistoryUiState())
    val state: StateFlow<SearchHistoryUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    /** Which surface owns the deletion — wired by the screen. */
    val isPopularMode: Boolean get() = mode == SearchHistoryMode.POPULAR

    fun refresh() {
        val s = _state.value
        if (s.deletingTerm != null || s.clearingAll) return // a mutation is in flight
        if (s.loading && s.hasContent) return
        _state.value = s.copy(loading = !s.hasContent, offline = false, error = null)
        viewModelScope.launch {
            if (mode == SearchHistoryMode.POPULAR) fetchPopular() else fetchHistory()
        }
    }

    fun retry() = refresh()

    // ── HISTORY mode ────────────────────────────────────────────────────────

    private suspend fun fetchHistory() {
        val signedIn = SessionManager.token() != null
        // Guests: the device-local fallback the search home already writes —
        // exactly the web page's unauthenticated rows.
        if (!signedIn) {
            val local = withContext(Dispatchers.IO) { readLocalRecent(appContext) }
            _state.value = _state.value.copy(
                loading = false,
                localRecent = local,
                history = emptyList(),
                offline = false,
                error = if (local.isEmpty()) "No searches on this device yet." else null,
            )
            return
        }
        try {
            Log.i(TAG, "fetchHistory")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.searchDiscoveryApi(base).history()
            if (!response.isSuccessful) {
                degradeHistory("Could not load your search history (HTTP ${response.code()})")
                return
            }
            val body = response.body()?.takeIf { it.success }
            val rows = body?.data.orEmpty().mapNotNull { it.toRow() }
            Log.i(TAG, "history http=${response.code()} rows=${rows.size}")
            _state.value = _state.value.copy(
                loading = false,
                history = rows,
                localRecent = emptyList(),
                offline = false,
                error = null,
            )
            withContext(Dispatchers.IO) {
                SearchDiscoveryCacheStore.writeHistory(
                    appContext,
                    SearchHistoryCacheEnvelope(savedAt = System.currentTimeMillis(), history = rows),
                )
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "fetchHistory failed: ${e.message}")
            degradeHistory("Network error while loading your search history. Check your connection and retry.")
        }
    }

    /**
     * Delete one row (the web page's per-row ✕). Signed in: DELETE
     * api/search/history?term=<query> — optimistic row removal, rolled back
     * if the call fails. Guests: the same deletion on the device store.
     */
    fun deleteTerm(term: String) {
        val s = _state.value
        if (s.deletingTerm != null || s.clearingAll) return
        _state.value = s.copy(deletingTerm = term)
        if (SessionManager.token() == null) {
            // Guest path — device-local list edit, persisted synchronously.
            viewModelScope.launch(Dispatchers.IO) {
                val remaining = readLocalRecent(appContext).filterNot { it == term }
                writeLocalRecent(appContext, remaining)
                _state.value = _state.value.copy(
                    deletingTerm = null,
                    localRecent = remaining,
                    error = if (remaining.isEmpty()) "No searches on this device yet." else null,
                )
            }
            return
        }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.searchDiscoveryApi(base).clearHistory(term = term)
                if (!response.isSuccessful) {
                    Log.w(TAG, "delete ${response.code()}")
                    _state.value = _state.value.copy(deletingTerm = null) // rollback = keep the row
                    return@launch
                }
                val current = _state.value
                val remaining = current.history.filterNot { it.query == term }
                _state.value = current.copy(deletingTerm = null, history = remaining)
                withContext(Dispatchers.IO) {
                    SearchDiscoveryCacheStore.writeHistory(
                        appContext,
                        SearchHistoryCacheEnvelope(savedAt = System.currentTimeMillis(), history = remaining),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "delete failed: ${e.message}")
                _state.value = _state.value.copy(deletingTerm = null)
            }
        }
    }

    /** Clear every row (the web page's Clear All). Same guest/auth split. */
    fun clearAll() {
        val s = _state.value
        if (s.deletingTerm != null || s.clearingAll) return
        _state.value = s.copy(clearingAll = true)
        if (SessionManager.token() == null) {
            viewModelScope.launch(Dispatchers.IO) {
                writeLocalRecent(appContext, emptyList())
                _state.value = _state.value.copy(
                    clearingAll = false,
                    localRecent = emptyList(),
                    error = "No searches on this device yet.",
                )
            }
            return
        }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.searchDiscoveryApi(base).clearHistory(term = null)
                if (!response.isSuccessful) {
                    Log.w(TAG, "clearAll ${response.code()}")
                    _state.value = _state.value.copy(clearingAll = false)
                    return@launch
                }
                _state.value = _state.value.copy(clearingAll = false, history = emptyList())
                withContext(Dispatchers.IO) {
                    SearchDiscoveryCacheStore.writeHistory(
                        appContext,
                        SearchHistoryCacheEnvelope(savedAt = System.currentTimeMillis(), history = emptyList()),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "clearAll failed: ${e.message}")
                _state.value = _state.value.copy(clearingAll = false)
            }
        }
    }

    // ── POPULAR mode ────────────────────────────────────────────────────────

    private suspend fun fetchPopular() {
        try {
            Log.i(TAG, "fetchPopular")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.searchDiscoveryApi(base).popular(limit = POPULAR_LIMIT)
            if (!response.isSuccessful) {
                degradePopular("Could not load trending searches (HTTP ${response.code()})")
                return
            }
            val body = response.body()?.takeIf { it.success }
            // The web page slices its own 30 out of the limit=40 fetch.
            val rows = body?.data.orEmpty().mapNotNull { it.toRow() }.take(POPULAR_SLICE)
            Log.i(TAG, "popular http=${response.code()} rows=${rows.size}")
            _state.value = _state.value.copy(
                loading = false,
                popular = rows,
                popularCategories = rows.mapNotNull { it.category }.distinct(),
                offline = false,
                error = null,
            )
            withContext(Dispatchers.IO) {
                SearchDiscoveryCacheStore.writePopular(
                    appContext,
                    PopularSearchCacheEnvelope(savedAt = System.currentTimeMillis(), popular = rows),
                )
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "fetchPopular failed: ${e.message}")
            degradePopular("Network error while loading trending searches. Check your connection and retry.")
        }
    }

    /** Popular category chip (the web page's own filter, row-scoped). */
    fun selectCategory(category: String?) {
        _state.value = _state.value.copy(selectedCategory = category)
    }

    // ── Shared degrade paths ────────────────────────────────────────────────

    private suspend fun degradeHistory(message: String) {
        val cached = withContext(Dispatchers.IO) { SearchDiscoveryCacheStore.readHistory(appContext) }
        val signedIn = SessionManager.token() != null
        if (cached != null && cached.history.isNotEmpty() && signedIn) {
            _state.value = _state.value.copy(
                loading = false, history = cached.history, offline = true,
            )
        } else if (!signedIn) {
            // Guests still get their device-local rows even offline.
            val local = withContext(Dispatchers.IO) { readLocalRecent(appContext) }
            _state.value = _state.value.copy(
                loading = false, localRecent = local, offline = local.isNotEmpty(),
                error = if (local.isEmpty()) message else null,
            )
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private suspend fun degradePopular(message: String) {
        val cached = withContext(Dispatchers.IO) { SearchDiscoveryCacheStore.readPopular(appContext) }
        if (cached != null && cached.popular.isNotEmpty()) {
            _state.value = _state.value.copy(
                loading = false,
                popular = cached.popular,
                popularCategories = cached.popular.mapNotNull { it.category }.distinct(),
                offline = true,
            )
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    // ── Device-local recents (SearchViewModel's own store, read-only twin) ──

    @Serializable
    private data class RecentQueries(val items: List<String> = emptyList())

    private fun readLocalRecent(context: Context): List<String> = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(RECENT_KEY, null) ?: return emptyList()
        ApiClient.json.decodeFromString(RecentQueries.serializer(), raw).items
    }.getOrDefault(emptyList())

    private fun writeLocalRecent(context: Context, items: List<String>) {
        runCatching {
            val raw = ApiClient.json.encodeToString(RecentQueries.serializer(), RecentQueries(items))
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(RECENT_KEY, raw).apply()
        }.onFailure { Log.w(TAG, "local recent write failed: ${it.message}") }
    }

    companion object {
        private const val TAG = "ZylodSearchHistory"
        private const val PREFS = "zylod_config"
        private const val RECENT_KEY = "native_search_recent"
        private const val POPULAR_LIMIT = 40 // the web page's ?limit=40 fetch
        private const val POPULAR_SLICE = 30 // the web page's .slice(0, 30)
    }
}
