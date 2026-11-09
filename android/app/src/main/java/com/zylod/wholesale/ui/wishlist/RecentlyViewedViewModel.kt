package com.zylod.wholesale.ui.wishlist

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.RecentlyViewedRowDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * t282 — native Recently-Viewed VM (SPA pageIds "recently-viewed" and
 * "recently-viewed-products" — the web maps BOTH ids onto the same
 * recently-viewed-page component, chunk-misc.ts:251, so the native does the
 * same: both registry rows land here).
 *
 * Wire contract (RecentlyViewedApi): GET api/products/recently-viewed —
 * AUTHENTICATED, cursor envelope { success, data, meta: {count, hasMore,
 * nextCursor} }; DELETE api/products/recently-viewed?productId= removes one
 * row, no param clears ALL. Guests are 401 BY DESIGN (the route's own doc:
 * a client-side history would be a second source of truth) — so guests get
 * the soft in-screen sign-in CTA, never a fabricated list.
 *
 * Removal is optimistic with the WishlistViewModel's single-flight guard:
 * the row leaves the list at once and returns on failure. Clear-all wipes
 * the list and refetches on failure. Offline: last saved snapshot under
 * prefs "zylod_config"/"native_recently_viewed_cache" (the SessionManager
 * logout purge covers every native_* key — no cross-account leak).
 */
data class RecentlyViewedUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val items: List<RecentlyViewedRowDto> = emptyList(),
    val offline: Boolean = false,
    val error: String? = null,
    /** Product id currently being removed (progress on its row). */
    val removingId: String? = null,
    /** Clear-all in flight (the top-bar action shows progress, stays disabled). */
    val clearing: Boolean = false,
    /** meta.hasMore of the last successful page — shows Load More. */
    val hasMore: Boolean = false,
    /** True while a cursor page is loading (Load More shows progress). */
    val loadingMore: Boolean = false,
)

@Serializable
private data class RecentlyViewedSnapshot(val items: List<RecentlyViewedRowDto> = emptyList())

class RecentlyViewedViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(RecentlyViewedUiState())
    val state: StateFlow<RecentlyViewedUiState> = _state.asStateFlow()

    private var api: com.zylod.wholesale.data.api.RecentlyViewedApi? = null
    private var nextCursor: String? = null

    /** Entry pull / retry (t208 parity: called on EVERY entry). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = RecentlyViewedUiState(loading = false, needsAuth = true)
            return
        }
        val hasData = _state.value.items.isNotEmpty()
        nextCursor = null
        _state.update { it.copy(loading = !hasData, error = null, needsAuth = false) }
        viewModelScope.launch { fetch() }
    }

    /** Cursor pagination — appends the next page when meta says there is one. */
    fun loadMore() {
        val s = _state.value
        if (s.loadingMore || s.loading || !s.hasMore || nextCursor.isNullOrBlank()) return
        _state.update { it.copy(loadingMore = true) }
        viewModelScope.launch { fetch(nextCursor) }
    }

    fun remove(productId: String) {
        // Same-frame double-tap guard (the WishlistViewModel t280 4-a#5 lesson).
        if (_state.value.removingId != null) return
        _state.update { it.copy(removingId = productId) }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val client = api ?: ApiClient.recentlyViewedApi(baseUrl).also { api = it }
                val response = client.remove(productId = productId)
                if (response.isSuccessful) {
                    _state.update { st ->
                        st.copy(
                            items = st.items.filterNot { it.effectiveProductId == productId },
                            removingId = null,
                        )
                    }
                    persist(_state.value.items)
                } else {
                    _state.update { it.copy(removingId = null, offline = true) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(removingId = null, offline = true) }
            }
        }
    }

    /** DELETE without productId — the route clears the caller's ENTIRE history. */
    fun clearAll() {
        val s = _state.value
        if (s.clearing || s.items.isEmpty()) return
        _state.update { it.copy(clearing = true) }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val client = api ?: ApiClient.recentlyViewedApi(baseUrl).also { api = it }
                val response = client.remove(productId = null)
                if (response.isSuccessful) {
                    nextCursor = null
                    _state.update { it.copy(items = emptyList(), clearing = false, hasMore = false) }
                    persist(emptyList())
                } else {
                    _state.update { it.copy(clearing = false, offline = true) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(clearing = false, offline = true) }
            }
        }
    }

    private suspend fun fetch(cursor: String? = null) {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.recentlyViewedApi(baseUrl).also { api = it }
            val response = client.list(limit = PAGE_SIZE, cursor = cursor)
            if (response.code() == 401) {
                _state.value = RecentlyViewedUiState(loading = false, needsAuth = true)
                return
            }
            val envelope = response.body()
            val rows = envelope?.takeIf { it.success }?.data.orEmpty()
            if (envelope == null || (!envelope.success && rows.isEmpty())) {
                degrade("Server error — your viewing history is temporarily unavailable.")
                return
            }
            nextCursor = envelope?.meta?.nextCursor?.takeIf(String::isNotBlank)
            _state.update { st ->
                st.copy(
                    loading = false,
                    loadingMore = false,
                    items = if (cursor.isNullOrBlank()) rows else st.items + rows,
                    hasMore = envelope?.meta?.hasMore ?: false,
                    offline = false,
                    error = null,
                )
            }
            if (cursor.isNullOrBlank()) persist(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "recently-viewed refresh failed: ${e.message}")
            if (cursor.isNullOrBlank()) {
                degrade("Network error — check your connection and retry.")
            } else {
                _state.update { it.copy(loadingMore = false, offline = true) }
            }
        }
    }

    private suspend fun degrade(message: String) {
        val inMemory = _state.value.items
        if (inMemory.isNotEmpty()) {
            _state.update { it.copy(loading = false, loadingMore = false, offline = true, error = null) }
            return
        }
        val saved = withContext(Dispatchers.IO) { readSnapshot() }
        if (saved != null && saved.items.isNotEmpty()) {
            _state.value = RecentlyViewedUiState(loading = false, items = saved.items, offline = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persist(rows: List<RecentlyViewedRowDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val raw = ApiClient.json.encodeToString(RecentlyViewedSnapshot.serializer(), RecentlyViewedSnapshot(rows))
                appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, raw).apply()
            }.onFailure { Log.w(TAG, "recently-viewed cache write failed: ${it.message}") }
        }
    }

    private fun readSnapshot(): RecentlyViewedSnapshot? = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return null
        ApiClient.json.decodeFromString(RecentlyViewedSnapshot.serializer(), raw)
    }.onFailure { Log.w(TAG, "recently-viewed cache read failed: ${it.message}") }.getOrNull()

    private companion object {
        const val TAG = "ZylodRecentlyViewed"
        const val PREFS = "zylod_config"
        const val KEY = "native_recently_viewed_cache"
        const val PAGE_SIZE = 20
    }
}
