package com.zylod.wholesale.ui.adminops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminOpsApi
import com.zylod.wholesale.data.api.AdminOpsPaymentRow
import com.zylod.wholesale.data.api.AdminOpsPaymentStats
import com.zylod.wholesale.data.api.AdminOpsPaymentsEnvelope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.Pagination
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
 * t265 — Admin Payments VM (pageId "admin-payments"): GET api/admin/payments
 * (payments/route.ts, requireUserType(['admin']), 401-first) — the REAL
 * manual payment chain: buyer submissions, seller/admin verify decisions and
 * webhook-recorded gateway payments.
 *
 *  - PAGINATION + FILTER: page/limit (20/page, server clamps ≤100) plus the
 *    handler's ?status (pending | success | failed | refunded) — the chip
 *    row sends exactly those; "All" omits the param. Any filter resets to
 *    page 1 and re-fetches; loadMore appends with an id-keyed dedup.
 *  - STATS: the platform-wide groupBy strip rides every response and stays
 *    independent of the current filter (wire fact, rendered as-is).
 *  - NOT-ADMIN (AdminUsersViewModel convention): 401/403 → honest gate.
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_admin_ops_admin-payments_cache", written ONLY
 *    after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class AdminPaymentsOpsUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val loadingMore: Boolean = false,
    val rows: List<AdminOpsPaymentRow> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    /** Platform-wide status counts — independent of the current filter. */
    val stats: AdminOpsPaymentStats? = null,
    /** Committed status filter: "" = all. */
    val statusFilter: String = "",
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or non-admin account — the screen's honest gate. */
    val notAdmin: Boolean = false,
)

class AdminPaymentsOpsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AdminPaymentsOpsUiState())
    val state: StateFlow<AdminPaymentsOpsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null
    private var moreJob: Job? = null

    /** Entry pull / retry — called on EVERY entry (the VM survives back stack). */
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
            Log.i(
                TAG,
                "fetch admin payments page=$pageNumber status=${s.statusFilter.ifBlank { "all" }}",
            )
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: AdminOpsApi = ApiClient.adminOpsApi(base)
            val response = api.payments(
                page = pageNumber,
                limit = PAGE_LIMIT,
                status = s.statusFilter.takeIf(String::isNotBlank),
            )
            // Honest admin gate: signed-out callers are 401 and non-admin
            // sessions 403 on the admin-only handler.
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not an admin session (http=${response.code()})")
                _state.value = AdminPaymentsOpsUiState(
                    loading = false,
                    notAdmin = true,
                    statusFilter = s.statusFilter,
                )
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load payments (HTTP ${response.code()})"
                Log.w(TAG, "payments error: $message")
                degrade(message)
                return
            }
            val body: AdminOpsPaymentsEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load payments")
                return
            }
            val incoming = body.data
            val merged = if (replace) incoming else {
                // Keyed dedup — a duplicate page (retry after a timeout that
                // actually landed) can never double-render a row.
                val seen = _state.value.rows.mapTo(HashSet()) { it.id.orEmpty() }
                _state.value.rows + incoming.filter { seen.add(it.id.orEmpty()) }
            }
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                loadingMore = false,
                rows = merged,
                page = body.pagination?.page ?: pageNumber,
                totalPages = body.pagination?.totalPages?.takeIf { it > 0 } ?: _state.value.totalPages,
                total = body.pagination?.total ?: _state.value.total,
                stats = body.stats ?: _state.value.stats,
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects). The wire
            // pagination travels WITH the cache so the offline meta line
            // ("Page X of Y · N payments") and the Load-more affordance
            // survive a degrade instead of collapsing to "Page 1 of 1 · 0".
            if (replace && incoming.isNotEmpty()) {
                persistCache(incoming, body.stats, body.pagination)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "payments fetch failed: ${e.message}")
            degrade("Network error while loading payments. Check your connection and retry.")
        }
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
        val cached = withContext(Dispatchers.IO) { PaymentsOpsCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = AdminPaymentsOpsUiState(
                loading = false,
                rows = cached.rows,
                page = cached.page,
                totalPages = cached.totalPages,
                total = cached.total,
                stats = cached.stats,
                statusFilter = _state.value.statusFilter,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, loadingMore = false, error = message) }
        }
    }

    /** Persist the page's wire DTOs — the offline render matches the online one,
     * including the pagination meta the offline header renders. */
    private fun persistCache(
        rows: List<AdminOpsPaymentRow>,
        stats: AdminOpsPaymentStats?,
        pagination: Pagination?,
    ) {
        val payload = CachedPaymentsOpsPage(
            rows = rows,
            stats = stats,
            page = pagination?.page ?: 1,
            totalPages = pagination?.totalPages?.takeIf { it > 0 } ?: 1,
            total = pagination?.total ?: rows.size,
        )
        viewModelScope.launch(Dispatchers.IO) {
            PaymentsOpsCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodAdminOps"
        /** Server clamps limit to 1..100; 20 matches the handler's default. */
        const val PAGE_LIMIT = 20
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedPaymentsOpsPage(
    val rows: List<AdminOpsPaymentRow> = emptyList(),
    val stats: AdminOpsPaymentStats? = null,
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
)

/**
 * On-device saved payments — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_admin_ops_admin-payments_cache".
 */
private object PaymentsOpsCacheStore {
    private const val TAG = "ZylodAdminOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_ops_admin-payments_cache"

    fun read(context: Context): CachedPaymentsOpsPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedPaymentsOpsPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "payments cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedPaymentsOpsPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedPaymentsOpsPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "payments cache write failed: ${it.message}") }
    }
}
