package com.zylod.wholesale.ui.adminops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminOpsInspectionRow
import com.zylod.wholesale.data.api.AdminOpsInspectionsEnvelope
import com.zylod.wholesale.data.api.AdminOpsInspectionStats
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
 * t265 — Admin Inspections VM (pageId "admin-inspections"): GET
 * api/admin/inspections (inspections/route.ts, requireUserType(['admin']),
 * 401-first) — every inspection request, pending first by the handler's
 * ordering, with the order's buyer display name and honest stats embedded.
 *
 *  - FILTER: the handler's ?status (pending | scheduled | completed |
 *    failed) — the chip row sends exactly those; "All" omits the param.
 *  - NOT-ADMIN (AdminUsersViewModel convention): 401/403 → honest gate.
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_admin_ops_admin-inspections_cache", written
 *    ONLY after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class InspectionsUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val rows: List<AdminOpsInspectionRow> = emptyList(),
    /** Wire stats over the WHOLE table — independent of the current filter. */
    val stats: AdminOpsInspectionStats? = null,
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

class InspectionsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(InspectionsUiState())
    val state: StateFlow<InspectionsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /** Entry pull / retry — called on EVERY entry (the VM survives back stack). */
    fun refresh() {
        if (fetchJob?.isActive == true) return
        startLoad()
    }

    fun retry() = refresh()

    /** Status chip — re-fetches with the handler's exact status value. */
    fun setStatusFilter(status: String) {
        if (_state.value.statusFilter == status) return
        _state.update { it.copy(statusFilter = status) }
        startLoad()
    }

    private fun startLoad() {
        fetchJob?.cancel()
        val hasRows = _state.value.rows.isNotEmpty()
        _state.update {
            it.copy(
                loading = !hasRows,
                refreshing = hasRows,
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
        }
        fetchJob = viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        val s = _state.value
        try {
            Log.i(TAG, "fetch inspections status=${s.statusFilter.ifBlank { "all" }}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.adminOpsApi(base)
            val response = api.inspections(
                status = s.statusFilter.takeIf(String::isNotBlank),
            )
            // Honest admin gate: signed-out callers are 401 and non-admin
            // sessions 403 on the admin-only handler.
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not an admin session (http=${response.code()})")
                _state.value = InspectionsUiState(
                    loading = false,
                    notAdmin = true,
                    statusFilter = s.statusFilter,
                )
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load inspections (HTTP ${response.code()})"
                Log.w(TAG, "inspections error: $message")
                degrade(message)
                return
            }
            val body: AdminOpsInspectionsEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load inspections")
                return
            }
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                rows = body.data?.inspections.orEmpty(),
                stats = body.data?.stats,
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            val incoming = body.data?.inspections.orEmpty()
            if (incoming.isNotEmpty()) {
                persistCache(incoming, body.data?.stats)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "inspections fetch failed: ${e.message}")
            degrade("Network error while loading inspections. Check your connection and retry.")
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
                it.copy(loading = false, refreshing = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { InspectionsCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = InspectionsUiState(
                loading = false,
                rows = cached.rows,
                stats = cached.stats,
                statusFilter = _state.value.statusFilter,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(rows: List<AdminOpsInspectionRow>, stats: AdminOpsInspectionStats?) {
        val payload = CachedInspectionsPage(rows = rows, stats = stats)
        viewModelScope.launch(Dispatchers.IO) {
            InspectionsCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodAdminOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedInspectionsPage(
    val rows: List<AdminOpsInspectionRow> = emptyList(),
    val stats: AdminOpsInspectionStats? = null,
)

/**
 * On-device saved inspections — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_admin_ops_admin-inspections_cache".
 */
private object InspectionsCacheStore {
    private const val TAG = "ZylodAdminOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_ops_admin-inspections_cache"

    fun read(context: Context): CachedInspectionsPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedInspectionsPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "inspections cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedInspectionsPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedInspectionsPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "inspections cache write failed: ${it.message}") }
    }
}
