package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WalletBalanceDto
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Apply-credits VM — GET api/wallet/balance through the EXISTING [WalletApi]
 * (never redeclared — t256 contract) as the payload of record for the
 * native apply-credits pageId.
 *
 * ROUTE TRUTH: the web apply-credits page is NOT the credit-limit request
 * flow — it is the "Apply Wallet Credit" page: the REAL wallet balance
 * plus an honest notice that checkout does not deduct from the wallet yet.
 * This VM mirrors exactly that (the read-only balance; no apply action is
 * invented). A 401 (after the shared OkHttp authenticator's one refresh)
 * → the honest sign-in gate. The last saved balance
 * ("zylod_config", "native_apply_credits_cache") renders with the offline
 * banner otherwise (FinanceCacheStore degrade convention).
 */
data class ApplyCreditsUiState(
    val loading: Boolean = true,
    val balance: WalletBalanceDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible balance came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class ApplyCreditsViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ApplyCreditsUiState())
    val state: StateFlow<ApplyCreditsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null

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
        if (initJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = ApplyCreditsUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.value = _state.value.copy(
            loading = _state.value.balance == null,
            error = null,
            needsAuth = false,
            offlineFromCache = false,
        )
        initJob = viewModelScope.launch { fetchBalance() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    private suspend fun fetchBalance() {
        try {
            Log.i(TAG, "fetch wallet balance")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            // The EXISTING WalletApi — not redeclared (t256 contract).
            val response = ApiClient.walletApi(base).balance()
            if (response.code() == 401) {
                Log.i(TAG, "not permitted (http=401) — session ended")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            val payload = response.body()
            val balance = payload?.data
            if (!response.isSuccessful || payload?.success != true || balance == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to load wallet balance (HTTP ${response.code()})."
                Log.w(TAG, "balance error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "balance loaded available=${balance.availableBalance}")
            _state.value = ApplyCreditsUiState(loading = false, balance = balance)
            persistCache(balance)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "balance fetch failed: ${e.message}")
            degrade("Network error while loading your wallet balance. Check your connection and retry.")
        }
    }

    /** Failure path: saved balance cache; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.APPLY_CREDITS, CachedApplyCreditsBalance.serializer())
        }
        val balance = cached?.balance
        if (balance != null) {
            Log.i(TAG, "degrade → cached wallet balance")
            _state.value = ApplyCreditsUiState(loading = false, balance = balance, offlineFromCache = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(balance: WalletBalanceDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.APPLY_CREDITS,
                CachedApplyCreditsBalance.serializer(),
                CachedApplyCreditsBalance(balance = balance),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}
