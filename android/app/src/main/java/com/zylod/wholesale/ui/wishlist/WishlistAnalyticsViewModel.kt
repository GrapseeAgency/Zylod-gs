package com.zylod.wholesale.ui.wishlist

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WishlistItemDto
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Wishlist-analytics VM (pageId wishlist-analytics). WEB TRUTH:
 * chunk-misc.ts:184 maps this pageId onto the SAME wishlist-page.tsx the
 * "wishlist" pageId uses — the tabbed stock book (All Items / In Stock /
 * Price Drop tabs, the four-way sort, per-row trash) — NOT a metrics
 * dashboard; no stats endpoint exists on the web and none is invented here.
 *
 * Wire: GET api/wishlist (the t233 [com.zylod.wholesale.data.api.WishlistApi]
 * accessor — never redeclared) for the list; DELETE api/wishlist/{itemId}
 * (WishlistItemApi) for the row trash — the web's own remove path
 * (wishlist-page.tsx:86), which targets the ROW id, unlike the t233
 * productId-based remove. Tab/sort are client-side (the web filters and
 * sorts its in-memory array; the route takes no such params). The
 * PRICE_DROP tab filters oldPrice > price and the wire never carries an
 * oldPrice — that tab honestly renders empty.
 *
 * AUTH: 401 → the web's sign-in gate. OFFLINE: last good rows in-memory,
 * then WishlistCacheKeys.WISHLIST_TABS, banner included.
 */
class WishlistAnalyticsViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(WishlistAnalyticsUiState())
    val state: StateFlow<WishlistAnalyticsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchInFlight = false

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in state (ComplaintsViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry pull / retry (called on EVERY entry — guard doctrine holds). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(loading = false, needsAuth = true)
            return
        }
        if (fetchInFlight) return
        _state.value = _state.value.copy(
            loading = _state.value.rows.isEmpty(),
            error = null,
            needsAuth = false,
            offline = false,
        )
        viewModelScope.launch { fetch() }
    }

    /** Same hook as ComplaintsViewModel.retry() — screens bind either name. */
    fun retry() = refresh()

    /** Stock tab tap — client-side filter (web parity, no re-fetch). */
    fun setTab(tab: String) = _state.update { it.copy(tab = tab) }

    /** Sort change — client-side sort (web parity, no re-fetch). */
    fun setSort(sort: String) = _state.update { it.copy(sort = sort) }

    fun consumeActionError() = _state.update { it.copy(actionError = null) }

    /**
     * The row trash (DELETE api/wishlist/{itemId}) — the web's handler has
     * NO confirm and removes the row from its local array on any 2xx; the
     * same here, with the verbatim failure text inline on anything else.
     */
    fun removeRow(rowId: String) {
        val s = _state.value
        if (s.removingId != null) return
        val target = s.rows.firstOrNull { it.id == rowId } ?: return
        _state.update {
            it.copy(
                removingId = rowId,
                rows = it.rows.filterNot { r -> r.id == rowId },
                actionError = null,
            )
        }
        viewModelScope.launch {
            try {
                Log.i(TAG, "remove wishlist row …${rowId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.wishlistItemApi(base).removeItem(rowId)
                if (response.isSuccessful && response.body()?.success == true) {
                    Log.i(TAG, "wishlist row removed")
                    _state.update { it.copy(removingId = null) }
                    persistCache()
                } else {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not remove the item (HTTP ${response.code()})"
                    Log.w(TAG, "remove failed: $message")
                    _state.update {
                        it.copy(
                            removingId = null,
                            rows = it.rows + target,
                            actionError = message,
                        )
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "remove failed: ${e.message}")
                _state.update {
                    it.copy(
                        removingId = null,
                        rows = it.rows + target,
                        actionError = "Network error while removing the item. Check your connection and retry.",
                    )
                }
            }
        }
    }

    private suspend fun fetch() {
        fetchInFlight = true
        try {
            Log.i(TAG, "fetch wishlist rows pageId=$pageId")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.wishlistApi(base).list(limit = 50)
            if (response.code() == 401 || response.code() == 403) {
                Log.w(TAG, "wishlist ${response.code()} — session gate")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            val envelope = response.body()
            val rows = envelope?.takeIf { it.success }?.data
            if (rows == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to fetch wishlist (HTTP ${response.code()})"
                Log.w(TAG, "wishlist error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "wishlist rows=${rows.size}")
            _state.value = _state.value.copy(
                loading = false,
                rows = rows,
                error = null,
                refreshError = null,
                offline = false,
            )
            persistCache()
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "wishlist fetch failed: ${e.message}")
            degrade("Network error while loading your wishlist. Check your connection and retry.")
        } finally {
            fetchInFlight = false
        }
    }

    /** Failure path: in-memory rows first, then the tabs disk cache. */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.rows.isNotEmpty()) {
            _state.value = s.copy(loading = false, offline = true, refreshError = message)
            return
        }
        val cached = withContext(Dispatchers.IO) {
            WishlistCacheStore.read(appContext, WishlistCacheKeys.WISHLIST_TABS, CachedWishlistRows.serializer())
        }
        val rows = cached?.rows.orEmpty()
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cached rows=${rows.size}")
            _state.value = _state.value.copy(loading = false, rows = rows, offline = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persistCache() {
        val rows: List<WishlistItemDto> = _state.value.rows
        viewModelScope.launch(Dispatchers.IO) {
            WishlistCacheStore.write(
                appContext,
                WishlistCacheKeys.WISHLIST_TABS,
                CachedWishlistRows.serializer(),
                CachedWishlistRows(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodWishlistAnalytics"
    }
}
