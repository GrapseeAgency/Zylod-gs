package com.zylod.wholesale.ui.suppliercore

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupplierCoreApi
import com.zylod.wholesale.data.api.SupplierCoreProductRow
import com.zylod.wholesale.data.api.SupplierCoreProductsEnvelope
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
 * t267 — Supplier Products VM (pageId "supplier-products"): GET api/
 * supplier/products (supplier/products/route.ts,
 * requireUserType(['supplier','admin']), 401-first) — the session
 * supplier's own product rows, newest first, 20 per page, with category /
 * priceTiers / variants nested.
 *
 *  - FILTER: the handler's validated ?status (active | inactive | pending |
 *    approved | out_of_stock) — the chip row sends exactly those; "All"
 *    omits the param.
 *  - NOT-SELLER: 401 ONLY on this route — a session WITHOUT a supplier
 *    profile answers success:true with an empty items list (honest empty,
 *    never an error), so 403/404 never arrive here.
 *  - PAGINATION: 1-based ?page with a fixed limit of 20; [loadMore] appends
 *    the next page (page state advances only on success, so a failed page
 *    can be re-requested); the silent refresh re-pulls page 1.
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_supplier_core_supplier-products_cache",
 *    written ONLY after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SupplierProductsUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    /** The next-page pull in flight (rows stay mounted; button shows it). */
    val loadingMore: Boolean = false,
    val rows: List<SupplierCoreProductRow> = emptyList(),
    /** Committed status filter: "" = all (the query param is omitted). */
    val statusFilter: String = "",
    /** Wire pagination fields — the handler's data { total, totalPages }. */
    val page: Int = 1,
    val total: Int = 0,
    val totalPages: Int = 0,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401: signed-out (the only gate this route raises). */
    val notSeller: Boolean = false,
)

class SupplierProductsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupplierProductsUiState())
    val state: StateFlow<SupplierProductsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /** Entry pull / retry — called on EVERY entry (the VM survives back stack). */
    fun refresh() {
        if (fetchJob?.isActive == true) return
        startLoad()
    }

    fun retry() = refresh()

    /** Status chip — re-fetches page 1 with the handler's exact token. */
    fun setStatusFilter(status: String) {
        if (_state.value.statusFilter == status) return
        _state.update { it.copy(statusFilter = status) }
        startLoad()
    }

    /** Append the next page — no-op while a fetch runs or pages ran out. */
    fun loadMore() {
        if (fetchJob?.isActive == true) return
        val s = _state.value
        if (s.page >= s.totalPages) return
        _state.update { it.copy(loadingMore = true) }
        fetchJob = viewModelScope.launch { fetch(s.page + 1) }
    }

    private fun startLoad() {
        fetchJob?.cancel()
        val hasRows = _state.value.rows.isNotEmpty()
        _state.update {
            it.copy(
                loading = !hasRows,
                refreshing = hasRows,
                loadingMore = false,
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
        }
        fetchJob = viewModelScope.launch { fetch(1) }
    }

    private suspend fun fetch(page: Int) {
        val s = _state.value
        try {
            Log.i(TAG, "fetch supplier products status=${s.statusFilter.ifBlank { "all" }} page=$page")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SupplierCoreApi = ApiClient.supplierCoreApi(base)
            val response = api.products(
                status = s.statusFilter.takeIf(String::isNotBlank),
                page = page,
            )
            // Honest supplier gate: signed-out callers are 401. A session
            // WITHOUT a supplier profile is NOT an error on this route — it
            // answers success:true with an empty items list (honest empty).
            if (response.code() == 401) {
                Log.i(TAG, "not a supplier session (http=${response.code()})")
                _state.value = SupplierProductsUiState(
                    loading = false,
                    notSeller = true,
                    statusFilter = s.statusFilter,
                )
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load products (HTTP ${response.code()})"
                Log.w(TAG, "products error: $message")
                failOrDegrade(message, page)
                return
            }
            val body: SupplierCoreProductsEnvelope? = response.body()
            if (body == null || !body.success) {
                failOrDegrade("Could not load products", page)
                return
            }
            val data = body.data
            val incoming = data?.items.orEmpty()
            val merged = if (page > 1) s.rows + incoming else incoming
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                loadingMore = false,
                rows = merged,
                page = page,
                total = data?.total ?: 0,
                totalPages = data?.totalPages ?: 0,
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            if (merged.isNotEmpty()) {
                persistCache(merged, s.statusFilter, page, data?.total ?: 0, data?.totalPages ?: 0)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "products fetch failed: ${e.message}")
            failOrDegrade("Network error while loading products. Check your connection and retry.", page)
        }
    }

    /**
     * Failure path: a failed NEXT-PAGE pull keeps the mounted rows and the
     * committed page state (the button flips back — no data invented); a
     * failed first page degrades — in-memory rows, then the saved cache,
     * else the first-launch offline state. Rows are mapped on the MAIN
     * thread after the IO cache read.
     */
    private suspend fun failOrDegrade(message: String, page: Int) {
        if (page > 1) {
            _state.update { it.copy(loadingMore = false) }
            return
        }
        if (_state.value.rows.isNotEmpty()) {
            _state.update {
                it.copy(loading = false, refreshing = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { SupplierProductsCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = SupplierProductsUiState(
                loading = false,
                rows = cached.rows,
                statusFilter = cached.statusFilter,
                page = cached.page,
                total = cached.total,
                totalPages = cached.totalPages,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(
        rows: List<SupplierCoreProductRow>,
        statusFilter: String,
        page: Int,
        total: Int,
        totalPages: Int,
    ) {
        val payload = CachedSupplierProductsPage(
            rows = rows,
            statusFilter = statusFilter,
            page = page,
            total = total,
            totalPages = totalPages,
        )
        viewModelScope.launch(Dispatchers.IO) {
            SupplierProductsCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSupplierCore"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSupplierProductsPage(
    val rows: List<SupplierCoreProductRow> = emptyList(),
    val statusFilter: String = "",
    val page: Int = 1,
    val total: Int = 0,
    val totalPages: Int = 0,
)

/**
 * On-device saved supplier products — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_supplier_core_supplier-products_cache".
 */
private object SupplierProductsCacheStore {
    private const val TAG = "ZylodSupplierCore"
    private const val PREFS = "zylod_config"
    const val KEY = "native_supplier_core_supplier-products_cache"

    fun read(context: Context): CachedSupplierProductsPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSupplierProductsPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "products cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSupplierProductsPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSupplierProductsPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "products cache write failed: ${it.message}") }
    }
}
