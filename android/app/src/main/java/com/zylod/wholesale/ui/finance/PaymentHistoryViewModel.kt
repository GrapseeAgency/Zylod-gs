package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.PaymentHistoryRowDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Payment-history VM — GET api/payments/history (FinanceApi.paymentsHistory)
 * as the payload of record for the native payment-history pageId.
 *
 *  - STATUS FILTER: the route's REAL contract — `status` is an EXACT match
 *    on the payments.status column and is SKIPPED when "all"/absent. The
 *    screen's chips send the web page's exact four values (all | success |
 *    pending | failed); there are no other wire values, so no other chip.
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 (the
 *    shared OkHttp authenticator already tried one refresh) → needsAuth.
 *  - OFFLINE (WalletTransactionsViewModel degrade convention): on failure,
 *    renderable rows survive — in-memory first, then the device-saved cache
 *    (SharedPreferences "zylod_config", "native_payment_history_cache",
 *    written after every success, TAGGED with the filter it was fetched
 *    under — a cache never renders under a different chip).
 */
data class PaymentHistoryUiState(
    val loading: Boolean = true,
    val rows: List<PaymentHistoryRowDto> = emptyList(),
    /** The active status filter — the wire value ("all" = the skip token). */
    val filter: String = FILTER_ALL,
    /** The visible rows are SAVED data (in-memory or disk cache). */
    val offline: Boolean = false,
    /** Signed out (no token / dead session after the refresh retry). */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
) {
    companion object {
        /** The route's documented skip token for the status param. */
        const val FILTER_ALL = "all"
    }
}

class PaymentHistoryViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(PaymentHistoryUiState())
    val state: StateFlow<PaymentHistoryUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var activeFilter = PaymentHistoryUiState.FILTER_ALL
    private var fetchInFlight = false

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in state (WalletTransactionsViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = PaymentHistoryUiState(
                        loading = false,
                        filter = activeFilter,
                        needsAuth = true,
                    )
                }
            }
        }
    }

    /** Entry pull / retry (called on EVERY entry — guard doctrine holds). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = PaymentHistoryUiState(
                loading = false,
                filter = activeFilter,
                needsAuth = true,
            )
            return
        }
        if (fetchInFlight) return
        _state.value = _state.value.copy(
            loading = _state.value.rows.isEmpty(),
            error = null,
            needsAuth = false,
            offline = false,
            filter = activeFilter,
        )
        viewModelScope.launch { fetch() }
    }

    /** Same hook as OrdersViewModel.retry() — screens may bind either name. */
    fun retry() = refresh()

    /**
     * Status chip tap — swaps the filter and re-fetches (the route filters
     * server-side by the exact status value; "all" is the skip token).
     * Same-filter taps are no-ops.
     */
    fun setFilter(status: String) {
        if (status == activeFilter) return
        activeFilter = status
        if (SessionManager.token() == null) {
            _state.value = PaymentHistoryUiState(
                loading = false,
                filter = activeFilter,
                needsAuth = true,
            )
            return
        }
        _state.value = PaymentHistoryUiState(loading = true, filter = activeFilter)
        viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        fetchInFlight = true
        try {
            Log.i(TAG, "fetch payment history filter=$activeFilter")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).paymentsHistory(
                status = activeFilter.takeIf { it != PaymentHistoryUiState.FILTER_ALL },
            )
            if (response.code() == 401) {
                Log.w(TAG, "payment history 401 — session ended")
                _state.value = PaymentHistoryUiState(
                    loading = false,
                    filter = activeFilter,
                    needsAuth = true,
                )
                return
            }
            val payload = response.body()
            val rows = payload?.data
            if (!response.isSuccessful || payload?.success != true || rows == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your payment history (HTTP ${response.code()})."
                Log.w(TAG, "payment history error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "payment history loaded rows=${rows.size}")
            _state.value = PaymentHistoryUiState(loading = false, rows = rows, filter = activeFilter)
            persistCache(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "payment history fetch failed: ${e.message}")
            degrade("Network error while loading your payment history. Check your connection and retry.")
        } finally {
            fetchInFlight = false
        }
    }

    /**
     * Failure path: keep renderable rows (banner state) — in-memory first,
     * then the saved cache ONLY when it was fetched under the same filter;
     * with neither, the honest error card.
     */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.rows.isNotEmpty()) {
            _state.value = s.copy(loading = false, offline = true)
            return
        }
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.PAYMENT_HISTORY, CachedPaymentHistory.serializer())
        }
        val usable = cached?.takeIf { it.filter == activeFilter && it.rows.isNotEmpty() }
        if (usable != null) {
            Log.i(TAG, "degrade → cache rows=${usable.rows.size}")
            _state.value = PaymentHistoryUiState(
                loading = false,
                rows = usable.rows,
                filter = activeFilter,
                offline = true,
            )
        } else {
            _state.value = PaymentHistoryUiState(
                loading = false,
                filter = activeFilter,
                error = message,
            )
        }
    }

    /** Persist the rows, tagged with the filter they belong to. */
    private fun persistCache(rows: List<PaymentHistoryRowDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.PAYMENT_HISTORY,
                CachedPaymentHistory.serializer(),
                CachedPaymentHistory(rows = rows, filter = activeFilter),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}
