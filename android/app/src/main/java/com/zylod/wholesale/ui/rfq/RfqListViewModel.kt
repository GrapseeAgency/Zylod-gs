package com.zylod.wholesale.ui.rfq

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ApiEnvelope
import com.zylod.wholesale.data.api.RfqConvertRequest
import com.zylod.wholesale.data.api.RfqAwardRequest
import com.zylod.wholesale.data.api.RfqRowDto
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
import kotlinx.serialization.Serializable

/**
 * Buyer RFQ VM — GET api/rfq?role=buyer as the payload of record for pageId
 * "rfq-list" (RouteOwnership row renders [RfqListScreen] through
 * NativePageRegistry; the handler scopes rows by the authenticated user's
 * buyerId — rfq/route.ts, verified).
 *
 *  - PAGINATION + FILTER: page/limit (limit ≤ 50 server clamp, this VM asks
 *    20) plus the handler's status param (open|quoted|awarded|closed|
 *    expired; null = all). A filter change resets to page 1 and re-fetches;
 *    loadMore appends the next page with a keyed dedup so a double-tap can
 *    never duplicate a row (AdminUsersViewModel convention).
 *  - AUTH: no token → no call at all, the honest needsAuth gate (the
 *    OrdersViewModel convention — RFQs are never a hard redirect to login).
 *    A 401 on any call means a real end of session (the shared OkHttp
 *    authenticator has already attempted one token refresh by then) →
 *    needsAuth; SessionManager.expiredTick moves an open screen there too.
 *  - EXPAND-TO-DETAIL: tapping a card fetches GET api/rfq/{id} once and
 *    caches the last detail — re-expanding the same card is instant, the
 *    detail survives collapse while the VM lives.
 *  - AWARD: PATCH api/rfq/{id}/quotes/{quoteId} body { action: accept |
 *    reject } — NEVER mutates rows optimistically; after the server
 *    confirms, the detail AND the list re-pull so every rendered status is
 *    a wire fact. 409 texts ("Cannot accept quotes on an RFQ with status
 *    …", "Quote already accepted") surface VERBATIM as the action message.
 *  - CONVERT: POST api/rfq/{id}/convert-order with an empty body (the
 *    handler's strict destructuring accepts {}) → 201 { orderId,
 *    orderNumber, … }; success message "Order <orderNumber> created", then
 *    the same detail+list re-pull.
 *  - OFFLINE (DealsViewModel degrade convention): on failure, renderable
 *    data survives — in-memory rows first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_rfq_list_cache", written
 *    ONLY after a successful non-empty page pull) — and the state flips
 *    offline/offlineFromCache so the screen shows its saved-data banner.
 *
 * SERIALIZATION NOTE (the dc74841 lesson): everything persisted to prefs is
 * @Serializable — [CachedRfqListPage] and its List<RfqRowDto> field
 * (RfqRowDto and every nested DTO already are, with defaults).
 */
data class RfqListUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val loadingMore: Boolean = false,
    val rows: List<RfqRow> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    /** Committed status filter: "" = all, else the rfqs.status enum value. */
    val statusFilter: String = "",
    /** The expanded card's rfq id (null = every card collapsed). */
    val expandedRfqId: String? = null,
    /** The last fetched detail — shown under the card whose id matches. */
    val detail: RfqDetail? = null,
    val detailLoading: Boolean = false,
    /** The quote whose accept/reject PATCH is in flight (per-row progress). */
    val awardInFlightQuoteId: String? = null,
    /** The RFQ whose convert-order POST is in flight. */
    val convertingRfqId: String? = null,
    /** One-shot award/convert feedback — surfaced as a snackbar, then cleared. */
    val actionMessage: String? = null,
    /** Set only when nothing is renderable (no network AND no saved RFQs). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
)

class RfqListViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(RfqListUiState())
    val state: StateFlow<RfqListUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null
    private var moreJob: Job? = null
    private var detailJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (OrdersViewModel convention) instead of a stale
        // list that would 401 on every follow-up action.
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry pull (AdminUsersViewModel convention: called on EVERY entry). */
    fun load() {
        if (fetchJob?.isActive == true) return
        startPage1Load()
    }

    /** Silent re-pull — same semantics, named for pull-to-refresh parity. */
    fun refresh() = load()

    fun retry() = load()

    /** Next page append — guarded so concurrent taps cannot double-fetch. */
    fun loadMore() {
        val s = _state.value
        if (fetchJob?.isActive == true || moreJob?.isActive == true) return
        if (s.loading || s.loadingMore || s.page <= 0 || s.page >= s.totalPages) return
        _state.update { it.copy(loadingMore = true) }
        moreJob = viewModelScope.launch { fetchPage(s.page + 1, replace = false) }
    }

    /** Status chip — resets pagination to page 1 and re-fetches. */
    fun setStatusFilter(status: String) {
        if (_state.value.statusFilter == status) return
        _state.update { it.copy(statusFilter = status) }
        startPage1Load()
    }

    /**
     * Tap-to-expand: collapsing just clears the id; expanding fetches the
     * detail unless the cached one already matches this rfq (instant
     * re-expand). The previous detail stays visible until the fresh one
     * lands (cached last detail).
     */
    fun toggleExpand(rfqId: String?) {
        val current = _state.value.expandedRfqId
        if (rfqId == null || rfqId.isBlank()) return
        if (current == rfqId) {
            _state.update { it.copy(expandedRfqId = null, detailLoading = false) }
            return
        }
        _state.update { it.copy(expandedRfqId = rfqId) }
        if (_state.value.detail?.id == rfqId) return // cached — no re-fetch
        fetchDetail(rfqId)
    }

    fun clearActionMessage() {
        _state.update { it.copy(actionMessage = null) }
    }

    /**
     * Accept/reject one pending quote (award PATCH, body { action }). The
     * confirm dialog lives in the screen; the VM only does the wire work:
     * PATCH → on success refresh detail + list with the one-shot message,
     * on 401 the needsAuth gate, on 409/error the server text VERBATIM.
     */
    fun awardQuote(quoteId: String, accept: Boolean) {
        val rfqId = _state.value.expandedRfqId ?: return
        if (quoteId.isBlank() || _state.value.awardInFlightQuoteId != null) return
        _state.update { it.copy(awardInFlightQuoteId = quoteId, actionMessage = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "award quote action=${if (accept) "accept" else "reject"} quote=…${quoteId.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api = ApiClient.rfqApi(base)
                val response = api.awardQuote(
                    id = rfqId,
                    quoteId = quoteId,
                    body = RfqAwardRequest(action = if (accept) "accept" else "reject"),
                )
                if (response.code() == 401) {
                    Log.i(TAG, "award not permitted (session ended, http=401)")
                    _state.update { it.copy(awardInFlightQuoteId = null, loading = false, needsAuth = true) }
                    return@launch
                }
                val body = response.body()
                if (!response.isSuccessful || body == null || !body.success) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not ${if (accept) "accept" else "reject"} the quote (HTTP ${response.code()})"
                    Log.w(TAG, "award failed: $message")
                    _state.update { it.copy(awardInFlightQuoteId = null, actionMessage = message) }
                    return@launch
                }
                Log.i(TAG, "award ok rfqStatus=${body.data?.rfqStatus}")
                _state.update {
                    it.copy(
                        awardInFlightQuoteId = null,
                        actionMessage = if (accept) "Quote accepted — RFQ awarded" else "Quote rejected",
                    )
                }
                refreshAfterMutation(rfqId)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "award failed: ${e.message}")
                _state.update {
                    it.copy(
                        awardInFlightQuoteId = null,
                        actionMessage = "Network error — the action may not have applied. Retry.",
                    )
                }
            }
        }
    }

    /**
     * Convert an awarded RFQ into a real order (POST convert-order, empty
     * body — the handler's strict destructuring accepts {}). Success message
     * "Order <orderNumber> created"; 409/error text VERBATIM.
     */
    fun convertToOrder(rfqId: String) {
        if (rfqId.isBlank() || _state.value.convertingRfqId != null) return
        _state.update { it.copy(convertingRfqId = rfqId, actionMessage = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "convert to order rfq=…${rfqId.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api = ApiClient.rfqApi(base)
                val response = api.convertToOrder(id = rfqId, body = RfqConvertRequest(shippingAddressId = null))
                if (response.code() == 401) {
                    Log.i(TAG, "convert not permitted (session ended, http=401)")
                    _state.update { it.copy(convertingRfqId = null, loading = false, needsAuth = true) }
                    return@launch
                }
                val body = response.body()
                if (!response.isSuccessful || body == null || !body.success) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not convert the RFQ to an order (HTTP ${response.code()})"
                    Log.w(TAG, "convert failed: $message")
                    _state.update { it.copy(convertingRfqId = null, actionMessage = message) }
                    return@launch
                }
                val orderNumber = body.data?.orderNumber?.takeIf(String::isNotBlank) ?: "--"
                Log.i(TAG, "convert ok order=$orderNumber")
                _state.update {
                    it.copy(convertingRfqId = null, actionMessage = "Order $orderNumber created")
                }
                refreshAfterMutation(rfqId)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "convert failed: ${e.message}")
                _state.update {
                    it.copy(
                        convertingRfqId = null,
                        actionMessage = "Network error — the order may not have been created. Retry.",
                    )
                }
            }
        }
    }

    /** Page-1 (re)load for entry/refresh/filter changes — cancels in-flight. */
    private fun startPage1Load() {
        if (SessionManager.token() == null) {
            _state.value = RfqListUiState(loading = false, needsAuth = true, statusFilter = _state.value.statusFilter)
            return
        }
        moreJob?.cancel()
        fetchJob?.cancel()
        val hasRows = _state.value.rows.isNotEmpty()
        _state.update {
            it.copy(
                loading = !hasRows,
                refreshing = hasRows,
                loadingMore = false,
                error = null,
                offline = false,
                offlineFromCache = false,
                needsAuth = false,
            )
        }
        fetchJob = viewModelScope.launch { fetchPage(1, replace = true) }
    }

    private suspend fun fetchPage(pageNumber: Int, replace: Boolean) {
        val s = _state.value
        try {
            Log.i(TAG, "fetch buyer rfqs page=$pageNumber status=${s.statusFilter.ifBlank { "all" }}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.rfqApi(base)
            val response = api.list(
                page = pageNumber,
                limit = PAGE_LIMIT,
                status = s.statusFilter.takeIf(String::isNotBlank),
            )
            // Honest buyer gate: a 401 here means the session ended (the
            // shared authenticator already tried one refresh) — never
            // render rows as if they were real.
            if (response.code() == 401) {
                Log.i(TAG, "not signed in (http=401)")
                _state.value = RfqListUiState(
                    loading = false,
                    needsAuth = true,
                    statusFilter = s.statusFilter,
                )
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load RFQs (HTTP ${response.code()})"
                Log.w(TAG, "rfqs error: $message")
                degrade(message)
                return
            }
            val body = response.body()
            if (body == null || !body.success) {
                degrade("Could not load RFQs")
                return
            }
            val incoming = body.toRfqRows()
            val pagination = body.pagination
            val merged = if (replace) incoming else {
                // Keyed dedup — a duplicate page (retry after a timeout that
                // actually landed) can never double-render an RFQ card.
                val seen = _state.value.rows.mapTo(HashSet()) { it.key }
                _state.value.rows + incoming.filter { seen.add(it.key) }
            }
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                loadingMore = false,
                rows = merged,
                page = pagination?.page ?: pageNumber,
                totalPages = pagination?.totalPages?.takeIf { it > 0 } ?: _state.value.totalPages,
                total = pagination?.total ?: _state.value.total,
                error = null,
                offline = false,
                offlineFromCache = false,
                needsAuth = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same mappers).
            if (replace && incoming.isNotEmpty()) persistCache(body, pageNumber)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "rfqs fetch failed: ${e.message}")
            degrade("Network error while loading your RFQs. Check your connection and retry.")
        }
    }

    /**
     * GET api/rfq/{id} for the expanded card. Silent re-fetches (after an
     * award/convert) skip the spinner; failures are non-fatal — the card
     * keeps its list-projection body and a snackbar explains why.
     */
    private fun fetchDetail(rfqId: String, silent: Boolean = false) {
        if (detailJob?.isActive == true && silent) return
        _state.update { it.copy(detailLoading = !silent) }
        detailJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch rfq detail …${rfqId.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api = ApiClient.rfqApi(base)
                val response = api.detail(rfqId)
                if (response.code() == 401) {
                    Log.i(TAG, "detail not permitted (session ended, http=401)")
                    _state.update { it.copy(detailLoading = false, loading = false, needsAuth = true) }
                    return@launch
                }
                val body = response.body()
                val detail = body?.takeIf { response.isSuccessful && it.success }?.toRfqDetail()
                if (detail == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load the RFQ details (HTTP ${response.code()})"
                    Log.w(TAG, "detail error: $message")
                    _state.update { it.copy(detailLoading = false, actionMessage = message) }
                    return@launch
                }
                // Only the expanded card's detail may land (a stale response
                // for an earlier expansion must not overwrite the current one).
                if (_state.value.expandedRfqId == rfqId || _state.value.expandedRfqId == null) {
                    _state.update { it.copy(detailLoading = false, detail = detail) }
                } else {
                    _state.update { it.copy(detailLoading = false) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "detail fetch failed: ${e.message}")
                _state.update { it.copy(detailLoading = false, actionMessage = "Network error while loading the RFQ details.") }
            }
        }
    }

    /**
     * Server-confirmed mutation aftermath: re-pull the open detail AND the
     * visible list page (never optimistic). A list row that left the current
     * page (e.g. an accepted RFQ left the "open" filter) falls back to page 1.
     */
    private fun refreshAfterMutation(rfqId: String) {
        moreJob?.cancel()
        fetchJob?.cancel()
        fetchJob = viewModelScope.launch {
            val page = _state.value.page
            fetchPage(pageNumber = page, replace = true)
            if (_state.value.rows.isEmpty() && page > 1) fetchPage(pageNumber = 1, replace = true)
        }
        detailJob?.cancel()
        if (_state.value.detail != null) fetchDetail(rfqId, silent = true)
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory rows
     * first, then the saved cache; with neither, the first-launch offline
     * state. Rows are mapped on the MAIN thread after the IO cache read
     * (the date/amount formatters are main-thread JVM helpers).
     */
    private suspend fun degrade(message: String) {
        if (_state.value.rows.isNotEmpty()) {
            _state.update {
                it.copy(loading = false, refreshing = false, loadingMore = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { RfqListCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = RfqListUiState(
                loading = false,
                rows = cached.rows.map { it.toRfqRow() },
                page = cached.page,
                totalPages = cached.totalPages,
                total = cached.total,
                statusFilter = _state.value.statusFilter,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, loadingMore = false, error = message) }
        }
    }

    /** Persist the page's wire DTOs — the offline render matches the online one. */
    private fun persistCache(envelope: ApiEnvelope<List<RfqRowDto>>, page: Int) {
        val payload = CachedRfqListPage(
            rows = envelope.data.orEmpty(),
            page = page,
            totalPages = envelope.pagination?.totalPages?.takeIf { it > 0 } ?: 1,
            total = envelope.pagination?.total ?: envelope.data.orEmpty().size,
        )
        viewModelScope.launch(Dispatchers.IO) {
            RfqListCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodRfq"
        /** Server clamps limit to ≤ 50; 20 matches the admin surfaces' page size. */
        const val PAGE_LIMIT = 20
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type + nested type serializable). */
@Serializable
private data class CachedRfqListPage(
    val rows: List<RfqRowDto> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
)

/**
 * On-device saved buyer RFQs — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_rfq_list_cache". Payload = the last successful non-empty page
 * (wire DTOs + its pagination ints), so the offline render is consistent
 * with the online one.
 */
private object RfqListCacheStore {
    private const val TAG = "ZylodRfq"
    private const val PREFS = "zylod_config"
    const val KEY = "native_rfq_list_cache"

    fun read(context: Context): CachedRfqListPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedRfqListPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "rfq list cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedRfqListPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedRfqListPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "rfq list cache write failed: ${it.message}") }
    }
}
