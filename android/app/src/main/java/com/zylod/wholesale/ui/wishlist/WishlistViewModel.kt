package com.zylod.wholesale.ui.wishlist

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WishlistEnvelope
import com.zylod.wholesale.data.api.WishlistItemDto
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
 * t233 — native Wishlist VM (SPA pageIds "wishlist", "wishlist-page",
 * "favorites", "favorites-page" and the buyer-wishlist aliases land here).
 *
 * Wire contract (CartDtos.kt WishlistApi): GET api/wishlist — authenticated,
 * cursor-shaped envelope {success, data:[{id,productId,product}], meta} —
 * DELETE api/wishlist?productId=… to remove. Removal is optimistic: the row
 * leaves the grid at once and comes back on failure (honest, never stuck).
 * Offline: last saved snapshot under prefs "zylod_config"/
 * "native_wishlist_cache"; guests get the soft in-screen sign-in CTA.
 */
data class WishlistUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val items: List<WishlistItemDto> = emptyList(),
    val offline: Boolean = false,
    val error: String? = null,
    /** Product id currently being removed (progress on its card). */
    val removingId: String? = null,
)

@Serializable
private data class WishlistSnapshot(val items: List<WishlistItemDto> = emptyList())

class WishlistViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(WishlistUiState())
    val state: StateFlow<WishlistUiState> = _state.asStateFlow()

    private var api: com.zylod.wholesale.data.api.WishlistApi? = null

    /** Entry pull / retry (t208 parity: called on EVERY entry). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = WishlistUiState(loading = false, needsAuth = true)
            return
        }
        val hasData = _state.value.items.isNotEmpty()
        _state.update { it.copy(loading = !hasData, error = null, needsAuth = false) }
        viewModelScope.launch { fetch() }
    }

    fun remove(productId: String) {
        _state.update { it.copy(removingId = productId) }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val client = api ?: ApiClient.wishlistApi(baseUrl).also { api = it }
                val response = client.remove(productId)
                if (response.isSuccessful) {
                    _state.update { st ->
                        st.copy(
                            items = st.items.filterNot { it.productId == productId || it.id == productId },
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

    private suspend fun fetch() {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.wishlistApi(baseUrl).also { api = it }
            val response = client.list()
            if (response.code() == 401) {
                _state.value = WishlistUiState(loading = false, needsAuth = true)
                return
            }
            val envelope = response.body()
            val rows = envelope?.takeIf { it.success }?.data.orEmpty()
            if (envelope == null || (!envelope.success && rows.isEmpty())) {
                degrade("Server error — the wishlist is temporarily unavailable.")
                return
            }
            _state.value = WishlistUiState(loading = false, items = rows, offline = false)
            persist(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "wishlist refresh failed: ${e.message}")
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
            _state.value = WishlistUiState(loading = false, items = saved.items, offline = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persist(rows: List<WishlistItemDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val raw = ApiClient.json.encodeToString(WishlistSnapshot.serializer(), WishlistSnapshot(rows))
                appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, raw).apply()
            }.onFailure { Log.w(TAG, "wishlist cache write failed: ${it.message}") }
        }
    }

    private fun readSnapshot(): WishlistSnapshot? = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return null
        ApiClient.json.decodeFromString(WishlistSnapshot.serializer(), raw)
    }.onFailure { Log.w(TAG, "wishlist cache read failed: ${it.message}") }.getOrNull()

    private companion object {
        const val TAG = "ZylodWishlist"
        const val PREFS = "zylod_config"
        const val KEY = "native_wishlist_cache"
    }
}
