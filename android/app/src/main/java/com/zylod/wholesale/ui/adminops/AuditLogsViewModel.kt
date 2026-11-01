package com.zylod.wholesale.ui.adminops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminOpsApi
import com.zylod.wholesale.data.api.AdminOpsAuditLogRow
import com.zylod.wholesale.data.api.AdminOpsAuditLogsEnvelope
import com.zylod.wholesale.data.api.ApiClient
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
 * t265 — Admin Audit Logs VM (pageId "admin-audit-logs"): GET
 * api/admin/audit-logs as the payload of record — the platform's REAL audit
 * trail (audit-logs/route.ts, requireUserType(['admin']), 401-first).
 *
 *  - PAGINATION + FILTER: page/limit (30/page, server clamps ≤100) plus the
 *    handler's action CONTAINS match — the chip row sends the action
 *    substring ("payment", "order", …) or omits it for "All". Any filter
 *    resets to page 1 and re-fetches; loadMore appends with an id-keyed
 *    dedup so a double-tap can never duplicate a row.
 *  - NOT-ADMIN (AdminUsersViewModel convention): a 401/403 means a real
 *    end-of-session or a buyer/supplier account → the honest gate state,
 *    never fabricated rows.
 *  - OFFLINE: on failure, renderable data survives — in-memory rows first,
 *    then the device-saved cache (SharedPreferences "zylod_config" under
 *    "native_admin_ops_admin-audit-logs_cache", written ONLY after a
 *    successful non-empty pull) — flipping offline/offlineFromCache.
 *  - t216 silent refresh: a re-pull never blanks visible data behind a
 *    spinner.
 */
data class AuditLogsUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val loadingMore: Boolean = false,
    val rows: List<AdminOpsAuditLogRow> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    /** Top entityType counts from the response summary (wire facts). */
    val summary: List<Pair<String, Int>> = emptyList(),
    /** Committed action CONTAINS filter: "" = all. */
    val actionFilter: String = "",
    /** Set only when nothing is renderable (no network AND no saved logs). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or non-admin account — the screen's honest gate. */
    val notAdmin: Boolean = false,
)

class AuditLogsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AuditLogsUiState())
    val state: StateFlow<AuditLogsUiState> = _state.asStateFlow()

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

    /** Action chip — resets pagination to page 1 and re-fetches. */
    fun setActionFilter(action: String) {
        if (_state.value.actionFilter == action) return
        _state.update { it.copy(actionFilter = action) }
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
                "fetch audit logs page=$pageNumber action=${s.actionFilter.ifBlank { "all" }}",
            )
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: AdminOpsApi = ApiClient.adminOpsApi(base)
            val response = api.auditLogs(
                page = pageNumber,
                limit = PAGE_LIMIT,
                action = s.actionFilter.takeIf(String::isNotBlank),
            )
            // Honest admin gate: signed-out callers are 401 and non-admin
            // sessions 403 on the admin-only handler.
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not an admin session (http=${response.code()})")
                _state.value = AuditLogsUiState(
                    loading = false,
                    notAdmin = true,
                    actionFilter = s.actionFilter,
                )
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load audit logs (HTTP ${response.code()})"
                Log.w(TAG, "audit logs error: $message")
                degrade(message)
                return
            }
            val body: AdminOpsAuditLogsEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load audit logs")
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
                summary = body.summary?.byEntityType
                    ?.mapNotNull { row ->
                        val type = row.entityType ?: return@mapNotNull null
                        type to row.count
                    }
                    ?.sortedByDescending { it.second }
                    .orEmpty(),
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same mappers).
            if (replace && incoming.isNotEmpty()) {
                persistCache(incoming, body.pagination?.page ?: pageNumber)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "audit logs fetch failed: ${e.message}")
            degrade("Network error while loading audit logs. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { AuditLogsCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = AuditLogsUiState(
                loading = false,
                rows = cached.rows,
                page = cached.page,
                totalPages = cached.totalPages,
                total = cached.total,
                actionFilter = _state.value.actionFilter,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, loadingMore = false, error = message) }
        }
    }

    /** Persist the page's wire DTOs — the offline render matches the online one. */
    private fun persistCache(rows: List<AdminOpsAuditLogRow>, page: Int) {
        val payload = CachedAuditLogsPage(rows = rows, page = page)
        viewModelScope.launch(Dispatchers.IO) {
            AuditLogsCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodAdminOps"
        /** Server clamps limit to 1..100; 30 matches the handler's default. */
        const val PAGE_LIMIT = 30
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedAuditLogsPage(
    val rows: List<AdminOpsAuditLogRow> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
)

/**
 * On-device saved audit logs — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_admin_ops_admin-audit-logs_cache". Payload = the last successful
 * non-empty page (wire DTOs), so the offline render is consistent with the
 * online one.
 */
private object AuditLogsCacheStore {
    private const val TAG = "ZylodAdminOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_ops_admin-audit-logs_cache"

    fun read(context: Context): CachedAuditLogsPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedAuditLogsPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "audit logs cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedAuditLogsPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedAuditLogsPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "audit logs cache write failed: ${it.message}") }
    }
}
