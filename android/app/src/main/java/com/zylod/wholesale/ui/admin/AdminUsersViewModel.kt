package com.zylod.wholesale.ui.admin

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminUserActionRequest
import com.zylod.wholesale.data.api.AdminUserDto
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
 * Native Admin Users VM — GET api/admin/users as the payload of record for
 * pageId "admin-users" (RouteOwnership row renders
 * [AdminUsersScreen] through NativePageRegistry; the handler is
 * requireUserType(['admin']) — admin/users/route.ts, verified).
 *
 *  - PAGINATION + FILTERS: page/limit (1..100 server clamp, this VM asks 20)
 *    plus the handler's role (buyer|supplier|admin), status
 *    (active|suspended|banned) and search (matches email/phone/buyer name/
 *    supplier company) params. Any filter or committed search resets to
 *    page 1 and re-fetches; loadMore appends the next page with a keyed
 *    dedup so a double-tap can never duplicate a row.
 *  - NOT-ADMIN (AdminDashboardViewModel auth-gate convention): a 401/403
 *    means a real end-of-session or a buyer/supplier account (the shared
 *    OkHttp authenticator has already attempted one token refresh by then)
 *    → the honest notAdmin state, never fabricated rows.
 *  - OFFLINE (DealsViewModel degrade convention): on failure, renderable
 *    data survives — in-memory rows first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_admin_users_cache", written
 *    ONLY after a successful non-empty page pull) — and the state flips
 *    offline/offlineFromCache so the screen shows its saved-data banner.
 *    With nothing renderable at all: the honest first-launch offline state.
 *  - MODERATION: applyUserAction PATCHes api/admin/users
 *    ({ userId, action: suspend|activate|ban, reason? }) and NEVER mutates
 *    rows optimistically — the list re-pulls after the server confirms, so
 *    every rendered account status is a wire fact.
 *  - t216 silent refresh: a re-pull never blanks visible data behind a
 *    spinner — the fetch replaces it in place (refreshing flag).
 *
 * SERIALIZATION NOTE (the dc74841 lesson): everything persisted to prefs is
 * @Serializable — [CachedAdminUsersPage] and its List<AdminUserDto> field
 * (AdminUserDto and every field of it already are, with defaults).
 */
data class AdminUsersUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val loadingMore: Boolean = false,
    val rows: List<AdminUserRow> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    /** Committed role filter: "" = all, else buyer|supplier|admin. */
    val roleFilter: String = "",
    /** Committed account-status filter: "" = all, else active|suspended|banned. */
    val statusFilter: String = "",
    /** Committed search text (email/phone/name/company) — empty = none. */
    val searchQuery: String = "",
    /** Set only when nothing is renderable (no network AND no saved users). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or non-admin account — the screen's honest gate. */
    val notAdmin: Boolean = false,
    /** The user card whose moderation action is in flight (per-card progress). */
    val actionInProgressUserId: String? = null,
    /** One-shot moderation feedback — surfaced as a snackbar, then cleared. */
    val actionMessage: String? = null,
)

class AdminUsersViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AdminUsersUiState())
    val state: StateFlow<AdminUsersUiState> = _state.asStateFlow()

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

    /** Role chip — resets pagination to page 1 and re-fetches. */
    fun setRoleFilter(role: String) {
        if (_state.value.roleFilter == role) return
        _state.update { it.copy(roleFilter = role) }
        startPage1Load()
    }

    /** Status chip — resets pagination to page 1 and re-fetches. */
    fun setStatusFilter(status: String) {
        if (_state.value.statusFilter == status) return
        _state.update { it.copy(statusFilter = status) }
        startPage1Load()
    }

    /**
     * Committed search (IME action / search button, not per keystroke) —
     * resets pagination to page 1 and re-fetches. Blank clears the search.
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
     * Moderation action (admin/users PATCH): suspend | activate | ban, with
     * an optional reason that is audit-logged server-side. In-flight is
     * tracked per-user ([AdminUsersUiState.actionInProgressUserId]); the
     * list re-pulls ONLY after the server confirms — never optimistic.
     */
    fun applyUserAction(userId: String, action: String, reason: String?) {
        if (userId.isBlank()) return
        if (_state.value.actionInProgressUserId != null) return
        _state.update { it.copy(actionInProgressUserId = userId, actionMessage = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "user action=$action id=…${userId.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api = ApiClient.adminApi(base)
                val response = api.updateUserStatus(
                    AdminUserActionRequest(
                        userId = userId,
                        action = action,
                        reason = reason?.trim()?.takeIf(String::isNotBlank),
                    ),
                )
                // Honest gate for the WRITE endpoint too: a 401/403 here means
                // the session ended or the account is not an admin.
                if (response.code() == 401 || response.code() == 403) {
                    Log.i(TAG, "user action not permitted (http=${response.code()})")
                    _state.update {
                        it.copy(actionInProgressUserId = null, actionMessage = "Admin access required")
                    }
                    return@launch
                }
                val body = response.body()
                if (!response.isSuccessful || body == null || !body.success) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not update the user (HTTP ${response.code()})"
                    Log.w(TAG, "user action failed: $message")
                    _state.update { it.copy(actionInProgressUserId = null, actionMessage = message) }
                    return@launch
                }
                Log.i(TAG, "user action ok status=${body.data?.accountStatus}")
                _state.update {
                    it.copy(
                        actionInProgressUserId = null,
                        actionMessage = when (action) {
                            "suspend" -> "User suspended"
                            "ban" -> "User banned"
                            else -> "User activated"
                        },
                    )
                }
                // Server-confirmed rows only: re-pull with the same filters —
                // the visible page first, page 1 when the moderated row left
                // it (e.g. a status filter that no longer matches).
                moreJob?.cancel()
                val page = _state.value.page
                fetchJob?.cancel()
                fetchJob = viewModelScope.launch {
                    fetchPage(pageNumber = page, replace = true)
                    if (_state.value.rows.isEmpty() && page > 1) fetchPage(pageNumber = 1, replace = true)
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "user action failed: ${e.message}")
                _state.update {
                    it.copy(
                        actionInProgressUserId = null,
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
            Log.i(
                TAG,
                "fetch admin users page=$pageNumber role=${s.roleFilter.ifBlank { "all" }} " +
                    "status=${s.statusFilter.ifBlank { "all" }} search=${s.searchQuery.ifBlank { "-" }}",
            )
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.adminApi(base)
            val response = api.users(
                page = pageNumber,
                limit = PAGE_LIMIT,
                role = s.roleFilter.takeIf(String::isNotBlank),
                status = s.statusFilter.takeIf(String::isNotBlank),
                search = s.searchQuery.takeIf(String::isNotBlank),
            )
            // Honest admin gate: signed-out callers are 401 and non-admin
            // sessions 403 on the admin-only handler — never render rows
            // as if they were real.
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not an admin session (http=${response.code()})")
                _state.value = AdminUsersUiState(
                    loading = false,
                    notAdmin = true,
                    roleFilter = s.roleFilter,
                    statusFilter = s.statusFilter,
                    searchQuery = s.searchQuery,
                )
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load users (HTTP ${response.code()})"
                Log.w(TAG, "users error: $message")
                degrade(message)
                return
            }
            val body = response.body()
            if (body == null || !body.success) {
                degrade("Could not load users")
                return
            }
            val incoming = body.toUserRows()
            val pagination = body.pagination
            val merged = if (replace) incoming else {
                // Keyed dedup — a duplicate page (retry after a timeout that
                // actually landed) can never double-render a user card.
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
                notAdmin = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same mappers).
            if (replace && incoming.isNotEmpty()) persistCache(body, pageNumber)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "users fetch failed: ${e.message}")
            degrade("Network error while loading users. Check your connection and retry.")
        }
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
        val cached = withContext(Dispatchers.IO) { AdminUsersCacheStore.read(appContext) }
        if (cached != null && cached.users.isNotEmpty()) {
            _state.value = AdminUsersUiState(
                loading = false,
                rows = cached.users.map { it.toUserRow() },
                page = cached.page,
                totalPages = cached.totalPages,
                total = cached.total,
                roleFilter = _state.value.roleFilter,
                statusFilter = _state.value.statusFilter,
                searchQuery = _state.value.searchQuery,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, loadingMore = false, error = message) }
        }
    }

    /** Persist the page's wire DTOs — the offline render matches the online one. */
    private fun persistCache(envelope: ApiEnvelope<List<AdminUserDto>>, page: Int) {
        val payload = CachedAdminUsersPage(
            users = envelope.data.orEmpty(),
            page = page,
            totalPages = envelope.pagination?.totalPages?.takeIf { it > 0 } ?: 1,
            total = envelope.pagination?.total ?: envelope.data.orEmpty().size,
        )
        viewModelScope.launch(Dispatchers.IO) {
            AdminUsersCacheStore.write(appContext, payload)
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
private data class CachedAdminUsersPage(
    val users: List<AdminUserDto> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
)

/**
 * On-device saved admin users — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_admin_users_cache". Payload = the last successful non-empty page
 * (wire DTOs + its pagination ints), so the offline render is consistent
 * with the online one.
 */
private object AdminUsersCacheStore {
    private const val TAG = "ZylodAdmin"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_users_cache"

    fun read(context: Context): CachedAdminUsersPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedAdminUsersPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "admin users cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedAdminUsersPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedAdminUsersPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "admin users cache write failed: ${it.message}") }
    }
}
