package com.zylod.wholesale.ui.admin

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminOrderDto
import com.zylod.wholesale.data.api.AdminOrdersPageDto
import com.zylod.wholesale.data.api.AdminVerifyPaymentRequest
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ApiEnvelope
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * Native Admin Orders VM — GET api/admin/orders as the payload of record for
 * pageId "admin-orders" (RouteOwnership row renders [AdminOrdersScreen]
 * through NativePageRegistry; the handler is requireUserType(['admin']) —
 * admin/orders/route.ts, verified).
 *
 *  - PAGINATION + FILTERS: page/limit (1..100 server clamp, this VM asks 20)
 *    plus the handler's paymentStatus (unpaid|partial|paid|refunded|all —
 *    NOTE: the handler's BARE default is the unpaid verification queue, so
 *    this VM always sends an explicit paymentStatus, "all" for the unfiltered
 *    list), fulfillment status (a REAL subOrder status — orders has no status
 *    column) and q (searches orderNumber / buyer email). Any filter or
 *    committed search resets to page 1; loadMore appends with a keyed dedup.
 *  - NOT-ADMIN (AdminDashboardViewModel auth-gate convention): a 401/403
 *    means a real end-of-session or a buyer/supplier account → the honest
 *    notAdmin state, never fabricated orders.
 *  - OFFLINE (DealsViewModel degrade convention): on failure, renderable data
 *    survives — in-memory rows first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_admin_orders_cache", written
 *    ONLY after a successful non-empty page pull) — offline/offlineFromCache
 *    banners; with nothing renderable, the honest first-launch offline state.
 *  - VERIFY PAYMENT: POST api/admin/orders/{orderId}/verify-payment (the
 *    route file's own contract) — the admin records a bank-transfer /
 *    mobile-banking payment (transactionId + amount matching the order total,
 *    optional note) for orders not already paid. NEVER optimistic: the list
 *    re-pulls after the server confirms the paid state. The amount always
 *    comes from the row the server sent — the VM refuses to invent one.
 *  - t216 silent refresh: a re-pull never blanks visible data behind a
 *    spinner — the fetch replaces it in place (refreshing flag).
 *
 * SERIALIZATION NOTE (the dc74841 lesson): everything persisted to prefs is
 * @Serializable — [CachedAdminOrdersPage] and its List<AdminOrderDto> field
 * (AdminOrderDto + its AdminOrderBuyerDto/AdminOrderPaymentDto/
 * AdminOrderSubOrderDto children all are, with defaults).
 */
data class AdminOrdersUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val loadingMore: Boolean = false,
    val orders: List<AdminOrderRow> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    /** Committed payment filter: unpaid|partial|paid|refunded|all (default all). */
    val paymentStatusFilter: String = "all",
    /** Committed fulfillment filter: a subOrder status, or "all" = none. */
    val statusFilter: String = "all",
    /** Committed search text (order number / buyer email) — empty = none. */
    val searchQuery: String = "",
    /** Set only when nothing is renderable (no network AND no saved orders). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or non-admin account — the screen's honest gate. */
    val notAdmin: Boolean = false,
    /** The order card whose verify-payment call is in flight. */
    val verifyInProgressOrderId: String? = null,
    /** One-shot verify-payment feedback — surfaced as a snackbar, then cleared. */
    val actionMessage: String? = null,
)

class AdminOrdersViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AdminOrdersUiState())
    val state: StateFlow<AdminOrdersUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null
    private var moreJob: Job? = null

    /**
     * Entry pull / retry (AdminDashboardViewModel convention: called on EVERY
     * entry — the VM survives on the saved back stack). A page-1 pull already
     * in flight is a no-op.
     */
    fun refresh() {
        if (fetchJob?.isActive == true) return
        startPage1Load()
    }

    fun retry() = refresh()

    /** Next page append — guarded so concurrent taps cannot double-fetch. */
    fun loadMore() {
        val s = _state.value
        if (fetchJob?.isActive == true || moreJob?.isActive == true) return
        if (s.loading || s.loadingMore || s.page <= 0 || s.page >= s.totalPages) return
        _state.update { it.copy(loadingMore = true) }
        moreJob = viewModelScope.launch { fetchPage(s.page + 1, replace = false) }
    }

    /** Payment chip — resets pagination to page 1 and re-fetches. */
    fun setPaymentStatusFilter(paymentStatus: String) {
        if (_state.value.paymentStatusFilter == paymentStatus) return
        _state.update { it.copy(paymentStatusFilter = paymentStatus) }
        startPage1Load()
    }

    /** Fulfillment chip — resets pagination to page 1 and re-fetches. */
    fun setStatusFilter(status: String) {
        if (_state.value.statusFilter == status) return
        _state.update { it.copy(statusFilter = status) }
        startPage1Load()
    }

    /**
     * Committed search (search button, not per keystroke) — resets pagination
     * to page 1 and re-fetches. Blank clears the search.
     */
    fun setSearchQuery(query: String) {
        val trimmed = query.trim()
        if (_state.value.searchQuery == trimmed) return
        _state.update { it.copy(searchQuery = trimmed) }
        startPage1Load()
    }

    fun clearActionMessage() {
        _state.update { it.copy(actionMessage = null) }
    }

    /**
     * Human-verified payment recording (POST verify-payment): the admin has
     * CONFIRMED money arrived in the company account. [amount] is the REAL
     * order total from the row the server sent (the handler rejects a
     * mismatch within ±0.01), [method] is bank_transfer|mobile_banking,
     * [transactionId] is the admin-entered unique reference and [note] is
     * optional. In-flight is tracked per order
     * ([AdminOrdersUiState.verifyInProgressOrderId]); the list re-pulls ONLY
     * after the server confirms — never optimistic.
     */
    fun verifyPayment(orderId: String, amount: Double, transactionId: String, method: String, note: String?) {
        if (orderId.isBlank()) return
        if (_state.value.verifyInProgressOrderId != null) return
        if (amount <= 0.0) {
            // The row carried no real total — refuse rather than invent one.
            _state.update { it.copy(actionMessage = "Order total unavailable — cannot record a payment.") }
            return
        }
        val tx = transactionId.trim()
        if (tx.isBlank()) {
            _state.update { it.copy(actionMessage = "A transaction reference is required.") }
            return
        }
        _state.update { it.copy(verifyInProgressOrderId = orderId, actionMessage = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "verify payment order=…${orderId.takeLast(6)} tx=$tx method=$method")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api = ApiClient.adminApi(base)
                val response = api.verifyPayment(
                    orderId = orderId,
                    body = AdminVerifyPaymentRequest(
                        transactionId = tx,
                        method = method,
                        amount = amount,
                        note = note?.trim()?.takeIf(String::isNotBlank),
                    ),
                )
                // Honest gate for the WRITE endpoint too.
                if (response.code() == 401 || response.code() == 403) {
                    Log.i(TAG, "verify payment not permitted (http=${response.code()})")
                    _state.update {
                        it.copy(verifyInProgressOrderId = null, actionMessage = "Admin access required")
                    }
                    return@launch
                }
                val body = response.body()
                if (!response.isSuccessful || body == null || !body.success) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not verify the payment (HTTP ${response.code()})"
                    Log.w(TAG, "verify payment failed: $message")
                    _state.update { it.copy(verifyInProgressOrderId = null, actionMessage = message) }
                    return@launch
                }
                val orderNumber = body.data?.orderNumber
                Log.i(TAG, "verify payment ok status=${body.data?.paymentStatus}")
                _state.update {
                    it.copy(
                        verifyInProgressOrderId = null,
                        actionMessage = if (orderNumber.isNullOrBlank()) "Payment verified — order marked paid"
                        else "Payment verified — $orderNumber marked paid",
                    )
                }
                // Server-confirmed rows only: re-pull with the same filters —
                // the visible page first, page 1 when the paid order left it.
                moreJob?.cancel()
                val page = _state.value.page
                fetchJob?.cancel()
                fetchJob = viewModelScope.launch {
                    fetchPage(pageNumber = page, replace = true)
                    if (_state.value.orders.isEmpty() && page > 1) fetchPage(pageNumber = 1, replace = true)
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "verify payment failed: ${e.message}")
                _state.update {
                    it.copy(
                        verifyInProgressOrderId = null,
                        actionMessage = "Network error — the payment may not have been recorded. Retry.",
                    )
                }
            }
        }
    }

    /** Page-1 (re)load for entry/refresh/filter changes — cancels in-flight. */
    private fun startPage1Load() {
        moreJob?.cancel()
        fetchJob?.cancel()
        val hasRows = _state.value.orders.isNotEmpty()
        _state.update {
            it.copy(
                loading = !hasRows,
                refreshing = hasRows,
                loadingMore = false,
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
        }
        fetchJob = viewModelScope.launch { fetchPage(1, replace = true) }
    }

    private suspend fun fetchPage(pageNumber: Int, replace: Boolean) {
        val s = _state.value
        try {
            Log.i(
                TAG,
                "fetch admin orders page=$pageNumber payment=${s.paymentStatusFilter} " +
                    "status=${s.statusFilter} q=${s.searchQuery.ifBlank { "-" }}",
            )
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.adminApi(base)
            val response = api.orders(
                page = pageNumber,
                limit = PAGE_LIMIT,
                // ALWAYS explicit — the handler's bare default is the unpaid
                // verification queue, not the unfiltered list.
                paymentStatus = s.paymentStatusFilter,
                status = s.statusFilter.takeIf { it != "all" },
                q = s.searchQuery.takeIf(String::isNotBlank),
            )
            // Honest admin gate: signed-out callers are 401 and non-admin
            // sessions 403 on the admin-only handler — never render orders
            // as if they were real.
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not an admin session (http=${response.code()})")
                _state.value = AdminOrdersUiState(
                    loading = false,
                    notAdmin = true,
                    paymentStatusFilter = s.paymentStatusFilter,
                    statusFilter = s.statusFilter,
                    searchQuery = s.searchQuery,
                )
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load orders (HTTP ${response.code()})"
                Log.w(TAG, "orders error: $message")
                degrade(message)
                return
            }
            val body = response.body()
            if (body == null || !body.success) {
                degrade("Could not load orders")
                return
            }
            val incoming = body.toOrderRows()
            val pagination = body.data?.pagination
            val merged = if (replace) incoming else {
                // Keyed dedup — a duplicate page (retry after a timeout that
                // actually landed) can never double-render an order card.
                val seen = _state.value.orders.mapTo(HashSet()) { it.key }
                _state.value.orders + incoming.filter { seen.add(it.key) }
            }
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                loadingMore = false,
                orders = merged,
                page = pagination?.page ?: pageNumber,
                totalPages = pagination?.totalPages?.takeIf { it > 0 } ?: _state.value.totalPages,
                total = pagination?.total ?: _state.value.total,
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same mappers).
            if (replace && incoming.isNotEmpty()) persistCache(body, pageNumber)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "orders fetch failed: ${e.message}")
            degrade("Network error while loading orders. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory rows
     * first, then the saved cache; with neither, the first-launch offline
     * state. Rows are mapped on the MAIN thread after the IO cache read
     * (the date/amount formatters are main-thread JVM helpers).
     */
    private suspend fun degrade(message: String) {
        if (_state.value.orders.isNotEmpty()) {
            _state.update {
                it.copy(loading = false, refreshing = false, loadingMore = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { AdminOrdersCacheStore.read(appContext) }
        if (cached != null && cached.orders.isNotEmpty()) {
            _state.value = AdminOrdersUiState(
                loading = false,
                orders = cached.orders.map { it.toOrderRow() },
                page = cached.page,
                totalPages = cached.totalPages,
                total = cached.total,
                paymentStatusFilter = _state.value.paymentStatusFilter,
                statusFilter = _state.value.statusFilter,
                searchQuery = _state.value.searchQuery,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, loadingMore = false, error = message) }
        }
    }

    /** Persist the page's wire DTOs — the offline render matches the online one. */
    private fun persistCache(envelope: ApiEnvelope<AdminOrdersPageDto>, page: Int) {
        val payload = CachedAdminOrdersPage(
            orders = envelope.data?.orders.orEmpty(),
            page = page,
            totalPages = envelope.data?.pagination?.totalPages?.takeIf { it > 0 } ?: 1,
            total = envelope.data?.pagination?.total ?: envelope.data?.orders.orEmpty().size,
        )
        viewModelScope.launch(Dispatchers.IO) {
            AdminOrdersCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodAdmin"
        /** Server clamps limit to 1..100; 20 matches the handler's default. */
        const val PAGE_LIMIT = 20
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type + nested type serializable). */
@Serializable
private data class CachedAdminOrdersPage(
    val orders: List<AdminOrderDto> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
)

/**
 * On-device saved admin orders — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_admin_orders_cache". Payload = the last successful non-empty page
 * (wire DTOs + its nested pagination ints), so the offline render is
 * consistent with the online one.
 */
private object AdminOrdersCacheStore {
    private const val TAG = "ZylodAdmin"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_orders_cache"

    fun read(context: Context): CachedAdminOrdersPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedAdminOrdersPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "admin orders cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedAdminOrdersPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedAdminOrdersPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "admin orders cache write failed: ${it.message}") }
    }
}
