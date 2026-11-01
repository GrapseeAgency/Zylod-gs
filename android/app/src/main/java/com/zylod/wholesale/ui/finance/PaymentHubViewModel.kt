package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.PaymentMethodRowDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WalletOverviewDto
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Payment-hub VM — the native "payment" pageId. The web page (?page=payment)
 * is the wallet-overview experience: a REAL balance strip, the saved
 * methods, and links into the payment surfaces. The native hub mirrors that
 * intent with the surfaces the app actually owns:
 *
 *  - BALANCE: GET api/wallet through the EXISTING [WalletApi] (never
 *    redeclared — t256 contract) — the signed-in user's REAL wallet.
 *  - DEFAULT METHOD: GET api/payment-methods (FinanceApi.paymentMethods,
 *    t256) — the isDefault row renders; no default → the honest empty line.
 *  - LINKS: payment-history / payment-pending / payment-failed /
 *    payment-method / add-payment-method (+ the real wallet page) — all
 *    live native surfaces.
 *  - AUTH: no token → no call at all, the honest sign-in gate (the web
 *    page gates guests too).
 *  - OFFLINE: the last saved snapshot (SharedPreferences "zylod_config",
 *    "native_payment_hub_cache") renders with the offline banner otherwise.
 */
data class PaymentHubUiState(
    val loading: Boolean = true,
    /** The REAL wallet overview (balance + escrow) from the existing WalletApi. */
    val wallet: WalletOverviewDto? = null,
    /** The signed-in user's REAL default payment method row (null = none). */
    val defaultMethod: PaymentMethodRowDto? = null,
    /** The user HAS saved methods, just none flagged default. */
    val hasMethods: Boolean = false,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible snapshot came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class PaymentHubViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(PaymentHubUiState())
    val state: StateFlow<PaymentHubUiState> = _state.asStateFlow()

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
            _state.value = PaymentHubUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.value = _state.value.copy(
            loading = _state.value.wallet == null,
            error = null,
            needsAuth = false,
            offlineFromCache = false,
        )
        initJob = viewModelScope.launch {
            // Both reads fire together; a wallet failure is fatal to the
            // hub (the banner IS the page), a methods failure degrades the
            // method row only.
            val methodsDeferred = async { fetchDefaultMethod() }
            fetchWallet()
            methodsDeferred.await()
        }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    private suspend fun fetchWallet() {
        try {
            Log.i(TAG, "fetch wallet overview")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.walletApi(base).overview()
            if (response.code() == 401) {
                Log.i(TAG, "not permitted (http=401) — session ended")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            val payload = response.body()
            val wallet = payload?.data
            if (!response.isSuccessful || payload?.success != true || wallet == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your wallet balance (HTTP ${response.code()})."
                Log.w(TAG, "wallet error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "wallet loaded balance=${wallet.balance}")
            _state.value = _state.value.copy(loading = false, wallet = wallet)
            persistCache()
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "wallet fetch failed: ${e.message}")
            degrade("Network error while loading your wallet balance. Check your connection and retry.")
        }
    }

    private suspend fun fetchDefaultMethod() {
        try {
            Log.i(TAG, "fetch payment methods")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).paymentMethods()
            if (response.code() == 401) {
                Log.i(TAG, "methods not permitted (http=401) — session ended")
                _state.value = _state.value.copy(needsAuth = true)
                return
            }
            val payload = response.body()
            val rows = payload?.data
            if (!response.isSuccessful || payload?.success != true || rows == null) {
                // The method row is a secondary element — its failure is an
                // honest empty line, not a page error.
                Log.w(TAG, "methods error (http=${response.code()}) — rendering without it")
                _state.value = _state.value.copy(defaultMethod = null, hasMethods = false)
                return
            }
            _state.value = _state.value.copy(
                defaultMethod = rows.firstOrNull { it.isDefault },
                hasMethods = rows.isNotEmpty(),
            )
            persistCache()
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "methods fetch failed: ${e.message}")
            _state.value = _state.value.copy(defaultMethod = null, hasMethods = false)
        }
    }

    /** Failure path: saved snapshot; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.PAYMENT_HUB, CachedPaymentHub.serializer())
        }
        if (cached?.wallet != null) {
            Log.i(TAG, "degrade → cached payment hub")
            _state.value = _state.value.copy(
                loading = false,
                wallet = cached.wallet,
                defaultMethod = cached.defaultMethod,
                hasMethods = cached.defaultMethod != null,
                offlineFromCache = true,
            )
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    /** Persist the current snapshot — the offline render matches the live one. */
    private fun persistCache() {
        val snapshot = _state.value
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.PAYMENT_HUB,
                CachedPaymentHub.serializer(),
                CachedPaymentHub(wallet = snapshot.wallet, defaultMethod = snapshot.defaultMethod),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}
