package com.zylod.wholesale.ui.adminops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminOpsShippingMethodRow
import com.zylod.wholesale.data.api.AdminOpsShippingMethodsEnvelope
import com.zylod.wholesale.data.api.AdminOpsShippingRateRow
import com.zylod.wholesale.data.api.AdminOpsShippingRatesEnvelope
import com.zylod.wholesale.data.api.AdminOpsShippingZoneRow
import com.zylod.wholesale.data.api.AdminOpsShippingZonesEnvelope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import retrofit2.Response

/**
 * t265 — Admin Shipping VM (pageId "admin-shipping"). There is NO bare
 * shipping/route.ts — the surface is the THREE sub-endpoints (Task 94), so
 * this VM pulls ALL THREE in parallel and renders a three-section screen:
 *
 *  - GET api/admin/shipping/methods — the carrier vocabulary + live rate
 *    counts (methods/route.ts).
 *  - GET api/admin/shipping/rates   — the price book with zone + method
 *    names resolved (rates/route.ts).
 *  - GET api/admin/shipping/zones   — every zone with its parsed districts
 *    + live rate counts (zones/route.ts).
 *
 * All handlers are requireUserType(['admin']); a 401/403 from any is the
 * honest not-admin gate. All three must succeed for Content — a failure on
 * any degrades the whole payload (in-memory first, then the saved cache
 * under "zylod_config"/"native_admin_ops_admin-shipping_cache", written ONLY
 * after a successful pull with at least one row) — never a half-rendered
 * screen presented as live truth. t216 silent refresh keeps visible data.
 */
data class AdminShippingUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val methods: List<AdminOpsShippingMethodRow> = emptyList(),
    val rates: List<AdminOpsShippingRateRow> = emptyList(),
    val zones: List<AdminOpsShippingZoneRow> = emptyList(),
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or non-admin account — the screen's honest gate. */
    val notAdmin: Boolean = false,
)

class AdminShippingViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AdminShippingUiState())
    val state: StateFlow<AdminShippingUiState> = _state.asStateFlow()

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
        val hasRows = _state.value.methods.isNotEmpty() ||
            _state.value.rates.isNotEmpty() ||
            _state.value.zones.isNotEmpty()
        _state.update {
            it.copy(
                loading = !hasRows,
                refreshing = hasRows,
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
        }
        fetchJob = viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        try {
            Log.i(TAG, "fetch shipping methods + rates + zones")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.adminOpsApi(base)
            // All three sections in parallel — the screen renders them as
            // sections of ONE payload, so one combined result state.
            val (methodsResp, ratesResp, zonesResp): Triple<
                Response<AdminOpsShippingMethodsEnvelope>,
                Response<AdminOpsShippingRatesEnvelope>,
                Response<AdminOpsShippingZonesEnvelope>,
                > = coroutineScope {
                val methodsCall: Deferred<Response<AdminOpsShippingMethodsEnvelope>> =
                    async { api.shippingMethods() }
                val ratesCall: Deferred<Response<AdminOpsShippingRatesEnvelope>> =
                    async { api.shippingRates() }
                val zonesCall: Deferred<Response<AdminOpsShippingZonesEnvelope>> =
                    async { api.shippingZones() }
                Triple(methodsCall.await(), ratesCall.await(), zonesCall.await())
            }
            // Honest admin gate: any handler refusing the session ends it.
            if (methodsResp.code() == 401 || methodsResp.code() == 403 ||
                ratesResp.code() == 401 || ratesResp.code() == 403 ||
                zonesResp.code() == 401 || zonesResp.code() == 403
            ) {
                Log.i(TAG, "not an admin session (http methods=${methodsResp.code()} rates=${ratesResp.code()} zones=${zonesResp.code()})")
                _state.value = AdminShippingUiState(loading = false, notAdmin = true)
                return
            }
            if (!methodsResp.isSuccessful || !ratesResp.isSuccessful || !zonesResp.isSuccessful) {
                val failedResp = when {
                    !methodsResp.isSuccessful -> methodsResp
                    !ratesResp.isSuccessful -> ratesResp
                    else -> zonesResp
                }
                val message = parseErrorBody(failedResp.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load shipping config (HTTP ${failedResp.code()})"
                Log.w(TAG, "shipping error: $message")
                degrade(message)
                return
            }
            val methods = methodsResp.body()?.data.orEmpty()
            val rates = ratesResp.body()?.data.orEmpty()
            val zones = zonesResp.body()?.data.orEmpty()
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                methods = methods,
                rates = rates,
                zones = zones,
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
            // Save cache ONLY on success with at least one row (wire DTOs —
            // the offline render maps through the same objects).
            if (methods.isNotEmpty() || rates.isNotEmpty() || zones.isNotEmpty()) {
                persistCache(methods, rates, zones)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "shipping fetch failed: ${e.message}")
            degrade("Network error while loading shipping config. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory rows
     * first, then the saved cache; with neither, the first-launch offline
     * state. Rows are mapped on the MAIN thread after the IO cache read.
     */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.methods.isNotEmpty() || s.rates.isNotEmpty() || s.zones.isNotEmpty()) {
            _state.update {
                it.copy(loading = false, refreshing = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { ShippingCacheStore.read(appContext) }
        if (cached != null &&
            (cached.methods.isNotEmpty() || cached.rates.isNotEmpty() || cached.zones.isNotEmpty())
        ) {
            _state.value = AdminShippingUiState(
                loading = false,
                methods = cached.methods,
                rates = cached.rates,
                zones = cached.zones,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(
        methods: List<AdminOpsShippingMethodRow>,
        rates: List<AdminOpsShippingRateRow>,
        zones: List<AdminOpsShippingZoneRow>,
    ) {
        val payload = CachedShippingPage(methods = methods, rates = rates, zones = zones)
        viewModelScope.launch(Dispatchers.IO) {
            ShippingCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodAdminOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedShippingPage(
    val methods: List<AdminOpsShippingMethodRow> = emptyList(),
    val rates: List<AdminOpsShippingRateRow> = emptyList(),
    val zones: List<AdminOpsShippingZoneRow> = emptyList(),
)

/**
 * On-device saved shipping config — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_admin_ops_admin-shipping_cache".
 */
private object ShippingCacheStore {
    private const val TAG = "ZylodAdminOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_ops_admin-shipping_cache"

    fun read(context: Context): CachedShippingPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedShippingPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "shipping cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedShippingPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedShippingPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "shipping cache write failed: ${it.message}") }
    }
}
