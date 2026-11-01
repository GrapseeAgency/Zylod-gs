package com.zylod.wholesale.ui.adminops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminOpsSettingRow
import com.zylod.wholesale.data.api.AdminOpsSettingsEnvelope
import com.zylod.wholesale.data.api.AdminOpsSettingsData
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
 * t265 — Admin Settings VM (pageId "admin-settings"): GET api/admin/settings
 * (settings/route.ts, requireUserType(['admin']), 401-first) — EVERY KNOWN
 * admin setting from the src/lib/admin-settings.ts registry whitelist. Unset
 * keys arrive as value=null and are rendered honestly as "Not set" next to
 * the built-in default (a default is NEVER rendered as a stored value — the
 * route's own dataNotes say exactly that, and the screen shows them).
 *
 *  - NOT-ADMIN (AdminUsersViewModel convention): 401/403 → honest gate.
 *  - OFFLINE: in-memory rows first, then the saved cache
 *    ("zylod_config"/"native_admin_ops_admin-settings_cache", written ONLY
 *    after a successful non-empty pull).
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class AdminSettingsOpsUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val rows: List<AdminOpsSettingRow> = emptyList(),
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

class AdminSettingsOpsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AdminSettingsOpsUiState())
    val state: StateFlow<AdminSettingsOpsUiState> = _state.asStateFlow()

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
            Log.i(TAG, "fetch admin settings")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.adminOpsApi(base)
            val response = api.settings()
            // Honest admin gate: signed-out callers are 401 and non-admin
            // sessions 403 on the admin-only handler.
            if (response.code() == 401 || response.code() == 403) {
                Log.i(TAG, "not an admin session (http=${response.code()})")
                _state.value = AdminSettingsOpsUiState(loading = false, notAdmin = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load settings (HTTP ${response.code()})"
                Log.w(TAG, "settings error: $message")
                degrade(message)
                return
            }
            val body: AdminOpsSettingsEnvelope? = response.body()
            if (body == null || !body.success) {
                degrade("Could not load settings")
                return
            }
            val data: AdminOpsSettingsData? = body.data
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                rows = data?.settings.orEmpty(),
                dataNotes = data?.dataNotes.orEmpty(),
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
            // Save cache ONLY on success with non-empty rows (wire DTOs —
            // the offline render maps through the same objects).
            val incoming = data?.settings.orEmpty()
            if (incoming.isNotEmpty()) {
                persistCache(incoming, data?.dataNotes.orEmpty())
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "settings fetch failed: ${e.message}")
            degrade("Network error while loading settings. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { SettingsOpsCacheStore.read(appContext) }
        if (cached != null && cached.rows.isNotEmpty()) {
            _state.value = AdminSettingsOpsUiState(
                loading = false,
                rows = cached.rows,
                dataNotes = cached.dataNotes,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(rows: List<AdminOpsSettingRow>, dataNotes: List<String>) {
        val payload = CachedSettingsOpsPage(rows = rows, dataNotes = dataNotes)
        viewModelScope.launch(Dispatchers.IO) {
            SettingsOpsCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodAdminOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSettingsOpsPage(
    val rows: List<AdminOpsSettingRow> = emptyList(),
    val dataNotes: List<String> = emptyList(),
)

/**
 * On-device saved admin settings — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_admin_ops_admin-settings_cache".
 */
private object SettingsOpsCacheStore {
    private const val TAG = "ZylodAdminOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_ops_admin-settings_cache"

    fun read(context: Context): CachedSettingsOpsPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedSettingsOpsPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "settings cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedSettingsOpsPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSettingsOpsPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "settings cache write failed: ${it.message}") }
    }
}
