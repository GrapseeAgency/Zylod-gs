package com.zylod.wholesale.ui.suppliercore

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupplierCoreApi
import com.zylod.wholesale.data.api.SupplierCoreStorefrontData
import com.zylod.wholesale.data.api.SupplierCoreStorefrontEnvelope
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * t268 — Supplier Storefront VM (pageId "supplier-storefront"): GET api/
 * supplier/storefront (supplier/storefront/route.ts) — a PUBLIC route. With
 * a signed-in seller session and no explicit supplierId the caller's OWN
 * storefront is answered (the Kotlin client sends no query params — own
 * store via session). A guest (or a session without a supplier profile)
 * gets 404 JSON { error } — "No storefront specified — pass ?supplierId=
 * to view a store" or "Supplier not found" — which renders the SERVER'S
 * OWN parsed message as the honest empty state (never invented copy).
 * 401 is impossible on a public route but degrades gracefully as an error
 * state like any other failure.
 *
 *  - OFFLINE: in-memory snapshot first, then the saved cache
 *    ("zylod_config"/"native_supplier_core_supplier-storefront_cache",
 *    written ONLY after a successful pull — never a 404).
 */
data class SupplierStorefrontUiState(
    val loading: Boolean = true,
    /** A silent re-pull with data already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val data: SupplierCoreStorefrontData? = null,
    /** The server's parsed 404 text — the honest "no storefront" state. */
    val notFoundMessage: String? = null,
    /** Set only when nothing is renderable (no network AND no saved page). */
    val error: String? = null,
    /** The visible data is the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible data came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
)

class SupplierStorefrontViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupplierStorefrontUiState())
    val state: StateFlow<SupplierStorefrontUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /** Entry pull / retry — called on EVERY entry (the VM survives back stack). */
    fun refresh() {
        if (fetchJob?.isActive == true) return
        startLoad()
    }

    fun retry() = refresh()

    private fun startLoad() {
        fetchJob?.cancel()
        val hasData = _state.value.data != null
        _state.update {
            it.copy(
                loading = !hasData,
                refreshing = hasData,
                error = null,
                offline = false,
                offlineFromCache = false,
                notFoundMessage = null,
            )
        }
        fetchJob = viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        val s = _state.value
        try {
            Log.i(TAG, "fetch supplier storefront")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SupplierCoreApi = ApiClient.supplierCoreApi(base)
            val response = api.storefront()
            // HONEST 404 — no session (or session without a supplier profile)
            // and no explicit supplierId means there is nothing to show; the
            // server's own error text is the state (never invented copy).
            if (response.code() == 404) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Supplier not found"
                Log.i(TAG, "no storefront to show (http=404)")
                _state.value = SupplierStorefrontUiState(
                    loading = false,
                    notFoundMessage = message,
                )
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the storefront (HTTP ${response.code()})"
                Log.w(TAG, "storefront error: $message")
                degrade(message)
                return
            }
            val body: SupplierCoreStorefrontEnvelope? = response.body()
            if (body == null || !body.success || body.data == null) {
                degrade("Could not load the storefront")
                return
            }
            val data = body.data
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                data = data,
                error = null,
                offline = false,
                offlineFromCache = false,
                notFoundMessage = null,
            )
            // Save cache ONLY on success — the offline render maps through
            // the same objects.
            persistCache(data)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "storefront fetch failed: ${e.message}")
            degrade("Network error while loading the storefront. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory snapshot
     * first, then the saved cache; with neither, the first-launch offline
     * state. The snapshot is mapped on the MAIN thread after the IO read.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.data != null) {
            _state.update {
                it.copy(loading = false, refreshing = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { SupplierStorefrontCacheStore.read(appContext) }
        if (cached != null && cached.data != null) {
            _state.value = SupplierStorefrontUiState(
                loading = false,
                data = cached.data,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire snapshot — the offline render matches the online one. */
    private fun persistCache(data: SupplierCoreStorefrontData) {
        val payload = CachedSupplierStorefrontPage(data = data)
        viewModelScope.launch(Dispatchers.IO) {
            SupplierStorefrontCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSupplierCore"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSupplierStorefrontPage(
    val data: SupplierCoreStorefrontData? = null,
)

/**
 * On-device saved supplier storefront — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_supplier_core_supplier-storefront_cache".
 */
private object SupplierStorefrontCacheStore {
    private const val TAG = "ZylodSupplierCore"
    private const val PREFS = "zylod_config"
    const val KEY = "native_supplier_core_supplier-storefront_cache"

    fun read(context: Context): CachedSupplierStorefrontPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSupplierStorefrontPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "storefront cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSupplierStorefrontPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSupplierStorefrontPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "storefront cache write failed: ${it.message}") }
    }
}
