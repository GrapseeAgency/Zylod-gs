package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.RefundRowDto
import com.zylod.wholesale.data.api.ServerConfig
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
 * Refund-to-wallet VM — GET api/wallet/refund (WalletMoneyApi.refunds) as
 * the payload of record for the native refund-to-wallet pageId.
 *
 *  - THE REFUND DOCTRINE (Task 140, mirrored honestly): this ledger holds
 *    the refunds the PLATFORM actually processed for this buyer (written by
 *    the admin rail POST api/admin/returns/[id]/refund after an approved
 *    return), each with its real-world UTR / TxnID reference. The old
 *    self-service POST on this route was RETIRED — refunds are never
 *    self-claimed, so there is NO form here and never will be.
 *  - AUTH: no token → no call at all, the honest sign-in gate (the route
 *    is 401-first). A 401 on the fetch (after the shared authenticator's
 *    one refresh) → needsAuth.
 *  - OFFLINE: the last saved refund ledger ("zylod_config",
 *    "native_refund_ledger_cache") renders with the offline banner
 *    otherwise (FinanceCacheStore degrade convention).
 */
data class RefundToWalletUiState(
    /** Fetching the refund ledger (skeleton while empty). */
    val loading: Boolean = true,
    /** The buyer's processed refunds, newest first (the route's order). */
    val rows: List<RefundRowDto> = emptyList(),
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible ledger came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class RefundToWalletViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(RefundToWalletUiState())
    val state: StateFlow<RefundToWalletUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var ledgerJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (BankAccountsViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load() {
        if (ledgerJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = RefundToWalletUiState(loading = false, needsAuth = true)
            return
        }
        ledgerJob?.cancel()
        _state.update {
            it.copy(
                loading = it.rows.isEmpty(),
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        ledgerJob = viewModelScope.launch { fetchRefunds() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    private suspend fun fetchRefunds() {
        try {
            Log.i(TAG, "fetch refund ledger")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.walletMoneyApi(base).refunds()
            if (response.code() == 401) {
                Log.i(TAG, "refunds not permitted (http=401) — session ended")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            val payload = response.body()
            val rows = payload?.data
            if (!response.isSuccessful || payload?.success != true || rows == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load refunds (HTTP ${response.code()})"
                Log.w(TAG, "refund ledger error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "refund ledger loaded rows=${rows.size}")
            _state.value = _state.value.copy(
                loading = false,
                rows = rows,
                error = null,
            )
            persistCache(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "refund ledger fetch failed: ${e.message}")
            degrade("Network error — could not reach the refund service.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved refund
     * cache; with none, the honest error card.
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, MoneyCacheKeys.REFUND_LEDGER, CachedRefundLedger.serializer())
        }
        val rows = cached?.rows
        if (rows != null) {
            Log.i(TAG, "degrade → cached refund ledger")
            _state.value = _state.value.copy(
                loading = false,
                rows = rows,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the live one. */
    private fun persistCache(rows: List<RefundRowDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                MoneyCacheKeys.REFUND_LEDGER,
                CachedRefundLedger.serializer(),
                CachedRefundLedger(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodMoney"
    }
}
