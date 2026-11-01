package com.zylod.wholesale.ui.sellerops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.SellerOpsApi
import com.zylod.wholesale.data.api.SellerOpsReviewRow
import com.zylod.wholesale.data.api.SellerOpsReviewsData
import com.zylod.wholesale.data.api.SellerOpsReviewsEnvelope
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
 * t266 — Seller Reviews VM (pageId "seller-reviews"): GET api/supplier/
 * reviews (reviews/route.ts, requireUserType(['supplier','admin']),
 * 401-first) — the seller's reviews console: BOTH rails the platform
 * persists merged newest-first (kind 'product' from db.reviews + kind
 * 'store' from supplierReviews, capped at 50 combined) with the route's
 * per-kind honest aggregates.
 *
 *  - NO query params: the handler takes NO status/rating filter (verified —
 *    it only resolves the supplier profile), so this screen renders NO chip
 *    row; each row carries its kind badge instead.
 *  - NOT-SELLER: 401 signed-out AND 403 no-supplier-profile → honest gate.
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_seller_ops_seller-reviews_cache", written ONLY
 *    after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SellerReviewsUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val rows: List<SellerOpsReviewRow> = emptyList(),
    /** The route's per-kind aggregates — product rail is the headline. */
    val data: SellerOpsReviewsData? = null,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or account without a supplier profile. */
    val notSeller: Boolean = false,
)

class SellerReviewsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SellerReviewsUiState())
    val state: StateFlow<SellerReviewsUiState> = _state.asStateFlow()

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
            Log.i(TAG, "fetch seller reviews")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SellerOpsApi = ApiClient.sellerOpsApi(base)
            val response = api.reviews()
            // Honest seller gate: signed-out callers are 401; sessions
            // without a supplier profile are 403 (SUPPLIER_PROFILE_REQUIRED).
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not a seller session (http=${response.code()})")
                _state.value = SellerReviewsUiState(loading = false, notSeller = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load reviews (HTTP ${response.code()})"
                Log.w(TAG, "reviews error: $message")
                degrade(message)
                return
            }
            val body: SellerOpsReviewsEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load reviews")
                return
            }
            val incoming = body.data?.reviews.orEmpty()
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                rows = incoming,
                data = body.data,
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            if (incoming.isNotEmpty()) {
                persistCache(incoming, body.data)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "reviews fetch failed: ${e.message}")
            degrade("Network error while loading reviews. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { SellerReviewsCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = SellerReviewsUiState(
                loading = false,
                rows = cached.rows,
                data = cached.data,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(rows: List<SellerOpsReviewRow>, data: SellerOpsReviewsData?) {
        val payload = CachedSellerReviewsPage(rows = rows, data = data)
        viewModelScope.launch(Dispatchers.IO) {
            SellerReviewsCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSellerOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSellerReviewsPage(
    val rows: List<SellerOpsReviewRow> = emptyList(),
    val data: SellerOpsReviewsData? = null,
)

/**
 * On-device saved reviews — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_seller_ops_seller-reviews_cache".
 */
private object SellerReviewsCacheStore {
    private const val TAG = "ZylodSellerOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_seller_ops_seller-reviews_cache"

    fun read(context: Context): CachedSellerReviewsPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSellerReviewsPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "reviews cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSellerReviewsPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSellerReviewsPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "reviews cache write failed: ${it.message}") }
    }
}
