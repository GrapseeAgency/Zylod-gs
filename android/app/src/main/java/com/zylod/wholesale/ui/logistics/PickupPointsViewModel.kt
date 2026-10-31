package com.zylod.wholesale.ui.logistics

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.QuoteOptionDto
import com.zylod.wholesale.data.api.ServerConfig
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
 * Pickup-points VM (pageId pickup-points) — GET api/warehouses (PUBLIC,
 * the Task 163 rail) as the payload of record, mirroring
 * pickup-point-page.tsx exactly:
 *
 *  - SEARCH: a 300ms-debounced refetch with the REAL q= param (the rail's
 *    q covers name/city/district/company text).
 *  - DISTRICT CHIPS: a client-side facet over the fetched rows (the rail's
 *    q= covers name/city/district/company text; district is a facet, not a
 *    param — the web comment applies verbatim).
 *  - SELECTION: a tapped card highlights (aria-pressed parity); "Visit
 *    store" opens the supplier's storefront.
 *  - PUBLIC: no auth gate.
 *  - HONEST EMPTY: "No pickup points yet" when the directory is empty;
 *    "No pickup points match" when a filter/search misses (web copy).
 *  - OFFLINE (LiveChatViewModel degrade convention): on failure the last
 *    snapshot survives — device-saved cache (SharedPreferences
 *    "zylod_config", "native_logistics_warehouses_cache") — and the state
 *    flips offlineFromCache so the screen shows its saved-data banner.
 */
data class PickupPointsUiState(
    /** First load (loader while true). */
    val loading: Boolean = true,
    /** All rows from the last successful fetch (the q= answer). */
    val allRows: List<WarehouseRow> = emptyList(),
    /** [allRows] after the district facet — what the list renders. */
    val rows: List<WarehouseRow> = emptyList(),
    /** Sorted unique districts over ALL rows (server-computed). */
    val districts: List<String> = emptyList(),
    /** "all" or one of [districts] (web state shape). */
    val district: String = "all",
    /** The live search text. */
    val search: String = "",
    /** The tapped card (selection highlight, web parity). */
    val selectedKey: String? = null,
    val error: String? = null,
    /** The visible rows came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class PickupPointsViewModel(
    private val appContext: Context,
    @Suppress("UNUSED_PARAMETER") private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(PickupPointsUiState())
    val state: StateFlow<PickupPointsUiState> = _state.asStateFlow()

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
                loading = it.allRows.isEmpty(),
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

    /** Debounced (300ms) q= search — the web rail's exact behavior. */
    fun search(raw: String) {
        _state.update { it.copy(search = raw) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300)
            fetch(raw.trim())
        }
    }

    /** District chip tap — client-side facet over the fetched rows. */
    fun setDistrict(district: String) {
        _state.update {
            it.copy(
                district = district,
                rows = if (district == "all") {
                    it.allRows
                } else {
                    it.allRows.filter { row -> row.district == district }
                },
            )
        }
    }

    /** Card tap — the selection highlight (web aria-pressed parity). */
    fun select(key: String) {
        _state.update {
            it.copy(selectedKey = if (it.selectedKey == key) null else key)
        }
    }

    private suspend fun fetch(q: String) {
        try {
            Log.i(TAG, "fetch pickup points q=\"$q\"")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.logisticsApi(base).warehouses(q.takeIf(String::isNotBlank))
            val body = response.body()
            if (body == null || !response.isSuccessful || !body.success) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "HTTP ${response.code()}"
                Log.w(TAG, "pickup points error: $message")
                degrade(message)
                return
            }
            val rows = body.data.orEmpty().map { it.toWarehouseRow() }
            Log.i(TAG, "pickup points loaded count=${rows.size}")
            _state.update {
                it.copy(
                    loading = false,
                    allRows = rows,
                    rows = if (it.district == "all") {
                        rows
                    } else {
                        rows.filter { row -> row.district == it.district }
                    },
                    districts = body.districts.orEmpty(),
                    error = null,
                    offlineFromCache = false,
                )
            }
            persistCache(body.data.orEmpty(), body.districts.orEmpty())
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "pickup points fetch failed: ${e.message}")
            degrade("Network error — check your connection and retry.")
        }
    }

    /**
     * Failure path: the saved warehouses cache (banner state); with none,
     * the honest error card. Mapped on the MAIN thread after the IO cache
     * read.
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            LogisticsCacheStore.read(appContext, LogisticsCacheKeys.WAREHOUSES, CachedWarehouses.serializer())
        }
        val rows = cached?.rows.orEmpty().map { it.toWarehouseRow() }
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cache warehouses=${rows.size}")
            _state.value = PickupPointsUiState(
                loading = false,
                allRows = rows,
                rows = rows,
                districts = cached?.districts ?: emptyList(),
                district = _state.value.district,
                search = _state.value.search,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the live one. */
    private fun persistCache(rows: List<com.zylod.wholesale.data.api.WarehouseDto>, districts: List<String>) {
        viewModelScope.launch(Dispatchers.IO) {
            LogisticsCacheStore.write(
                appContext,
                LogisticsCacheKeys.WAREHOUSES,
                CachedWarehouses.serializer(),
                CachedWarehouses(rows = rows, districts = districts, total = rows.size),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodLogistics"
    }
}
