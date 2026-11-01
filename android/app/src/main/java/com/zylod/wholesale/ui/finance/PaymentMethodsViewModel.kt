package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.PaymentMethodRowDto
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
 * Payment-methods VM — GET api/payment-methods (FinanceApi.paymentMethods,
 * payment-methods/route.ts:15) as the payload of record for the native
 * payment-method pageId. The route returns the RAW db rows of EVERY family
 * — bKash/Nagad/Upay/Rocket wallets, debit/credit cards AND the 'bank'
 * rows the bank-accounts rail owns; the screen renders the wallet + card
 * families in two sections and leaves the bank rows to the bank-accounts
 * page (they still exist — nothing is hidden, they live on their own
 * surface).
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    the fetch means a real end of session (the shared OkHttp authenticator
 *    has already attempted one token refresh by then) → needsAuth.
 *  - FAILURE: honest error card + Retry when nothing renderable; the last
 *    saved snapshot (SharedPreferences "zylod_config",
 *    "native_payment_methods_cache") renders with the offline banner
 *    otherwise (BankAccountsViewModel degrade convention).
 *  - DELETE: DELETE api/payment-methods/{id} (payment-methods/[id]/route.ts
 *    — that file's ONLY method; 404 for a foreign id; success carries NO
 *    message field) — on success the row drops locally AND the full list
 *    re-fetches; the failure text surfaces honestly in a snackbar.
 *    Double-delete is guarded (one in-flight delete at a time).
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (TrackOrderViewModel convention) while sharing the one cache key.
 */
data class PaymentMethodsUiState(
    /** Resolving / fetching the list (skeleton cards while empty). */
    val loading: Boolean = true,
    /** EVERY raw row from the wire (all families, including bank rows). */
    val rows: List<PaymentMethodRowDto> = emptyList(),
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible list came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** The delete in flight (its row shows progress; further deletes blocked). */
    val deletingId: String? = null,
    /** A failed delete/refresh action — surfaced as a snackbar, non-fatal. */
    val actionError: String? = null,
) {
    /** The wallet-family rows (bKash/Nagad/Upay/Rocket), server order. */
    val wallets: List<PaymentMethodRowDto>
        get() = rows.filter { isMobileWalletType(it.type) }

    /** The card-family rows (debit/credit, plus the legacy 'card' type). */
    val cards: List<PaymentMethodRowDto>
        get() = rows.filter { isCardFamilyType(it.type) }

    /** True when neither renderable family has a row. */
    val isEmpty: Boolean get() = wallets.isEmpty() && cards.isEmpty()
}

class PaymentMethodsViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(PaymentMethodsUiState())
    val state: StateFlow<PaymentMethodsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (BankAccountsViewModel convention).
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
    fun load() {
        if (initJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = PaymentMethodsUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.rows.isEmpty(),
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchMethods() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /**
     * DELETE api/payment-methods/{id} — the [id] file's real (and only)
     * removal method. Success drops the row locally and re-fetches; the
     * failure text surfaces honestly in the snackbar line.
     */
    fun delete(methodId: String) {
        val s = _state.value
        if (methodId.isBlank() || s.deletingId != null) return
        if (SessionManager.token() == null) {
            _state.value = s.copy(deletingId = null, needsAuth = true)
            return
        }
        _state.update { it.copy(deletingId = methodId, actionError = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "delete payment method …${methodId.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.financeApi(base).deletePaymentMethod(methodId)
                if (response.code() == 401) {
                    Log.i(TAG, "delete rejected (http=401) — session ended")
                    _state.update { it.copy(deletingId = null, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    Log.i(TAG, "payment method removed")
                    _state.update {
                        it.copy(
                            deletingId = null,
                            rows = it.rows.filter { row -> row.id != methodId },
                        )
                    }
                    // Re-fetch the server's authoritative list (its
                    // isDefault DESC ordering may reshuffle).
                    load()
                    return@launch
                }
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not remove the payment method (HTTP ${response.code()})."
                Log.w(TAG, "delete failed: $message")
                _state.update { it.copy(deletingId = null, actionError = message) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "delete failed: ${e.message}")
                _state.update {
                    it.copy(
                        deletingId = null,
                        actionError = "Network error while removing the payment method. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /** The snackbar consumed its action error. */
    fun consumeActionError() {
        _state.update { it.copy(actionError = null) }
    }

    private suspend fun fetchMethods() {
        try {
            Log.i(TAG, "fetch payment methods")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).paymentMethods()
            if (gateOn401(response.code())) return
            val payload = response.body()
            val rows = payload?.data
                ?.takeIf { response.isSuccessful && payload?.success == true }
                .orEmpty()
            if (!response.isSuccessful || payload?.success != true) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your payment methods (HTTP ${response.code()})."
                Log.w(TAG, "payment methods error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "payment methods loaded rows=${rows.size}")
            _state.value = PaymentMethodsUiState(loading = false, rows = rows)
            persistCache(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "payment methods fetch failed: ${e.message}")
            degrade("Network error while loading your payment methods. Check your connection and retry.")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved list
     * cache; with none, the honest error card. Mapped on the MAIN thread
     * after the IO cache read (AddressBookViewModel convention).
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(
                appContext,
                FinanceCacheKeys.PAYMENT_METHODS,
                CachedPaymentMethods.serializer(),
            )
        }
        val rows = cached?.rows.orEmpty()
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cache rows=${rows.size}")
            _state.value = PaymentMethodsUiState(
                loading = false,
                rows = rows,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the raw wire rows — the offline render matches the live one. */
    private fun persistCache(rows: List<PaymentMethodRowDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                FinanceCacheKeys.PAYMENT_METHODS,
                CachedPaymentMethods.serializer(),
                CachedPaymentMethods(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}
