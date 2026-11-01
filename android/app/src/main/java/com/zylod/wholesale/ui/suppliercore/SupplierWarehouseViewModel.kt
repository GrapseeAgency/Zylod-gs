package com.zylod.wholesale.ui.suppliercore

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupplierCoreApi
import com.zylod.wholesale.data.api.SupplierCoreWarehouseRow
import com.zylod.wholesale.data.api.SupplierCoreWarehousesEnvelope
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
 * t267 — Supplier Warehouse VM (pageId "supplier-warehouse"): GET api/
 * supplier/warehouses (supplier/warehouses/route.ts, authenticateRequest-
 * first) — the supplier's REAL warehouseLocations through the shapeOwner
 * projection, active first then oldest first, with the honest lat/lng
 * coordinates (real nulls when unset — no invented map).
 *
 *  - NO query params on this route (verified in the handler) — no chip row.
 *  - NOT-SELLER: 401 signed-out AND 403 no-supplier-profile
 *    (SUPPLIER_PROFILE_REQUIRED) → honest gate.
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_supplier_core_supplier-warehouse_cache",
 *    written ONLY after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SupplierWarehouseUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val rows: List<SupplierCoreWarehouseRow> = emptyList(),
    /** The envelope's root count (the handler's rows.length). */
    val count: Int = 0,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or account without a supplier profile. */
    val notSeller: Boolean = false,
)

class SupplierWarehouseViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupplierWarehouseUiState())
    val state: StateFlow<SupplierWarehouseUiState> = _state.asStateFlow()

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
        val hasRows = _state.value.rows.isNotEmpty()
        _state.update {
            it.copy(
                loading = !hasRows,
                refreshing = hasRows,
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
            Log.i(TAG, "fetch supplier warehouses")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SupplierCoreApi = ApiClient.supplierCoreApi(base)
            val response = api.warehouses()
            // Honest supplier gate: signed-out callers are 401; sessions
            // without a supplier profile are 403 (SUPPLIER_PROFILE_REQUIRED).
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not a supplier session (http=${response.code()})")
                _state.value = SupplierWarehouseUiState(loading = false, notSeller = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load warehouse locations (HTTP ${response.code()})"
                Log.w(TAG, "warehouses error: $message")
                degrade(message)
                return
            }
            val body: SupplierCoreWarehousesEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load warehouse locations")
                return
            }
            val rows = body.data
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                rows = rows,
                count = body.count,
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            if (rows.isNotEmpty()) {
                persistCache(rows, body.count)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "warehouses fetch failed: ${e.message}")
            degrade("Network error while loading warehouse locations. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory rows
     * first, then the saved cache; with neither, the first-launch offline
     * state. Rows are mapped on the MAIN thread after the IO cache read.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.rows.isNotEmpty()) {
            _state.update {
                it.copy(loading = false, refreshing = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { SupplierWarehouseCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = SupplierWarehouseUiState(
                loading = false,
                rows = cached.rows,
                count = cached.count,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(rows: List<SupplierCoreWarehouseRow>, count: Int) {
        val payload = CachedSupplierWarehousePage(rows = rows, count = count)
        viewModelScope.launch(Dispatchers.IO) {
            SupplierWarehouseCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSupplierCore"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSupplierWarehousePage(
    val rows: List<SupplierCoreWarehouseRow> = emptyList(),
    val count: Int = 0,
)

/**
 * On-device saved warehouse locations — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_supplier_core_supplier-warehouse_cache".
 */
private object SupplierWarehouseCacheStore {
    private const val TAG = "ZylodSupplierCore"
    private const val PREFS = "zylod_config"
    const val KEY = "native_supplier_core_supplier-warehouse_cache"

    fun read(context: Context): CachedSupplierWarehousePage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSupplierWarehousePage.serializer(), raw)
    }.onFailure { Log.w(TAG, "warehouses cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSupplierWarehousePage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSupplierWarehousePage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "warehouses cache write failed: ${it.message}") }
    }
}
