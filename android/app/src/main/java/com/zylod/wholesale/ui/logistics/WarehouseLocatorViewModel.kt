package com.zylod.wholesale.ui.logistics

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WarehouseDto
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Warehouse-locator VM — GET api/warehouses (PUBLIC, rate-limited; the
 * Task 163 directory rail) as the payload of record for the two directory
 * pageIds (warehouse-locator, fulfillment-center; each keeps its OWN VM
 * instance via the screen's pageId-keyed factory).
 *
 *  - SEARCH: the text field re-hits the endpoint with the REAL q= param
 *    (server-side honest contains-filter across name/city/district/
 *    companyName/addressLine1), debounced 300ms like the web rails.
 *  - DISTRICT CHIPS: a client-side facet over the fetched rows (the rail's
 *    q= covers name/city/district/company text; district is a facet, not a
 *    param — pickup-point-page.tsx comment applies verbatim). The chips
 *    list itself is the server's sorted unique districts over ALL rows.
 *  - PUBLIC: no auth gate.
 *  - HONEST EMPTY: total == 0 → "No warehouses published yet"; a filter
 *    miss → "Nothing matches that search" (web copy).
 *  - OFFLINE (LiveChatViewModel degrade convention): on failure the last
 *    snapshot survives — device-saved cache (SharedPreferences
 *    "zylod_config", "native_logistics_warehouses_cache") — and the state
 *    flips offlineFromCache so the screen shows its saved-data banner.
 */
data class WarehouseLocatorUiState(
    /** First load (skeleton while true). */
    val loading: Boolean = true,
    /** Server-filtered rows (the q= answer). */
    val rows: List<WarehouseRow> = emptyList(),
    /** [rows] after the district facet — what the list renders. */
    val filteredRows: List<WarehouseRow> = emptyList(),
    /** Sorted unique districts over ALL rows (server-computed). */
    val districts: List<String> = emptyList(),
    /** Total unfiltered row count (the "All (n)" chip). */
    val total: Int = 0,
    /** The active district facet (null = All). */
    val activeDistrict: String? = null,
    /** The live search text (kept so the field survives recomposition). */
    val searchQuery: String = "",
    val error: String? = null,
    /** The visible rows came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class WarehouseLocatorViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(WarehouseLocatorUiState())
    val state: StateFlow<WarehouseLocatorUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var searchJob: Job? = null

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(entryQuery: String? = null) {
        if (initJob?.isActive == true) return
        searchJob?.cancel()
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.rows.isEmpty(),
                error = null,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetch("") }
    }

    /** Error-card Retry — full re-fetch without the q filter. */
    fun retry() {
        load()
    }

    /** Debounced (300ms) q= search — the web rails' exact behavior. */
    fun search(raw: String) {
        _state.update { it.copy(searchQuery = raw) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300)
            fetch(raw.trim())
        }
    }

    /** District chip tap — client-side facet over the fetched rows. */
    fun setDistrict(district: String?) {
        _state.update { it.copy(activeDistrict = district, filteredRows = filterRows(it.rows, district)) }
    }

    private suspend fun fetch(q: String) {
        try {
            Log.i(TAG, "fetch warehouses q=\"$q\"")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.logisticsApi(base).warehouses(q.takeIf(String::isNotBlank))
            val body = response.body()
            if (body == null || !response.isSuccessful || !body.success) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the directory (HTTP ${response.code()})."
                Log.w(TAG, "warehouses error: $message")
                degrade(message)
                return
            }
            val rows = body.data.orEmpty().map { it.toWarehouseRow() }
            Log.i(TAG, "warehouses loaded count=${rows.size} total=${body.total}")
            _state.update {
                it.copy(
                    loading = false,
                    rows = rows,
                    filteredRows = filterRows(rows, it.activeDistrict),
                    districts = body.districts.orEmpty(),
                    total = body.total,
                    error = null,
                    offlineFromCache = false,
                )
            }
            persistCache(body.data.orEmpty(), body.districts.orEmpty(), body.total)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "warehouses fetch failed: ${e.message}")
            degrade("Network error. Please retry.")
        }
    }

    private fun filterRows(rows: List<WarehouseRow>, district: String?): List<WarehouseRow> =
        if (district.isNullOrBlank()) {
            rows
        } else {
            rows.filter { it.district == district }
        }

    /**
     * Failure path: the saved warehouses cache (banner state); with none,
     * the honest error card. Mapped on the MAIN thread after the IO cache
     * read (the mappers are main-thread JVM helpers, RfqModels convention).
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            LogisticsCacheStore.read(appContext, LogisticsCacheKeys.WAREHOUSES, CachedWarehouses.serializer())
        }
        val rows = cached?.rows.orEmpty().map { it.toWarehouseRow() }
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cache warehouses=${rows.size}")
            _state.value = WarehouseLocatorUiState(
                loading = false,
                rows = rows,
                filteredRows = filterRows(rows, _state.value.activeDistrict),
                districts = cached.districts,
                total = cached.total,
                activeDistrict = _state.value.activeDistrict,
                searchQuery = _state.value.searchQuery,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the live one. */
    private fun persistCache(rows: List<WarehouseDto>, districts: List<String>, total: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            LogisticsCacheStore.write(
                appContext,
                LogisticsCacheKeys.WAREHOUSES,
                CachedWarehouses.serializer(),
                CachedWarehouses(rows = rows, districts = districts, total = total),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodLogistics"
    }
}
