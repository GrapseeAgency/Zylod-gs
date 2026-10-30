package com.zylod.wholesale.ui.search

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
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
 * Recent searches persist under prefs "zylod_config"/"native_search_recent"
 * (owned by this VM, capped at 8). Offline: the last successful result page
 * stays mounted and the state flips `offline`; with nothing yet, the honest
 * empty state shows — a search page has nothing to fabricate.
 */
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
)

@Serializable
private data class RecentQueries(val items: List<String> = emptyList())

class SearchViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SearchUiState(recent = readRecent()))
    val state: StateFlow<SearchUiState> = _state.asStateFlow()

    private var api: com.zylod.wholesale.data.api.ZylodApi? = null
    private var debounceJob: Job? = null
    private var appendJob: Job? = null

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
        viewModelScope.launch { searchNow(trimmed) }
    }

    fun loadMore() {
        val s = _state.value
        if (s.searching || s.loadingMore || s.page == 0 || s.page >= s.totalPages) return
        appendJob?.cancel()
        appendJob = viewModelScope.launch { fetchPage(s.searchedQuery, s.page + 1, replace = false) }
    }

    fun refresh() {
        val q = _state.value.searchedQuery.ifBlank { _state.value.query }
        if (q.isNotBlank()) viewModelScope.launch { searchNow(q) }
    }

    private suspend fun searchNow(query: String) {
        _state.update { it.copy(searching = true, offline = false, searchedQuery = query) }
        fetchPage(query, 1, replace = true)
    }

    private suspend fun fetchPage(query: String, pageNumber: Int, replace: Boolean) {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.create(baseUrl, appContext).also { api = it }
            val envelope = client.products(search = query, page = pageNumber)
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
