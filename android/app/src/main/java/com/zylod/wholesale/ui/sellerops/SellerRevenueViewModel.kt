package com.zylod.wholesale.ui.sellerops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.SellerOpsApi
import com.zylod.wholesale.data.api.SellerOpsRevenueDay
import com.zylod.wholesale.data.api.SellerOpsRevenueEnvelope
import com.zylod.wholesale.data.api.SellerOpsRevenueLedgerRow
import com.zylod.wholesale.data.api.SellerOpsRevenueSummary
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
 * t266 — Seller Revenue VM (pageId "seller-revenue"): GET api/supplier/
 * revenue (revenue/route.ts, requireUserType(['supplier','admin']),
 * 401-first) — the REAL revenue ledger: orderItem rows on the supplier's
 * products whose parent subOrder is not cancelled/returned, the derived
 * daily series, and the summary whose fee/payout numbers arrive as honest
 * nulls on the wire (no real fee ledger exists yet).
 *
 *  - NO query params on this route (verified in the handler) — no chip row.
 *  - NOT-SELLER: 401 signed-out AND 403 no-supplier-profile → honest gate.
 *  - OFFLINE: in-memory ledger first, then the saved cache
 *    ("zylod_config"/"native_seller_ops_seller-revenue_cache", written ONLY
 *    after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SellerRevenueUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val ledger: List<SellerOpsRevenueLedgerRow> = emptyList(),
    val dailySeries: List<SellerOpsRevenueDay> = emptyList(),
    val summary: SellerOpsRevenueSummary? = null,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or account without a supplier profile. */
    val notSeller: Boolean = false,
)

class SellerRevenueViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SellerRevenueUiState())
    val state: StateFlow<SellerRevenueUiState> = _state.asStateFlow()

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
        val hasRows = _state.value.ledger.isNotEmpty()
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
            Log.i(TAG, "fetch seller revenue")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SellerOpsApi = ApiClient.sellerOpsApi(base)
            val response = api.revenue()
            // Honest seller gate: signed-out callers are 401; sessions
            // without a supplier profile are 403 (SUPPLIER_PROFILE_REQUIRED).
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not a seller session (http=${response.code()})")
                _state.value = SellerRevenueUiState(loading = false, notSeller = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load revenue (HTTP ${response.code()})"
                Log.w(TAG, "revenue error: $message")
                degrade(message)
                return
            }
            val body: SellerOpsRevenueEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load revenue")
                return
            }
            val ledger = body.data?.ledger.orEmpty()
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                ledger = ledger,
                dailySeries = body.data?.dailySeries.orEmpty(),
                summary = body.data?.summary,
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            if (ledger.isNotEmpty()) {
                persistCache(ledger, body.data?.dailySeries.orEmpty(), body.data?.summary)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "revenue fetch failed: ${e.message}")
            degrade("Network error while loading revenue. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory rows
     * first, then the saved cache; with neither, the first-launch offline
     * state. Rows are mapped on the MAIN thread after the IO cache read.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.ledger.isNotEmpty()) {
            _state.update {
                it.copy(loading = false, refreshing = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { SellerRevenueCacheStore.read(appContext) }
        if (cached != null && cached.ledger.isNotEmpty()) {
            _state.value = SellerRevenueUiState(
                loading = false,
                ledger = cached.ledger,
                dailySeries = cached.dailySeries,
                summary = cached.summary,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(
        ledger: List<SellerOpsRevenueLedgerRow>,
        dailySeries: List<SellerOpsRevenueDay>,
        summary: SellerOpsRevenueSummary?,
    ) {
        val payload = CachedSellerRevenuePage(ledger = ledger, dailySeries = dailySeries, summary = summary)
        viewModelScope.launch(Dispatchers.IO) {
            SellerRevenueCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSellerOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSellerRevenuePage(
    val ledger: List<SellerOpsRevenueLedgerRow> = emptyList(),
    val dailySeries: List<SellerOpsRevenueDay> = emptyList(),
    val summary: SellerOpsRevenueSummary? = null,
)

/**
 * On-device saved revenue — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_seller_ops_seller-revenue_cache".
 */
private object SellerRevenueCacheStore {
    private const val TAG = "ZylodSellerOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_seller_ops_seller-revenue_cache"

    fun read(context: Context): CachedSellerRevenuePage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSellerRevenuePage.serializer(), raw)
    }.onFailure { Log.w(TAG, "revenue cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSellerRevenuePage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSellerRevenuePage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "revenue cache write failed: ${it.message}") }
    }
}
