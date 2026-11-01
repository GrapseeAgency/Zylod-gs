package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CommissionBookDto
import com.zylod.wholesale.data.api.SellerEarningsDto
import com.zylod.wholesale.data.api.ServerConfig
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
 * Seller-finance VM — GET api/finance/earnings + GET api/finance/commissions
 * (FinanceApi.financeEarnings / .financeCommissions, the web "finance"
 * surface's two money calls) as the payload of record for the native
 * finance pageId. The two calls compose the same way the screen composes
 * them: earnings is the GATE, commissions the table.
 *
 *  - SUPPLIER-ONLY: earnings is requireUserType(['supplier']) — a BUYER
 *    session gets 403 (auth.error text, e.g. 'Supplier account required'),
 *    a guest 401. On 403 the screen renders the honest role gate and NEVER
 *    a zero-shaped revenue card (the t216 doctrine this route was built
 *    around). Commissions authenticates WITHOUT a role gate (a buyer
 *    parses an empty book), so it is only rendered once earnings passed.
 *  - AUTH: no token → no call at all, the honest sign-in gate.
 *  - PARTIAL FAILURE: earnings ok + commissions failed → the earnings
 *    cards render with an honest commissions error card (separate retry).
 *  - OFFLINE: the last saved payloads ("zylod_config",
 *    "native_seller_finance_cache" / "native_seller_commissions_cache")
 *    render with the offline banner otherwise (FinanceCacheStore
 *    degrade convention).
 */
data class SellerFinanceUiState(
    val loading: Boolean = true,
    /** The earnings payload (null while loading / gated / failed). */
    val earnings: SellerEarningsDto? = null,
    /** The commissions payload (rendered only when earnings passed). */
    val commissions: CommissionBookDto? = null,
    /** Earnings load failure text (with Retry). */
    val error: String? = null,
    /** Commissions load failure text (honest card + its own retry). */
    val commissionsError: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /**
     * 403 role denial from the supplier-only earnings route — the honest
     * gate ("Supplier account required"), never a zero revenue card.
     * Carries the route's verbatim error text.
     */
    val supplierGateMessage: String? = null,
    /** The visible payloads came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class SellerFinanceViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(SellerFinanceUiState())
    val state: StateFlow<SellerFinanceUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var commissionsJob: Job? = null

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
            _state.value = SellerFinanceUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.value = _state.value.copy(
            loading = _state.value.earnings == null,
            error = null,
            needsAuth = false,
            supplierGateMessage = null,
            offlineFromCache = false,
        )
        initJob = viewModelScope.launch {
            // BOTH calls fire together (the screen composes the same two
            // endpoints); the earnings verdict decides the render.
            val commissionsDeferred = async { fetchCommissions() }
            fetchEarnings()
            commissionsDeferred.await()
        }
    }

    /** Error-card Retry — full re-fetch of both payloads. */
    fun retry() = load()

    /** The commissions error card's own retry — re-fetches just the table. */
    fun retryCommissions() {
        if (commissionsJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(needsAuth = true)
            return
        }
        _state.value = _state.value.copy(commissionsError = null)
        commissionsJob = viewModelScope.launch { fetchCommissions() }
    }

    private suspend fun fetchEarnings() {
        try {
            Log.i(TAG, "fetch seller earnings")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).financeEarnings()
            if (response.code() == 401) {
                Log.i(TAG, "not permitted (http=401) — session ended")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            if (response.code() == 403) {
                // The route's ROLE DENIAL — its verbatim error text becomes
                // the honest gate. No payload is parsed; no zero card renders.
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Supplier account required"
                Log.i(TAG, "supplier gate (http=403): $message")
                _state.value = _state.value.copy(
                    loading = false,
                    earnings = null,
                    commissions = null,
                    supplierGateMessage = message,
                )
                return
            }
            val payload = response.body()
            val earnings = payload?.data
            if (!response.isSuccessful || payload?.success != true || earnings == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your earnings (HTTP ${response.code()})."
                Log.w(TAG, "earnings error: $message")
                degradeEarnings(message)
                return
            }
            Log.i(TAG, "earnings loaded gmv=${earnings.grossGMV}")
            _state.value = _state.value.copy(
                loading = false,
                earnings = earnings,
                error = null,
                supplierGateMessage = null,
            )
            persistEarningsCache(earnings)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "earnings fetch failed: ${e.message}")
            degradeEarnings("Network error while loading your earnings. Check your connection and retry.")
        }
    }

    private suspend fun fetchCommissions() {
        try {
            Log.i(TAG, "fetch seller commissions")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).financeCommissions()
            if (response.code() == 401) {
                Log.i(TAG, "commissions not permitted (http=401) — session ended")
                _state.value = _state.value.copy(commissionsError = null, needsAuth = true)
                return
            }
            val payload = response.body()
            val book = payload?.data
            if (!response.isSuccessful || payload?.success != true || book == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your commission ledger (HTTP ${response.code()})."
                Log.w(TAG, "commissions error: $message")
                degradeCommissions(message)
                return
            }
            Log.i(TAG, "commissions loaded rows=${book.items.size}")
            _state.value = _state.value.copy(commissions = book, commissionsError = null)
            persistCommissionsCache(book)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "commissions fetch failed: ${e.message}")
            degradeCommissions("Network error while loading your commission ledger. Check your connection and retry.")
        }
    }

    /** Failure path for earnings: saved cache; with none, the honest error. */
    private suspend fun degradeEarnings(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.SELLER_FINANCE, CachedSellerFinance.serializer())
        }
        val earnings = cached?.earnings
        if (earnings != null) {
            Log.i(TAG, "degrade → cached earnings")
            _state.value = _state.value.copy(loading = false, earnings = earnings, offlineFromCache = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    /** Failure path for commissions: saved cache; with none, its error card. */
    private suspend fun degradeCommissions(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.SELLER_COMMISSIONS, CachedCommissions.serializer())
        }
        val book = cached?.book
        if (book != null) {
            Log.i(TAG, "degrade → cached commissions")
            _state.value = _state.value.copy(commissions = book, commissionsError = null, offlineFromCache = true)
        } else {
            _state.value = _state.value.copy(commissionsError = message)
        }
    }

    private fun persistEarningsCache(earnings: SellerEarningsDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.SELLER_FINANCE,
                CachedSellerFinance.serializer(),
                CachedSellerFinance(earnings = earnings),
            )
        }
    }

    private fun persistCommissionsCache(book: CommissionBookDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.SELLER_COMMISSIONS,
                CachedCommissions.serializer(),
                CachedCommissions(book = book),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}
