package com.zylod.wholesale.ui.returns

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ReturnItemBody
import com.zylod.wholesale.data.api.ReturnOrderDto
import com.zylod.wholesale.data.api.ReturnOrderItemDto
import com.zylod.wholesale.data.api.ReturnSubmitBody
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.logistics.orderIdFromQuery
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer

/**
 * Return-request VM — GET api/orders/{orderId} (ReturnsApi.orderForReturn,
 * the exact endpoint return-request-page.tsx:76 fetches) plus POST
 * api/orders/{orderId}/return (ReturnsApi.submitReturn, return-request-
 * page.tsx:140) as the payload of record for the three return pageIds
 * (return-management, returns-exchange, warranty-claims; each gets its OWN
 * VM instance via the screen's pageId-keyed factory).
 *
 *  - ORDER RESOLUTION (web parity): the entry query pins the order via
 *    [orderIdFromQuery] ("orderId=x", a bare "id=x" pair, or a bare token).
 *    NO id → the honest "No order selected" state with a jump to My Orders
 *    — never a fabricated fallback id.
 *  - AUTH: no token → no call at all, the honest needsAuth gate. A 401 on
 *    either call means a real end of session (the shared OkHttp
 *    authenticator has already attempted one token refresh by then) →
 *    needsAuth (on submit the web ALSO keeps the session-expired note).
 *  - 404 is a DEFINITIVE answer ("Order not found") — the honest card,
 *    never a cache of some other order. Other HTTP/network errors → error
 *    text + Retry.
 *  - OFFLINE (TrackOrderViewModel degrade convention): on load failure the
 *    last snapshot for THIS pageId survives — in-memory first, then the
 *    device-saved cache (SharedPreferences "zylod_config",
 *    "native_returns_order_cache_<pageId>") — and the state flips
 *    offlineFromCache so the screen shows its saved-data banner. The cache
 *    is only usable when it was saved for the SAME order id.
 *
 * SELECTION STATE (ported verbatim from return-request-page.tsx): nothing
 * is pre-selected on a successful fetch; toggling an item defaults its
 * return quantity to 1; steppers clamp 1..orderedQty; the reason dropdown
 * is required per selected item; ONE shared comments box feeds every
 * selected item (the web page keeps a single `comments` string rendered
 * inside each selected row); the estimated refund is
 * Σ unitPrice × returnQty over the selected items. The shippingMethod is
 * the return route's REAL two-value field ("pickup" default / "dropoff",
 * exactly what route.ts accepts) — the web page renders no picker and the
 * server would default it, but the t253 contract sends the buyer's choice.
 * The web page never renders GET api/returns — none is fetched here either.
 */
data class ReturnItemRow(
    /** Stable LazyColumn key (item id, hash fallback). */
    val key: String,
    /** The REAL order-item id — what the submit body's itemId must be. */
    val id: String,
    /** product.name, "Product" fallback (web parity). */
    val name: String,
    /** "variantName: variantValue" — null when the item has no variant. */
    val variantLabel: String?,
    val unitPrice: Double,
    /** product.unit, "unit" fallback (web parity). */
    val unitLabel: String,
    /** The ordered quantity — the stepper's hard cap. */
    val orderedQty: Int,
    /** product.thumbnailUrl — null → the Package-icon placeholder box. */
    val thumbnailUrl: String?,
)

data class ReturnRequestUiState(
    /** Resolving / fetching the order (skeleton while empty). */
    val loading: Boolean = true,
    /** False → the entry query carried no order id (the "No order selected" state). */
    val hasOrderId: Boolean = false,
    /** The resolved order id (empty until the query yields one). */
    val orderId: String = "",
    val orderNumber: String = "",
    /** "5 Jan 2026" — empty → the progress card drops the Placed line. */
    val placedLabel: String = "",
    /** Wire chip text verbatim ("" → the chip collapses, web parity). */
    val paymentStatus: String = "",
    val items: List<ReturnItemRow> = emptyList(),
    /** itemId → checked (nothing pre-selected, web parity). */
    val selected: Map<String, Boolean> = emptyMap(),
    /** itemId → return quantity (default 1 on first toggle). */
    val quantities: Map<String, Int> = emptyMap(),
    /** itemId → reason VALUE (damaged/wrong/defect/specs), "" = unchosen. */
    val reasons: Map<String, String> = emptyMap(),
    /** ONE shared comments box — the web page's exact model. */
    val comments: String = "",
    /** "pickup" | "dropoff" — the route's two server-accepted values. */
    val shippingMethod: String = "pickup",
    val submitting: Boolean = false,
    /** Red inline text above the submit button (validation/HTTP/network). */
    val submitError: String? = null,
    /** Real 200 from the route → the screen jumps to the return-detail view. */
    val submitSuccess: Boolean = false,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Definitive HTTP 404 → the honest "Order not found" card. */
    val notFound: Boolean = false,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible order came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
) {
    /** Selected item ids in wire order (deterministic submit body order). */
    val selectedIds: List<String>
        get() = items.filter { selected[it.id] == true }.map { it.id }

    val selectedCount: Int get() = selectedIds.size

    val selectedQty: Int get() = selectedIds.sumOf { quantities[it] ?: 1 }

    /** Σ unitPrice × returnQty over the selected items (web totalRefund). */
    val totalRefund: Double
        get() = items
            .filter { selected[it.id] == true }
            .sumOf { it.unitPrice * (quantities[it.id] ?: 1) }

    /** Every selected item needs a reason before the submit unlocks. */
    val missingReason: Boolean
        get() = selectedIds.any { reasons[it].isNullOrBlank() }
}

class ReturnRequestViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ReturnRequestUiState())
    val state: StateFlow<ReturnRequestUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var submitJob: Job? = null
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
        val orderId = orderIdFromQuery(lastQuery)
        if (orderId == null) {
            // Web parity: no order id in the entry query → the honest
            // "No order selected" state, never a fabricated fallback.
            Log.i(TAG, "no orderId in query — no-order state")
            _state.value = ReturnRequestUiState(loading = false, hasOrderId = false)
            return
        }
        if (SessionManager.token() == null) {
            _state.value = ReturnRequestUiState(loading = false, hasOrderId = true, orderId = orderId, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.orderId != orderId || it.items.isEmpty(),
                hasOrderId = true,
                orderId = orderId,
                error = null,
                notFound = false,
                needsAuth = false,
                offlineFromCache = false,
                submitError = null,
                submitSuccess = false,
            )
        }
        initJob = viewModelScope.launch { fetchOrder(orderId) }
    }

    /** Error-card Retry — full re-fetch of the same order. */
    fun retry() {
        load()
    }

    /* ─── selection edits (web handlers, 1:1) ───────────────────────────── */

    /** Checkbox toggle — first check seeds the return quantity at 1. */
    fun toggleItem(itemId: String) {
        _state.update { s ->
            val nowSelected = !(s.selected[itemId] ?: false)
            s.copy(
                selected = s.selected + (itemId to nowSelected),
                quantities = if (s.quantities[itemId] == null) {
                    s.quantities + (itemId to 1)
                } else {
                    s.quantities
                },
            )
        }
    }

    /** Stepper — clamped 1..orderedQty exactly like the web handler. */
    fun changeQuantity(itemId: String, delta: Int, max: Int) {
        _state.update { s ->
            val current = s.quantities[itemId] ?: 1
            val next = (current + delta).coerceIn(1, max.coerceAtLeast(1))
            s.copy(quantities = s.quantities + (itemId to next))
        }
    }

    fun setReason(itemId: String, reason: String) {
        _state.update { it.copy(reasons = it.reasons + (itemId to reason)) }
    }

    fun setComments(text: String) {
        _state.update { it.copy(comments = text) }
    }

    /** Shipping-method radio — only the two route-accepted values arrive. */
    fun setShippingMethod(method: String) {
        _state.update { it.copy(shippingMethod = if (method == "dropoff") "dropoff" else "pickup") }
    }

    /* ─── submit (POST api/orders/{orderId}/return) ─────────────────────── */

    /**
     * Files the return. Double-submit guard: the button is disabled while
     * [ReturnRequestUiState.submitting] (and a settled success re-entry is
     * a no-op) — the route rate-limits at 5/min, so a double-tap must never
     * fire two POSTs. Success navigates to the order's return-detail view
     * (web navigate('return-detail', { orderId })).
     */
    fun submit() {
        val s = _state.value
        if (!s.hasOrderId || s.orderId.isBlank()) return
        if (s.submitting || s.submitSuccess) return
        if (s.missingReason) {
            _state.update {
                it.copy(submitError = "Please choose a reason for every selected item.")
            }
            return
        }
        submitJob?.cancel()
        _state.update { it.copy(submitting = true, submitError = null) }
        submitJob = viewModelScope.launch {
            try {
                val orderId = s.orderId
                Log.i(TAG, "submit return …${orderId.takeLast(6)} items=${s.selectedIds.size}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val body = ReturnSubmitBody(
                    items = s.selectedIds.map { itemId ->
                        ReturnItemBody(
                            itemId = itemId,
                            reason = s.reasons[itemId].orEmpty().trim(),
                            quantity = s.quantities[itemId] ?: 1,
                            comments = s.comments.trim().takeIf(String::isNotBlank),
                        )
                    },
                    shippingMethod = s.shippingMethod,
                )
                val response = ApiClient.returnsApi(base).submitReturn(orderId, body)
                if (response.code() == 401) {
                    // Web parity: the gate AND the session-expired note.
                    Log.i(TAG, "submit rejected (http=401) — session ended")
                    _state.update {
                        it.copy(
                            loading = false,
                            submitting = false,
                            needsAuth = true,
                            submitError = SESSION_EXPIRED_TEXT,
                        )
                    }
                    return@launch
                }
                val payload = response.body()
                val confirmed = payload?.takeIf { response.isSuccessful && it.success }?.data
                if (confirmed == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Return request failed (HTTP ${response.code()})."
                    Log.w(TAG, "submit failed: $message")
                    _state.update { it.copy(submitting = false, submitError = message) }
                    return@launch
                }
                Log.i(TAG, "return filed ${confirmed.returnNumber ?: "--"}")
                _state.update { it.copy(submitting = false, submitSuccess = true) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "submit failed: ${e.message}")
                _state.update {
                    it.copy(submitting = false, submitError = "Network error while submitting the return request")
                }
            }
        }
    }

    /* ─── fetch / failure / helpers ─────────────────────────────────────── */

    private suspend fun fetchOrder(orderId: String) {
        try {
            Log.i(TAG, "fetch order …${orderId.takeLast(6)}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.returnsApi(base).orderForReturn(orderId)
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
            val payload = response.body()
            val order = payload?.takeIf { response.isSuccessful && it.success }?.data
            if (order == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to load order (HTTP ${response.code()})."
                Log.w(TAG, "order error: $message")
                degrade(orderId, message)
                return
            }
            Log.i(TAG, "order loaded items=${order.subOrders.sumOf { it.items.size }}")
            _state.value = order.toState(orderId, offlineFromCache = false, comments = _state.value.comments)
            persistCache(orderId, order)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "order fetch failed: ${e.message}")
            degrade(orderId, "Network error while loading order")
        }
    }

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
     * (the date formatter is a main-thread JVM helper, RfqModels convention).
     */
    private suspend fun degrade(orderId: String, message: String) {
        val cached = withContext(Dispatchers.IO) {
            ReturnsCacheStore.read(appContext, ReturnsCacheKeys.order(pageId), CachedReturnOrder.serializer())
        }
        val cachedOrder = cached?.order?.takeIf { cached.orderId == orderId }
        if (cachedOrder != null) {
            Log.i(TAG, "degrade → cache items=${cachedOrder.subOrders.sumOf { it.items.size }}")
            _state.value = cachedOrder.toState(orderId, offlineFromCache = true, comments = _state.value.comments)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the order's wire DTOs — the offline render matches the live one. */
    private fun persistCache(orderId: String, order: ReturnOrderDto) {
        viewModelScope.launch(Dispatchers.IO) {
            ReturnsCacheStore.write(
                appContext,
                ReturnsCacheKeys.order(pageId),
                CachedReturnOrder.serializer(),
                CachedReturnOrder(orderId = orderId, order = order),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodReturns"
        const val SESSION_EXPIRED_TEXT = "Your session has expired. Please sign in again to submit this return."
    }
}

/** Wire order → render state (items flattened in wire order). */
private fun ReturnOrderDto.toState(orderId: String, offlineFromCache: Boolean, comments: String): ReturnRequestUiState =
    ReturnRequestUiState(
        loading = false,
        hasOrderId = true,
        orderId = orderId,
        orderNumber = orderNumber.orEmpty(),
        placedLabel = returnsPlacedLabel(placedAt).orEmpty(),
        paymentStatus = paymentStatus.orEmpty(),
        items = subOrders.flatMap { subOrder -> subOrder.items.map { it.toRow() } },
        // Start with nothing pre-selected — the buyer picks what to return.
        selected = emptyMap(),
        quantities = emptyMap(),
        reasons = emptyMap(),
        comments = comments,
        offlineFromCache = offlineFromCache,
    )

private fun ReturnOrderItemDto.toRow() = ReturnItemRow(
    key = stableKey,
    id = id?.takeIf(String::isNotBlank) ?: stableKey,
    name = product?.name?.takeIf(String::isNotBlank) ?: "Product",
    variantLabel = variant?.let { v ->
        val name = v.variantName.orEmpty()
        val value = v.variantValue.orEmpty()
        if (name.isBlank() && value.isBlank()) null else "$name: $value"
    },
    unitPrice = unitPrice,
    unitLabel = product?.unit?.takeIf(String::isNotBlank) ?: "unit",
    orderedQty = quantity,
    thumbnailUrl = product?.thumbnailUrl?.takeIf(String::isNotBlank),
)

/* ─── formatters (web formatPrice / en-GB placedAt date) ─────────────────── */

/** ISO instants on the orders wire: "2024-05-05T10:00:00.000Z". */
private val utcIsoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

/** return-request-page.tsx: toLocaleDateString('en-GB', {day, short month, year}). */
private val placedFormat = SimpleDateFormat("d MMM yyyy", Locale.UK)

private val takaFormat: NumberFormat = NumberFormat.getIntegerInstance(Locale.US)

/** "5 Jan 2026" from a UTC ISO instant — null on absent/unparsable input. */
fun returnsPlacedLabel(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val parsed = runCatching { utcIsoParser.parse(iso.take(19)) }.getOrNull() ?: return null
    return placedFormat.format(parsed)
}

/** ৳ price text (whole → no decimals, fractional → 2dp; web formatPrice). */
fun formatTakaText(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + takaFormat.format(value.toLong())
    else "৳" + String.format(Locale.US, "%.2f", value)

/* ─── offline cache (t252 LogisticsCacheStore convention) ────────────────── */

/** The device-saved return-flow payload keys — SharedPreferences "zylod_config". */
internal object ReturnsCacheKeys {
    const val PREFS = "zylod_config"

    /** One snapshot per pageId on the return surface family. */
    fun order(pageId: String): String = "native_returns_order_cache_$pageId"
}

/** Order snapshot pinned to the order id it was fetched for. */
@kotlinx.serialization.Serializable
data class CachedReturnOrder(val orderId: String? = null, val order: ReturnOrderDto? = null)

/**
 * On-device saved payloads — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the [ReturnsCacheKeys] keys.
 */
internal object ReturnsCacheStore {
    private const val TAG = "ZylodReturns"

    fun <T> read(context: Context, key: String, serializer: KSerializer<T>): T? = runCatching {
        val raw = context.getSharedPreferences(ReturnsCacheKeys.PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(serializer, raw)
    }.onFailure { Log.w(TAG, "returns cache read failed: ${it.message}") }.getOrNull()

    fun <T> write(context: Context, key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            val raw = ApiClient.json.encodeToString(serializer, value)
            context.getSharedPreferences(ReturnsCacheKeys.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
        }.onFailure { Log.w(TAG, "returns cache write failed: ${it.message}") }
    }
}
