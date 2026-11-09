package com.zylod.wholesale.ui.rewards

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.PointsLedgerRowDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * t282 — native Points-History VM (SPA pageId "points-history"; the web
 * component is points-history-page.tsx). The pageId was WebView-forwarded in
 * t281 with "typed ui/rewards port noted for later" — this is that port.
 *
 * Wire contract (PointsLedgerApi): GET api/rewards/history?type=&page=&limit=
 * — AUTHENTICATED, { success, data: [rewardTransactions rows], pagination }.
 * The type filter mirrors the web's three tabs: '' (All) / 'earn' /
 * 'redeem'. Points ride NEGATIVE on redeem rows — the sign is the ledger's
 * own; the screen renders '+' for earn and the raw negative for redeem,
 * exactly like the web. Guests get the soft in-screen sign-in CTA (the web's
 * AccountGate parity — "the ledger holds YOUR point transactions — guests
 * get a gate, never a fabricated 'No point transactions found' page").
 *
 * Pagination: page/limit paging (the ledger route is page-based, not
 * cursor-based); Load More appends while pagination.totalPages allows.
 * Offline: last saved snapshot under prefs "zylod_config"/
 * "native_points_history_cache" (the SessionManager logout purge covers
 * every native_* key). A filter change resets to page 1.
 */
data class PointsHistoryUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    /** '' = All, 'earn', 'redeem' — the web's three tabs verbatim. */
    val activeType: String = "",
    val rows: List<PointsLedgerRowDto> = emptyList(),
    val offline: Boolean = false,
    val error: String? = null,
    val page: Int = 1,
    val totalPages: Int = 1,
    val loadingMore: Boolean = false,
)

@Serializable
private data class PointsHistorySnapshot(val rows: List<PointsLedgerRowDto> = emptyList())

class PointsHistoryViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(PointsHistoryUiState())
    val state: StateFlow<PointsHistoryUiState> = _state.asStateFlow()

    private var api: com.zylod.wholesale.data.api.PointsLedgerApi? = null

    /** Entry pull / retry (t208 parity: called on EVERY entry). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = PointsHistoryUiState(loading = false, needsAuth = true)
            return
        }
        val hasData = _state.value.rows.isNotEmpty()
        _state.update { it.copy(loading = !hasData, error = null, needsAuth = false) }
        viewModelScope.launch { fetch(page = 1) }
    }

    /** A filter tab tap — resets to page 1 (the web's setActiveType refetch). */
    fun setType(type: String) {
        if (_state.value.activeType == type) return
        _state.update { it.copy(activeType = type, loading = _state.value.rows.isEmpty()) }
        viewModelScope.launch { fetch(page = 1) }
    }

    fun loadMore() {
        val s = _state.value
        if (s.loadingMore || s.loading || s.page >= s.totalPages) return
        _state.update { it.copy(loadingMore = true) }
        viewModelScope.launch { fetch(page = s.page + 1, append = true) }
    }

    private suspend fun fetch(page: Int, append: Boolean = false) {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.pointsLedgerApi(baseUrl).also { api = it }
            val type = _state.value.activeType.takeIf(String::isNotBlank)
            val response = client.history(type = type, page = page, limit = PAGE_SIZE)
            if (response.code() == 401) {
                _state.value = PointsHistoryUiState(loading = false, needsAuth = true)
                return
            }
            val envelope = response.body()
            val rows = envelope?.takeIf { it.success }?.data.orEmpty()
            if (envelope == null || (!envelope.success && rows.isEmpty() && !append)) {
                degrade("Server error — your points ledger is temporarily unavailable.")
                return
            }
            _state.update { st ->
                st.copy(
                    loading = false,
                    loadingMore = false,
                    rows = if (append) st.rows + rows else rows,
                    page = page,
                    totalPages = envelope?.pagination?.totalPages ?: 1,
                    offline = false,
                    error = null,
                )
            }
            if (!append) persist(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "points history refresh failed: ${e.message}")
            if (append) {
                _state.update { it.copy(loadingMore = false, offline = true) }
            } else {
                degrade("Network error — check your connection and retry.")
            }
        }
    }

    private suspend fun degrade(message: String) {
        val inMemory = _state.value.rows
        if (inMemory.isNotEmpty()) {
            _state.update { it.copy(loading = false, loadingMore = false, offline = true, error = null) }
            return
        }
        val saved = withContext(Dispatchers.IO) { readSnapshot() }
        if (saved != null && saved.rows.isNotEmpty()) {
            _state.value = PointsHistoryUiState(loading = false, rows = saved.rows, offline = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persist(rows: List<PointsLedgerRowDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val raw = ApiClient.json.encodeToString(PointsHistorySnapshot.serializer(), PointsHistorySnapshot(rows))
                appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, raw).apply()
            }.onFailure { Log.w(TAG, "points history cache write failed: ${it.message}") }
        }
    }

    private fun readSnapshot(): PointsHistorySnapshot? = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return null
        ApiClient.json.decodeFromString(PointsHistorySnapshot.serializer(), raw)
    }.onFailure { Log.w(TAG, "points history cache read failed: ${it.message}") }.getOrNull()

    private companion object {
        const val TAG = "ZylodPointsHistory"
        const val PREFS = "zylod_config"
        const val KEY = "native_points_history_cache"
        const val PAGE_SIZE = 20
    }
}
