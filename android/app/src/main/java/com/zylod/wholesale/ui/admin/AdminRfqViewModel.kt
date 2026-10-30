package com.zylod.wholesale.ui.admin

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminRfqCloseRequest
import com.zylod.wholesale.data.api.AdminRfqDetailDto
import com.zylod.wholesale.data.api.AdminRfqRowDto
import com.zylod.wholesale.data.api.AdminRfqStatsDto
import com.zylod.wholesale.data.api.AdminRfqsEnvelope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ApiEnvelope
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.ui.rfq.rfqStatusLabel
import com.zylod.wholesale.ui.wallet.formatBdt
import com.zylod.wholesale.ui.wallet.formatRelativeDate
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
import java.util.Locale

/**
 * Admin RFQ review VM — GET api/admin/rfqs as the payload of record for
 * pageId "admin-rfq" (RouteOwnership row renders [AdminRfqScreen] through
 * NativePageRegistry; the handler is requireUserType(['admin']) —
 * admin/rfqs/route.ts, verified).
 *
 *  - PAGINATION + FILTER: page/limit (limit ≤ 50 server clamp, this VM asks
 *    20) plus the handler's status param (open|quoted|awarded|closed|
 *    expired; "all" omits it). A filter change resets to page 1 and
 *    re-fetches; loadMore appends the next page with a keyed dedup
 *    (AdminUsersViewModel convention).
 *  - STATS: the envelope's TOP-LEVEL stats block (per-status counts) rides
 *    the dedicated [AdminRfqsEnvelope] — the screen's KPI chip row renders
 *    exactly those wire numbers, never computed-from-page substitutes.
 *  - NOT-ADMIN (AdminUsersViewModel auth-gate convention): a 401/403 means
 *    a real end-of-session or a buyer/supplier account → the honest
 *    notAdmin state, never fabricated rows.
 *  - OFFLINE (DealsViewModel degrade convention): on failure, renderable
 *    data survives — in-memory rows first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_admin_rfq_cache", written
 *    ONLY after a successful non-empty page pull) — and the state flips
 *    offline/offlineFromCache so the screen shows its saved-data banner.
 *  - CLOSE: PATCH api/admin/rfqs/{id} body { status: "closed" } — accepted
 *    ONLY from status open|quoted (else 409 "Cannot close an RFQ with
 *    status \"<status>\\"", surfaced VERBATIM); the list re-pulls after the
 *    server confirms, never optimistic. 401/403 on the WRITE path surfaces
 *    "Admin access required" (AdminUsersViewModel applyUserAction parity).
 *  - t216 silent refresh: a re-pull never blanks visible data behind a
 *    spinner — the fetch replaces it in place (refreshing flag).
 *
 * SERIALIZATION NOTE (the dc74841 lesson): everything persisted to prefs is
 * @Serializable — [CachedAdminRfqsPage] and its List<AdminRfqRowDto> field
 * (AdminRfqRowDto and every nested DTO already are, with defaults).
 */
data class AdminRfqUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val loadingMore: Boolean = false,
    val rows: List<AdminRfqRow> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    /** Committed status filter: "all" = none, else the rfqs.status enum value. */
    val statusFilter: String = "all",
    /** The wire stats block (Open n · Quoted n · … · Total n). */
    val stats: AdminRfqStats? = null,
    /** The expanded card's rfq id (null = every card collapsed). */
    val expandedRfqId: String? = null,
    /** The last fetched detail — shown under the card whose id matches. */
    val detail: AdminRfqDetail? = null,
    val detailLoading: Boolean = false,
    /** The RFQ whose close PATCH is in flight (per-card progress). */
    val closingRfqId: String? = null,
    /** One-shot close feedback — surfaced as a snackbar, then cleared. */
    val actionMessage: String? = null,
    /** Set only when nothing is renderable (no network AND no saved RFQs). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or non-admin account — the screen's honest gate. */
    val notAdmin: Boolean = false,
)

class AdminRfqViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AdminRfqUiState())
    val state: StateFlow<AdminRfqUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null
    private var moreJob: Job? = null
    private var detailJob: Job? = null

    /** Entry pull / retry (AdminUsersViewModel convention: every entry). */
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

    /** Status chip — resets pagination to page 1 and re-fetches. */
    fun setStatusFilter(status: String) {
        if (_state.value.statusFilter == status) return
        _state.update { it.copy(statusFilter = status) }
        startPage1Load()
    }

    /**
     * Tap-to-expand: collapsing just clears the id; expanding fetches the
     * admin detail unless the cached one already matches this rfq. The
     * previous detail stays visible until the fresh one lands.
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
     * Close an RFQ (admin PATCH, body { status: "closed" } — the ONLY value
     * the handler accepts, and only from open|quoted). The confirm dialog
     * lives in the screen; the VM does the wire work: PATCH → on success a
     * one-shot message and the detail+list re-pull, on 401/403 the admin
     * gate message, on 409 the server text VERBATIM.
     */
    fun closeRfq(rfqId: String) {
        if (rfqId.isBlank() || _state.value.closingRfqId != null) return
        _state.update { it.copy(closingRfqId = rfqId, actionMessage = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "close rfq id=…${rfqId.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api = ApiClient.adminApi(base)
                val response = api.closeRfq(id = rfqId, body = AdminRfqCloseRequest(status = "closed"))
                // Honest gate for the WRITE endpoint too: a 401/403 here means
                // the session ended or the account is not an admin.
                if (response.code() == 401 || response.code() == 403) {
                    Log.i(TAG, "close not permitted (http=${response.code()})")
                    _state.update {
                        it.copy(closingRfqId = null, actionMessage = "Admin access required")
                    }
                    return@launch
                }
                val body = response.body()
                if (!response.isSuccessful || body == null || !body.success) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not close the RFQ (HTTP ${response.code()})"
                    Log.w(TAG, "close failed: $message")
                    _state.update { it.copy(closingRfqId = null, actionMessage = message) }
                    return@launch
                }
                Log.i(TAG, "close ok status=${body.data?.status}")
                _state.update {
                    it.copy(closingRfqId = null, actionMessage = "RFQ closed")
                }
                refreshAfterMutation(rfqId)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "close failed: ${e.message}")
                _state.update {
                    it.copy(
                        closingRfqId = null,
                        actionMessage = "Network error — the action may not have applied. Retry.",
                    )
                }
            }
        }
    }

    /** Page-1 (re)load for entry/refresh/filter changes — cancels in-flight. */
    private fun startPage1Load() {
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
                notAdmin = false,
            )
        }
        fetchJob = viewModelScope.launch { fetchPage(1, replace = true) }
    }

    private suspend fun fetchPage(pageNumber: Int, replace: Boolean) {
        val s = _state.value
        try {
            Log.i(TAG, "fetch admin rfqs page=$pageNumber status=${s.statusFilter}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.adminApi(base)
            val response = api.rfqs(
                page = pageNumber,
                limit = PAGE_LIMIT,
                status = s.statusFilter.takeIf { it != FILTER_ALL },
            )
            // Honest admin gate: signed-out callers are 401 and non-admin
            // sessions 403 on the admin-only handler — never render rows
            // as if they were real.
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not an admin session (http=${response.code()})")
                _state.value = AdminRfqUiState(
                    loading = false,
                    notAdmin = true,
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
                stats = body.stats?.toStats(),
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same mappers; stats are
            // NOT cached — the banner explains the stale view instead).
            if (replace && incoming.isNotEmpty()) persistCache(body, pageNumber)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "rfqs fetch failed: ${e.message}")
            degrade("Network error while loading RFQs. Check your connection and retry.")
        }
    }

    /**
     * GET api/admin/rfqs/{id} for the expanded card. Silent re-fetches
     * (after a close) skip the spinner; failures are non-fatal — the card
     * keeps its list-projection body and a snackbar explains why.
     */
    private fun fetchDetail(rfqId: String, silent: Boolean = false) {
        if (detailJob?.isActive == true && silent) return
        _state.update { it.copy(detailLoading = !silent) }
        detailJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch admin rfq detail …${rfqId.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api = ApiClient.adminApi(base)
                val response = api.rfqDetail(rfqId)
                if (response.code() == 401 || response.code() == 403) {
                    Log.i(TAG, "detail not permitted (http=${response.code()})")
                    _state.update {
                        it.copy(detailLoading = false, loading = false, notAdmin = true)
                    }
                    return@launch
                }
                val body = response.body()
                val detail = body?.takeIf { response.isSuccessful && it.success }?.toAdminRfqDetail()
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
     * Server-confirmed close aftermath: re-pull the open detail AND the
     * visible list page (never optimistic) — a closed RFQ leaves the
     * open/quoted filters, so an emptied page falls back to page 1.
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
     * state. Rows are mapped on the MAIN thread after the IO cache read.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.rows.isNotEmpty()) {
            _state.update {
                it.copy(loading = false, refreshing = false, loadingMore = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { AdminRfqCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = AdminRfqUiState(
                loading = false,
                rows = cached.rows.map { it.toAdminRfqRow() },
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
    private fun persistCache(envelope: AdminRfqsEnvelope, page: Int) {
        val payload = CachedAdminRfqsPage(
            rows = envelope.data,
            page = page,
            totalPages = envelope.pagination?.totalPages?.takeIf { it > 0 } ?: 1,
            total = envelope.pagination?.total ?: envelope.data.size,
        )
        viewModelScope.launch(Dispatchers.IO) {
            AdminRfqCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodAdmin"
        /** Server clamps limit to ≤ 50; 20 matches the handler's default. */
        const val PAGE_LIMIT = 20
        /** The filter sentinel that omits the status query param entirely. */
        const val FILTER_ALL = "all"
    }
}

/* ─── domain models + mappers (AdminModels conventions, admin-rfq slice) ─── */

/** One admin RFQ review card row (list projection + precomputed labels). */
data class AdminRfqRow(
    val key: String,
    val id: String?,
    val title: String,
    val status: String?,
    /** "Open" / "Quoted" / "Awarded" / "Closed" / "Expired" / raw fallback. */
    val statusLabel: String,
    val buyerName: String?,
    /** "3 items" / "1 item" — the wire itemCount. */
    val itemCountLabel: String,
    /** "4 quotes" / "1 quote" / "No quotes yet" — the wire quoteCount. */
    val quoteCountLabel: String,
    /** "৳min – ৳max" from the bestQuote aggregate, or "—" when absent. */
    val bestQuoteLabel: String,
    /** "120 pcs · target ৳1,500" — quantity/unit/target line (best effort). */
    val summaryLabel: String,
    val deliveryCity: String?,
    /** "Deadline in 3d · Jan 5, 2025" — null when absent/unparsable. */
    val deadlineLabel: String?,
    /** "3h ago" for createdAt — null when the instant is missing/unparsable. */
    val createdLabel: String?,
)

/** One line item inside an expanded admin RFQ card. */
data class AdminRfqItemRow(
    val key: String,
    val name: String,
    val specs: String?,
    val qtyLabel: String,
    val targetLabel: String?,
)

/** One supplier quote inside an expanded admin RFQ card. */
data class AdminRfqQuoteRow(
    val key: String,
    /** supplier.displayName or the honest "Supplier" fallback. */
    val supplierLabel: String,
    val priceLabel: String?,
    val totalLabel: String?,
    val deliveryLabel: String?,
    val message: String?,
    val status: String?,
    val statusLabel: String,
    /** status == pending (informational on the admin surface — no actions). */
    val pending: Boolean,
)

/** The admin detail payload behind an expanded card (GET api/admin/rfqs/{id}). */
data class AdminRfqDetail(
    val key: String,
    val id: String?,
    val title: String,
    val description: String?,
    val categorySlug: String?,
    val status: String?,
    val statusLabel: String,
    val summaryLabel: String,
    val buyerName: String?,
    val deliveryCity: String?,
    val deadlineLabel: String?,
    val items: List<AdminRfqItemRow>,
    val quotes: List<AdminRfqQuoteRow>,
    /** open|quoted → the [Close RFQ] button renders (the handler's rule). */
    val closable: Boolean,
)

/** The wire stats block, typed for the screen's chip row. */
data class AdminRfqStats(
    val open: Int,
    val quoted: Int,
    val awarded: Int,
    val closed: Int,
    val expired: Int,
    val total: Int,
)

/** Admin RFQ list page (GET api/admin/rfqs) — typed on ITS envelope type. */
fun AdminRfqsEnvelope.toRfqRows(): List<AdminRfqRow> =
    data.map { it.toAdminRfqRow() }

/** Admin RFQ detail — null when data is missing (shape drift). */
fun ApiEnvelope<AdminRfqDetailDto>.toAdminRfqDetail(): AdminRfqDetail? {
    val data = data ?: return null
    return data.toAdminRfqDetail()
}

fun AdminRfqStatsDto?.toStats(): AdminRfqStats? = this?.let {
    AdminRfqStats(
        open = it.open,
        quoted = it.quoted,
        awarded = it.awarded,
        closed = it.closed,
        expired = it.expired,
        total = it.total,
    )
}

/** List row mapper — labels precomputed, nothing invented. */
fun AdminRfqRowDto.toAdminRfqRow() = AdminRfqRow(
    key = "rfq-$stableKey",
    id = id?.takeIf(String::isNotBlank),
    title = title?.takeIf(String::isNotBlank) ?: "Untitled RFQ",
    status = status?.takeIf(String::isNotBlank),
    statusLabel = rfqStatusLabel(status),
    buyerName = buyer?.displayName?.takeIf(String::isNotBlank),
    itemCountLabel = when (itemCount) {
        0 -> "No items"
        1 -> "1 item"
        else -> "$itemCount items"
    },
    quoteCountLabel = when {
        quoteCount <= 0 -> "No quotes yet"
        quoteCount == 1 -> "1 quote"
        else -> "$quoteCount quotes"
    },
    bestQuoteLabel = bestQuoteLabelOf(bestQuote?.min, bestQuote?.max),
    summaryLabel = summaryLabelOf(quantity, unit, targetPrice),
    deliveryCity = deliveryCity?.takeIf(String::isNotBlank),
    deadlineLabel = deadlineLabelOf(deadline),
    createdLabel = formatRelativeDate(createdAt).takeIf(String::isNotBlank),
)

/** Admin detail mapper — the expanded card's payload of record. */
fun AdminRfqDetailDto.toAdminRfqDetail() = AdminRfqDetail(
    key = "rfq-$stableKey",
    id = id?.takeIf(String::isNotBlank),
    title = title?.takeIf(String::isNotBlank) ?: "Untitled RFQ",
    description = description?.takeIf(String::isNotBlank),
    categorySlug = categorySlug?.takeIf(String::isNotBlank),
    status = status?.takeIf(String::isNotBlank),
    statusLabel = rfqStatusLabel(status),
    summaryLabel = summaryLabelOf(quantity, unit, targetPrice),
    buyerName = buyer?.displayName?.takeIf(String::isNotBlank),
    deliveryCity = deliveryCity?.takeIf(String::isNotBlank),
    deadlineLabel = deadlineLabelOf(deadline),
    items = items.map { it.toItemRow() },
    quotes = quotes.map { it.toQuoteRow() },
    closable = status?.trim()?.lowercase(Locale.US) == "open" ||
        status?.trim()?.lowercase(Locale.US) == "quoted",
)

private fun AdminRfqItemDto.toItemRow() = AdminRfqItemRow(
    key = "aitem-$stableKey",
    name = productName?.takeIf(String::isNotBlank) ?: "Unnamed item",
    specs = specifications?.takeIf(String::isNotBlank),
    qtyLabel = quantityLabelOf(quantity, unit),
    targetLabel = targetPrice?.takeIf { it > 0.0 }?.let { formatBdt(it) },
)

private fun AdminRfqDetailQuoteDto.toQuoteRow() = AdminRfqQuoteRow(
    key = "aquote-$stableKey",
    supplierLabel = supplier?.displayName?.takeIf(String::isNotBlank) ?: "Supplier",
    priceLabel = pricePerUnit?.takeIf { it > 0.0 }?.let { "${formatBdt(it)} / unit" },
    totalLabel = totalPrice?.takeIf { it > 0.0 }?.let { formatBdt(it) },
    deliveryLabel = deliveryDays?.takeIf { it > 0 }?.let { "${it}d delivery" },
    message = message?.takeIf(String::isNotBlank),
    status = status?.takeIf(String::isNotBlank),
    statusLabel = when (status?.trim()?.lowercase(Locale.US)) {
        "pending" -> "Pending"
        "accepted" -> "Accepted"
        "rejected" -> "Rejected"
        else -> status?.takeIf(String::isNotBlank) ?: "Pending"
    },
    pending = status?.trim()?.lowercase(Locale.US) == "pending",
)

/** "৳min – ৳max" or "—" — never invents a range the wire did not send. */
private fun bestQuoteLabelOf(min: Double?, max: Double?): String {
    val minLabel = min?.takeIf { it > 0.0 }?.let { formatBdt(it) }
    val maxLabel = max?.takeIf { it > 0.0 }?.let { formatBdt(it) }
    return when {
        minLabel != null && maxLabel != null && minLabel != maxLabel -> "$minLabel – $maxLabel"
        minLabel != null && maxLabel != null -> minLabel
        minLabel != null -> minLabel
        maxLabel != null -> maxLabel
        else -> "—"
    }
}

/** "120 pcs · target ৳1,500" — whichever parts the wire actually carries. */
private fun summaryLabelOf(quantity: Double?, unit: String?, targetPrice: Double?): String {
    val qty = quantityLabelOf(quantity, unit)
    val target = targetPrice?.takeIf { it > 0.0 }?.let { "target ${formatBdt(it)}" }
    return listOf(qty, target).filter { it.isNotBlank() }.joinToString(" · ")
}

/** "120 pcs" / "120" / "" — never invents a unit. */
private fun quantityLabelOf(quantity: Double?, unit: String?): String {
    if (quantity == null || quantity <= 0.0) return ""
    val qty = if (quantity % 1.0 == 0.0) quantity.toLong().toString() else quantity.toString()
    val unitText = unit?.takeIf(String::isNotBlank) ?: return qty
    return "$qty $unitText"
}

/**
 * "Deadline in 3d · Jan 5, 2025" (or "Deadline today/tomorrow/passed") —
 * null when the instant is missing/unparsable, never invented. UTC parse
 * like formatAdminDate; day granularity from calendar dates.
 */
private fun deadlineLabelOf(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val parsed = runCatching {
        val utc = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
        utc.parse(iso.take(19))
    }.getOrNull() ?: return null
    val deadlineCal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
        clear()
        time = parsed
    }
    val todayCal = java.util.Calendar.getInstance()
    fun dayNumber(cal: java.util.Calendar): Long =
        cal.get(java.util.Calendar.YEAR) * 10_000L + cal.get(java.util.Calendar.MONTH) * 100L +
            cal.get(java.util.Calendar.DAY_OF_MONTH)
    val diffDays = dayNumber(deadlineCal) - dayNumber(todayCal)
    val relative = when {
        diffDays > 1L -> "Deadline in ${diffDays}d"
        diffDays == 1L -> "Deadline tomorrow"
        diffDays == 0L -> "Deadline today"
        else -> "Deadline passed"
    }
    val absolute = java.text.SimpleDateFormat("MMM d, yyyy", Locale.US).format(deadlineCal.time)
    return "$relative · $absolute"
}

/** @Serializable page snapshot (dc74841 rule: every persisted type + nested type serializable). */
@Serializable
private data class CachedAdminRfqsPage(
    val rows: List<AdminRfqRowDto> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
)

/**
 * On-device saved admin RFQs — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_admin_rfq_cache". Payload = the last successful non-empty page
 * (wire DTOs + its pagination ints), so the offline render is consistent
 * with the online one.
 */
private object AdminRfqCacheStore {
    private const val TAG = "ZylodAdmin"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_rfq_cache"

    fun read(context: Context): CachedAdminRfqsPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedAdminRfqsPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "admin rfq cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedAdminRfqsPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedAdminRfqsPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "admin rfq cache write failed: ${it.message}") }
    }
}
