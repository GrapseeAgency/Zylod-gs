package com.zylod.wholesale.ui.wishlist

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AddCartRequest
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.SaveForLaterRowDto
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
 * t282 — native Save-For-Later VM (SPA pageId "save-for-later"). The old
 * registry row fed this page GET api/wishlist?limit=50 — WISHLIST rows under
 * a "Save For Later" title; this VM feeds it the REAL /api/save-for-later
 * rows (SaveForLaterApi), the exact feed the web page WOULD render if its
 * `data.items` read matched the envelope's actual `data` array.
 *
 * Wire contract (SaveForLaterApi): GET api/save-for-later — AUTHENTICATED,
 * { success, data: [raw savedForLater rows + product select], meta: {count} };
 * DELETE api/save-for-later/{itemId} — remove one row by ROW id (200
 * { success, message: 'Item removed' }). Move-to-Cart goes through the
 * EXISTING CartApi.addItem — POST api/cart { productId, quantity } (the
 * server resolves the supplier itself, the same two fields the web page
 * sends) followed by the row's DELETE on success — the web's exact
 * handleMoveToCart sequence. Guests get the soft in-screen sign-in CTA.
 *
 * Offline: last saved snapshot under prefs "zylod_config"/
 * "native_save_for_later_cache" (the SessionManager logout purge covers
 * every native_* key). Removal/move are single-flight (the t280 4-a#5
 * double-tap lesson) with the row returning on failure — honest, never stuck.
 */
data class SaveForLaterUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val items: List<SaveForLaterRowDto> = emptyList(),
    val offline: Boolean = false,
    val error: String? = null,
    /** Row id currently being removed or moved (progress on its card). */
    val busyId: String? = null,
    /** Bulk op in flight (Clear all / Move all) — per-row actions disabled. */
    val bulkBusy: Boolean = false,
)

@Serializable
private data class SaveForLaterSnapshot(val items: List<SaveForLaterRowDto> = emptyList())

class SaveForLaterViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SaveForLaterUiState())
    val state: StateFlow<SaveForLaterUiState> = _state.asStateFlow()

    private var api: com.zylod.wholesale.data.api.SaveForLaterApi? = null
    private var cartApi: com.zylod.wholesale.data.api.CartApi? = null

    /** Entry pull / retry (t208 parity: called on EVERY entry). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = SaveForLaterUiState(loading = false, needsAuth = true)
            return
        }
        val hasData = _state.value.items.isNotEmpty()
        _state.update { it.copy(loading = !hasData, error = null, needsAuth = false) }
        viewModelScope.launch { fetch() }
    }

    /** DELETE api/save-for-later/{itemId} — the web page's Remove action. */
    fun remove(row: SaveForLaterRowDto) {
        val itemId = row.id?.takeIf(String::isNotBlank) ?: return
        if (_state.value.busyId != null || _state.value.bulkBusy) return
        _state.update { it.copy(busyId = itemId) }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val client = api ?: ApiClient.saveForLaterApi(baseUrl).also { api = it }
                val response = client.remove(itemId)
                if (response.isSuccessful) {
                    _state.update { st ->
                        st.copy(items = st.items.filterNot { it.stableKey == row.stableKey }, busyId = null)
                    }
                    persist(_state.value.items)
                } else {
                    _state.update { it.copy(busyId = null, offline = true) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(busyId = null, offline = true) }
            }
        }
    }

    /**
     * The web page's Move-to-Cart: POST api/cart { productId, quantity } (the
     * saved qty, never below MOQ) then DELETE the saved row — both must
     * succeed or the row stays (a saved row is never silently lost).
     */
    fun moveToCart(row: SaveForLaterRowDto) {
        val itemId = row.id?.takeIf(String::isNotBlank)
        val productId = row.effectiveProductId
        if (itemId == null || productId == null) return
        if (_state.value.busyId != null || _state.value.bulkBusy) return
        _state.update { it.copy(busyId = itemId) }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val cart = cartApi ?: ApiClient.cartApi(baseUrl).also { cartApi = it }
                val addResponse = cart.addItem(
                    AddCartRequest(
                        productId = productId,
                        // supplierId is resolved server-side (the cart POST
                        // destructures only productId/variantId/quantity —
                        // the web page sends exactly these two fields).
                        supplierId = "",
                        quantity = row.moveQty,
                        variantId = row.variantId?.takeIf(String::isNotBlank),
                    ),
                )
                if (!addResponse.isSuccessful) {
                    _state.update { it.copy(busyId = null, offline = true) }
                    return@launch
                }
                val client = api ?: ApiClient.saveForLaterApi(baseUrl).also { api = it }
                val response = client.remove(itemId)
                if (response.isSuccessful) {
                    _state.update { st ->
                        st.copy(items = st.items.filterNot { it.stableKey == row.stableKey }, busyId = null)
                    }
                    persist(_state.value.items)
                } else {
                    // The line IS in the cart; the saved row stays so the
                    // buyer can remove it themselves — honest, never a
                    // silent double-add on retry.
                    _state.update { it.copy(busyId = null, offline = true) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(busyId = null, offline = true) }
            }
        }
    }

    /** The web page's Clear All — one DELETE per row (the route has no bulk). */
    fun clearAll() {
        val s = _state.value
        if (s.bulkBusy || s.busyId != null || s.items.isEmpty()) return
        _state.update { it.copy(bulkBusy = true) }
        viewModelScope.launch {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.saveForLaterApi(baseUrl).also { api = it }
            var failure = false
            for (row in s.items) {
                val itemId = row.id?.takeIf(String::isNotBlank) ?: continue
                try {
                    if (!client.remove(itemId).isSuccessful) failure = true
                } catch (ce: CancellationException) {
                    throw ce
                } catch (_: Exception) {
                    failure = true
                }
            }
            if (failure) {
                // Re-pull: the surviving rows are the truth.
                _state.update { it.copy(bulkBusy = false, offline = true) }
                fetch()
            } else {
                _state.update { it.copy(items = emptyList(), bulkBusy = false) }
                persist(emptyList())
            }
        }
    }

    private suspend fun fetch() {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.saveForLaterApi(baseUrl).also { api = it }
            val response = client.list()
            if (response.code() == 401) {
                _state.value = SaveForLaterUiState(loading = false, needsAuth = true)
                return
            }
            val envelope = response.body()
            val rows = envelope?.takeIf { it.success }?.data.orEmpty()
            if (envelope == null || (!envelope.success && rows.isEmpty())) {
                degrade("Server error — your saved items are temporarily unavailable.")
                return
            }
            _state.value = SaveForLaterUiState(loading = false, items = rows, offline = false)
            persist(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "save-for-later refresh failed: ${e.message}")
            degrade("Network error — check your connection and retry.")
        }
    }

    private suspend fun degrade(message: String) {
        val inMemory = _state.value.items
        if (inMemory.isNotEmpty()) {
            _state.update { it.copy(loading = false, offline = true, error = null) }
            return
        }
        val saved = withContext(Dispatchers.IO) { readSnapshot() }
        if (saved != null && saved.items.isNotEmpty()) {
            _state.value = SaveForLaterUiState(loading = false, items = saved.items, offline = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persist(rows: List<SaveForLaterRowDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val raw = ApiClient.json.encodeToString(SaveForLaterSnapshot.serializer(), SaveForLaterSnapshot(rows))
                appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, raw).apply()
            }.onFailure { Log.w(TAG, "save-for-later cache write failed: ${it.message}") }
        }
    }

    private fun readSnapshot(): SaveForLaterSnapshot? = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return null
        ApiClient.json.decodeFromString(SaveForLaterSnapshot.serializer(), raw)
    }.onFailure { Log.w(TAG, "save-for-later cache read failed: ${it.message}") }.getOrNull()

    private companion object {
        const val TAG = "ZylodSaveForLater"
        const val PREFS = "zylod_config"
        const val KEY = "native_save_for_later_cache"
    }
}
