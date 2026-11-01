package com.zylod.wholesale.ui.sellerops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.SellerOpsApi
import com.zylod.wholesale.data.api.SellerOpsInventoryEnvelope
import com.zylod.wholesale.data.api.SellerOpsInventoryItem
import com.zylod.wholesale.data.api.SellerOpsInventorySummary
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
 * t266 — Seller Inventory VM (pageId "seller-inventory"): GET api/supplier/
 * inventory (inventory/route.ts, requireUserType(['supplier','admin']),
 * 401-first) — the session supplier's REAL stock levels with variants
 * nested, ordered by stockQuantity ascending, plus the route's own summary
 * (per-product alert thresholds honored, platform fallback 20).
 *
 *  - NO query params sent: the handler's ?all=true is ADMIN-ONLY and a
 *    plain seller session is always scoped to its own profile — the native
 *    screen sends nothing.
 *  - NOT-SELLER: 401 signed-out AND 403 no-supplier-profile → honest gate.
 *    (This handler answers a SUCCESS empty body for a profile-less session;
 *    the gate covers the 403-shaped handlers above it in the batch.)
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_seller_ops_seller-inventory_cache", written
 *    ONLY after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SellerInventoryUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val rows: List<SellerOpsInventoryItem> = emptyList(),
    /** Derived from the rows server-side — rendered as-is. */
    val summary: SellerOpsInventorySummary? = null,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or account without a supplier profile. */
    val notSeller: Boolean = false,
)

class SellerInventoryViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SellerInventoryUiState())
    val state: StateFlow<SellerInventoryUiState> = _state.asStateFlow()

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
            Log.i(TAG, "fetch seller inventory")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SellerOpsApi = ApiClient.sellerOpsApi(base)
            val response = api.inventory()
            // Honest seller gate: signed-out callers are 401; sessions
            // without a supplier profile are 403 on the batch's guarded
            // handlers (this one answers an honest empty inventory).
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not a seller session (http=${response.code()})")
                _state.value = SellerInventoryUiState(loading = false, notSeller = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load inventory (HTTP ${response.code()})"
                Log.w(TAG, "inventory error: $message")
                degrade(message)
                return
            }
            val body: SellerOpsInventoryEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load inventory")
                return
            }
            val incoming = body.data?.items.orEmpty()
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                rows = incoming,
                summary = body.data?.summary,
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            if (incoming.isNotEmpty()) {
                persistCache(incoming, body.data?.summary)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "inventory fetch failed: ${e.message}")
            degrade("Network error while loading inventory. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { SellerInventoryCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = SellerInventoryUiState(
                loading = false,
                rows = cached.rows,
                summary = cached.summary,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(rows: List<SellerOpsInventoryItem>, summary: SellerOpsInventorySummary?) {
        val payload = CachedSellerInventoryPage(rows = rows, summary = summary)
        viewModelScope.launch(Dispatchers.IO) {
            SellerInventoryCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSellerOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSellerInventoryPage(
    val rows: List<SellerOpsInventoryItem> = emptyList(),
    val summary: SellerOpsInventorySummary? = null,
)

/**
 * On-device saved inventory — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_seller_ops_seller-inventory_cache".
 */
private object SellerInventoryCacheStore {
    private const val TAG = "ZylodSellerOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_seller_ops_seller-inventory_cache"

    fun read(context: Context): CachedSellerInventoryPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSellerInventoryPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "inventory cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSellerInventoryPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSellerInventoryPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "inventory cache write failed: ${it.message}") }
    }
}
