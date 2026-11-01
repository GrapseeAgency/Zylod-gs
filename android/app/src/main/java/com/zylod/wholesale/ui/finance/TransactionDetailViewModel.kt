package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WalletTransactionDetailDto
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Transaction-detail VM — GET api/wallet/transactions/{id} through the
 * EXISTING [com.zylod.wholesale.data.api.WalletApi] (t256 does NOT
 * redeclare wallet endpoints; the [id] route server-verifies the row
 * belongs to the session user and answers 404 'Transaction not found'
 * otherwise). Payload of record for the native transaction-detail pageId.
 *
 *  - ID RESOLUTION: the entry query pins the transaction via
 *    [transactionIdFromQuery] ("id=x" or a bare token). NO id → the honest
 *    "No transaction selected" state — never a fabricated fallback id.
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    the fetch means a real end of session → needsAuth.
 *  - 404 is a DEFINITIVE answer ("Transaction not found") — the honest
 *    card, never a cache of some other transaction. Other HTTP/network
 *    errors → error text + Retry.
 *  - OFFLINE: on failure the last snapshot for THIS transaction survives —
 *    in-memory first, then the device-saved cache (SharedPreferences
 *    "zylod_config", "native_tx_detail_cache_<id>") — and the state flips
 *    offlineFromCache so the screen shows its saved-data banner. The cache
 *    is only usable when it was saved for the SAME transaction id.
 */
data class TransactionDetailUiState(
    /** Resolving / fetching (skeleton while empty). */
    val loading: Boolean = true,
    /** False → the entry query carried no transaction id (honest state). */
    val hasId: Boolean = false,
    /** The resolved transaction id (empty until the query yields one). */
    val txId: String = "",
    val detail: WalletTransactionDetailDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Definitive HTTP 404 → the honest "Transaction not found" card. */
    val notFound: Boolean = false,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible detail came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class TransactionDetailViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(TransactionDetailUiState())
    val state: StateFlow<TransactionDetailUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var lastQuery: String = ""

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (TrackOrderViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(
                        loading = false,
                        needsAuth = true,
                    )
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(entryQuery: String? = null) {
        if (entryQuery != null) lastQuery = entryQuery
        if (initJob?.isActive == true) return
        val txId = transactionIdFromQuery(lastQuery)
        if (txId == null) {
            // Honest: no transaction id in the entry query.
            Log.i(TAG, "no tx id in query — no-transaction state")
            _state.value = TransactionDetailUiState(loading = false, hasId = false)
            return
        }
        if (SessionManager.token() == null) {
            _state.value = TransactionDetailUiState(loading = false, hasId = true, txId = txId, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.txId != txId || it.detail == null,
                hasId = true,
                txId = txId,
                error = null,
                notFound = false,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchTransaction(txId) }
    }

    /** Error-card Retry — full re-fetch of the same transaction. */
    fun retry() {
        load()
    }

    private suspend fun fetchTransaction(txId: String) {
        try {
            Log.i(TAG, "fetch transaction …${txId.takeLast(6)}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            // The EXISTING WalletApi — not redeclared (t256 contract).
            val response = ApiClient.walletApi(base).transaction(txId)
            if (response.code() == 401) {
                Log.i(TAG, "not permitted (http=401) — session ended")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            if (response.code() == 404) {
                Log.i(TAG, "transaction not found (http=404)")
                _state.value = _state.value.copy(loading = false, notFound = true, detail = null)
                return
            }
            val payload = response.body()
            val detail = payload?.data
            if (!response.isSuccessful || payload?.success != true || detail == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the transaction (HTTP ${response.code()})."
                Log.w(TAG, "transaction error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "transaction loaded")
            _state.value = TransactionDetailUiState(
                loading = false,
                hasId = true,
                txId = txId,
                detail = detail,
            )
            persistCache(txId, detail)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "transaction fetch failed: ${e.message}")
            degrade("Network error while loading the transaction. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep the renderable detail (banner state) — in-memory
     * first, then the saved cache for THIS id; with neither, the honest
     * error card.
     */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.detail != null) {
            _state.value = s.copy(loading = false, offlineFromCache = true)
            return
        }
        val txId = s.txId
        val cached = withContext(Dispatchers.IO) {
            txId.takeIf(String::isNotBlank)?.let {
                FinanceCacheStore.read(
                    appContext,
                    FinanceCacheKeys.TRANSACTION_DETAIL_PREFIX + it,
                    CachedTransactionDetail.serializer(),
                )
            }
        }
        val renderable = cached?.detail
        if (renderable != null) {
            _state.value = TransactionDetailUiState(
                loading = false,
                hasId = true,
                txId = txId,
                detail = renderable,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(txId: String, detail: WalletTransactionDetailDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                FinanceCacheKeys.TRANSACTION_DETAIL_PREFIX + txId,
                CachedTransactionDetail.serializer(),
                CachedTransactionDetail(detail = detail),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}

/**
 * Extracts a transaction id from the page's entry query, mirroring the
 * native key=value query convention (TrackOrder orderIdFromQuery style):
 * a bare "&id=x" pair first, then a bare single token without any "=".
 * Null when nothing usable is present.
 */
fun transactionIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val named = Regex("(?:^|&)id=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!named.isNullOrBlank()) return named
    return raw.takeIf { !it.contains('=') }
}
