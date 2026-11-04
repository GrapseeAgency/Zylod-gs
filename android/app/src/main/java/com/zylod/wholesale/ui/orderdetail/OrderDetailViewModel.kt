package com.zylod.wholesale.ui.orderdetail

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.OrderDetailInitiatePayload
import com.zylod.wholesale.data.api.OrderDetailOrder
import com.zylod.wholesale.data.api.OrderDetailPaymentSubmitPayload
import com.zylod.wholesale.data.api.OrderDetailReceipt
import com.zylod.wholesale.data.api.OrderDetailCancelPayload
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseOrderDetailError
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.logistics.orderIdFromQuery
import com.zylod.wholesale.ui.wallet.formatBdt
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * t274 — BUYER ORDER-DETAIL VM (pageId "order-detail"): the honest Kotlin
 * port of order-detail-page.tsx against the verified server contracts
 * (data/api/OrderDetailApi.kt).
 *
 *  - ORDER RESOLUTION (web parity): the entry query pins the order via
 *    [orderIdFromQuery] ("orderId=x", an "id=x" pair, or a bare token).
 *    NO id → the honest "No order selected" state with a jump to My Orders
 *    — never a fabricated fallback id.
 *  - AUTH: no token → no call at all, the honest needsAuth gate. A 401 on
 *    the fetch means a real end of session (the shared OkHttp authenticator
 *    has already attempted one token refresh by then) → needsAuth. 404 is a
 *    DEFINITIVE answer ("Order not found") — the honest card. 403 answers
 *    the error ladder like the web's generic failure text.
 *  - MONEY DERIVATIONS (ported verbatim): verifiedPaid = Σ success payments;
 *    remainingDue = max(0, total − verifiedPaid); canSubmitPayment = owner
 *    && paymentStatus unpaid|partial; canCancelOrder mirrors the API guards
 *    (pre-verification AND every shipment still pending|confirmed);
 *    subtotal/shipping = Σ per shipment; estDelivery = the earliest
 *    supplier-set date; the 4-step stepper reads REAL statuses only.
 *  - CANCEL (Task 57-a/58): whole-order when subOrderIds is null, scoped to
 *    one shipment otherwise; success reloads (the honest counts land in the
 *    notice banner exactly as the web toast renders them).
 *  - PAYMENT SUBMIT (Task 56-b): the web's own regexes run client-side
 *    first (TRXID ^[A-Za-z0-9\-_]{6,64}$, SENDER ^\+?[0-9]{6,20}$); on a
 *    PARTIAL order the body carries amount = remainingDue (server truth
 *    caps it at the total). A success reloads — the new payments row
 *    renders as "verification pending" (the same honest state the web
 *    shows until a seller/admin verifies).
 *  - INSTRUCTIONS (Task 128-a): fetched for the two transfer methods when
 *    the submit dialog opens; the 503 (unset env accounts) surfaces
 *    verbatim. Receipt (Task 128-c) fetches on demand once money moved.
 */
data class OrderDetailUiState(
    /** Resolving / fetching the order (skeleton while empty). */
    val loading: Boolean = true,
    /** False → the entry query carried no order id (the "No order selected" state). */
    val hasOrderId: Boolean = false,
    /** The resolved order id (empty until the query yields one). */
    val orderId: String = "",
    val order: OrderDetailOrder? = null,
    /** Load failure text (with Retry) — empty on success. */
    val error: String = "",
    /** Definitive HTTP 404 → the honest "Order not found" card. */
    val notFound: Boolean = false,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,

    /* ── cancel (Task 57-a/58) ── */
    /** Confirm dialog visibility; label distinguishes whole-order vs shipment. */
    val cancelDialogOpen: Boolean = false,
    /** Non-null → the confirm targets ONE shipment (id + display label). */
    val cancelShipmentId: String? = null,
    val cancelShipmentLabel: String = "",
    val cancelling: Boolean = false,
    /** Dialog-local failure line — the verbatim server guard message. */
    val cancelError: String = "",
    /** Success feedback line (the honest server counts) — surfaced as a banner. */
    val cancelNotice: String = "",

    /* ── submit payment (Task 56-b) ── */
    val payDialogOpen: Boolean = false,
    /** Index into the shared PAYMENT_METHOD_OPTIONS table. */
    val payMethodIdx: Int = 0,
    val payTrxId: String = "",
    val paySender: String = "",
    val payNote: String = "",
    val paySubmitting: Boolean = false,
    val payError: String = "",
    /** Task 128-a receiving-account instructions for the transfer methods. */
    val payInstructions: Map<String, String>? = null,
    val payInstructionsLoading: Boolean = false,
    val payInstructionsError: String = "",
    /** t277-1a: which transfer method the cached instructions belong to —
     *  the rail MUST never render account details of a method the buyer
     *  already switched away from (money misdirection). */
    val payInstructionsMethod: String? = null,
    /** Success feedback line — surfaced as a banner (sonner parity). */
    val payNotice: String = "",

    /* ── receipt (Task 128-c) ── */
    val receiptOpen: Boolean = false,
    val receiptLoading: Boolean = false,
    val receiptError: String = "",
    val receipt: OrderDetailReceipt? = null,
)

class OrderDetailViewModel(
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(OrderDetailUiState())
    val state: StateFlow<OrderDetailUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null
    private var lastQuery: String = ""

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (TrackOrderViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /* ─── entry: query → resolve → fetch ─── */

    /** Called by the screen on first composition AND on every new query. */
    fun start(query: String?) {
        if (lastQuery == query && _state.value.order != null) return
        lastQuery = query ?: ""
        val orderId = orderIdFromQuery(query)
        if (orderId == null) {
            Log.i(TAG, "no orderId in query — no-order state")
            _state.value = OrderDetailUiState(loading = false, hasOrderId = false)
            return
        }
        _state.value = OrderDetailUiState(loading = true, hasOrderId = true, orderId = orderId)
        fetchOrder()
    }

    fun retry() {
        if (!_state.value.hasOrderId) return
        _state.update { it.copy(loading = true, error = "", notFound = false, needsAuth = false) }
        fetchOrder()
    }

    private fun fetchOrder() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                if (SessionManager.token() == null) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                val base = resolveBase()
                val response = ApiClient.orderDetailApi(base).order(_state.value.orderId)
                val code = response.code()
                if (code == 401) {
                    val message = parseOrderDetailError(response.errorBody()?.string())
                        ?: "Authentication required"
                    Log.w(TAG, "order 401: $message")
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                if (code == 404) {
                    Log.i(TAG, "order 404 — not-found state")
                    _state.update { it.copy(loading = false, notFound = true) }
                    return@launch
                }
                val body = response.body()
                if (!response.isSuccessful || body?.success != true || body.data == null) {
                    val message = parseOrderDetailError(response.errorBody()?.string())
                        ?: "Could not load this order (HTTP ${code})."
                    Log.w(TAG, "order fetch failed http=$code: $message")
                    _state.update { it.copy(loading = false, error = message) }
                    return@launch
                }
                Log.i(TAG, "order loaded id=${body.data.id} subOrders=${body.data.subOrders.size}")
                _state.update {
                    it.copy(loading = false, error = "", notFound = false, order = body.data)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "order fetch network error", e)
                _state.update {
                    it.copy(
                        loading = false,
                        error = "Network error while loading this order. Check your connection and retry.",
                    )
                }
            }
        }
    }

    private suspend fun resolveBase(): String =
        baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }

    /* ─── derived money/status mirrors (web verbatim) ─── */

    /** Pure deriveStatus mirror — real sub-order statuses only. */
    fun deriveStatus(order: OrderDetailOrder): String {
        val statuses = order.subOrders.map { (it.status ?: "pending").lowercase(Locale.US) }
        if (statuses.isEmpty()) return "processing"
        if (statuses.all { it == "delivered" }) return "delivered"
        if (statuses.any { it == "cancelled" }) return "cancelled"
        if (statuses.any { it == "shipped" }) return "shipped"
        return "processing"
    }

    fun verifiedPaid(order: OrderDetailOrder): Double =
        order.payments.filter { it.status == "success" }.sumOf { it.amount }

    fun remainingDue(order: OrderDetailOrder): Double =
        (order.totalAmount - verifiedPaid(order)).coerceAtLeast(0.0)

    fun canCancelOrder(order: OrderDetailOrder): Boolean {
        val submittable = order.paymentStatus == "unpaid" || order.paymentStatus == "partial"
        if (!submittable || order.subOrders.isEmpty()) return false
        return order.subOrders.all {
            val s = (it.status ?: "pending").lowercase(Locale.US)
            s == "pending" || s == "confirmed"
        }
    }

    /* ─── cancel (Task 57-a / 58) ─── */

    fun requestCancelOrder() {
        _state.update {
            it.copy(cancelDialogOpen = true, cancelShipmentId = null, cancelShipmentLabel = "", cancelError = "")
        }
    }

    fun requestCancelShipment(subOrderId: String, label: String) {
        _state.update {
            it.copy(cancelDialogOpen = true, cancelShipmentId = subOrderId, cancelShipmentLabel = label, cancelError = "")
        }
    }

    fun dismissCancel() {
        if (_state.value.cancelling) return
        _state.update { it.copy(cancelDialogOpen = false, cancelShipmentId = null, cancelShipmentLabel = "") }
    }

    fun confirmCancel() {
        val snapshot = _state.value
        val order = snapshot.order ?: return
        if (snapshot.cancelling) return
        _state.update { it.copy(cancelling = true, cancelError = "") }
        viewModelScope.launch {
            try {
                val base = resolveBase()
                val payload = snapshot.cancelShipmentId
                    ?.let { OrderDetailCancelPayload(subOrderIds = listOf(it)) }
                val response = ApiClient.orderDetailApi(base).cancel(order.id, payload)
                val code = response.code()
                if (code == 401) {
                    Log.w(TAG, "cancel 401")
                    _state.update { it.copy(cancelling = false, cancelDialogOpen = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    val message = parseOrderDetailError(response.errorBody()?.string())
                        ?: "Cancellation failed (HTTP ${code})."
                    Log.w(TAG, "cancel failed http=$code: $message")
                    _state.update { it.copy(cancelling = false, cancelError = message) }
                    return@launch
                }
                val d = response.body()?.data
                val adjusted = d?.totalAmount != null && d.totalBefore != null && d.totalAmount != d.totalBefore
                val notice = buildString {
                    append(if (snapshot.cancelShipmentId != null) "Shipment cancelled" else "Order cancelled")
                    append(" · ${d?.subOrdersCancelled ?: 0} shipment(s) cancelled · stock restored")
                    if (adjusted) append(" · order total now ${formatBdt(d!!.totalAmount)}")
                    if ((d?.paymentsVoided ?: 0) > 0) append(" · ${d!!.paymentsVoided} pending payment reference voided")
                    val remaining = d?.remainingActive ?: 0
                    if (remaining > 0) append(" · ${remaining} shipment(s) remain active")
                }
                Log.i(TAG, "cancel ok: $notice")
                _state.update {
                    it.copy(
                        cancelling = false,
                        cancelDialogOpen = false,
                        cancelShipmentId = null,
                        cancelShipmentLabel = "",
                        cancelNotice = notice,
                        loading = true,
                    )
                }
                fetchOrder()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "cancel network error", e)
                _state.update {
                    it.copy(cancelling = false, cancelError = "Network error while cancelling. Check your connection and retry.")
                }
            }
        }
    }

    /* ─── submit payment (Task 56-b) ─── */

    /** t277-1a: switching method invalidates the instruction rail — the old
     *  cached rail (previous method's receiving account) must not survive. */
    fun updatePayMethod(idx: Int) = _state.update {
        val changed = it.payMethodIdx != idx
        it.copy(
            payMethodIdx = idx,
            payError = "",
            payInstructions = if (changed) null else it.payInstructions,
            payInstructionsLoading = if (changed) false else it.payInstructionsLoading,
            payInstructionsError = if (changed) "" else it.payInstructionsError,
            payInstructionsMethod = if (changed) null else it.payInstructionsMethod,
        )
    }
    fun updatePayTrxId(v: String) = _state.update { it.copy(payTrxId = v) }
    fun updatePaySender(v: String) = _state.update { it.copy(paySender = v) }
    fun updatePayNote(v: String) = _state.update { it.copy(payNote = v) }

    /** Opens the manual-payment dialog (Task 56-b). Instructions load in a
     *  dialog-open LaunchedEffect via [fetchPayInstructions]. */
    fun openPayDialog() {
        _state.update {
            it.copy(
                payDialogOpen = true,
                payMethodIdx = 0,
                payTrxId = "",
                paySender = "",
                payNote = "",
                payError = "",
                payInstructions = null,
                payInstructionsError = "",
            )
        }
    }

    fun dismissPayDialog() {
        if (_state.value.paySubmitting) return
        _state.update {
            it.copy(payDialogOpen = false, payError = "", payTrxId = "", paySender = "", payNote = "", payInstructions = null, payInstructionsError = "")
        }
    }

    /**
     * The web's own client-side gates, verbatim, before the POST: required
     * trx reference, TRXID pattern, optional sender pattern. On a PARTIAL
     * order the body carries amount = remainingDue.
     */
    fun submitPayment() {
        val snapshot = _state.value
        val order = snapshot.order ?: return
        if (snapshot.paySubmitting) return
        val trimmedTrx = snapshot.payTrxId.trim()
        if (trimmedTrx.isEmpty()) {
            _state.update { it.copy(payError = "Transaction reference is required — enter the ID from your payment receipt.") }
            return
        }
        if (!TRXID_PATTERN.matches(trimmedTrx)) {
            _state.update { it.copy(payError = "Transaction reference must be 6-64 letters, numbers, dashes or underscores.") }
            return
        }
        val trimmedSender = snapshot.paySender.trim()
        if (trimmedSender.isNotEmpty() && !SENDER_PATTERN.matches(trimmedSender)) {
            _state.update { it.copy(payError = "Sender number must be 6-20 digits, optionally starting with +.") }
            return
        }
        val method = PAYMENT_METHOD_OPTIONS[snapshot.payMethodIdx]
        val partial = order.paymentStatus == "partial"
        val payload = OrderDetailPaymentSubmitPayload(
            method = method.value,
            transactionId = trimmedTrx,
            brand = method.brand,
            senderNumber = trimmedSender.ifEmpty { null },
            note = snapshot.payNote.trim().ifEmpty { null },
            amount = if (partial) remainingDue(order) else null,
        )
        _state.update { it.copy(paySubmitting = true, payError = "") }
        viewModelScope.launch {
            try {
                val base = resolveBase()
                val response = ApiClient.orderDetailApi(base).submitPayment(order.id, payload)
                val code = response.code()
                if (code == 401) {
                    Log.w(TAG, "payment-submit 401")
                    _state.update { it.copy(paySubmitting = false, payDialogOpen = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    val message = parseOrderDetailError(response.errorBody()?.string())
                        ?: "Submission failed (HTTP ${code})."
                    Log.w(TAG, "payment-submit failed http=$code: $message")
                    _state.update { it.copy(paySubmitting = false, payError = message) }
                    return@launch
                }
                Log.i(TAG, "payment submitted ref=$trimmedTrx method=${method.value}")
                _state.update {
                    it.copy(
                        paySubmitting = false,
                        payDialogOpen = false,
                        payTrxId = "",
                        paySender = "",
                        payNote = "",
                        payInstructions = null,
                        payNotice = "Payment submitted for verification — reference ${trimmedTrx}. The seller verifies it shortly.",
                        loading = true,
                    )
                }
                fetchOrder()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "payment-submit network error", e)
                _state.update {
                    it.copy(paySubmitting = false, payError = "Network error while submitting your payment. Check your connection and retry.")
                }
            }
        }
    }

    /** Task 128-a: the receiving-account rail for the two transfer methods. */
    fun fetchPayInstructions() {
        val snapshot = _state.value
        val order = snapshot.order ?: return
        val selected = PAYMENT_METHOD_OPTIONS.getOrNull(snapshot.payMethodIdx) ?: return
        if (selected.value != "bank_transfer" && selected.value != "mobile_banking") {
            _state.update { it.copy(payInstructions = null, payInstructionsError = "") }
            return
        }
        if (snapshot.payInstructionsLoading) return
        // t277-1a: only short-circuit when the cached rail belongs to the
        // CURRENTLY selected method; a stale rail for another method must
        // trigger a refetch, not render.
        if (snapshot.payInstructions != null && snapshot.payInstructionsMethod == selected.value) return
        _state.update { it.copy(payInstructionsLoading = true, payInstructionsError = "") }
        viewModelScope.launch {
            try {
                val base = resolveBase()
                val response = ApiClient.orderDetailApi(base)
                    .initiate(order.id, OrderDetailInitiatePayload(method = selected.value))
                val code = response.code()
                if (!response.isSuccessful) {
                    val message = parseOrderDetailError(response.errorBody()?.string())
                        ?: "Could not load payment details (HTTP ${code})."
                    Log.w(TAG, "initiate failed http=$code: $message")
                    _state.update { it.copy(payInstructionsLoading = false, payInstructions = null, payInstructionsError = message) }
                    return@launch
                }
                val instructions = response.body()?.data?.instructions
                if (instructions == null) {
                    _state.update {
                        it.copy(payInstructionsLoading = false, payInstructionsError = "Payment details response was malformed — try again.")
                    }
                    return@launch
                }
                _state.update { it.copy(payInstructionsLoading = false, payInstructions = instructions, payInstructionsError = "", payInstructionsMethod = selected.value) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "initiate network error", e)
                _state.update {
                    it.copy(payInstructionsLoading = false, payInstructionsError = "Network error while loading payment details. Check your connection and retry.")
                }
            }
        }
    }

    /* ─── receipt (Task 128-c) ─── */

    fun openReceipt() {
        val snapshot = _state.value
        val order = snapshot.order ?: return
        if (snapshot.receiptOpen) return
        _state.update { it.copy(receiptOpen = true, receiptError = "", receipt = null, receiptLoading = true) }
        viewModelScope.launch {
            try {
                val base = resolveBase()
                val response = ApiClient.orderDetailApi(base).receipt(order.id)
                if (!response.isSuccessful) {
                    val message = parseOrderDetailError(response.errorBody()?.string())
                        ?: "Could not load the receipt (HTTP ${response.code()})."
                    Log.w(TAG, "receipt failed http=${response.code()}: $message")
                    _state.update { it.copy(receiptLoading = false, receiptError = message) }
                    return@launch
                }
                val data = response.body()?.data
                if (data == null) {
                    _state.update { it.copy(receiptLoading = false, receiptError = "Receipt response was malformed — try again.") }
                    return@launch
                }
                _state.update { it.copy(receiptLoading = false, receipt = data, receiptError = "") }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "receipt network error", e)
                _state.update {
                    it.copy(receiptLoading = false, receiptError = "Network error while loading the receipt. Check your connection and retry.")
                }
            }
        }
    }

    fun dismissReceipt() {
        _state.update { it.copy(receiptOpen = false, receipt = null, receiptError = "") }
    }

    fun clearNotice() {
        _state.update { it.copy(payNotice = "", cancelNotice = "") }
    }

    companion object {
        private const val TAG = "ZylodOrderDetail"

        /** The web's own client-side patterns (order-detail-page.tsx). */
        val TRXID_PATTERN = Regex("^[A-Za-z0-9\\-_]{6,64}$")
        val SENDER_PATTERN = Regex("^\\+?[0-9]{6,20}$")

        /**
         * Method dropdown entries map to the REAL payments.method enum
         * (prisma: cod|bank_transfer|card|mobile_banking|wallet).
         * bKash/Nagad/Rocket are mobile_banking + a brand — the brand rides
         * in the submit payload exactly as POST payment-submit stores it.
         */
        val PAYMENT_METHOD_OPTIONS: List<OrderDetailMethodOption> = listOf(
            OrderDetailMethodOption("mobile_banking", "bKash", "bKash (mobile banking)"),
            OrderDetailMethodOption("mobile_banking", "Nagad", "Nagad (mobile banking)"),
            OrderDetailMethodOption("mobile_banking", "Rocket", "Rocket (mobile banking)"),
            OrderDetailMethodOption("bank_transfer", null, "Bank transfer"),
            OrderDetailMethodOption("cod", null, "Cash on Delivery"),
            OrderDetailMethodOption("wallet", null, "Wallet"),
            OrderDetailMethodOption("card", null, "Card"),
        )
    }
}

/** One method-dropdown row (value + optional brand + display label). */
data class OrderDetailMethodOption(
    val value: String,
    val brand: String?,
    val label: String,
)
