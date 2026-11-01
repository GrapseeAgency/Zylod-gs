package com.zylod.wholesale.ui.adminops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminOpsCategoriesData
import com.zylod.wholesale.data.api.AdminOpsCategoriesEnvelope
import com.zylod.wholesale.data.api.AdminOpsCategoryRow
import com.zylod.wholesale.data.api.AdminOpsCategoryStats
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
 * t265 — Admin Categories VM (pageId "admin-categories"): GET
 * api/admin/categories (categories/route.ts, requireUserType(['admin']),
 * 401-first) — the FULL flat category list for the admin tree: every
 * category (active AND inactive) with real product/children count
 * aggregates, the parent's real name, and real tree stats (the handler's
 * sort: parent-roots first, then sortOrder, then name).
 *
 *  - NOT-ADMIN (AdminUsersViewModel convention): 401/403 → honest gate.
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_admin_ops_admin-categories_cache", written
 *    ONLY after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class AdminCategoriesUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val rows: List<AdminOpsCategoryRow> = emptyList(),
    /** Real tree stats derived from the same rows the handler returned. */
    val stats: AdminOpsCategoryStats? = null,
    /** The route's own honesty notes — rendered verbatim under the list. */
    val dataNotes: List<String> = emptyList(),
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or non-admin account — the screen's honest gate. */
    val notAdmin: Boolean = false,
)

class AdminCategoriesViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AdminCategoriesUiState())
    val state: StateFlow<AdminCategoriesUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /** Entry pull / retry — called on EVERY entry (the VM survives back stack). */
    fun refresh() {
        if (fetchJob?.isActive == true) return
        startLoad()
    }

    fun retry() = refresh()

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
        try {
            Log.i(TAG, "fetch admin categories")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.adminOpsApi(base)
            val response = api.categories()
            // Honest admin gate: signed-out callers are 401 and non-admin
            // sessions 403 on the admin-only handler.
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not an admin session (http=${response.code()})")
                _state.value = AdminCategoriesUiState(loading = false, notAdmin = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load categories (HTTP ${response.code()})"
                Log.w(TAG, "categories error: $message")
                degrade(message)
                return
            }
            val body: AdminOpsCategoriesEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load categories")
                return
            }
            val data: AdminOpsCategoriesData? = body.data
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                rows = data?.categories.orEmpty(),
                stats = data?.stats,
                dataNotes = data?.dataNotes.orEmpty(),
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            val incoming = data?.categories.orEmpty()
            if (incoming.isNotEmpty()) {
                persistCache(incoming, data?.stats, data?.dataNotes.orEmpty())
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "categories fetch failed: ${e.message}")
            degrade("Network error while loading categories. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { CategoriesCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = AdminCategoriesUiState(
                loading = false,
                rows = cached.rows,
                stats = cached.stats,
                dataNotes = cached.dataNotes,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(
        rows: List<AdminOpsCategoryRow>,
        stats: AdminOpsCategoryStats?,
        dataNotes: List<String>,
    ) {
        val payload = CachedCategoriesPage(rows = rows, stats = stats, dataNotes = dataNotes)
        viewModelScope.launch(Dispatchers.IO) {
            CategoriesCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodAdminOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedCategoriesPage(
    val rows: List<AdminOpsCategoryRow> = emptyList(),
    val stats: AdminOpsCategoryStats? = null,
    val dataNotes: List<String> = emptyList(),
)

/**
 * On-device saved admin categories — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_admin_ops_admin-categories_cache".
 */
private object CategoriesCacheStore {
    private const val TAG = "ZylodAdminOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_ops_admin-categories_cache"

    fun read(context: Context): CachedCategoriesPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedCategoriesPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "categories cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedCategoriesPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedCategoriesPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "categories cache write failed: ${it.message}") }
    }
}
