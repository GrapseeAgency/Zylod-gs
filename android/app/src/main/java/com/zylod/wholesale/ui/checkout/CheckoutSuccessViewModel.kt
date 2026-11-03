package com.zylod.wholesale.ui.checkout

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CheckoutSuccessOrder
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseCheckoutError
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.logistics.orderIdFromQuery
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t273 — ORDER-CONFIRMATION VM (pageId "checkout-success", the
 * order-confirmation-page.tsx port). Structure mirrors the closest precedent
 * ui/logistics/TrackOrderViewModel.kt — the SAME GET api/orders/{orderId}
 * route, parsed through the CheckoutApi's typed confirmation projection:
 *
 *  - ORDER RESOLUTION (web parity): the entry query pins the order via
 *    [orderIdFromQuery] ("orderId=x", an "id=x" pair, or a bare token).
 *    NO id → the honest "No order to confirm" state — never a fabricated
 *    fallback id.
 *  - AUTH: no token → no call at all, the honest needsAuth gate. A 401 on
 *    the fetch (after the shared OkHttp authenticator's one refresh) means
 *    the session truly ended → needsAuth.
 *  - OTHER failures → the verbatim error text + Retry. 404-style
 *    "not found" answers ride the same error card (the message the server
 *    sends, or the HTTP fallback) — never a cached other order.
 */
data class CheckoutSuccessUiState(
    /** False → the entry query carried no order id (the "No order to confirm" state). */
    val hasOrderId: Boolean = false,
    val loading: Boolean = false,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    val error: String = "",
    val order: CheckoutSuccessOrder? = null,
)

class CheckoutSuccessViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(CheckoutSuccessUiState())
    val state: StateFlow<CheckoutSuccessUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null
    private var lastQuery: String = ""

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (TrackOrderViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(entryQuery: String? = null) {
        if (entryQuery != null) lastQuery = entryQuery
        if (loadJob?.isActive == true) return
        val orderId = orderIdFromQuery(lastQuery)
        if (orderId == null) {
            Log.i(TAG, "no orderId in query — no-order state")
            _state.value = CheckoutSuccessUiState(hasOrderId = false, loading = false)
            return
        }
        if (SessionManager.token() == null) {
            _state.value = CheckoutSuccessUiState(hasOrderId = true, loading = false, needsAuth = true)
            return
        }
        loadJob?.cancel()
        _state.update {
            it.copy(
                hasOrderId = true,
                loading = true,
                needsAuth = false,
                error = "",
            )
        }
        loadJob = viewModelScope.launch { fetchOrder(orderId) }
    }

    /** Error-card Retry — full re-fetch of the same order. */
    fun retry() {
        load()
    }

    private suspend fun fetchOrder(orderId: String) {
        try {
            Log.i(TAG, "fetch confirmation order …${orderId.takeLast(6)}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.checkoutApi(base).orderForConfirmation(orderId)
            if (response.code() == 401) {
                Log.i(TAG, "not permitted (http=401) — session ended")
                _state.update { it.copy(loading = false, needsAuth = true) }
                return
            }
            val body = response.body()
            val order = body?.takeIf { response.isSuccessful && it.success }?.data
            if (order == null) {
                val message = parseCheckoutError(response.errorBody()?.string())
                    ?: "Could not load the order (HTTP ${response.code()})"
                Log.w(TAG, "confirmation error: $message")
                _state.update { it.copy(loading = false, error = message) }
                return
            }
            Log.i(TAG, "confirmation loaded subOrders=${order.subOrders.size}")
            _state.update { it.copy(loading = false, order = order, error = "") }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "confirmation fetch failed: ${e.message}")
            _state.update {
                it.copy(loading = false, error = "Network error while loading the order. Check your connection and retry.")
            }
        }
    }

    private companion object {
        const val TAG = "ZylodCheckout"
    }
}
