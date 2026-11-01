package com.zylod.wholesale.ui.wishlist

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WishlistItemDetailDto
import com.zylod.wholesale.data.api.WishlistNotePatchBody
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
 * Wishlist-detail VM (pageId wishlist-detail — wishlist-detail-page.tsx's
 * exact wire contract, WishlistItemApi):
 *
 *  - GET api/wishlist/{itemId} — the owned single row (404 'Wishlist item
 *    not found' for foreign/unknown ids; the entry query carries
 *    itemId=/id=/a bare token, wishlistItemIdFromQuery). No id in the
 *    query → the web's not-found card, honestly.
 *  - PATCH api/wishlist/{itemId} { note } — the Personal Note save (the
 *    200 data is the updateMany count; the web shows no success toast, so
 *    none is invented here — the button's Saving… state is the feedback).
 *  - DELETE api/wishlist/{itemId} — the Remove-from-Wishlist confirm's
 *    action; success pops back exactly like the web's goBack().
 *
 * Signed-out: no call at all — the honest sign-in gate (the web's fetch
 * would 401 and fall into its not-found card; the native surfaces the real
 * reason instead). Cache: the last fetched detail survives per item id
 * (WishlistCacheKeys.wishlistItem) for the offline banner state.
 */
class WishlistDetailViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(WishlistDetailUiState())
    val state: StateFlow<WishlistDetailUiState> = _state.asStateFlow()

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

    /** Entry resolve on EVERY entry (ReturnRequestViewModel.load convention). */
    fun load(query: String?) {
        val itemId = wishlistItemIdFromQuery(query).orEmpty()
        _state.value = WishlistDetailUiState(
            loading = itemId.isNotBlank(),
            hasId = itemId.isNotBlank(),
            itemId = itemId,
        )
        if (itemId.isBlank()) {
            // The web with no itemId: loading=false → its "Item not found." card.
            Log.i(TAG, "no item id in entry query — not-found state")
            return
        }
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(loading = false, needsAuth = true)
            return
        }
        viewModelScope.launch { fetch(itemId) }
    }

    /** Retry re-runs the load for the pinned id. */
    fun retry() {
        val id = _state.value.itemId
        if (id.isBlank()) return
        if (fetchInFlight) return
        _state.update { it.copy(loading = true, error = null, notFound = false, needsAuth = false) }
        viewModelScope.launch { fetch(id) }
    }

    fun setNote(value: String) = _state.update { it.copy(note = value) }

    fun consumeNoteError() = _state.update { it.copy(noteError = null) }

    fun consumeRemoveError() = _state.update { it.copy(removeError = null) }

    /**
     * Saves the personal note (PATCH api/wishlist/{itemId}). Disabled while
     * saving or unchanged (the web's exact button condition); no invented
     * success toast — the web shows none.
     */
    fun saveNote() {
        val s = _state.value
        if (s.savingNote || !s.hasId) return
        val detail = s.detail ?: return
        if (s.note == (detail.note ?: "")) return
        _state.update { it.copy(savingNote = true, noteError = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "save note …${s.itemId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.wishlistItemApi(base)
                    .updateNote(s.itemId, WishlistNotePatchBody(note = s.note))
                if (response.code() == 401) {
                    Log.i(TAG, "note save rejected (http=401)")
                    _state.update { it.copy(savingNote = false, needsAuth = true) }
                    return@launch
                }
                val ok = response.isSuccessful && response.body()?.success == true
                if (!ok) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not save the note (HTTP ${response.code()})"
                    Log.w(TAG, "note save failed: $message")
                    _state.update { it.copy(savingNote = false, noteError = message) }
                    return@launch
                }
                Log.i(TAG, "note saved")
                _state.update { current ->
                    current.copy(
                        savingNote = false,
                        detail = current.detail?.copy(note = current.note),
                        noteError = null,
                    )
                }
                persistCache(_state.value.detail)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "note save failed: ${e.message}")
                _state.update {
                    it.copy(savingNote = false, noteError = "Network error while saving the note. Check your connection and retry.")
                }
            }
        }
    }

    /**
     * Removes the item (DELETE api/wishlist/{itemId}) after the screen's
     * confirm dialog; the caller pops back on success (the web's goBack()).
     * The route's verbatim errors surface inline.
     */
    fun removeConfirmed(onRemoved: () -> Unit) {
        val s = _state.value
        if (s.removing || !s.hasId) return
        _state.update { it.copy(removing = true, removeError = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "remove wishlist item …${s.itemId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.wishlistItemApi(base).removeItem(s.itemId)
                if (response.code() == 401) {
                    Log.i(TAG, "remove rejected (http=401)")
                    _state.update { it.copy(removing = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                if (!response.isSuccessful || payload?.success != true) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: payload?.message?.takeIf(String::isNotBlank)
                        ?: "Could not remove the item (HTTP ${response.code()})"
                    Log.w(TAG, "remove failed: $message")
                    _state.update { it.copy(removing = false, removeError = message) }
                    return@launch
                }
                Log.i(TAG, "wishlist item removed")
                _state.update { it.copy(removing = false) }
                onRemoved()
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "remove failed: ${e.message}")
                _state.update {
                    it.copy(removing = false, removeError = "Network error while removing the item. Check your connection and retry.")
                }
            }
        }
    }

    private suspend fun fetch(itemId: String) {
        fetchInFlight = true
        try {
            Log.i(TAG, "fetch wishlist item …${itemId.takeLast(8)}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.wishlistItemApi(base).item(itemId)
            if (response.code() == 401) {
                Log.w(TAG, "wishlist item 401 — session gate")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            if (response.code() == 404) {
                // The route's verbatim 404 ('Wishlist item not found') — the
                // honest not-found card, no invented item behind it.
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Wishlist item not found"
                Log.w(TAG, "wishlist item 404: $message")
                _state.value = _state.value.copy(loading = false, notFound = true, error = null)
                return
            }
            val detail = response.body()?.takeIf { response.isSuccessful && it.success }?.data
            if (detail == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to load the wishlist item (HTTP ${response.code()})"
                Log.w(TAG, "wishlist item error: $message")
                degrade(itemId, message)
                return
            }
            Log.i(TAG, "wishlist item loaded product=${detail.product?.id.orEmpty().takeLast(8)}")
            _state.value = _state.value.copy(
                loading = false,
                detail = detail,
                note = detail.note.orEmpty(),
                error = null,
                offlineFromCache = false,
            )
            persistCache(detail)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "wishlist item fetch failed: ${e.message}")
            degrade(itemId, "Network error while loading the wishlist item. Check your connection and retry.")
        } finally {
            fetchInFlight = false
        }
    }

    /** Failure path: the per-item disk cache renders with the honest banner. */
    private suspend fun degrade(itemId: String, message: String) {
        val cached = withContext(Dispatchers.IO) {
            WishlistCacheStore.read(
                appContext,
                WishlistCacheKeys.wishlistItem(itemId),
                CachedWishlistItem.serializer(),
            )
        }
        val detail = cached?.takeIf { it.itemId == itemId }?.detail
        if (detail != null) {
            Log.i(TAG, "degrade → cached wishlist item")
            _state.value = _state.value.copy(
                loading = false,
                detail = detail,
                note = detail.note.orEmpty(),
                error = null,
                offlineFromCache = true,
            )
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persistCache(detail: WishlistItemDetailDto?) {
        val id = detail?.id ?: _state.value.itemId
        if (id.isBlank()) return
        viewModelScope.launch(Dispatchers.IO) {
            WishlistCacheStore.write(
                appContext,
                WishlistCacheKeys.wishlistItem(id),
                CachedWishlistItem.serializer(),
                CachedWishlistItem(itemId = id, detail = detail),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodWishlistDetail"
    }
}
