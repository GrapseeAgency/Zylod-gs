package com.zylod.wholesale.ui.logistics

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.TrackedOrderDto
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
import java.util.Locale

/**
 * Order-tracking VM — GET api/orders/{orderId} (OrdersApi.order, the exact
 * endpoint track-order-page.tsx:126 fetches) as the payload of record for
 * the three tracking pageIds (order-tracking, track-package,
 * track-consignment; each gets its OWN VM instance via the screen's
 * pageId-keyed factory).
 *
 *  - ORDER RESOLUTION (web parity): the entry query pins the order via
 *    [orderIdFromQuery] ("orderId=x", a bare "id=x" pair, or a bare token).
 *    NO id → the honest "No order selected" state with a jump to My Orders
 *    — never a fabricated fallback id.
 *  - AUTH: no token → no call at all, the honest needsAuth gate. A 401 on
 *    the fetch means a real end of session (the shared OkHttp authenticator
 *    has already attempted one token refresh by then) → needsAuth.
 *  - 404 is a DEFINITIVE answer ("Order not found") — the honest card,
 *    never a cache of some other order. Other HTTP/network errors → error
 *    text + Retry.
 *  - OFFLINE (LiveChatViewModel degrade convention): on failure the last
 *    snapshot for THIS pageId survives — in-memory first, then the
 *    device-saved cache (SharedPreferences "zylod_config",
 *    "native_logistics_track_cache_<pageId>") — and the state flips
 *    offlineFromCache so the screen shows its saved-data banner. The cache
 *    is only usable when it was saved for the SAME order id.
 *
 * DERIVATIONS (ported verbatim from track-order-page.tsx): the overall
 * badge + 4-step stage + per-shipment rows + the DESC tracking timeline
 * come from ui/logistics/LogisticsModels.kt — real subOrder statuses only,
 * nothing invented.
 */
data class TrackOrderUiState(
    /** Resolving / fetching the order (skeleton while empty). */
    val loading: Boolean = true,
    /** False → the entry query carried no order id (the "No order selected" state). */
    val hasOrderId: Boolean = false,
    /** The resolved order id (empty until the query yields one). */
    val orderId: String = "",
    val orderNumber: String = "",
    val paymentStatus: String? = null,
    val placedLabel: String = "",
    /** "PROCESSING" | "DELIVERED" | "IN TRANSIT" | "CANCELLED". */
    val overallBadge: String = "PROCESSING",
    /** 1..4 — furthest stage reached by any non-cancelled subOrder. */
    val stage: Int = 1,
    /** Every non-empty subOrder status is delivered → the rail is all-green. */
    val allDelivered: Boolean = false,
    /** Any subOrder shipped → the "live transit" flavor of the header band. */
    val inTransit: Boolean = false,
    /** Earliest real supplier-set ETA ("Jan 5, 2026") — null when none set. */
    val etaLabel: String? = null,
    val shipments: List<ShipmentRow> = emptyList(),
    val events: List<TrackingEventRow> = emptyList(),
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Definitive HTTP 404 → the honest "Order not found" card. */
    val notFound: Boolean = false,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible order came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class TrackOrderViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(TrackOrderUiState())
    val state: StateFlow<TrackOrderUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var lastQuery: String = ""

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (LiveChatViewModel convention).
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
        val orderId = orderIdFromQuery(lastQuery)
        if (orderId == null) {
            // Web parity: no order id in the entry query → the honest
            // "No order selected" state, never a fabricated fallback.
            Log.i(TAG, "no orderId in query — no-order state")
            _state.value = TrackOrderUiState(loading = false, hasOrderId = false)
            return
        }
        if (SessionManager.token() == null) {
            _state.value = TrackOrderUiState(loading = false, hasOrderId = true, orderId = orderId, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.orderId != orderId || it.shipments.isEmpty(),
                hasOrderId = true,
                orderId = orderId,
                error = null,
                notFound = false,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchOrder(orderId) }
    }

    /** Error-card Retry — full re-fetch of the same order. */
    fun retry() {
        load()
    }

    private suspend fun fetchOrder(orderId: String) {
        try {
            Log.i(TAG, "fetch order …${orderId.takeLast(6)}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.ordersApi(base).order(orderId)
            if (gateOn401(response.code())) return
            if (response.code() == 404) {
                // Definitive answer (foreign/gone order) — honest card,
                // never a cache of some other order.
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Order not found (HTTP 404)."
                Log.w(TAG, "order 404: $message")
                _state.update { it.copy(loading = false, notFound = true) }
                return
            }
            val body = response.body()
            val order = body?.takeIf { response.isSuccessful && it.success }?.data
            if (order == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the order (HTTP ${response.code()})."
                Log.w(TAG, "order error: $message")
                degrade(orderId, message)
                return
            }
            Log.i(TAG, "order loaded subOrders=${order.subOrders.size}")
            _state.value = order.toState(orderId, offlineFromCache = false)
            persistCache(orderId, order)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "order fetch failed: ${e.message}")
            degrade(orderId, "Network error while loading the order. Check your connection and retry.")
        }
    }

    /* ─── failure / helpers ──────────────────────────────────────────────── */

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved order
     * cache, ONLY when it was saved for this same order id; with none, the
     * honest error card. Mapped on the MAIN thread after the IO cache read
     * (the date formatters are main-thread JVM helpers, RfqModels
     * convention).
     */
    private suspend fun degrade(orderId: String, message: String) {
        val cached = withContext(Dispatchers.IO) {
            LogisticsCacheStore.read(appContext, LogisticsCacheKeys.track(pageId), CachedTrack.serializer())
        }
        val cachedOrder = cached?.order?.takeIf { cached.orderId == orderId }
        if (cachedOrder != null) {
            Log.i(TAG, "degrade → cache subOrders=${cachedOrder.subOrders.size}")
            _state.value = cachedOrder.toState(orderId, offlineFromCache = true)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the order's wire DTOs — the offline render matches the live one. */
    private fun persistCache(orderId: String, order: TrackedOrderDto) {
        viewModelScope.launch(Dispatchers.IO) {
            LogisticsCacheStore.write(
                appContext,
                LogisticsCacheKeys.track(pageId),
                CachedTrack.serializer(),
                CachedTrack(orderId = orderId, order = order),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodLogistics"
    }
}

/** Wire order → render state (derivations precomputed, nothing invented). */
private fun TrackedOrderDto.toState(orderId: String, offlineFromCache: Boolean): TrackOrderUiState {
    val badge = deriveOverallBadge(subOrders)
    val statuses = subOrders.map { (it.status ?: "pending").trim().lowercase(Locale.US) }
    return TrackOrderUiState(
        loading = false,
        hasOrderId = true,
        orderId = orderId,
        orderNumber = orderNumber.orEmpty(),
        paymentStatus = paymentStatus?.takeIf(String::isNotBlank),
        placedLabel = logisticsDateLabel(placedAt).orEmpty(),
        overallBadge = badge,
        stage = deriveStage(subOrders),
        allDelivered = statuses.isNotEmpty() && statuses.all { it == "delivered" },
        inTransit = statuses.any { it == "shipped" },
        etaLabel = etaLabel(),
        shipments = toShipmentRows(),
        events = toEventRows(),
        offlineFromCache = offlineFromCache,
    )
}
