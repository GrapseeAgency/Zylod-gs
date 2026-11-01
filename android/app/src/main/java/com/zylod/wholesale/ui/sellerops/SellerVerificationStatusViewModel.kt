package com.zylod.wholesale.ui.sellerops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.SellerOpsApi
import com.zylod.wholesale.data.api.SellerOpsVerificationDoc
import com.zylod.wholesale.data.api.SellerOpsVerificationEnvelope
import com.zylod.wholesale.data.api.SellerOpsVerificationProgress
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
 * t266 — Seller Verification Status VM (pageId "seller-verification-status"):
 * GET api/supplier/verification (verification/route.ts, requireUserType
 * (['supplier','admin']), 401-first) — the sellerVerificationDocuments rows
 * for the signed-in supplier (newest upload first) plus the route's own
 * honest progress object (only VERIFIED rows count, and only the four
 * required document types). A status/detail surface, not a list console —
 * the screen renders the progress card + the required-types checklist +
 * the uploaded document rows.
 *
 *  - NO query params on this route (verified in the handler) — no chip row.
 *  - NOT-SELLER: 401 signed-out AND 403 no-supplier-profile → honest gate.
 *  - OFFLINE: in-memory docs first, then the saved cache
 *    ("zylod_config"/"native_seller_ops_seller-verification-status_cache",
 *    written ONLY after a successful pull that carried any document).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SellerVerificationStatusUiState(
    val loading: Boolean = true,
    /** A silent re-pull with docs already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val docs: List<SellerOpsVerificationDoc> = emptyList(),
    /** The route's own honest progress (verifiedRequired/totalRequired/…). */
    val progress: SellerOpsVerificationProgress? = null,
    /** Set only when nothing is renderable (no network AND no saved docs). */
    val error: String? = null,
    /** The visible docs are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible docs came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or account without a supplier profile. */
    val notSeller: Boolean = false,
)

class SellerVerificationStatusViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SellerVerificationStatusUiState())
    val state: StateFlow<SellerVerificationStatusUiState> = _state.asStateFlow()

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
        val hasDocs = _state.value.docs.isNotEmpty()
        _state.update {
            it.copy(
                loading = !hasDocs,
                refreshing = hasDocs,
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
            Log.i(TAG, "fetch seller verification status")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SellerOpsApi = ApiClient.sellerOpsApi(base)
            val response = api.verification()
            // Honest seller gate: signed-out callers are 401; sessions
            // without a supplier profile are 403 (SUPPLIER_PROFILE_REQUIRED).
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not a seller session (http=${response.code()})")
                _state.value = SellerVerificationStatusUiState(loading = false, notSeller = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load verification status (HTTP ${response.code()})"
                Log.w(TAG, "verification error: $message")
                degrade(message)
                return
            }
            val body: SellerOpsVerificationEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load verification status")
                return
            }
            val incoming = body.data
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                docs = incoming,
                progress = body.progress,
                error = null,
                offline = false,
                offlineFromCache = false,
                notSeller = false,
            )
            // Save cache ONLY on success with a non-empty document list
            // (wire DTOs — the offline render maps through the same objects).
            if (incoming.isNotEmpty()) {
                persistCache(incoming, body.progress)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "verification fetch failed: ${e.message}")
            degrade("Network error while loading verification status. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory docs
     * first, then the saved cache; with neither, the first-launch offline
     * state. Rows are mapped on the MAIN thread after the IO cache read.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.docs.isNotEmpty()) {
            _state.update {
                it.copy(loading = false, refreshing = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { SellerVerificationCacheStore.read(appContext) }
        if (cached != null && cached.docs.isNotEmpty()) {
            _state.value = SellerVerificationStatusUiState(
                loading = false,
                docs = cached.docs,
                progress = cached.progress,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(docs: List<SellerOpsVerificationDoc>, progress: SellerOpsVerificationProgress?) {
        val payload = CachedSellerVerificationPage(docs = docs, progress = progress)
        viewModelScope.launch(Dispatchers.IO) {
            SellerVerificationCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodSellerOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSellerVerificationPage(
    val docs: List<SellerOpsVerificationDoc> = emptyList(),
    val progress: SellerOpsVerificationProgress? = null,
)

/**
 * On-device saved verification documents — the SAME prefs file the rest of
 * the native shell uses (zylod_config), under the owner-fixed key
 * "native_seller_ops_seller-verification-status_cache".
 */
private object SellerVerificationCacheStore {
    private const val TAG = "ZylodSellerOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_seller_ops_seller-verification-status_cache"

    fun read(context: Context): CachedSellerVerificationPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSellerVerificationPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "verification cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSellerVerificationPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSellerVerificationPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "verification cache write failed: ${it.message}") }
    }
}
