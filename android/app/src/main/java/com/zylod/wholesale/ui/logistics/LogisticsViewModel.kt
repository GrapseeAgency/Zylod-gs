package com.zylod.wholesale.ui.logistics

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.QuoteOptionDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WarehouseDto
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Logistics & Freight hub VM (pageId logistics) — the page behind the
 * header search destination, mirroring logistics-page.tsx exactly. Three
 * REAL data rails in parallel:
 *
 *  - GET api/delivery-methods → the admin-configured couriers
 *  - GET api/warehouses       → active ship-from rows of approved suppliers
 *  - GET api/shipping/quote   → the Task 94 zone-book rate engine (the
 *    quote section's inputs + Get Shipping Rates action)
 *
 * LOAD (web Promise.allSettled parity): both list rails fire together; the
 * hub renders whichever succeeded and shows the loadError ONLY when NEITHER
 * answered (web sawSuccess rule). A warehouse search re-hits the endpoint
 * with the REAL q= param, debounced 300ms, keeping the last known list on
 * failure (web catch-parity).
 *
 * OFFLINE (LiveChatViewModel degrade convention): on a total failure the
 * last snapshots survive — device-saved caches (SharedPreferences
 * "zylod_config", "native_logistics_methods_cache" /
 * "native_logistics_warehouses_cache") — and the state flips
 * offlineFromCache so the screen shows its saved-data banner.
 */
data class LogisticsUiState(
    /** First load (loader while true). */
    val loading: Boolean = true,
    /** Set ONLY when neither list rail answered (web sawSuccess rule). */
    val loadError: String? = null,
    val methods: List<DeliveryMethodRow> = emptyList(),
    val warehouses: List<WarehouseRow> = emptyList(),
    /** Sorted unique districts over ALL warehouse rows (server-computed). */
    val districts: List<String> = emptyList(),
    /** The live warehouse search text. */
    val warehouseQuery: String = "",
    // ─── Shipping Rate Calculator section (real /api/shipping/quote) ───
    val quoteDistrict: String = "",
    val quoteWeight: String = "10",
    val quoteSubtotal: String = "50000",
    /** Null = no answer yet; empty = the honest uncovered-district answer. */
    val quoteOptions: List<QuoteOptionDto>? = null,
    val quoteLoading: Boolean = false,
    val quoteError: String? = null,
    /** The visible lists came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class LogisticsViewModel(
    private val appContext: Context,
    @Suppress("UNUSED_PARAMETER") private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(LogisticsUiState())
    val state: StateFlow<LogisticsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var searchJob: Job? = null
    private var quoteJob: Job? = null

    /** Last successful wire DTOs — the cache payloads. */
    private var lastMethods: List<com.zylod.wholesale.data.api.DeliveryMethodDto> = emptyList()
    private var lastWarehouses: List<WarehouseDto> = emptyList()

    /* ─── list rails ─────────────────────────────────────────────────────── */

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(entryQuery: String? = null) {
        if (initJob?.isActive == true) return
        searchJob?.cancel()
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.methods.isEmpty() && it.warehouses.isEmpty(),
                loadError = null,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { loadLists() }
    }

    /** Error-banner Retry — full parallel re-load. */
    fun retry() {
        load()
    }

    /** Debounced (300ms) q= warehouse search — the web hub's exact behavior. */
    fun searchWarehouses(raw: String) {
        _state.update { it.copy(warehouseQuery = raw) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300)
            fetchWarehouses(raw.trim())
        }
    }

    private suspend fun loadLists() {
        try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            // Promise.allSettled parity: both rails fire together, one 4xx/
            // 5xx must not hide the other's data.
            coroutineScope {
                val methodsCall = async { ApiClient.logisticsApi(base).deliveryMethods() }
                val warehousesCall = async { ApiClient.logisticsApi(base).warehouses(null) }
                val methodsResponse = methodsCall.await()
                val warehousesResponse = warehousesCall.await()

                var sawSuccess = false
                val methodsBody = methodsResponse.body()
                val methods = methodsBody
                    ?.takeIf { methodsResponse.isSuccessful && it.success }
                    ?.data.orEmpty()
                if (methodsBody != null && methodsResponse.isSuccessful && methodsBody.success) {
                    sawSuccess = true
                }
                val warehousesBody = warehousesResponse.body()
                val warehouses = warehousesBody
                    ?.takeIf { warehousesResponse.isSuccessful && it.success }
                    ?.data.orEmpty()
                if (warehousesBody != null && warehousesResponse.isSuccessful && warehousesBody.success) {
                    sawSuccess = true
                }
                Log.i(TAG, "hub lists loaded methods=${methods.size} warehouses=${warehouses.size} sawSuccess=$sawSuccess")
                if (!sawSuccess) {
                    degrade("Logistics data is unavailable right now. Please try again later.")
                    return@coroutineScope
                }
                _state.update {
                    it.copy(
                        loading = false,
                        methods = methods.map { dto -> dto.toMethodRow() },
                        warehouses = warehouses.map { dto -> dto.toWarehouseRow() },
                        districts = warehousesBody?.districts.orEmpty(),
                        loadError = null,
                        offlineFromCache = false,
                    )
                }
                persistCaches(methods, warehouses, warehousesBody?.districts.orEmpty())
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "hub lists failed: ${e.message}")
            degrade("Network error while loading logistics data.")
        }
    }

    /**
     * Warehouse search — hits the REAL endpoint with q= and replaces the
     * list; on failure the last known list survives untouched (web
     * catch-parity), so no error card interrupts the section.
     */
    private suspend fun fetchWarehouses(q: String) {
        try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.logisticsApi(base).warehouses(q.takeIf(String::isNotBlank))
            val body = response.body() ?: return
            if (!response.isSuccessful || !body.success) {
                Log.w(TAG, "hub warehouse search failed: HTTP ${response.code()}")
                return
            }
            val rows = body.data.orEmpty()
            Log.i(TAG, "hub warehouse search q=\"$q\" count=${rows.size}")
            _state.update {
                it.copy(warehouses = rows.map { dto -> dto.toWarehouseRow() })
            }
            persistCaches(lastMethods, rows, body.districts.orEmpty())
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "hub warehouse search error: ${e.message}")
        }
    }

    /* ─── Shipping Rate Calculator section ───────────────────────────────── */

    fun setQuoteDistrict(value: String) {
        _state.update { it.copy(quoteDistrict = value, quoteError = null) }
    }

    fun setQuoteWeight(value: String) {
        _state.update { it.copy(quoteWeight = value, quoteError = null) }
    }

    fun setQuoteSubtotal(value: String) {
        _state.update { it.copy(quoteSubtotal = value, quoteError = null) }
    }

    /**
     * Get Shipping Rates — the web hub's exact validation texts and the
     * ALWAYS-sent subtotal (unlike the calculator page, the hub sends the
     * order value on every request).
     */
    fun fetchQuote() {
        if (quoteJob?.isActive == true) return
        val weight = _state.value.quoteWeight.toDoubleOrNull()
        val subtotal = _state.value.quoteSubtotal.toDoubleOrNull()
        if (_state.value.quoteDistrict.trim().isEmpty()) {
            _state.update { it.copy(quoteError = "Enter a delivery district first.") }
            return
        }
        if (weight == null || weight < 0.0) {
            _state.update { it.copy(quoteError = "Weight must be a number (kg).") }
            return
        }
        if (subtotal == null || subtotal < 0.0) {
            _state.update { it.copy(quoteError = "Order value must be a number.") }
            return
        }
        quoteJob?.cancel()
        _state.update { it.copy(quoteLoading = true, quoteError = null) }
        quoteJob = viewModelScope.launch {
            try {
                val district = _state.value.quoteDistrict.trim()
                Log.i(TAG, "hub quote district=$district weight=$weight subtotal=$subtotal")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.logisticsApi(base)
                    .shippingQuote(district = district, weightKg = weight, subtotal = subtotal)
                val body = response.body()
                if (body == null || !response.isSuccessful || !body.success) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Quote request failed. Adjust the inputs and try again."
                    Log.w(TAG, "hub quote error: $message")
                    _state.update { it.copy(quoteLoading = false, quoteError = message, quoteOptions = null) }
                    return@launch
                }
                // The engine returns an honest empty list for uncovered
                // districts — show exactly that, never a fabricated rate.
                val options = body.data.orEmpty()
                Log.i(TAG, "hub quote loaded count=${options.size}")
                _state.update { it.copy(quoteLoading = false, quoteOptions = options, quoteError = null) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "hub quote failed: ${e.message}")
                _state.update {
                    it.copy(quoteLoading = false, quoteError = "Network error while requesting the quote.", quoteOptions = null)
                }
            }
        }
    }

    /* ─── failure / helpers ──────────────────────────────────────────────── */

    /**
     * Total-failure path: the saved methods + warehouses caches (banner
     * state); with neither, the honest error banner text. Mapped on the
     * MAIN thread after the IO cache reads.
     */
    private suspend fun degrade(message: String) {
        val cachedMethods = withContext(Dispatchers.IO) {
            LogisticsCacheStore.read(appContext, LogisticsCacheKeys.METHODS, CachedMethods.serializer())
        }
        val cachedWarehouses = withContext(Dispatchers.IO) {
            LogisticsCacheStore.read(appContext, LogisticsCacheKeys.WAREHOUSES, CachedWarehouses.serializer())
        }
        val methods = cachedMethods?.methods.orEmpty()
        val warehouses = cachedWarehouses?.rows.orEmpty()
        if (methods.isNotEmpty() || warehouses.isNotEmpty()) {
            Log.i(TAG, "degrade → cache methods=${methods.size} warehouses=${warehouses.size}")
            _state.value = LogisticsUiState(
                loading = false,
                methods = methods.map { it.toMethodRow() },
                warehouses = warehouses.map { it.toWarehouseRow() },
                districts = cachedWarehouses?.districts.orEmpty(),
                quoteWeight = _state.value.quoteWeight,
                quoteSubtotal = _state.value.quoteSubtotal,
                quoteDistrict = _state.value.quoteDistrict,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, loadError = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the live one. */
    private fun persistCaches(
        methods: List<com.zylod.wholesale.data.api.DeliveryMethodDto>,
        warehouses: List<WarehouseDto>,
        districts: List<String>,
    ) {
        lastMethods = methods
        lastWarehouses = warehouses
        viewModelScope.launch(Dispatchers.IO) {
            if (methods.isNotEmpty()) {
                LogisticsCacheStore.write(
                    appContext,
                    LogisticsCacheKeys.METHODS,
                    CachedMethods.serializer(),
                    CachedMethods(methods = methods),
                )
            }
            if (warehouses.isNotEmpty()) {
                LogisticsCacheStore.write(
                    appContext,
                    LogisticsCacheKeys.WAREHOUSES,
                    CachedWarehouses.serializer(),
                    CachedWarehouses(rows = warehouses, districts = districts, total = warehouses.size),
                )
            }
        }
    }

    private companion object {
        const val TAG = "ZylodLogistics"
    }
}
