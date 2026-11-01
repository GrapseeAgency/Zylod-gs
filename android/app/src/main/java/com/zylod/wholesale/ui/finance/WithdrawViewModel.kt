package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.PayoutLedgerDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WithdrawBody
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
 * Withdraw VM — GET/POST api/wallet/withdraw (WalletMoneyApi.payoutLedger /
 * .requestWithdrawal) as the payload of record for BOTH native pageIds
 * "withdraw" AND "withdraw-money" (one shared rail, pageId-keyed VMs).
 *
 *  - THE PAYOUT DOCTRINE (Task 107): a withdrawal request creates a
 *    PENDING sellerPayouts row; the wallet is untouched until an admin
 *    completes it. The GET's honest three-way split (balance / onHold /
 *    available = balance − the supplier's own pending+processing holds)
 *    is rendered as-is — no invented available figure.
 *  - SUPPLIER-ONLY: a buyer session gets 403 with the supplier-scope.ts
 *    verbatim body { error: 'Supplier profile required. Only registered
 *    suppliers can access seller data.' } — the screen renders the honest
 *    role gate and NEVER a zero-shaped balance card (the t216/SellerFinance
 *    doctrine). A guest gets 401 → the sign-in gate.
 *  - REQUEST FORM (withdrawSchema mirrored): amount positive ≥ ৳50 AND
 *    ≤ the REAL available; method bank|bKash|Nagad|Upay|Rocket;
 *    accountNumber 6..40; holderName 2..80; bankName only when method is
 *    bank (the web's select options, sent verbatim). The server's verbatim
 *    400 text — including the exceeds-available message that spells out
 *    the real balance/hold numbers — surfaces as-is; 404 'No wallet found
 *    for this account' verbatim. Success 201 shows the route's message
 *    verbatim + payoutId + the server's onHoldAfter/availableAfter inline,
 *    then re-fetches the ledger so the pending row appears.
 *  - OFFLINE: the last saved rail payload ("zylod_config",
 *    "native_payout_ledger_cache") renders with the offline banner
 *    otherwise (FinanceCacheStore degrade convention).
 */
data class WithdrawUiState(
    /** Fetching the payout rail (skeleton while empty). */
    val loading: Boolean = true,
    /** The rail payload (null while loading / gated / failed). */
    val ledger: PayoutLedgerDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /**
     * 403 role denial from the supplier-only rail — the honest gate
     * ("Supplier profile required"), never a zero-shaped balance card.
     * Carries the route's verbatim error text.
     */
    val supplierGateMessage: String? = null,
    /** The visible rail came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    // ── request-withdrawal form ──
    /** The expandable form is open. */
    val formVisible: Boolean = false,
    /** Raw amount field text (parsed on submit — the client guard). */
    val amountText: String = "",
    /** Selected payout method (the withdrawSchema enum tokens). */
    val payoutMethod: String = "bank",
    /** Bank name (the web select's options; sent only when method=bank). */
    val bankName: String = PAYOUT_BANK_NAMES.first(),
    /** Beneficiary account number (6..40). */
    val accountNumber: String = "",
    /** Beneficiary / corporate account title (2..80). */
    val holderName: String = "",
    /** Submit in flight — the button is disabled (route rate-limits 10/min). */
    val submitting: Boolean = false,
    /** The verbatim server rejection (400 zod/holds / 404 no wallet / 429). */
    val submitError: String? = null,
    /** Real success: the route's 201 message verbatim. */
    val successMessage: String? = null,
    /** Real success: the created sellerPayouts row id. */
    val successPayoutId: String? = null,
    /** Real success: the server's post-hold available figure. */
    val successAvailableAfter: Double? = null,
) {
    /** The client-side amount guard: ≥ ৳50 and ≤ the REAL available. */
    val amountInvalid: Boolean
        get() {
            val amount = amountText.trim().toDoubleOrNull() ?: return true
            if (amount < WITHDRAW_AMOUNT_MIN) return true
            val available = ledger?.available
            return available != null && amount > available
        }

    /** The client-side required-fields guard (withdrawSchema mins). */
    val fieldsInvalid: Boolean
        get() = accountNumber.trim().length < 6 || holderName.trim().length < 2
}

class WithdrawViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(WithdrawUiState())
    val state: StateFlow<WithdrawUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var ledgerJob: Job? = null
    private var submitJob: Job? = null

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
            _state.value = WithdrawUiState(loading = false, needsAuth = true)
            return
        }
        ledgerJob?.cancel()
        _state.update {
            it.copy(
                loading = it.ledger == null,
                error = null,
                needsAuth = false,
                supplierGateMessage = null,
                offlineFromCache = false,
            )
        }
        ledgerJob = viewModelScope.launch { fetchLedger() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /* ── form events ── */

    fun toggleForm() {
        _state.update { it.copy(formVisible = !it.formVisible, submitError = null) }
    }

    fun setAmount(text: String) {
        _state.update { it.copy(amountText = text, submitError = null) }
    }

    fun setPayoutMethod(method: String) {
        _state.update { it.copy(payoutMethod = method, submitError = null) }
    }

    fun setBankName(name: String) {
        _state.update { it.copy(bankName = name, submitError = null) }
    }

    fun setAccountNumber(text: String) {
        _state.update { it.copy(accountNumber = text, submitError = null) }
    }

    fun setHolderName(text: String) {
        _state.update { it.copy(holderName = text, submitError = null) }
    }

    /** Withdraw Max — the web's own affordance (fills the REAL available). */
    fun fillMaxAmount() {
        val available = _state.value.ledger?.available ?: return
        _state.update { it.copy(amountText = available.toString(), submitError = null) }
    }

    /** Dismiss the inline success card (the user read the payout id). */
    fun consumeSuccess() {
        _state.update {
            it.copy(successMessage = null, successPayoutId = null, successAvailableAfter = null)
        }
    }

    /**
     * POST api/wallet/withdraw — the withdrawal REQUEST. Client guards:
     * ≥ ৳50, ≤ the REAL available, accountNumber ≥ 6, holderName ≥ 2 (the
     * withdrawSchema rules mirrored). The server's verbatim error text
     * (400 with the real balance/hold numbers, 404 no wallet, 401 session
     * end) surfaces honestly; success shows the route's message + payoutId
     * + availableAfter INLINE — a pending row, not a wallet debit — and
     * re-fetches the ledger.
     */
    fun submitWithdrawal() {
        val s = _state.value
        val amount = s.amountText.trim().toDoubleOrNull()
        val available = s.ledger?.available
        if (amount == null || amount < WITHDRAW_AMOUNT_MIN) {
            _state.update { it.copy(submitError = "Minimum withdrawal threshold is ৳50") }
            return
        }
        if (available != null && amount > available) {
            _state.update {
                it.copy(
                    submitError = "Withdrawal amount exceeds the available balance " +
                        "(balance minus requests already pending verification)",
                )
            }
            return
        }
        if (s.fieldsInvalid) {
            _state.update {
                it.copy(submitError = "Please enter account number and beneficiary name")
            }
            return
        }
        if (submitJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = s.copy(needsAuth = true, submitting = false)
            return
        }
        _state.update { it.copy(submitting = true, submitError = null) }
        submitJob = viewModelScope.launch {
            try {
                Log.i(TAG, "request withdrawal")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val body = WithdrawBody(
                    amount = amount,
                    method = s.payoutMethod,
                    accountNumber = s.accountNumber.trim(),
                    holderName = s.holderName.trim(),
                    bankName = if (s.payoutMethod == "bank") s.bankName.trim().takeIf(String::isNotBlank) else null,
                )
                val response = ApiClient.walletMoneyApi(base).requestWithdrawal(body)
                if (response.code() == 401) {
                    Log.i(TAG, "withdrawal rejected (http=401) — session ended")
                    _state.update { it.copy(submitting = false, needsAuth = true) }
                    return@launch
                }
                if (response.code() == 403) {
                    // The route's ROLE DENIAL — its verbatim text becomes the
                    // honest gate. No zero-shaped balance card ever renders.
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Supplier profile required. Only registered suppliers can access seller data."
                    Log.i(TAG, "supplier gate (http=403): $message")
                    _state.value = _state.value.copy(
                        submitting = false,
                        formVisible = false,
                        ledger = null,
                        supplierGateMessage = message,
                    )
                    return@launch
                }
                val payload = response.body()
                val data = payload?.data
                if (response.isSuccessful && payload?.success == true && data != null) {
                    Log.i(TAG, "payout requested id=${data.payoutId} status=${data.status}")
                    _state.update {
                        it.copy(
                            submitting = false,
                            formVisible = false,
                            successMessage = payload.message
                                ?.takeIf(String::isNotBlank)
                                ?: "Withdrawal request submitted — an admin verifies it before any money leaves.",
                            successPayoutId = data.payoutId,
                            successAvailableAfter = data.availableAfter,
                            amountText = "",
                        )
                    }
                    refreshLedgerAfterSubmit()
                    return@launch
                }
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Withdrawal failed. Please check details. (HTTP ${response.code()})"
                Log.w(TAG, "withdrawal failed: $message")
                _state.update { it.copy(submitting = false, submitError = message) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "withdrawal failed: ${e.message}")
                _state.update {
                    it.copy(
                        submitting = false,
                        submitError = "Network error while submitting the request. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /* ── fetch / degrade ── */

    /** Post-submit ledger refresh (independent of the entry guard). */
    private fun refreshLedgerAfterSubmit() {
        if (ledgerJob?.isActive == true) return
        ledgerJob = viewModelScope.launch { fetchLedger() }
    }

    private suspend fun fetchLedger() {
        try {
            Log.i(TAG, "fetch payout rail")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.walletMoneyApi(base).payoutLedger()
            if (response.code() == 401) {
                Log.i(TAG, "payout rail not permitted (http=401) — session ended")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            if (response.code() == 403) {
                // The route's ROLE DENIAL — its verbatim error text becomes
                // the honest gate. No payload is parsed; no zero card renders.
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Supplier profile required. Only registered suppliers can access seller data."
                Log.i(TAG, "supplier gate (http=403): $message")
                _state.value = _state.value.copy(
                    loading = false,
                    ledger = null,
                    supplierGateMessage = message,
                )
                return
            }
            val payload = response.body()
            val ledger = payload?.data
            if (!response.isSuccessful || payload?.success != true || ledger == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your payout rail (HTTP ${response.code()})."
                Log.w(TAG, "payout rail error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "payout rail loaded available=${ledger.available} rows=${ledger.payouts.size}")
            _state.value = _state.value.copy(
                loading = false,
                ledger = ledger,
                error = null,
                supplierGateMessage = null,
            )
            persistCache(ledger)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "payout rail fetch failed: ${e.message}")
            degrade("Network error while loading your payout rail. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved rail
     * cache; with none, the honest error card.
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, MoneyCacheKeys.PAYOUT_LEDGER, CachedPayoutLedger.serializer())
        }
        val ledger = cached?.ledger
        if (ledger != null) {
            Log.i(TAG, "degrade → cached payout rail")
            _state.value = _state.value.copy(loading = false, ledger = ledger, offlineFromCache = true)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(ledger: PayoutLedgerDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                MoneyCacheKeys.PAYOUT_LEDGER,
                CachedPayoutLedger.serializer(),
                CachedPayoutLedger(ledger = ledger),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodMoney"
    }
}
