package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CreditLimitRequestBody
import com.zylod.wholesale.data.api.CreditLineDto
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
 * Credit-limit VM — GET/POST api/credits/limit (FinanceApi.creditLimit /
 * .requestCreditLimitIncrease) as the payload of record for the native
 * credit-limit / buyer-credit pageIds.
 *
 *  - FIND-OR-CREATE: the GET creates the buyer's first ACTIVE creditLines
 *    row server-side when none exists, so a 200 ALWAYS carries a real
 *    facility (৳250,000 default) — the gauge never fabricates a zero line.
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    the fetch (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth.
 *  - OFFLINE: the last saved facility (SharedPreferences "zylod_config",
 *    "native_credit_limit_cache") renders with the offline banner
 *    otherwise (FinanceCacheStore degrade convention).
 *  - REQUEST FORM: client guard = a positive, parseable amount (the
 *    route's own 400 rule mirrored); the server's verbatim 400/429 text
 *    surfaces in [CreditLimitUiState.submitError]. Success shows the
 *    route's REAL message + referenceId inline (under_review) — no dialog.
 */
data class CreditLimitUiState(
    /** Resolving / fetching the facility (skeleton while empty). */
    val loading: Boolean = true,
    val line: CreditLineDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible facility came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    // ── Request-limit-increase form ──
    /** The expandable form is open. */
    val formVisible: Boolean = false,
    /** Raw amount field text (parsed on submit — the client guard). */
    val amountText: String = DEFAULT_AMOUNT,
    /** Business justification (the web form's own prefill). */
    val reason: String = DEFAULT_REASON,
    /** Optional bank-solvency document URL (the route's third field). */
    val docUrl: String = "",
    /** Submit in flight — the button is disabled (route rate-limits 10/min). */
    val submitting: Boolean = false,
    /** The verbatim server rejection (400 invalid amount / 429 rate limit). */
    val submitError: String? = null,
    /** Real success: the route's message text (shown inline). */
    val successMessage: String? = null,
    /** Real success: the CRE-REQ-… reference token from data. */
    val referenceId: String? = null,
    /** Real success: the data.status token ('under_review'). */
    val requestStatus: String? = null,
) {
    /** The client-side guard message shown above the form when the amount fails. */
    val amountInvalid: Boolean
        get() = (amountText.toDoubleOrNull() ?: 0.0) <= 0.0

    companion object {
        /** The web form's own prefill values (credit-limit-page.tsx:36-37). */
        const val DEFAULT_AMOUNT = "500000"
        const val DEFAULT_REASON = "Higher seasonal procurement for wholesale inventory"
    }
}

class CreditLimitViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(CreditLimitUiState())
    val state: StateFlow<CreditLimitUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
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
        if (initJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = CreditLimitUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.line == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchLine() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /* ── form events ── */

    fun toggleForm() {
        _state.update {
            it.copy(formVisible = !it.formVisible, submitError = null)
        }
    }

    fun setAmount(text: String) {
        _state.update { it.copy(amountText = text, submitError = null) }
    }

    fun setReason(text: String) {
        _state.update { it.copy(reason = text, submitError = null) }
    }

    fun setDocUrl(text: String) {
        _state.update { it.copy(docUrl = text, submitError = null) }
    }

    /** Dismiss the inline success card (the user read the reference). */
    fun consumeSuccess() {
        _state.update { it.copy(successMessage = null, referenceId = null, requestStatus = null) }
    }

    /**
     * POST api/credits/limit — the underwriting request. Client guard: the
     * amount must parse to a positive number (the route's own 400 rule —
     * mirrored so the buyer sees the hint before the wire). The server's
     * verbatim error text (400 'Invalid credit limit amount', 429 rate
     * limit, 401 session end) surfaces honestly; success shows the route's
     * message + data.referenceId + data.status INLINE.
     */
    fun submitRequest() {
        val s = _state.value
        val amount = s.amountText.trim().toDoubleOrNull()
        if (amount == null || amount <= 0.0) {
            _state.update { it.copy(submitError = "Enter a valid credit limit amount (a positive number).") }
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
                Log.i(TAG, "request credit limit increase")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val body = CreditLimitRequestBody(
                    requestedLimit = amount,
                    reason = s.reason.trim(),
                    bankSolvencyDocUrl = s.docUrl.trim().takeIf(String::isNotBlank),
                )
                val response = ApiClient.financeApi(base).requestCreditLimitIncrease(body)
                if (response.code() == 401) {
                    Log.i(TAG, "request rejected (http=401) — session ended")
                    _state.update { it.copy(submitting = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    val data = payload.data
                    Log.i(TAG, "request accepted ref=${data?.referenceId}")
                    _state.update {
                        it.copy(
                            submitting = false,
                            formVisible = false,
                            successMessage = payload.message
                                ?.takeIf(String::isNotBlank)
                                ?: "Increase request submitted for underwriting review.",
                            referenceId = data?.referenceId,
                            requestStatus = data?.status,
                        )
                    }
                    return@launch
                }
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not submit the credit request (HTTP ${response.code()})."
                Log.w(TAG, "request failed: $message")
                _state.update { it.copy(submitting = false, submitError = message) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "request failed: ${e.message}")
                _state.update {
                    it.copy(
                        submitting = false,
                        submitError = "Network error while submitting the credit request. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /* ── fetch / degrade ── */

    private suspend fun fetchLine() {
        try {
            Log.i(TAG, "fetch credit line")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).creditLimit()
            if (gateOn401(response.code())) return
            val payload = response.body()
            val line = payload?.data
            if (!response.isSuccessful || payload?.success != true || line == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your trade credit line (HTTP ${response.code()})."
                Log.w(TAG, "credit line error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "credit line loaded limit=${line.creditLimit}")
            _state.value = CreditLimitUiState(loading = false, line = line)
            persistCache(line)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "credit line fetch failed: ${e.message}")
            degrade("Network error while loading your trade credit line. Check your connection and retry.")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved
     * facility cache; with none, the honest error card.
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.CREDIT_LIMIT, CachedCreditLine.serializer())
        }
        val line = cached?.line
        if (line != null) {
            Log.i(TAG, "degrade → cached credit line")
            _state.value = CreditLimitUiState(loading = false, line = line, offlineFromCache = true)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(line: CreditLineDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.CREDIT_LIMIT,
                CachedCreditLine.serializer(),
                CachedCreditLine(line = line),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}
