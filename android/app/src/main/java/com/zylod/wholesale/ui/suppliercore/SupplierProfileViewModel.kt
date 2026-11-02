package com.zylod.wholesale.ui.suppliercore

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupplierCoreApi
import com.zylod.wholesale.data.api.SupplierCoreDashboardData
import com.zylod.wholesale.data.api.SupplierCoreDashboardEnvelope
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
 * t268 — Supplier Profile VM (pageId "supplier-profile"): the PROFILE LENS
 * on GET api/supplier/dashboard (supplier/dashboard/route.ts) — the SAME
 * endpoint the dashboard lens reads, under its own pageId, ViewModel and
 * cache key ("zylod_config"/"native_supplier_core_supplier-profile_cache").
 * The t267 delegation doctrine (one wire payload, two page-owned renderers)
 * applied to a full typed screen: this lens keeps the identity card, the
 * product-performance book, the customer-insights block and the store-stats
 * row — the dashboard lens keeps the money/bars/alerts/orders rails.
 * requireUserType(['supplier','admin']) → 401 ONLY (the route never 403s —
 * no-profile sessions fall back to user-keyed scoping).
 */
data class SupplierProfileUiState(
    val loading: Boolean = true,
    /** A silent re-pull with data already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val data: SupplierCoreDashboardData? = null,
    /** Set only when nothing is renderable (no network AND no saved page). */
    val error: String? = null,
    /** The visible data is the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible data came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401: signed out (this route has no 403 path). */
    val notSeller: Boolean = false,
)

class SupplierProfileViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupplierProfileUiState())
    val state: StateFlow<SupplierProfileUiState> = _state.asStateFlow()

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
                notSeller = false,
            )
        }
        fetchJob = viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        val s = _state.value
        try {
            Log.i(TAG, "fetch supplier profile (dashboard lens)")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SupplierCoreApi = ApiClient.supplierCoreApi(base)
            val response = api.dashboard()
            // Honest supplier gate: 401 signed-out only — this route never
            // 403s (no-profile sessions fall back to user-keyed scoping).
            if (response.code() == 401) {
                Log.i(TAG, "not a supplier session (http=401)")
                _state.value = SupplierProfileUiState(loading = false, notSeller = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the profile (HTTP ${response.code()})"
                Log.w(TAG, "profile error: $message")
                degrade(message)
                return
            }
            val body: SupplierCoreDashboardEnvelope? = response.body()
            if (body == null || !body.success || body.data == null) {
                degrade("Could not load the profile")
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
                notSeller = false,
            )
            // Save cache ONLY on success — the offline render maps through
            // the same objects.
            persistCache(data)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "profile fetch failed: ${e.message}")
            degrade("Network error while loading the profile. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { SupplierProfileCacheStore.read(appContext) }
        if (cached != null && cached.data != null) {
            _state.value = SupplierProfileUiState(
                loading = false,
                data = cached.data,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire snapshot — the offline render matches the online one. */
    private fun persistCache(data: SupplierCoreDashboardData) {
        val payload = CachedSupplierProfilePage(data = data)
        viewModelScope.launch(Dispatchers.IO) {
            SupplierProfileCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSupplierCore"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSupplierProfilePage(
    val data: SupplierCoreDashboardData? = null,
)

/**
 * On-device saved supplier profile — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_supplier_core_supplier-profile_cache".
 */
private object SupplierProfileCacheStore {
    private const val TAG = "ZylodSupplierCore"
    private const val PREFS = "zylod_config"
    const val KEY = "native_supplier_core_supplier-profile_cache"

    fun read(context: Context): CachedSupplierProfilePage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSupplierProfilePage.serializer(), raw)
    }.onFailure { Log.w(TAG, "profile cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSupplierProfilePage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSupplierProfilePage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "profile cache write failed: ${it.message}") }
    }
}
