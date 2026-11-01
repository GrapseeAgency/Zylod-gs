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
 * Payment-methods-detail VM — resolves ONE raw row of GET
 * api/payment-methods (FinanceApi.paymentMethods) for the native
 * payment-methods-detail pageId. There is deliberately NO GET-by-id under
 * payment-methods/ (the [id] file declares DELETE only), so the row is
 * resolved from the list exactly like the web does:
 *
 *  - an entry query carrying "id=…" (or a bare token) pins THAT row; when
 *    the successful list does not contain it, the honest "not found" state
 *    renders — never a substitute row;
 *  - no id in the query → the DEFAULT method renders, else the first row
 *    (the wire orders isDefault DESC, createdAt DESC);
 *  - an empty list → the honest empty state.
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    the fetch means a real end of session → needsAuth.
 *  - FAILURE: honest error card + Retry when nothing renderable; the saved
 *    snapshot (SharedPreferences "zylod_config",
 *    "native_payment_methods_cache" — the SAME payload family the list
 *    saves) renders with the offline banner otherwise.
 *  - DELETE: DELETE api/payment-methods/{id} (the [id] file's only method)
 *    — on success the screen pops back to the list; failures surface
 *    honestly.
 */
data class PaymentMethodDetailUiState(
    /** Resolving / fetching the list (skeleton while empty). */
    val loading: Boolean = true,
    /** The pinned id from the entry query (empty → default/first row). */
    val requestedId: String = "",
    val row: PaymentMethodRowDto? = null,
    /** A pinned id that the successful list does not contain. */
    val notFound: Boolean = false,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible row came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** Delete in flight — the Remove button is disabled. */
    val deleting: Boolean = false,
    /** Real DELETE success → the screen pops back to the list. */
    val deleted: Boolean = false,
    /** A failed delete — surfaced as a snackbar, non-fatal. */
    val actionError: String? = null,
)

class PaymentMethodsDetailViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(PaymentMethodDetailUiState())
    val state: StateFlow<PaymentMethodDetailUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var lastQuery: String = ""

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (TrackOrderViewModel convention).
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
    fun load(entryQuery: String? = null) {
        if (entryQuery != null) lastQuery = entryQuery
        if (initJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = PaymentMethodDetailUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        val requestedId = paymentMethodIdFromQuery(lastQuery).orEmpty()
        _state.update {
            it.copy(
                loading = it.row == null,
                requestedId = requestedId,
                error = null,
                notFound = false,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchAndResolve(requestedId) }
    }

    /** Error-card Retry — full re-resolve of the same target. */
    fun retry() {
        load()
    }

    /**
     * DELETE api/payment-methods/{id} — the [id] file's real (and only)
     * removal method. Success pops the screen back to the list; failure
     * surfaces the route's honest error text in the snackbar line.
     */
    fun delete() {
        val s = _state.value
        val id = s.row?.id.orEmpty()
        if (id.isBlank() || s.deleting || s.deleted) return
        if (SessionManager.token() == null) {
            _state.update { it.copy(deleting = false, needsAuth = true) }
            return
        }
        _state.update { it.copy(deleting = true, actionError = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "delete payment method …${id.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.financeApi(base).deletePaymentMethod(id)
                if (response.code() == 401) {
                    Log.i(TAG, "delete rejected (http=401) — session ended")
                    _state.update { it.copy(deleting = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    Log.i(TAG, "payment method removed")
                    _state.update { it.copy(deleting = false, deleted = true) }
                    return@launch
                }
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not remove the payment method (HTTP ${response.code()})."
                Log.w(TAG, "delete failed: $message")
                _state.update { it.copy(deleting = false, actionError = message) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "delete failed: ${e.message}")
                _state.update {
                    it.copy(
                        deleting = false,
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

    private suspend fun fetchAndResolve(requestedId: String) {
        try {
            Log.i(TAG, "fetch payment methods (resolve detail)")
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
                    ?: "Could not load the payment method (HTTP ${response.code()})."
                Log.w(TAG, "payment methods error: $message")
                degrade(message, requestedId)
                return
            }
            persistCache(rows)
            resolveFrom(rows, requestedId, offline = false)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "payment methods fetch failed: ${e.message}")
            degrade(
                "Network error while loading the payment method. Check your connection and retry.",
                requestedId,
            )
        }
    }

    /** Web resolution order: pinned id → default row → first row. */
    private fun resolveFrom(
        rows: List<PaymentMethodRowDto>,
        requestedId: String,
        offline: Boolean,
    ) {
        if (rows.isEmpty()) {
            // Honest empty — the account really has no payment methods.
            _state.value = PaymentMethodDetailUiState(loading = false)
            return
        }
        if (requestedId.isNotBlank()) {
            val pinned = rows.firstOrNull { it.id == requestedId }
            if (pinned == null) {
                // Definitive: the list is live and the id is not in it.
                _state.value = PaymentMethodDetailUiState(
                    loading = false,
                    requestedId = requestedId,
                    notFound = true,
                    offlineFromCache = offline,
                )
                return
            }
            _state.value = PaymentMethodDetailUiState(
                loading = false,
                requestedId = requestedId,
                row = pinned,
                offlineFromCache = offline,
            )
            return
        }
        val fallback = rows.firstOrNull { it.isDefault } ?: rows.first()
        _state.value = PaymentMethodDetailUiState(
            loading = false,
            row = fallback,
            offlineFromCache = offline,
        )
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /**
     * Failure path: resolve from the saved list cache (same payload family
     * the list screen saves); with none, the honest error card.
     */
    private suspend fun degrade(message: String, requestedId: String) {
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
            resolveFrom(rows, requestedId, offline = true)
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

/**
 * Extracts a payment-method id from the page's entry query, mirroring the
 * native key=value query convention (addressIdFromQuery/TrackOrder
 * orderIdFromQuery style): a bare "&id=x" pair first, then a bare single
 * token without any "=". Null when nothing usable is present.
 */
fun paymentMethodIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val named = Regex("(?:^|&)id=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!named.isNullOrBlank()) return named
    return raw.takeIf { !it.contains('=') }
}
