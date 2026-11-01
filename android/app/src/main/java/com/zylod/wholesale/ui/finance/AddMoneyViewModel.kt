package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.TopupClaimBody
import com.zylod.wholesale.data.api.TopupClaimDto
import com.zylod.wholesale.data.api.TopupInitiateBody
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
 * Add-money VM — GET/POST api/wallet/topup + POST api/wallet/topup/initiate
 * (WalletMoneyApi.topupClaims / .submitTopupClaim / .initiateTopup) as the
 * payload of record for the native add-money pageId.
 *
 *  - THE WALLET DOCTRINE (Task 118, mirrored honestly): a manual top-up
 *    claim NEVER moves money — the route creates ONE walletTopups row with
 *    status 'pending' and nothing else; only the admin verify route flips
 *    it to credited. The success card renders the route's OWN data.message
 *    verbatim ("Claim received. Your wallet balance does NOT change until a
 *    Zylod admin verifies the payment — the same rule as order payments.")
 *    — the screen NEVER says "balance added".
 *  - GATEWAY LEG: initiate starts a REAL bKash Tokenized Checkout /
 *    SSLCommerz EasyCheckout session and returns { redirectUrl, reference }
 *    — the wallet is credited ONLY by the verified callback/IPN. A 503
 *    ('bKash is not configured' / 'SSLCommerz is not configured') surfaces
 *    verbatim; a success hands the URL to the OS via an ACTION_VIEW intent
 *    labeled "Open secure payment page" — no in-app webview pretense.
 *  - CLAIM LEDGER: GET returns the caller's own claims newest-first (take
 *    50) with honest statuses (pending | credited | rejected).
 *  - CLIENT GUARDS (the route's own rules mirrored): amount 10..100000 and
 *    the transactionReference regex ^[A-Za-z0-9\-_]{6,64}$; the server's
 *    verbatim 400/409/429 text surfaces when it fires anyway.
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    either leg (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth.
 *  - OFFLINE: the last saved claim ledger ("zylod_config",
 *    "native_topup_claims_cache") renders with the offline banner
 *    otherwise (FinanceCacheStore degrade convention).
 */
data class AddMoneyUiState(
    /** Fetching the claim ledger (skeleton while empty). */
    val loading: Boolean = true,
    /** The caller's own top-up claims, newest first (the route's order). */
    val claims: List<TopupClaimDto> = emptyList(),
    /** Ledger load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible ledger came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** Active funding tab: 0 = manual claim, 1 = gateway session. */
    val tab: Int = AddMoneyUiState.TAB_MANUAL,
    // ── manual claim form ──
    /** Raw amount field text (parsed on submit — the client guard). */
    val amountText: String = DEFAULT_AMOUNT,
    /** Selected claim method (the claimSchema enum tokens). */
    val claimMethod: String = "bKash",
    /** The REAL transaction reference / TRXID (required, regex-guarded). */
    val transactionReference: String = "",
    /** Optional sender number (route regex ^[0-9+\-]{6,20}$). */
    val senderNumber: String = "",
    /** Optional note for the finance team (≤300). */
    val note: String = "",
    /** Submit in flight — the button is disabled (route rate-limits 10/min). */
    val submitting: Boolean = false,
    /** The verbatim server rejection (400 zod / 409 duplicate / 429). */
    val submitError: String? = null,
    /** Real success: the route's data.message verbatim (NEVER "added"). */
    val successMessage: String? = null,
    /** Real success: the submitted reference (the ledger's identity). */
    val successReference: String? = null,
    /** Real success: the data.status token (always 'pending' today). */
    val successStatus: String? = null,
    // ── gateway form ──
    val gatewayAmountText: String = DEFAULT_AMOUNT,
    /** Selected gateway method (bKash | Nagad | Upay | Rocket | card). */
    val gatewayMethod: String = "bKash",
    /** Gateway session start in flight — the button is disabled. */
    val initiating: Boolean = false,
    /** The verbatim gateway route error (400 bounds / 503 unconfigured / 502). */
    val initiateError: String? = null,
    /** Real success: the gateway checkout URL (opened via ACTION_VIEW). */
    val paymentUrl: String? = null,
    /** Real success: the server's WBD-TU-… session reference. */
    val paymentReference: String? = null,
) {
    /** The client-side amount guard: parseable AND within the route bounds. */
    val claimAmountInvalid: Boolean
        get() {
            val amount = amountText.trim().toDoubleOrNull() ?: return true
            return amount < TOPUP_AMOUNT_MIN || amount > TOPUP_AMOUNT_MAX
        }

    /**
     * The client-side reference guard: REQUIRED and regex-shaped — an
     * unverifiable claim is not accepted (the route's own doctrine).
     */
    val referenceInvalid: Boolean
        get() = !TOPUP_REFERENCE_REGEX.matches(transactionReference.trim())

    /** Gateway amount guard — the same route bounds. */
    val gatewayAmountInvalid: Boolean
        get() {
            val amount = gatewayAmountText.trim().toDoubleOrNull() ?: return true
            return amount < TOPUP_AMOUNT_MIN || amount > TOPUP_AMOUNT_MAX
        }

    companion object {
        /** The web form's own prefill (add-money-page.tsx:69). */
        const val DEFAULT_AMOUNT = "5000"
        const val TAB_MANUAL = 0
        const val TAB_GATEWAY = 1
    }
}

class AddMoneyViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(AddMoneyUiState())
    val state: StateFlow<AddMoneyUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var ledgerJob: Job? = null
    private var submitJob: Job? = null
    private var initiateJob: Job? = null

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
            _state.value = AddMoneyUiState(loading = false, needsAuth = true)
            return
        }
        ledgerJob?.cancel()
        _state.update {
            it.copy(
                loading = it.claims.isEmpty(),
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        ledgerJob = viewModelScope.launch { fetchClaims() }
    }

    /** Error-card Retry — full ledger re-fetch. */
    fun retry() = load()

    /* ── tab + form events ── */

    fun setTab(tab: Int) {
        _state.update { it.copy(tab = tab) }
    }

    fun setClaimAmount(text: String) {
        _state.update { it.copy(amountText = text, submitError = null) }
    }

    fun setClaimMethod(method: String) {
        _state.update { it.copy(claimMethod = method, submitError = null) }
    }

    fun setTransactionReference(text: String) {
        _state.update { it.copy(transactionReference = text, submitError = null) }
    }

    fun setSenderNumber(text: String) {
        _state.update { it.copy(senderNumber = text, submitError = null) }
    }

    fun setNote(text: String) {
        _state.update { it.copy(note = text.take(300), submitError = null) }
    }

    /** Dismiss the inline pending-verification card (the user read it). */
    fun consumeClaimSuccess() {
        _state.update {
            it.copy(successMessage = null, successReference = null, successStatus = null)
        }
    }

    fun setGatewayAmount(text: String) {
        _state.update { it.copy(gatewayAmountText = text, initiateError = null) }
    }

    fun setGatewayMethod(method: String) {
        _state.update { it.copy(gatewayMethod = method, initiateError = null) }
    }

    /** Dismiss the gateway handoff card (the URL was consumed or ignored). */
    fun consumeGatewayResult() {
        _state.update { it.copy(paymentUrl = null, paymentReference = null) }
    }

    /**
     * POST api/wallet/topup — the manual funding CLAIM. Client guards: the
     * route's amount bounds and reference regex (mirrored so the buyer
     * sees the hint before the wire). The server's verbatim error text
     * (400 zod issue, 409 duplicate reference, 429 rate limit, 401 session
     * end) surfaces honestly; success renders the route's data.message +
     * status + reference INLINE — a pending row, never a credited one —
     * and re-fetches the ledger so the new claim appears with its status.
     */
    fun submitClaim() {
        val s = _state.value
        val amount = s.amountText.trim().toDoubleOrNull()
        if (amount == null || amount < TOPUP_AMOUNT_MIN || amount > TOPUP_AMOUNT_MAX) {
            _state.update {
                it.copy(
                    submitError = "Amount must be between ৳10 and ৳100,000 " +
                        "(the verification desk rejects anything else).",
                )
            }
            return
        }
        if (s.referenceInvalid) {
            _state.update {
                it.copy(
                    submitError = "Enter the real transaction reference (TRXID) from your " +
                        (if (s.claimMethod == "bank_transfer") "bank receipt" else s.claimMethod) +
                        " — 6-64 characters (letters, numbers, dash, underscore). Without it " +
                        "the claim cannot be verified.",
                )
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
                Log.i(TAG, "submit top-up claim")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val body = TopupClaimBody(
                    amount = amount,
                    method = s.claimMethod,
                    transactionReference = s.transactionReference.trim(),
                    senderNumber = s.senderNumber.trim().takeIf(String::isNotBlank),
                    note = s.note.trim().takeIf(String::isNotBlank),
                )
                val response = ApiClient.walletMoneyApi(base).submitTopupClaim(body)
                if (response.code() == 401) {
                    Log.i(TAG, "claim rejected (http=401) — session ended")
                    _state.update { it.copy(submitting = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                val data = payload?.data
                if (response.isSuccessful && payload?.success == true && data != null) {
                    Log.i(TAG, "claim recorded ref=${data.reference} status=${data.status}")
                    _state.update {
                        it.copy(
                            submitting = false,
                            successMessage = data.message
                                ?.takeIf(String::isNotBlank)
                                ?: "Claim received — pending admin verification. Your balance is unchanged.",
                            successReference = data.reference,
                            successStatus = data.status,
                            transactionReference = "",
                            senderNumber = "",
                            note = "",
                        )
                    }
                    refreshClaimsAfterSubmit()
                    return@launch
                }
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Claim failed (HTTP ${response.code()})."
                Log.w(TAG, "claim failed: $message")
                _state.update { it.copy(submitting = false, submitError = message) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "claim failed: ${e.message}")
                _state.update {
                    it.copy(
                        submitting = false,
                        submitError = "Network error — the claim was NOT recorded. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /**
     * POST api/wallet/topup/initiate — start the gateway session. A 503 is
     * the HONEST gateway-missing verdict ('bKash is not configured' /
     * 'SSLCommerz is not configured') and surfaces verbatim; success keeps
     * the returned redirectUrl for the screen's ACTION_VIEW handoff (the
     * wallet is credited only by the verified callback/IPN, which the
     * handoff card says in plain words).
     */
    fun initiateGateway() {
        val s = _state.value
        val amount = s.gatewayAmountText.trim().toDoubleOrNull()
        if (amount == null || amount < TOPUP_AMOUNT_MIN || amount > TOPUP_AMOUNT_MAX) {
            _state.update {
                it.copy(initiateError = "Amount must be between ৳10 and ৳100,000")
            }
            return
        }
        if (initiateJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = s.copy(needsAuth = true, initiating = false)
            return
        }
        _state.update { it.copy(initiating = true, initiateError = null, paymentUrl = null, paymentReference = null) }
        initiateJob = viewModelScope.launch {
            try {
                Log.i(TAG, "initiate gateway top-up method=${s.gatewayMethod}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val body = TopupInitiateBody(amount = amount, method = s.gatewayMethod)
                val response = ApiClient.walletMoneyApi(base).initiateTopup(body)
                if (response.code() == 401) {
                    Log.i(TAG, "initiate rejected (http=401) — session ended")
                    _state.update { it.copy(initiating = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                val data = payload?.data
                val redirectUrl = data?.redirectUrl
                if (response.isSuccessful && payload?.success == true && !redirectUrl.isNullOrBlank()) {
                    Log.i(TAG, "gateway session started ref=${data?.reference}")
                    _state.update {
                        it.copy(
                            initiating = false,
                            paymentUrl = redirectUrl,
                            paymentReference = data?.reference,
                        )
                    }
                    return@launch
                }
                val message = payload?.error
                    ?.takeIf(String::isNotBlank)
                    ?: parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not start payment (HTTP ${response.code()})."
                Log.w(TAG, "initiate failed: $message")
                _state.update { it.copy(initiating = false, initiateError = message) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "initiate failed: ${e.message}")
                _state.update {
                    it.copy(
                        initiating = false,
                        initiateError = "Network error while starting the payment. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /* ── fetch / degrade ── */

    /** Post-submit ledger refresh (independent of the entry guard). */
    private fun refreshClaimsAfterSubmit() {
        if (ledgerJob?.isActive == true) return
        ledgerJob = viewModelScope.launch { fetchClaims() }
    }

    private suspend fun fetchClaims() {
        try {
            Log.i(TAG, "fetch top-up claims")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.walletMoneyApi(base).topupClaims()
            if (response.code() == 401) {
                Log.i(TAG, "claims not permitted (http=401) — session ended")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            val payload = response.body()
            val rows = payload?.data
            if (!response.isSuccessful || payload?.success != true || rows == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your funding claims (HTTP ${response.code()})."
                Log.w(TAG, "claims error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "claims loaded rows=${rows.size}")
            _state.value = _state.value.copy(
                loading = false,
                claims = rows,
                error = null,
            )
            persistCache(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "claims fetch failed: ${e.message}")
            degrade("Network error while loading your funding claims. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved claims
     * cache; with none, the honest error card.
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, MoneyCacheKeys.TOPUP_CLAIMS, CachedTopupClaims.serializer())
        }
        val rows = cached?.rows
        if (rows != null) {
            Log.i(TAG, "degrade → cached top-up claims")
            _state.value = _state.value.copy(
                loading = false,
                claims = rows,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the live one. */
    private fun persistCache(rows: List<TopupClaimDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                MoneyCacheKeys.TOPUP_CLAIMS,
                CachedTopupClaims.serializer(),
                CachedTopupClaims(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodMoney"
    }
}
