package com.zylod.wholesale.ui.suppliercore

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupplierCoreApi
import com.zylod.wholesale.data.api.SupplierCoreDirectoryEnvelope
import com.zylod.wholesale.data.api.SupplierCorePagination
import com.zylod.wholesale.data.api.SupplierCoreSupplierRow
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
 * t267 — Suppliers Directory VM (pageId "suppliers"): GET api/suppliers
 * (suppliers/route.ts, PUBLIC — no auth) — the marketplace's REAL supplier
 * profiles with the joined review/product counts and pagination, 20 per
 * page, sorted by the handler's three sort tokens.
 *
 *  - PUBLIC ROUTE: 401 is impossible (the Bearer header is ignored) — the
 *    notSeller flag stays false by construction and the screen renders the
 *    rows signed-out. No gate on this surface.
 *  - SORT: newest | rating | products — the chip row sends exactly those;
 *    a sort change resets the page to 1.
 *  - PAGINATION: the VM holds page + sort; Prev/Next move page within the
 *    wire pagination bounds.
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_supplier_core_suppliers_cache", written ONLY
 *    after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SupplierDirectoryUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val rows: List<SupplierCoreSupplierRow> = emptyList(),
    /** Committed page (1-based) + sort token ("newest" is the handler default). */
    val page: Int = 1,
    val sort: String = "newest",
    /** The wire pagination block — drives the Prev/Next bounds. */
    val pagination: SupplierCorePagination? = null,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** Always false — a public route has no not-seller gate (by construction). */
    val notSeller: Boolean = false,
)

class SupplierDirectoryViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupplierDirectoryUiState())
    val state: StateFlow<SupplierDirectoryUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /** Entry pull / retry — called on EVERY entry (the VM survives back stack). */
    fun refresh() {
        if (fetchJob?.isActive == true) return
        startLoad()
    }

    fun retry() = refresh()

    /** Sort chip — resets the page to 1 and re-fetches with the exact token. */
    fun setSort(sort: String) {
        if (_state.value.sort == sort) return
        _state.update { it.copy(sort = sort, page = 1) }
        startLoad()
    }

    /** Prev/Next — clamped by the caller to the wire pagination bounds. */
    fun goToPage(page: Int) {
        if (fetchJob?.isActive == true) return
        val s = _state.value
        if (page < 1 || page == s.page) return
        s.pagination?.let { if (page > it.totalPages) return }
        _state.update { it.copy(page = page) }
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
            Log.i(TAG, "fetch suppliers directory page=${s.page} sort=${s.sort}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SupplierCoreApi = ApiClient.supplierCoreApi(base)
            val response = api.suppliers(page = s.page, sort = s.sort)
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load suppliers (HTTP ${response.code()})"
                Log.w(TAG, "suppliers error: $message")
                degrade(message)
                return
            }
            val body: SupplierCoreDirectoryEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load suppliers")
                return
            }
            val rows = body.data
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                rows = rows,
                pagination = body.pagination,
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            if (rows.isNotEmpty()) {
                persistCache(rows, body.pagination, s.page, s.sort)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "suppliers fetch failed: ${e.message}")
            degrade("Network error while loading suppliers. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { SupplierDirectoryCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = SupplierDirectoryUiState(
                loading = false,
                rows = cached.rows,
                page = cached.page,
                sort = cached.sort,
                pagination = cached.pagination,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(
        rows: List<SupplierCoreSupplierRow>,
        pagination: SupplierCorePagination?,
        page: Int,
        sort: String,
    ) {
        val payload = CachedSupplierDirectoryPage(
            rows = rows,
            pagination = pagination,
            page = page,
            sort = sort,
        )
        viewModelScope.launch(Dispatchers.IO) {
            SupplierDirectoryCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSupplierCore"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSupplierDirectoryPage(
    val rows: List<SupplierCoreSupplierRow> = emptyList(),
    val pagination: SupplierCorePagination? = null,
    val page: Int = 1,
    val sort: String = "newest",
)

/**
 * On-device saved suppliers directory — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_supplier_core_suppliers_cache".
 */
private object SupplierDirectoryCacheStore {
    private const val TAG = "ZylodSupplierCore"
    private const val PREFS = "zylod_config"
    const val KEY = "native_supplier_core_suppliers_cache"

    fun read(context: Context): CachedSupplierDirectoryPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSupplierDirectoryPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "suppliers cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSupplierDirectoryPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSupplierDirectoryPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "suppliers cache write failed: ${it.message}") }
    }
}
