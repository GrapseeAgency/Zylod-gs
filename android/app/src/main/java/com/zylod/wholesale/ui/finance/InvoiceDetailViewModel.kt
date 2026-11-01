package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.OrderInvoiceDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Order tax-invoice VM — GET api/orders/{orderId}/invoice
 * (FinanceApi.orderInvoice) as the payload of record for the native
 * order-invoice AND order-invoice-download pageIds (the download pageId is
 * the web page's honest thin-alias twin).
 *
 *  - ROUTE TRUTH: the web order-invoice page consumes THIS endpoint (the
 *    purpose-built invoice document with server-computed VAT reference,
 *    discount derivation and platform billing identity) — NOT
 *    api/invoices/{id}, which is the Mushak 6.3 dialog document on the
 *    invoice-management page. Each surface keeps its own wire truth.
 *  - QUERY: the order id comes from the page query (`orderId=…`, the
 *    RouteOwnership.queryParam shape) and is re-resolved on EVERY entry —
 *    the VM is keyed by pageId, so a new id always re-fetches.
 *  - HONEST GUARDS: no id → noId (the web's "No order selected" card);
 *    401 → needsAuth (the shared authenticator already retried); 404 →
 *    notFound ('Order not found'); 403 → forbidden ('Not authorized to
 *    view this invoice' — the route's foreign-caller shape, verbatim).
 *  - OFFLINE: the last saved document for THIS order id (SharedPreferences
 *    "zylod_config", "native_invoice_detail_cache_<orderId>") renders with
 *    the offline banner otherwise (FinanceCacheStore degrade convention).
 */
data class InvoiceDetailUiState(
    /** Resolving / fetching the document (skeleton while empty). */
    val loading: Boolean = true,
    /** The order id parsed from the query ("" = none given). */
    val orderId: String = "",
    val detail: OrderInvoiceDto? = null,
    /** The query carried no order id — the honest "no order selected" card. */
    val noId: Boolean = false,
    /** 404 — the order does not exist (or the caller may not know it exists). */
    val notFound: Boolean = false,
    /** 403 — the caller is not the buyer / a supplier on the order / an admin. */
    val forbidden: Boolean = false,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible document came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class InvoiceDetailViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(InvoiceDetailUiState())
    val state: StateFlow<InvoiceDetailUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadedOrderId: String? = null

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

    /**
     * Entry resolve — called on EVERY entry with the page query; the order
     * id is re-parsed each time (the VM survives on the saved back stack,
     * so entering with a different order shows THAT order's invoice).
     */
    fun load(query: String) {
        val orderId = RouteQueryHelper.queryParam(query, "orderId")
            .ifBlank { RouteQueryHelper.queryParam(query, "id") }
        loadedOrderId = orderId.ifBlank { null }
        if (orderId.isBlank()) {
            _state.value = InvoiceDetailUiState(loading = false, noId = true)
            return
        }
        if (SessionManager.token() == null) {
            _state.value = InvoiceDetailUiState(loading = false, orderId = orderId, needsAuth = true)
            return
        }
        _state.value = InvoiceDetailUiState(
            loading = true,
            orderId = orderId,
            detail = _state.value.detail?.takeIf { loadedOrderId != null && _state.value.orderId == orderId },
        )
        viewModelScope.launch { fetchInvoice(orderId) }
    }

    /** Error-card Retry — full re-fetch of the current order id. */
    fun retry() {
        val orderId = loadedOrderId
        if (orderId.isNullOrBlank()) return
        _state.value = _state.value.copy(loading = true, error = null, notFound = false, forbidden = false)
        viewModelScope.launch { fetchInvoice(orderId) }
    }

    private suspend fun fetchInvoice(orderId: String) {
        try {
            Log.i(TAG, "fetch order invoice ${orderId.takeLast(8)}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).orderInvoice(orderId)
            if (response.code() == 401) {
                Log.i(TAG, "not permitted (http=401) — session ended")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            if (response.code() == 404) {
                Log.i(TAG, "invoice not found (http=404)")
                _state.value = _state.value.copy(loading = false, detail = null, notFound = true)
                return
            }
            if (response.code() == 403) {
                Log.i(TAG, "not authorized (http=403)")
                _state.value = _state.value.copy(loading = false, detail = null, forbidden = true)
                return
            }
            val payload = response.body()
            val detail = payload?.data
            if (!response.isSuccessful || payload?.success != true || detail == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to load invoice (HTTP ${response.code()})."
                Log.w(TAG, "order invoice error: $message")
                degrade(orderId, message)
                return
            }
            Log.i(TAG, "order invoice loaded ${detail.invoiceNumber}")
            _state.value = InvoiceDetailUiState(loading = false, orderId = orderId, detail = detail)
            persistCache(orderId, detail)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "order invoice fetch failed: ${e.message}")
            degrade(orderId, "Network error while loading the invoice. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved
     * document for THIS order id; with none, the honest error card.
     */
    private suspend fun degrade(orderId: String, message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(
                appContext,
                CreditCacheKeys.INVOICE_DETAIL_PREFIX + orderId,
                CachedInvoiceDetail.serializer(),
            )
        }
        val detail = cached?.detail
        if (detail != null) {
            Log.i(TAG, "degrade → cached order invoice")
            _state.value = InvoiceDetailUiState(
                loading = false,
                orderId = orderId,
                detail = detail,
                offlineFromCache = true,
            )
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    /** Persist the wire DTO under the per-order cache key. */
    private fun persistCache(orderId: String, detail: OrderInvoiceDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.INVOICE_DETAIL_PREFIX + orderId,
                CachedInvoiceDetail.serializer(),
                CachedInvoiceDetail(detail = detail),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}

/**
 * Tiny query-string reader (the RouteOwnership.queryParam shape, mirrored
 * locally so the ui/finance screens never depend on the nav package).
 */
object RouteQueryHelper {
    fun queryParam(query: String, name: String): String =
        query.split('&')
            .firstOrNull { it.substringBefore('=') == name }
            ?.substringAfter('=', "")
            ?.let { android.net.Uri.decode(it) }
            .orEmpty()
}
