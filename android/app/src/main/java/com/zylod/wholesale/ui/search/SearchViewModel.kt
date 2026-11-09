package com.zylod.wholesale.ui.search

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CategoryDto
import com.zylod.wholesale.data.api.ProductDto
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * t233 — native Search VM (SPA pageIds "search" / "search-home" /
 * "search-results" / "global-search" all land here through
 * RouteOwnership's native-first resolution).
 *
 * Live results: GET api/products?search=<q>&page=N (the web endpoint's own
 * contract) with a 300 ms debounce, keyed-dedup append and pagination guards.
 *
 * t282 — the web search surface's discovery rails are here too:
 *  - SORT: the endpoint's own sortBy/sortOrder fields (search-results-page
 *    contract: src/app/api/products/route.ts ALLOWED_SORT_FIELDS). Default
 *    is Newest (createdAt desc) — the web route's own default; Best
 *    selling (soldCount desc) keeps its one-tap slot.
 *  - CATEGORY: real category chips from GET api/categories, passed as the
 *    endpoint's category= filter (GenericCategoryPage parity).
 *  - SERVER HISTORY: GET api/search/history for signed-in buyers
 *    (search-home-page.tsx:62), per-term DELETE ?term= and clear-all —
 *    guests keep the device-local recents only (the history route 401s
 *    guests by design; the local list is the honest device-side stand-in).
 *  - TRENDING: GET api/search/popular?limit=10 (search-home-page.tsx:77) —
 *    public, rendered as tap-to-search chips; every explicit submit also
 *    records through POST api/search/popular (web parity, fire-and-forget).
 *
 * Recent searches persist under prefs "zylod_config"/"native_search_recent"
 * (owned by this VM, capped at 8). Offline: the last successful result page
 * stays mounted and the state flips `offline`; with nothing yet, the honest
 * empty state shows — a search page has nothing to fabricate.
 */
data class SearchSort(val field: String, val order: String, val label: String) {
    companion object {
        /** The five REAL sort fields the endpoint accepts (ALLOWED_SORT_FIELDS). */
        val OPTIONS = listOf(
            SearchSort("createdAt", "desc", "Newest"),
            SearchSort("soldCount", "desc", "Best selling"),
            SearchSort("basePrice", "asc", "Price ↑"),
            SearchSort("basePrice", "desc", "Price ↓"),
            SearchSort("ratingAvg", "desc", "Top rated"),
        )
    }
}

data class SearchUiState(
    val query: String = "",
    val searching: Boolean = false,
    val results: List<ProductDto> = emptyList(),
    val recent: List<String> = emptyList(),
    val page: Int = 0,
    val totalPages: Int = 1,
    val loadingMore: Boolean = false,
    val canLoadMore: Boolean = false,
    val offline: Boolean = false,
    val searchedQuery: String = "",
    // t282 — discovery rails.
    val sort: SearchSort = SearchSort.OPTIONS.first(),
    val category: String? = null,
    val categories: List<CategoryDto> = emptyList(),
    /** Server history rows (signed-in buyers) — device-local recents stay separate. */
    val serverHistory: List<String> = emptyList(),
    val serverHistoryLoading: Boolean = false,
    /** Popular searches (public) — tap-to-search chips. */
    val popular: List<String> = emptyList(),
    /** The term currently being deleted from server history. */
    val deletingTerm: String? = null,
)

@Serializable
private data class RecentQueries(val items: List<String> = emptyList())

class SearchViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState(recent = readRecent()))
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    private var api: com.zylod.wholesale.data.api.ZylodApi? = null
    private var discoveryApi: com.zylod.wholesale.data.api.SearchDiscoveryApi? = null
    private var debounceJob: Job? = null
    private var appendJob: Job? = null
    // t279 — the page-1 fetch job itself: submit/refresh used to relaunch
    // searchNow UNTRACKED, so two page-1 fetches could race on a slow network
    // and the OLDER response could land last — shoe-results rendered under
    // the "shoesh" query, then loadMore appended page 2 of the NEW query onto
    // the OLD rows (a mixed list). One tracked job; relaunch cancels it.
    private var searchJob: Job? = null
    private var discoveryLoaded = false

    init {
        // Discovery rails load once per VM (public endpoints + optional
        // history) — never block the first keystroke on them.
        viewModelScope.launch { loadDiscovery() }
    }

    private suspend fun loadDiscovery() {
        if (discoveryLoaded) return
        discoveryLoaded = true
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.create(baseUrl, appContext).also { api = it }
            val categoriesEnvelope = client.categories()
            val cats = categoriesEnvelope.data.orEmpty()
            _state.update { it.copy(categories = cats) }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "search categories failed: ${e.message}")
        }
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val discovery = discoveryApi
                ?: ApiClient.searchDiscoveryApi(baseUrl).also { discoveryApi = it }
            val popularEnvelope = discovery.popular(limit = 10)
            val queries = popularEnvelope.takeIf { it.success }?.data
                .orEmpty()
                .mapNotNull { it.effectiveQuery }
                .distinct()
            _state.update { it.copy(popular = queries) }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "search popular failed: ${e.message}")
        }
        loadServerHistory()
    }

    /** GET api/search/history — signed-in buyers only (guests 401 by design). */
    private fun loadServerHistory() {
        if (com.zylod.wholesale.data.session.SessionManager.token() == null) return
        _state.update { it.copy(serverHistoryLoading = true) }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val discovery = discoveryApi
                    ?: ApiClient.searchDiscoveryApi(baseUrl).also { discoveryApi = it }
                val response = discovery.history()
                if (response.isSuccessful) {
                    val rows = response.body()?.takeIf { it.success }?.data.orEmpty()
                    val queries = rows.mapNotNull { it.effectiveQuery }.distinct().take(12)
                    _state.update { it.copy(serverHistory = queries, serverHistoryLoading = false) }
                } else {
                    _state.update { it.copy(serverHistoryLoading = false) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "search history failed: ${e.message}")
                _state.update { it.copy(serverHistoryLoading = false) }
            }
        }
    }

    /** DELETE api/search/history?term= — optimistic per-row removal. */
    fun removeServerHistory(term: String) {
        // t280 4-a#5: same-frame double-tap guard.
        if (_state.value.deletingTerm != null) return
        _state.update { it.copy(deletingTerm = term) }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val discovery = discoveryApi
                    ?: ApiClient.searchDiscoveryApi(baseUrl).also { discoveryApi = it }
                val response = discovery.clearHistory(term = term)
                if (response.isSuccessful) {
                    _state.update {
                        it.copy(
                            deletingTerm = null,
                            serverHistory = it.serverHistory.filterNot { q -> q.equals(term, ignoreCase = true) },
                        )
                    }
                } else {
                    _state.update { it.copy(deletingTerm = null) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(deletingTerm = null) }
            }
        }
    }

    /** DELETE api/search/history (no term) — clear the whole server history. */
    fun clearServerHistory() {
        if (_state.value.deletingTerm != null) return
        _state.update { it.copy(deletingTerm = "") }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val discovery = discoveryApi
                    ?: ApiClient.searchDiscoveryApi(baseUrl).also { discoveryApi = it }
                val response = discovery.clearHistory(term = null)
                if (response.isSuccessful) {
                    _state.update { it.copy(deletingTerm = null, serverHistory = emptyList()) }
                } else {
                    _state.update { it.copy(deletingTerm = null) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(deletingTerm = null) }
            }
        }
    }

    fun onQueryChange(query: String) {
        _state.update { it.copy(query = query, offline = false) }
        debounceJob?.cancel()
        if (query.isBlank()) {
            _state.update { it.copy(searching = false, results = emptyList(), searchedQuery = "", canLoadMore = false, page = 0) }
            return
        }
        debounceJob = viewModelScope.launch {
            delay(300)
            searchNow(query.trim())
        }
    }

    /** Explicit submit (keyboard action / recent-chip tap). */
    fun submit(query: String) {
        _state.update { it.copy(query = query) }
        debounceJob?.cancel()
        val trimmed = query.trim()
        if (trimmed.isEmpty()) return
        rememberRecent(trimmed)
        recordPopular(trimmed)
        searchJob?.cancel()
        searchJob = viewModelScope.launch { searchNow(trimmed) }
    }

    /**
     * POST api/search/popular {query} — fire-and-forget trending recording
     * (the web's public route; failures never disturb the search).
     */
    private fun recordPopular(query: String) {
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val discovery = discoveryApi
                    ?: ApiClient.searchDiscoveryApi(baseUrl).also { discoveryApi = it }
                discovery.recordPopular(
                    com.zylod.wholesale.data.api.PopularSearchRecordBody(query = query),
                )
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                // fire-and-forget — web parity
            }
        }
    }

    /** Sort chip tap — re-runs the live search under the new sort. */
    fun setSort(sort: SearchSort) {
        if (_state.value.sort == sort) return
        _state.update { it.copy(sort = sort) }
        val q = _state.value.searchedQuery.ifBlank { _state.value.query }.trim()
        if (q.isNotEmpty()) {
            searchJob?.cancel()
            searchJob = viewModelScope.launch { searchNow(q) }
        }
    }

    /** Category chip tap — re-runs the live search under the new filter. */
    fun setCategory(category: String?) {
        if (_state.value.category == category) return
        _state.update { it.copy(category = category) }
        val q = _state.value.searchedQuery.ifBlank { _state.value.query }.trim()
        if (q.isNotEmpty()) {
            searchJob?.cancel()
            searchJob = viewModelScope.launch { searchNow(q) }
        }
    }

    fun loadMore() {
        val s = _state.value
        if (s.searching || s.loadingMore || s.page == 0 || s.page >= s.totalPages) return
        appendJob?.cancel()
        appendJob = viewModelScope.launch { fetchPage(s.searchedQuery, s.page + 1, replace = false) }
    }

    fun refresh() {
        val q = _state.value.searchedQuery.ifBlank { _state.value.query }
        if (q.isNotBlank()) {
            searchJob?.cancel()
            searchJob = viewModelScope.launch { searchNow(q) }
        } else {
            discoveryLoaded = false
            viewModelScope.launch { loadDiscovery() }
        }
    }

    private suspend fun searchNow(query: String) {
        _state.update { it.copy(searching = true, offline = false, searchedQuery = query) }
        fetchPage(query, 1, replace = true)
    }

    private suspend fun fetchPage(query: String, pageNumber: Int, replace: Boolean) {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.create(baseUrl, appContext).also { api = it }
            val sort = _state.value.sort
            val category = _state.value.category
            val envelope = client.products(
                sortBy = sort.field,
                sortOrder = sort.order,
                search = query,
                page = pageNumber,
                category = category,
            )
            envelope.pagination?.let {
                _state.update { st -> st.copy(page = it.page, totalPages = it.totalPages) }
            }
            val incoming = envelope.data.orEmpty().filter { it.id.isNotBlank() }
            val merged = if (replace) incoming else {
                val seen = _state.value.results.mapTo(HashSet()) { it.id }
                _state.value.results + incoming.filter { seen.add(it.id) }
            }
            _state.update {
                it.copy(
                    searching = false,
                    loadingMore = false,
                    results = merged,
                    offline = false,
                    canLoadMore = _state.value.page < _state.value.totalPages,
                )
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "search failed: ${e.message}")
            if (pageNumber == 1) {
                _state.update { it.copy(searching = false, offline = it.results.isNotEmpty()) }
            } else {
                _state.update { it.copy(loadingMore = false, offline = true, canLoadMore = false) }
            }
        }
    }

    private fun rememberRecent(query: String) {
        val next = listOf(query) + _state.value.recent.filter { it != query }
        val capped = next.take(8)
        _state.update { it.copy(recent = capped) }
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val raw = ApiClient.json.encodeToString(RecentQueries.serializer(), RecentQueries(capped))
                appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, raw).apply()
            }
        }
    }

    private fun readRecent(): List<String> = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return emptyList()
        ApiClient.json.decodeFromString(RecentQueries.serializer(), raw).items
    }.getOrDefault(emptyList())

    private companion object {
        const val TAG = "ZylodSearch"
        const val PREFS = "zylod_config"
        const val KEY = "native_search_recent"
    }
}
