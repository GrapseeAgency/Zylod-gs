package com.zylod.wholesale.ui.suppliercore

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupplierCoreApi
import com.zylod.wholesale.data.api.SupplierCoreOrderRow
import com.zylod.wholesale.data.api.SupplierCoreOrdersEnvelope
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
 * t267 — Supplier Orders VM (pageId "supplier-orders"): GET api/supplier/
 * orders (supplier/orders/route.ts, requireUserType(['supplier','admin']),
 * 401-first) — the supplier's REAL subOrders, newest first, capped at 100,
 * each with the parent order's number/paymentStatus, the buyer display
 * fallback, the pack total and the item lines.
 *
 *  - FILTER: the handler's validated ?status (pending | confirmed | packed |
 *    shipped | delivered | cancelled | returned) — the chip row sends
 *    exactly those; "All" omits the param (unknown tokens would honestly
 *    yield an empty list server-side).
 *  - NOT-SELLER: 401 signed-out, 403 profile gate AND 404 — this one route
 *    answers 404 "No supplier profile found for this account" for a session
 *    without a supplier profile (unlike the 403 on the sibling routes).
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_supplier_core_supplier-orders_cache", written
 *    ONLY after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SupplierOrdersUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val rows: List<SupplierCoreOrderRow> = emptyList(),
    /** Committed status filter: "" = all (the query param is omitted). */
    val statusFilter: String = "",
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403/404: signed-out or account without a supplier profile. */
    val notSeller: Boolean = false,
)

class SupplierOrdersViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupplierOrdersUiState())
    val state: StateFlow<SupplierOrdersUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /** Entry pull / retry — called on EVERY entry (the VM survives back stack). */
    fun refresh() {
        if (fetchJob?.isActive == true) return
        startLoad()
    }

    fun retry() = refresh()

    /** Status chip — re-fetches with the handler's exact lowercase token. */
    fun setStatusFilter(status: String) {
        if (_state.value.statusFilter == status) return
        _state.update { it.copy(statusFilter = status) }
        startLoad()
    }

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
            Log.i(TAG, "fetch supplier orders status=${s.statusFilter.ifBlank { "all" }}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SupplierCoreApi = ApiClient.supplierCoreApi(base)
            val response = api.orders(status = s.statusFilter.takeIf(String::isNotBlank))
            // Honest supplier gate: signed-out callers are 401, sessions
            // without a supplier profile are 403 on the sibling routes but
            // 404 HERE ("No supplier profile found for this account").
            if (response.code() == 401 || response.code() == 403 || response.code() == 404) {
                Log.i(TAG, "not a supplier session (http=${response.code()})")
                _state.value = SupplierOrdersUiState(
                    loading = false,
                    notSeller = true,
                    statusFilter = s.statusFilter,
                )
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load orders (HTTP ${response.code()})"
                Log.w(TAG, "orders error: $message")
                degrade(message)
                return
            }
            val body: SupplierCoreOrdersEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load orders")
                return
            }
            val rows = body.orders
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                rows = rows,
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            if (rows.isNotEmpty()) {
                persistCache(rows, s.statusFilter)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "orders fetch failed: ${e.message}")
            degrade("Network error while loading orders. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { SupplierOrdersCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = SupplierOrdersUiState(
                loading = false,
                rows = cached.rows,
                statusFilter = cached.statusFilter,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(rows: List<SupplierCoreOrderRow>, statusFilter: String) {
        val payload = CachedSupplierOrdersPage(rows = rows, statusFilter = statusFilter)
        viewModelScope.launch(Dispatchers.IO) {
            SupplierOrdersCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSupplierCore"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSupplierOrdersPage(
    val rows: List<SupplierCoreOrderRow> = emptyList(),
    val statusFilter: String = "",
)

/**
 * On-device saved supplier orders — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_supplier_core_supplier-orders_cache".
 */
private object SupplierOrdersCacheStore {
    private const val TAG = "ZylodSupplierCore"
    private const val PREFS = "zylod_config"
    const val KEY = "native_supplier_core_supplier-orders_cache"

    fun read(context: Context): CachedSupplierOrdersPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSupplierOrdersPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "orders cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSupplierOrdersPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSupplierOrdersPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "orders cache write failed: ${it.message}") }
    }
}
