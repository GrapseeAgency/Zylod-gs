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
 * t268 — Supplier Dashboard VM (pageId "supplier-dashboard"): GET api/
 * supplier/dashboard (supplier/dashboard/route.ts, requireUserType
 * (['supplier','admin']), 401-first). The route NEVER 403s — a session
 * without a supplier profile falls back to user-keyed scoping and answers
 * success, so 401 (signed out) is the only gate code here. The payload is
 * the whole dashboard snapshot: stats, supplier identity, recent subOrders,
 * top products, product performance, inventory alerts, the six-month
 * revenue series, pending verifications, customer insights and store stats.
 *
 *  - OFFLINE: in-memory snapshot first, then the saved cache
 *    ("zylod_config"/"native_supplier_core_supplier-dashboard_cache",
 *    written ONLY after a successful pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SupplierDashboardUiState(
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

class SupplierDashboardViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupplierDashboardUiState())
    val state: StateFlow<SupplierDashboardUiState> = _state.asStateFlow()

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
            Log.i(TAG, "fetch supplier dashboard")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SupplierCoreApi = ApiClient.supplierCoreApi(base)
            val response = api.dashboard()
            // Honest supplier gate: the dashboard route answers 401 for
            // signed-out callers and NEVER 403 — sessions without a supplier
            // profile fall back to user-keyed scoping (Task 50-b) and still
            // answer success, so 401 is the only not-seller code here.
            if (response.code() == 401) {
                Log.i(TAG, "not a supplier session (http=401)")
                _state.value = SupplierDashboardUiState(loading = false, notSeller = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the dashboard (HTTP ${response.code()})"
                Log.w(TAG, "dashboard error: $message")
                degrade(message)
                return
            }
            val body: SupplierCoreDashboardEnvelope? = response.body()
            if (body == null || !body.success || body.data == null) {
                degrade("Could not load the dashboard")
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
            Log.w(TAG, "dashboard fetch failed: ${e.message}")
            degrade("Network error while loading the dashboard. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { SupplierDashboardCacheStore.read(appContext) }
        if (cached != null && cached.data != null) {
            _state.value = SupplierDashboardUiState(
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
        val payload = CachedSupplierDashboardPage(data = data)
        viewModelScope.launch(Dispatchers.IO) {
            SupplierDashboardCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSupplierCore"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSupplierDashboardPage(
    val data: SupplierCoreDashboardData? = null,
)

/**
 * On-device saved supplier dashboard — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_supplier_core_supplier-dashboard_cache".
 */
private object SupplierDashboardCacheStore {
    private const val TAG = "ZylodSupplierCore"
    private const val PREFS = "zylod_config"
    const val KEY = "native_supplier_core_supplier-dashboard_cache"

    fun read(context: Context): CachedSupplierDashboardPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSupplierDashboardPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "dashboard cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSupplierDashboardPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSupplierDashboardPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "dashboard cache write failed: ${it.message}") }
    }
}
