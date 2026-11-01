package com.zylod.wholesale.ui.complaints

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ApiEnvelope
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupplierQueryDto
import com.zylod.wholesale.data.api.SupplierQueryPatchBody
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
import retrofit2.Response

/**
 * Customer-query-detail VM — the REAL thread behind the seller console's
 * query rows (the web CustomerQueryDetailPage's exact data source):
 * GET api/supplier/queries/[id] (ComplaintsApi.supplierQuery) plus the two
 * PATCH actions — the reply ([reply], replyMessage ≤ 2000) and the status
 * transitions (resolved / open / closed).
 *
 *  - ENTRY: [queryIdFromQuery] ("queryId=x" / "id=x" / bare token — the
 *    web's idProp || pageParams?.id). NO id → the web's honest "No query
 *    selected" state, never a fabricated thread.
 *  - AUTH: no token → no call, the honest gate. 401 → the web's "Sign in
 *    required" card (a BUYER session lands here too: the route demands
 *    supplier|admin, and requireUserType answers
 *    "Access denied. Required: supplier or admin"). 404 → the web's
 *    "Query not found" card (foreign ids get the same answer — no
 *    existence leak). 403 (no supplierProfile) → the route's verbatim
 *    "Supplier profile required. Only registered suppliers can access
 *    seller data."
 *  - ACTIONS: an empty reply is refused client-side (the web's toast
 *    guard, verbatim); the PATCH 400 texts surface verbatim; the server's
 *    reply stamping (repliedAt + status → 'replied') arrives via the
 *    reload after every 2xx. Double-fire guard on both actions.
 *  - OFFLINE: on load failure the last thread saved for THIS query id
 *    survives (SharedPreferences "zylod_config",
 *    "native_queries_cache" — pinned to the id like the returns cache) and
 *    the state flips offlineFromCache; with no saved thread, the honest
 *    error card.
 */
class CustomerQueriesViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(QueryDetailUiState())
    val state: StateFlow<QueryDetailUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var actionJob: Job? = null
    private var lastQuery: String = ""

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in state (TrackOrderViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(entryQuery: String? = null) {
        if (entryQuery != null) lastQuery = entryQuery
        if (initJob?.isActive == true) return
        val queryId = queryIdFromQuery(lastQuery)
        if (queryId == null) {
            // Web parity: no query id → the honest "No query selected" state.
            Log.i(TAG, "no queryId in query — no-query state")
            _state.value = QueryDetailUiState(loading = false, hasQueryId = false)
            return
        }
        if (SessionManager.token() == null) {
            _state.value = QueryDetailUiState(
                loading = false,
                hasQueryId = true,
                queryId = queryId,
                needsAuth = true,
            )
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.queryId != queryId || it.query == null,
                hasQueryId = true,
                queryId = queryId,
                error = null,
                notFound = false,
                needsAuth = false,
                offlineFromCache = false,
                actionError = null,
                actionMessage = null,
            )
        }
        initJob = viewModelScope.launch { fetchQuery(queryId) }
    }

    /** Error-card Retry — full re-fetch of the same thread. */
    fun retry() {
        load()
    }

    /* ─── reply composer + status transitions (the web's real PATCHes) ───── */

    fun setReply(value: String) = _state.update { it.copy(reply = value) }

    /**
     * Sends the seller's reply (PATCH replyMessage). The web's guard is
     * verbatim: an empty reply is refused before the wire; the reply is
     * hard-capped at the route's 2000-char limit; the 200 reloads the
     * thread (the server stamps repliedAt + flips status to 'replied').
     */
    fun sendReply() {
        val s = _state.value
        if (s.sending || !s.hasQueryId || s.queryId.isBlank()) return
        val message = s.reply.trim()
        if (message.isEmpty()) {
            _state.update {
                it.copy(actionError = "Write a reply first — empty replies are refused.")
            }
            return
        }
        actionJob?.cancel()
        _state.update { it.copy(sending = true, actionError = null, actionMessage = null) }
        actionJob = viewModelScope.launch {
            try {
                Log.i(TAG, "reply …${s.queryId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.complaintsApi(base).updateSupplierQuery(
                    s.queryId,
                    SupplierQueryPatchBody(replyMessage = message),
                )
                if (!handleActionResponse(response, "Reply sent — the query is marked replied.")) return@launch
                _state.update { it.copy(reply = "") }
                reloadAfterAction()
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "reply failed: ${e.message}")
                _state.update {
                    it.copy(sending = false, actionError = "Network error while sending the reply. Check your connection and retry.")
                }
            }
        }
    }

    /** Status transition (PATCH status) — resolved / open / closed. */
    fun moveStatus(status: String) {
        val s = _state.value
        if (s.statusMoving || !s.hasQueryId || s.queryId.isBlank()) return
        if (status !in QUERY_STATUSES) return
        actionJob?.cancel()
        _state.update { it.copy(statusMoving = true, actionError = null, actionMessage = null) }
        actionJob = viewModelScope.launch {
            try {
                Log.i(TAG, "status=$status …${s.queryId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.complaintsApi(base).updateSupplierQuery(
                    s.queryId,
                    SupplierQueryPatchBody(status = status),
                )
                if (!handleActionResponse(response, "Query marked $status.")) return@launch
                reloadAfterAction()
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "status change failed: ${e.message}")
                _state.update {
                    it.copy(statusMoving = false, actionError = "Network error while changing the status.")
                }
            }
        }
    }

    /** Shared PATCH result handling: 401/404/400/other verbatim + 200 note. */
    private suspend fun handleActionResponse(
        response: Response<ApiEnvelope<SupplierQueryDto>>,
        successMessage: String,
    ): Boolean {
        if (response.code() == 401) {
            val message = parseErrorBody(response.errorBody()).error
                ?.takeIf(String::isNotBlank)
                ?: "Sign in required"
            Log.i(TAG, "action rejected (http=401)")
            _state.update {
                it.copy(sending = false, statusMoving = false, needsAuth = true, actionError = message)
            }
            return false
        }
        val payload = response.body()
        if (!response.isSuccessful || payload?.success != true) {
            val message = parseErrorBody(response.errorBody()).error
                ?.takeIf(String::isNotBlank)
                ?: "Request failed (HTTP ${response.code()})."
            Log.w(TAG, "action failed: $message")
            _state.update {
                it.copy(sending = false, statusMoving = false, actionError = message)
            }
            return false
        }
        _state.update {
            it.copy(
                sending = false,
                statusMoving = false,
                actionMessage = successMessage,
            )
        }
        return true
    }

    /** The web reloads after every 2xx — the server's stamps must show. */
    private fun reloadAfterAction() {
        viewModelScope.launch { fetchQuery(_state.value.queryId, silent = true) }
    }

    /* ─── fetch / failure / cache ─────────────────────────────────────────── */

    private suspend fun fetchQuery(queryId: String, silent: Boolean = false) {
        try {
            Log.i(TAG, "fetch query …${queryId.takeLast(8)}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.complaintsApi(base).supplierQuery(queryId)
            if (response.code() == 401) {
                Log.i(TAG, "query 401 — supplier/admin required")
                _state.update { it.copy(loading = false, needsAuth = true) }
                return
            }
            if (response.code() == 404) {
                // Definitive answer — the web's card, never a cache of some
                // other seller's thread.
                Log.w(TAG, "query 404: Query not found")
                _state.update { it.copy(loading = false, notFound = true) }
                return
            }
            val payload = response.body()
            val query = payload?.takeIf { response.isSuccessful && it.success }?.data
            if (query == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the query (HTTP ${response.code()})."
                Log.w(TAG, "query error: $message")
                degrade(queryId, message, silent)
                return
            }
            Log.i(TAG, "query loaded status=${query.status}")
            _state.update {
                it.copy(
                    loading = false,
                    query = query,
                    error = null,
                    offlineFromCache = false,
                )
            }
            persistCache(queryId, query)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "query fetch failed: ${e.message}")
            degrade(queryId, "Network error while loading the query. Check your connection and retry.", silent)
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved thread
     * cache, ONLY when it was saved for this same query id; with none, the
     * honest error card (silent reloads keep the old thread visible and
     * only surface the action note).
     */
    private suspend fun degrade(queryId: String, message: String, silent: Boolean) {
        val cached = withContext(Dispatchers.IO) {
            ComplaintCacheStore.read(
                appContext,
                ComplaintCacheKeys.QUERIES,
                CachedSupplierQuery.serializer(),
            )
        }
        val cachedQuery = cached?.query?.takeIf { cached.queryId == queryId }
        if (cachedQuery != null) {
            Log.i(TAG, "degrade → cache status=${cachedQuery.status}")
            _state.update {
                it.copy(
                    loading = false,
                    query = cachedQuery,
                    offlineFromCache = true,
                    error = null,
                )
            }
        } else if (silent && _state.value.query != null) {
            _state.update { it.copy(loading = false, actionError = message) }
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the thread, pinned to the query id it was fetched for. */
    private fun persistCache(queryId: String, query: SupplierQueryDto) {
        viewModelScope.launch(Dispatchers.IO) {
            ComplaintCacheStore.write(
                appContext,
                ComplaintCacheKeys.QUERIES,
                CachedSupplierQuery.serializer(),
                CachedSupplierQuery(queryId = queryId, query = query),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodComplaints"
    }
}
