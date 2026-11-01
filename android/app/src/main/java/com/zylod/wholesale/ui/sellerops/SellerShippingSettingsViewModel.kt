package com.zylod.wholesale.ui.sellerops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.SellerOpsApi
import com.zylod.wholesale.data.api.SellerOpsShippingConfig
import com.zylod.wholesale.data.api.SellerOpsShippingEnvelope
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
 * t266 — Seller Shipping Settings VM (pageId "seller-shipping-settings"):
 * GET api/supplier/shipping (shipping/route.ts, requireUserType
 * (['supplier','admin']), 401-first) — the REAL sellerShippingConfigs rows
 * for the signed-in supplier plus the model's zone enum list. READ-ONLY on
 * native this round: the GET is the wire contract rendered; the PATCH
 * upsert stays a web-console action (the t265 settings surface convention
 * for write-heavy admin tooling).
 *
 *  - NO query params on this route (verified in the handler) — no chip row.
 *  - NOT-SELLER: 401 signed-out AND 403 no-supplier-profile → honest gate.
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_seller_ops_seller-shipping-settings_cache",
 *    written ONLY after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SellerShippingSettingsUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val rows: List<SellerOpsShippingConfig> = emptyList(),
    /** The model's zone enum — zones without a config render as "not set". */
    val zones: List<String> = emptyList(),
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or account without a supplier profile. */
    val notSeller: Boolean = false,
)

class SellerShippingSettingsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SellerShippingSettingsUiState())
    val state: StateFlow<SellerShippingSettingsUiState> = _state.asStateFlow()

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
            Log.i(TAG, "fetch seller shipping configs")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SellerOpsApi = ApiClient.sellerOpsApi(base)
            val response = api.shipping()
            // Honest seller gate: signed-out callers are 401; sessions
            // without a supplier profile are 403 (SUPPLIER_PROFILE_REQUIRED).
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not a seller session (http=${response.code()})")
                _state.value = SellerShippingSettingsUiState(loading = false, notSeller = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load shipping settings (HTTP ${response.code()})"
                Log.w(TAG, "shipping error: $message")
                degrade(message)
                return
            }
            val body: SellerOpsShippingEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load shipping settings")
                return
            }
            val incoming = body.data?.configs.orEmpty()
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                rows = incoming,
                zones = body.data?.zones.orEmpty(),
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            if (incoming.isNotEmpty()) {
                persistCache(incoming, body.data?.zones.orEmpty())
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "shipping fetch failed: ${e.message}")
            degrade("Network error while loading shipping settings. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { SellerShippingCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = SellerShippingSettingsUiState(
                loading = false,
                rows = cached.rows,
                zones = cached.zones,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(rows: List<SellerOpsShippingConfig>, zones: List<String>) {
        val payload = CachedSellerShippingPage(rows = rows, zones = zones)
        viewModelScope.launch(Dispatchers.IO) {
            SellerShippingCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSellerOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSellerShippingPage(
    val rows: List<SellerOpsShippingConfig> = emptyList(),
    val zones: List<String> = emptyList(),
)

/**
 * On-device saved shipping configs — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_seller_ops_seller-shipping-settings_cache".
 */
private object SellerShippingCacheStore {
    private const val TAG = "ZylodSellerOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_seller_ops_seller-shipping-settings_cache"

    fun read(context: Context): CachedSellerShippingPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSellerShippingPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "shipping cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSellerShippingPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSellerShippingPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "shipping cache write failed: ${it.message}") }
    }
}
