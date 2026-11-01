package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.InvoiceRowDto
import com.zylod.wholesale.data.api.MushakInvoiceDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Invoices VM — GET api/invoices (FinanceApi.invoices) as the payload of
 * record for the THREE native invoice-list pageIds (invoice-management,
 * seller-tax-invoices, invoice — one shared screen, pageId-keyed VMs).
 *
 *  - STATUS FILTER: the route's REAL contract — `status` filters the
 *    orders.paymentStatus column EXACTLY and is skipped when "all"/absent.
 *    The chips send the web page's exact three values (all | paid |
 *    pending); there are no other wire values, so no other chip.
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    the fetch (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth.
 *  - OFFLINE (PaymentHistoryViewModel degrade convention): on failure,
 *    renderable rows survive — in-memory first, then the device-saved
 *    cache (SharedPreferences "zylod_config", "native_invoices_cache",
 *    written after every success, TAGGED with the filter it was fetched
 *    under — a cache never renders under a different chip).
 *  - MUSHAK DIALOG: the row-level "Mushak 6.3" affordance fetches GET
 *    api/invoices/{id} (the web page's own dialog data source) into the
 *    [mushak*] state — loading/error/document, honest inside the dialog;
 *    404 'Invoice not found' (the route's foreign-id shape) surfaces
 *    verbatim. The dialog is transient, so it is deliberately not cached.
 */
data class InvoicesUiState(
    val loading: Boolean = true,
    val rows: List<InvoiceRowDto> = emptyList(),
    /** The active paymentStatus filter — the wire value ("all" = the skip token). */
    val filter: String = FILTER_ALL,
    /** The visible rows are SAVED data (in-memory or disk cache). */
    val offline: Boolean = false,
    /** Signed out (no token / dead session after the refresh retry). */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    // ── Mushak 6.3 dialog (GET api/invoices/{id}, transient) ──
    /** The order id whose Mushak document is being shown (null = closed). */
    val mushakOrderId: String? = null,
    val mushakLoading: Boolean = false,
    val mushakError: String? = null,
    val mushakDoc: MushakInvoiceDto? = null,
) {
    companion object {
        /** The route's documented skip token for the status param. */
        const val FILTER_ALL = "all"
    }
}

class InvoicesViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(InvoicesUiState())
    val state: StateFlow<InvoicesUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var activeFilter = InvoicesUiState.FILTER_ALL
    private var fetchInFlight = false
    private var mushakJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in state (PaymentHistoryViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = InvoicesUiState(
                        loading = false,
                        filter = activeFilter,
                        needsAuth = true,
                    )
                }
            }
        }
    }

    /** Entry pull / retry (called on EVERY entry — guard doctrine holds). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = InvoicesUiState(
                loading = false,
                filter = activeFilter,
                needsAuth = true,
            )
            return
        }
        if (fetchInFlight) return
        _state.value = _state.value.copy(
            loading = _state.value.rows.isEmpty(),
            error = null,
            needsAuth = false,
            offline = false,
            filter = activeFilter,
        )
        viewModelScope.launch { fetch() }
    }

    /** Same hook as OrdersViewModel.retry() — screens may bind either name. */
    fun retry() = refresh()

    /**
     * Open the Mushak 6.3 dialog for an order id and fetch GET
     * api/invoices/{id} — the route answers 404 for a foreign id, whose
     * verbatim text surfaces inside the dialog.
     */
    fun openMushak(orderId: String) {
        if (orderId.isBlank() || mushakJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(needsAuth = true)
            return
        }
        _state.value = _state.value.copy(
            mushakOrderId = orderId,
            mushakLoading = true,
            mushakError = null,
            mushakDoc = null,
        )
        mushakJob = viewModelScope.launch { fetchMushak(orderId) }
    }

    /** Close the dialog and drop its transient state. */
    fun closeMushak() {
        mushakJob?.cancel()
        mushakJob = null
        _state.value = _state.value.copy(
            mushakOrderId = null,
            mushakLoading = false,
            mushakError = null,
            mushakDoc = null,
        )
    }

    private suspend fun fetchMushak(orderId: String) {
        try {
            Log.i(TAG, "fetch mushak doc ${orderId.takeLast(6)}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).mushakInvoice(orderId)
            if (response.code() == 401) {
                Log.i(TAG, "mushak rejected (http=401) — session ended")
                _state.value = _state.value.copy(mushakLoading = false, mushakError = null, needsAuth = true)
                return
            }
            val payload = response.body()
            val doc = payload?.data
            if (!response.isSuccessful || payload?.success != true || doc == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the Mushak document (HTTP ${response.code()})."
                Log.w(TAG, "mushak error: $message")
                _state.value = _state.value.copy(mushakLoading = false, mushakError = message)
                return
            }
            Log.i(TAG, "mushak doc loaded ${doc.mushakNumber}")
            _state.value = _state.value.copy(mushakLoading = false, mushakDoc = doc)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "mushak fetch failed: ${e.message}")
            _state.value = _state.value.copy(
                mushakLoading = false,
                mushakError = "Network error while loading the Mushak document. Check your connection and retry.",
            )
        }
    }

    /**
     * paymentStatus chip tap — swaps the filter and re-fetches (the route
     * filters server-side by the exact value; "all" is the skip token).
     * Same-filter taps are no-ops.
     */
    fun setFilter(status: String) {
        if (status == activeFilter) return
        activeFilter = status
        if (SessionManager.token() == null) {
            _state.value = InvoicesUiState(
                loading = false,
                filter = activeFilter,
                needsAuth = true,
            )
            return
        }
        _state.value = InvoicesUiState(loading = true, filter = activeFilter)
        viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        fetchInFlight = true
        try {
            Log.i(TAG, "fetch invoices filter=$activeFilter")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).invoices(
                status = activeFilter.takeIf { it != InvoicesUiState.FILTER_ALL },
            )
            if (response.code() == 401) {
                Log.w(TAG, "invoices 401 — session ended")
                _state.value = InvoicesUiState(
                    loading = false,
                    filter = activeFilter,
                    needsAuth = true,
                )
                return
            }
            val payload = response.body()
            val rows = payload?.data
            if (!response.isSuccessful || payload?.success != true || rows == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load invoices (HTTP ${response.code()})."
                Log.w(TAG, "invoices error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "invoices loaded rows=${rows.size}")
            _state.value = InvoicesUiState(loading = false, rows = rows, filter = activeFilter)
            persistCache(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "invoices fetch failed: ${e.message}")
            degrade("Network error while loading invoices. Check your connection and retry.")
        } finally {
            fetchInFlight = false
        }
    }

    /**
     * Failure path: keep renderable rows (banner state) — in-memory first,
     * then the saved cache ONLY when it was fetched under the same filter;
     * with neither, the honest error card.
     */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.rows.isNotEmpty()) {
            _state.value = s.copy(loading = false, offline = true)
            return
        }
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.INVOICES, CachedInvoices.serializer())
        }
        val usable = cached?.takeIf { it.filter == activeFilter && it.rows.isNotEmpty() }
        if (usable != null) {
            Log.i(TAG, "degrade → cache rows=${usable.rows.size}")
            _state.value = InvoicesUiState(
                loading = false,
                rows = usable.rows,
                filter = activeFilter,
                offline = true,
            )
        } else {
            _state.value = InvoicesUiState(
                loading = false,
                filter = activeFilter,
                error = message,
            )
        }
    }

    /** Persist the rows, tagged with the filter they belong to. */
    private fun persistCache(rows: List<InvoiceRowDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.INVOICES,
                CachedInvoices.serializer(),
                CachedInvoices(rows = rows, filter = activeFilter),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}
