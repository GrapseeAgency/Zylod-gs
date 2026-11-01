package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.FailedPaymentRowDto
import com.zylod.wholesale.data.api.ServerConfig
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
 * Failed-payments VM — GET api/payments/failed (FinanceApi.paymentsFailed)
 * as the payload of record for the native payment-failed pageId.
 *
 *  - The rows carry the route's HONEST gateway reason (the stored
 *    gatewayResponse, or its verbatim fallback copy) — surfaced verbatim.
 *  - NO RETRY: there is no retry endpoint anywhere under api/payments (the
 *    web's "Retry Payment" button only NAVIGATES to checkout), so this VM
 *    offers none — the screen links to the payment-method surface and the
 *    payment hub instead, with honest copy.
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 (the
 *    shared OkHttp authenticator already tried one refresh) → needsAuth —
 *    never a fabricated "zero failed payments" empty state for a guest.
 *  - OFFLINE: the last saved list (SharedPreferences "zylod_config",
 *    "native_failed_payments_cache") renders with the offline banner
 *    otherwise (FinanceCacheStore degrade convention).
 */
data class FailedPaymentsUiState(
    val loading: Boolean = true,
    val rows: List<FailedPaymentRowDto> = emptyList(),
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible rows came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class FailedPaymentsViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(FailedPaymentsUiState())
    val state: StateFlow<FailedPaymentsUiState> = _state.asStateFlow()

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
            _state.value = FailedPaymentsUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.value = _state.value.copy(
            loading = _state.value.rows.isEmpty(),
            error = null,
            needsAuth = false,
            offlineFromCache = false,
        )
        initJob = viewModelScope.launch { fetchFailed() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    private suspend fun fetchFailed() {
        try {
            Log.i(TAG, "fetch failed payments")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).paymentsFailed()
            if (response.code() == 401) {
                Log.w(TAG, "failed payments 401 — session ended")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            val payload = response.body()
            val rows = payload?.data
            if (!response.isSuccessful || payload?.success != true || rows == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your failed payments (HTTP ${response.code()})."
                Log.w(TAG, "failed payments error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "failed payments loaded rows=${rows.size}")
            _state.value = FailedPaymentsUiState(loading = false, rows = rows)
            persistCache(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "failed payments fetch failed: ${e.message}")
            degrade("Network error while loading your failed payments. Check your connection and retry.")
        }
    }

    /** Failure path: saved list cache; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.FAILED_PAYMENTS, CachedFailedPayments.serializer())
        }
        val rows = cached?.rows.orEmpty()
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cache rows=${rows.size}")
            _state.value = FailedPaymentsUiState(loading = false, rows = rows, offlineFromCache = true)
        } else {
            _state.value = FailedPaymentsUiState(loading = false, error = message)
        }
    }

    /** Persist the wire DTOs — the offline render matches the live one. */
    private fun persistCache(rows: List<FailedPaymentRowDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.FAILED_PAYMENTS,
                CachedFailedPayments.serializer(),
                CachedFailedPayments(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}
