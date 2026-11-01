package com.zylod.wholesale.ui.sellerops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.SellerOpsApi
import com.zylod.wholesale.data.api.SellerOpsAnalyticsData
import com.zylod.wholesale.data.api.SellerOpsAnalyticsEnvelope
import com.zylod.wholesale.data.api.ServerConfig
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
 * t266 — Seller Analytics VM (pageId "seller-analytics"): GET api/supplier/
 * analytics (analytics/route.ts, requireUserType(['supplier','admin']),
 * 401-first) — REAL aggregates over the supplier's orderItem rows: the
 * overview (gmv/units/orders/aov with null conversionRate + pageViews — no
 * tracking source), the 30-day sales-performance buckets, top products by
 * revenue, and the restock-watch demand from active stockAlerts.
 *
 *  - NO query params on this route (verified in the handler) — no chip row.
 *  - NOT-SELLER: 401 signed-out AND 403 no-supplier-profile → honest gate.
 *  - OFFLINE: in-memory payload first, then the saved cache
 *    ("zylod_config"/"native_seller_ops_seller-analytics_cache", written
 *    ONLY after a successful pull that carried any renderable section).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SellerAnalyticsUiState(
    val loading: Boolean = true,
    /** A silent re-pull with data already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    /** The whole analytics payload — null until a section is renderable. */
    val data: SellerOpsAnalyticsData? = null,
    /** Set only when nothing is renderable (no network AND no saved data). */
    val error: String? = null,
    /** The visible data is the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible data came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or account without a supplier profile. */
    val notSeller: Boolean = false,
)

class SellerAnalyticsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SellerAnalyticsUiState())
    val state: StateFlow<SellerAnalyticsUiState> = _state.asStateFlow()

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
            Log.i(TAG, "fetch seller analytics")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SellerOpsApi = ApiClient.sellerOpsApi(base)
            val response = api.analytics()
            // Honest seller gate: signed-out callers are 401; sessions
            // without a supplier profile are 403 (SUPPLIER_PROFILE_REQUIRED).
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not a seller session (http=${response.code()})")
                _state.value = SellerAnalyticsUiState(loading = false, notSeller = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load analytics (HTTP ${response.code()})"
                Log.w(TAG, "analytics error: $message")
                degrade(message)
                return
            }
            val body: SellerOpsAnalyticsEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load analytics")
                return
            }
            val incoming = body.data
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                data = incoming,
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
            // Save cache ONLY on success with a renderable payload (wire
            // DTOs — the offline render maps through the same objects).
            if (incoming != null) {
                persistCache(incoming)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "analytics fetch failed: ${e.message}")
            degrade("Network error while loading analytics. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory payload
     * first, then the saved cache; with neither, the first-launch offline
     * state. Rows are mapped on the MAIN thread after the IO cache read.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.data != null) {
            _state.update {
                it.copy(loading = false, refreshing = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { SellerAnalyticsCacheStore.read(appContext) }
        if (cached?.data != null) {
            _state.value = SellerAnalyticsUiState(
                loading = false,
                data = cached.data,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(data: SellerOpsAnalyticsData) {
        val payload = CachedSellerAnalyticsPage(data = data)
        viewModelScope.launch(Dispatchers.IO) {
            SellerAnalyticsCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSellerOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSellerAnalyticsPage(
    val data: SellerOpsAnalyticsData? = null,
)

/**
 * On-device saved analytics — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_seller_ops_seller-analytics_cache".
 */
private object SellerAnalyticsCacheStore {
    private const val TAG = "ZylodSellerOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_seller_ops_seller-analytics_cache"

    fun read(context: Context): CachedSellerAnalyticsPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSellerAnalyticsPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "analytics cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSellerAnalyticsPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSellerAnalyticsPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "analytics cache write failed: ${it.message}") }
    }
}
