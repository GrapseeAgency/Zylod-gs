package com.zylod.wholesale.ui.orders

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.OrderDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Buyer orders VM — GET /api/orders/my-orders (orders/my-orders/route.ts),
 * the exact endpoint the web buyer orders list fetches (orders-page.tsx:75).
 *
 *  - Unauthenticated: no call at all — the screen shows its soft sign-in CTA
 *    (RouteOwnership guest policy, CartScreen precedent: orders are never a
 *    hard redirect to login).
 *  - 401: the shared OkHttp authenticator has already attempted one token
 *    refresh by the time a 401 reaches this layer, so it means a real end of
 *    session (or a non-buyer account) → needsAuth state, honest message.
 *  - Pagination: the server has NO pagination params — it returns the
 *    account's full list and the web page renders it whole. Phase 2 scope is
 *    one full pull per refresh; a cursor page is a later, server-side change.
 *
 * All network calls are best-effort: failures degrade to the error state with
 * retry, never a crash and never fake rows.
 */
data class OrdersUiState(
    val loading: Boolean = true,
    val orders: List<OrderDto> = emptyList(),
    val needsAuth: Boolean = false,
    val error: String? = null,
)

class OrdersViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(OrdersUiState())
    val state: StateFlow<OrdersUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    init {
        refresh()
        // 401→refresh→logout chain: a dropped session moves the screen to the
        // sign-in state (CartViewModel convention) instead of a stale list.
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = OrdersUiState(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Pulls the buyer's orders from the server. Safe to call again. */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = OrdersUiState(loading = false, needsAuth = true)
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, needsAuth = false)
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.ordersApi(base).myOrders()
                if (response.code() == 401) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true, orders = emptyList())
                    return@launch
                }
                if (!response.isSuccessful) {
                    val err = parseErrorBody(response.errorBody())
                    _state.value = _state.value.copy(
                        loading = false,
                        orders = emptyList(),
                        error = err.error ?: "Could not load orders (HTTP ${response.code()})",
                    )
                    return@launch
                }
                val list = response.body()?.takeIf { it.success }?.data
                if (list == null) {
                    _state.value = _state.value.copy(loading = false, orders = emptyList(), error = "Could not load orders")
                    return@launch
                }
                _state.value = OrdersUiState(loading = false, orders = list)
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.value = _state.value.copy(
                    loading = false,
                    orders = emptyList(),
                    error = "Network error while loading your orders. Check your connection and retry.",
                )
            }
        }
    }

    fun retry() = refresh()
}
