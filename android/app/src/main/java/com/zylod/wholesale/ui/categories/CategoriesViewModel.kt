package com.zylod.wholesale.ui.categories

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CategoryDto
import com.zylod.wholesale.data.api.ServerConfig
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
 * t233 — native Categories VM (SPA pageIds "category-browser" (the bottom
 * Categories tab), "categories", "all-categories", "category-directory" and
 * friends resolve here through RouteOwnership's native-first table).
 *
 * One call: GET api/categories (top level + children). Offline degrade
 * (DealsViewModel convention): in-memory rows first, then the saved snapshot
 * under prefs "zylod_config"/"native_categories_cache"; with neither, the
 * honest error + Retry. Never a white screen.
 */
data class CategoriesUiState(
    val loading: Boolean = true,
    val categories: List<CategoryDto> = emptyList(),
    val offline: Boolean = false,
    val error: String? = null,
)

@Serializable
private data class CategoriesSnapshot(val categories: List<CategoryDto> = emptyList())

class CategoriesViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(CategoriesUiState())
    val state: StateFlow<CategoriesUiState> = _state.asStateFlow()

    private var api: com.zylod.wholesale.data.api.ZylodApi? = null

    /** Entry pull / retry (t208 parity: called on EVERY entry). */
    fun refresh() {
        val hasData = _state.value.categories.isNotEmpty()
        _state.update { it.copy(loading = !hasData, error = null) }
        viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.create(baseUrl, appContext).also { api = it }
            val envelope = client.categories()
            val rows = envelope.data.orEmpty().filter { it.id.isNotBlank() && it.name.isNotBlank() }
            if (!envelope.success && rows.isEmpty()) {
                degrade("Server error — categories are temporarily unavailable.")
                return
            }
            _state.value = CategoriesUiState(loading = false, categories = rows, offline = false)
            withContext(Dispatchers.IO) {
                runCatching {
                    val raw = ApiClient.json.encodeToString(CategoriesSnapshot.serializer(), CategoriesSnapshot(rows))
                    appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, raw).apply()
                }.onFailure { Log.w(TAG, "categories cache write failed: ${it.message}") }
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "categories refresh failed: ${e.message}")
            degrade("Network error — check your connection and retry.")
        }
    }

    private suspend fun degrade(message: String) {
        val inMemory = _state.value.categories
        if (inMemory.isNotEmpty()) {
            _state.value = _state.value.copy(loading = false, offline = true, error = null)
            return
        }
        val saved = withContext(Dispatchers.IO) { readSnapshot() }
        if (saved != null && saved.categories.isNotEmpty()) {
            _state.value = CategoriesUiState(loading = false, categories = saved.categories, offline = true)
        } else {
            _state.value = CategoriesUiState(loading = false, error = message)
        }
    }

    private fun readSnapshot(): CategoriesSnapshot? = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return null
        ApiClient.json.decodeFromString(CategoriesSnapshot.serializer(), raw)
    }.onFailure { Log.w(TAG, "categories cache read failed: ${it.message}") }.getOrNull()

    private companion object {
        const val TAG = "ZylodCategories"
        const val PREFS = "zylod_config"
        const val KEY = "native_categories_cache"
    }
}
