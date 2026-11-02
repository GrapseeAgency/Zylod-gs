package com.zylod.wholesale.ui.suppliercore

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupplierCoreApi
import com.zylod.wholesale.data.api.SupplierCoreQueriesEnvelope
import com.zylod.wholesale.data.api.SupplierCoreQueryRow
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
 * t268 — Supplier Queries VM (pageId "supplier-queries"): GET api/supplier/
 * queries (supplier/queries/route.ts, requireUserType(['supplier','admin'])
 * → 401; resolveSupplierProfile → 403 SUPPLIER_PROFILE_REQUIRED). The
 * supplier's REAL sellerCustomerQueries rows, newest first, capped at 100.
 *
 *  - FILTER: the handler's ?status has NO server validation, so the chip
 *    row sends ONLY the schema's real tokens (open | replied | resolved |
 *    closed); "All" omits the param — an unknown token would honestly
 *    answer an empty list server-side.
 *  - NOT-SELLER: 401 signed-out AND 403 profile gate.
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_supplier_core_supplier-queries_cache",
 *    written ONLY after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SupplierQueriesUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val rows: List<SupplierCoreQueryRow> = emptyList(),
    /** Committed status filter: "" = all (the query param is omitted). */
    val statusFilter: String = "",
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401 signed-out or 403 account without a supplier profile. */
    val notSeller: Boolean = false,
)

class SupplierQueriesViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupplierQueriesUiState())
    val state: StateFlow<SupplierQueriesUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /** Entry pull / retry — called on EVERY entry (the VM survives back stack). */
    fun refresh() {
        if (fetchJob?.isActive == true) return
        startLoad()
    }

    fun retry() = refresh()

    /** Status chip — re-fetches with the schema's exact lowercase token. */
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
            Log.i(TAG, "fetch supplier queries status=${s.statusFilter.ifBlank { "all" }}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SupplierCoreApi = ApiClient.supplierCoreApi(base)
            val response = api.queries(status = s.statusFilter.takeIf(String::isNotBlank))
            // Honest supplier gate: 401 signed-out or 403 profile-required.
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not a supplier session (http=${response.code()})")
                _state.value = SupplierQueriesUiState(
                    loading = false,
                    notSeller = true,
                    statusFilter = s.statusFilter,
                )
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load queries (HTTP ${response.code()})"
                Log.w(TAG, "queries error: $message")
                degrade(message)
                return
            }
            val body: SupplierCoreQueriesEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load queries")
                return
            }
            val rows = body.data
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
            Log.w(TAG, "queries fetch failed: ${e.message}")
            degrade("Network error while loading queries. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { SupplierQueriesCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = SupplierQueriesUiState(
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
    private fun persistCache(rows: List<SupplierCoreQueryRow>, statusFilter: String) {
        val payload = CachedSupplierQueriesPage(rows = rows, statusFilter = statusFilter)
        viewModelScope.launch(Dispatchers.IO) {
            SupplierQueriesCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSupplierCore"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSupplierQueriesPage(
    val rows: List<SupplierCoreQueryRow> = emptyList(),
    val statusFilter: String = "",
)

/**
 * On-device saved supplier queries — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_supplier_core_supplier-queries_cache".
 */
private object SupplierQueriesCacheStore {
    private const val TAG = "ZylodSupplierCore"
    private const val PREFS = "zylod_config"
    const val KEY = "native_supplier_core_supplier-queries_cache"

    fun read(context: Context): CachedSupplierQueriesPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSupplierQueriesPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "queries cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSupplierQueriesPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSupplierQueriesPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "queries cache write failed: ${it.message}") }
    }
}
