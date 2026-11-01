package com.zylod.wholesale.ui.wishlist

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.SavedSearchDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Saved-searches VM (pageId saved-searches — saved-searches-page.tsx's
 * exact wire contract, SavedSearchesApi):
 *
 *  - GET api/search/saved — auth OPTIONAL on the route: signed-in renders
 *    the user's own rows + the public isDefault ones, signed-out renders
 *    ONLY the public defaults. The native therefore NEVER gates on the
 *    session — the fetch fires signed-out exactly like the web's
 *    header-less fetch.
 *  - DELETE api/search/saved/{id} — owner-scoped (401 'Authentication
 *    required' for guests). DOCUMENTED DEVIATION: the web drops the row
 *    from its local array without even reading the response status — the
 *    native restores the row on ANY failure and surfaces the route's
 *    verbatim error inline instead of silently losing it.
 *  - The web's "Alert" button is a LOCAL toast (no endpoint exists for
 *    search alerts on this surface) — the same local confirmation here,
 *    text verbatim, never a fabricated server call.
 *  - POST api/search/saved is real but the web page never calls it
 *    (creation lives on the search page) — undeclared, see WishlistApi.kt.
 *
 * OFFLINE: last good rows in-memory, then WishlistCacheKeys.SAVED_SEARCHES.
 */
class SavedSearchesViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(SavedSearchesUiState())
    val state: StateFlow<SavedSearchesUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchInFlight = false

    /** Entry pull / retry (called on EVERY entry — guard doctrine holds). */
    fun refresh() {
        if (fetchInFlight) return
        _state.value = _state.value.copy(
            loading = _state.value.rows.isEmpty(),
            error = null,
        )
        viewModelScope.launch { fetch() }
    }

    /** Same hook as ComplaintsViewModel.retry() — screens bind either name. */
    fun retry() = refresh()

    fun consumeActionError() = _state.update { it.copy(actionError = null) }

    fun consumeAlertMessage() = _state.update { it.copy(alertMessage = null) }

    /** The web's local Alert toast — verbatim text, no server call. */
    fun enableAlert(name: String) {
        _state.update {
            it.copy(alertMessage = "Alert enabled — You'll be notified when new matches appear for \"$name\".")
        }
    }

    /**
     * Deletes a saved search (DELETE api/search/saved/{id}) with the
     * optimistic row removal; ANY failure restores the row and surfaces the
     * verbatim route error (see the documented deviation above).
     */
    fun deleteSearch(rowId: String) {
        val s = _state.value
        if (s.deletingId != null) return
        val target = s.rows.firstOrNull { it.stableKey == rowId } ?: return
        _state.update {
            it.copy(
                deletingId = rowId,
                rows = it.rows.filterNot { r -> r.stableKey == rowId },
                actionError = null,
            )
        }
        viewModelScope.launch {
            try {
                Log.i(TAG, "delete saved search …${rowId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.savedSearchesApi(base).deleteSavedSearch(rowId)
                if (response.isSuccessful && response.body()?.success == true) {
                    Log.i(TAG, "saved search deleted")
                    _state.update { it.copy(deletingId = null) }
                    persistCache()
                } else {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Failed to delete saved search (HTTP ${response.code()})"
                    Log.w(TAG, "delete failed: $message")
                    _state.update {
                        it.copy(
                            deletingId = null,
                            rows = it.rows + target,
                            actionError = message,
                        )
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "delete failed: ${e.message}")
                _state.update {
                    it.copy(
                        deletingId = null,
                        rows = it.rows + target,
                        actionError = "Network error while deleting the saved search. Check your connection and retry.",
                    )
                }
            }
        }
    }

    private suspend fun fetch() {
        fetchInFlight = true
        try {
            Log.i(TAG, "fetch saved searches pageId=$pageId")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.savedSearchesApi(base).savedSearches()
            val rows = response.body()?.data
            if (!response.isSuccessful || response.body()?.success != true || rows == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to fetch saved searches (HTTP ${response.code()})"
                Log.w(TAG, "saved searches error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "saved searches rows=${rows.size}")
            _state.value = _state.value.copy(
                loading = false,
                rows = rows,
                error = null,
                offline = false,
            )
            persistCache()
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "saved searches fetch failed: ${e.message}")
            degrade("Network error while loading your saved searches. Check your connection and retry.")
        } finally {
            fetchInFlight = false
        }
    }

    /** Failure path: in-memory rows first, then the disk cache. */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.rows.isNotEmpty()) {
            _state.value = s.copy(loading = false, offline = true, error = null, actionError = message)
            return
        }
        val cached = withContext(Dispatchers.IO) {
            WishlistCacheStore.read(appContext, WishlistCacheKeys.SAVED_SEARCHES, CachedSavedSearches.serializer())
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
        val rows: List<SavedSearchDto> = _state.value.rows
        viewModelScope.launch(Dispatchers.IO) {
            WishlistCacheStore.write(
                appContext,
                WishlistCacheKeys.SAVED_SEARCHES,
                CachedSavedSearches.serializer(),
                CachedSavedSearches(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodSavedSearches"
    }
}
