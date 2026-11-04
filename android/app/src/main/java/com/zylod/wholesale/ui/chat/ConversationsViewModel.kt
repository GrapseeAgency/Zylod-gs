package com.zylod.wholesale.ui.chat

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ConversationRow
import com.zylod.wholesale.data.api.ServerConfig
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
 * t278 — the conversations LIST behind the native "chat-list" /
 * "messaging-center" / "messages" pageIds (web specialType 'chat-list'
 * parity): GET api/chat/conversations with the role derived from the signed
 * session (supplier accounts list their buyer threads; buyers list their
 * supplier threads). Previously EVERY native chat pageId funneled into the
 * SUPPORT sessions API — buyer↔supplier DM threads were invisible on native.
 *
 *  - PAGING: page/limit=20 with keyed-dedup append (RfqListViewModel
 *    loadMore convention).
 *  - SEARCH: client-side filter on other-party name + last message preview
 *    (the web's query field filters the same way, server list is one call).
 *  - OFFLINE (LiveChat degrade convention): on failure, renderable rows
 *    survive — in-memory first, then the device-saved snapshot under
 *    "zylod_config"/"native_dm_conversations_cache" (wire DTOs, tagged with
 *    the pagination it was fetched under).
 *  - AUTH: no token → the honest sign-in gate; a 401 that survives the
 *    shared OkHttp refresh chain → same gate (needsAuth).
 */
data class ConversationsUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val rows: List<ConversationRow> = emptyList(),
    /** Client-side filter (web query-field parity) — filters name + preview. */
    val search: String = "",
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    val loadingMore: Boolean = false,
    val offline: Boolean = false,
    val offlineFromCache: Boolean = false,
    val error: String? = null,
) {
    val canLoadMore: Boolean get() = page < totalPages && !loadingMore
}

@Serializable
private data class ConversationsSnapshot(
    val rows: List<ConversationRow> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
)

class ConversationsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(ConversationsUiState())
    val state: StateFlow<ConversationsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (LiveChatViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, loadingMore = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry pull / retry (t208 parity: called on EVERY entry). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = ConversationsUiState(loading = false, needsAuth = true)
            return
        }
        fetchJob?.cancel()
        val hasRows = _state.value.rows.isNotEmpty()
        _state.update {
            it.copy(loading = !hasRows, loadingMore = false, error = null, needsAuth = false, offline = false, offlineFromCache = false)
        }
        fetchJob = viewModelScope.launch { fetch(page = 1, replace = true) }
    }

    fun retry() = refresh()

    /** One typed keystroke of the search field — filters the rendered rows. */
    fun setSearch(value: String) {
        _state.update { it.copy(search = value) }
    }

    fun loadMore() {
        val s = _state.value
        if (s.loading || s.loadingMore || s.needsAuth || s.offline) return
        if (s.page >= s.totalPages) return
        _state.update { it.copy(loadingMore = true) }
        fetchJob = viewModelScope.launch { fetch(page = s.page + 1, replace = false) }
    }

    /** "buyer" | "supplier" — the signed account's own lens (server contract). */
    fun role(): String = if (isSupplier()) "supplier" else "buyer"

    private fun isSupplier(): Boolean = SessionManager.userJson()?.let { raw ->
        runCatching {
            ApiClient.json.decodeFromString(
                com.zylod.wholesale.data.api.UserProfileSeed.serializer(),
                raw,
            )
        }.getOrNull()?.userType?.equals("supplier", ignoreCase = true) == true
    } ?: false

    private suspend fun fetch(page: Int, replace: Boolean) {
        try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.chatConversationApi(base).conversations(
                role = role(),
                page = page,
                limit = 20,
            )
            if (response.code() == 401) {
                // Session died between tabs — the honest gate, not an error.
                _state.value = ConversationsUiState(loading = false, needsAuth = true)
                return
            }
            val envelope = response.body()
            val incoming = envelope?.takeIf { it.success }?.data.orEmpty()
            if (envelope == null || (!envelope.success && incoming.isEmpty())) {
                degrade("Could not load your conversations (HTTP ${response.code()}).")
                return
            }
            val merged = if (replace) incoming else {
                val seen = _state.value.rows.mapTo(HashSet()) { it.stableKey }
                _state.value.rows + incoming.filter { seen.add(it.stableKey) }
            }
            _state.value = ConversationsUiState(
                loading = false,
                rows = merged,
                search = _state.value.search,
                page = envelope.pagination?.page ?: page,
                totalPages = envelope.pagination?.totalPages?.takeIf { it > 0 } ?: 1,
                total = envelope.pagination?.total ?: merged.size,
                loadingMore = false,
                offline = false,
                offlineFromCache = false,
            )
            withContext(Dispatchers.IO) {
                runCatching {
                    val snapshot = ConversationsSnapshot(
                        rows = merged,
                        page = envelope.pagination?.page ?: page,
                        totalPages = envelope.pagination?.totalPages?.takeIf { it > 0 } ?: 1,
                        total = envelope.pagination?.total ?: merged.size,
                    )
                    val raw = ApiClient.json.encodeToString(ConversationsSnapshot.serializer(), snapshot)
                    appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, raw).apply()
                }.onFailure { Log.w(TAG, "conversations cache write failed: ${it.message}") }
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "conversations fetch failed: ${e.message}")
            degrade("Network error while loading your conversations. Check your connection and retry.")
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
            _state.value = ConversationsUiState(
                loading = false,
                rows = saved.rows,
                search = _state.value.search,
                page = saved.page,
                totalPages = saved.totalPages,
                total = saved.total,
                offlineFromCache = true,
            )
        } else {
            _state.value = _state.value.copy(loading = false, loadingMore = false, error = message)
        }
    }

    private fun readSnapshot(): ConversationsSnapshot? = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return null
        ApiClient.json.decodeFromString(ConversationsSnapshot.serializer(), raw)
    }.onFailure { Log.w(TAG, "conversations cache read failed: ${it.message}") }.getOrNull()

    private companion object {
        const val TAG = "ZylodChatDM"
        const val PREFS = "zylod_config"
        const val KEY = "native_dm_conversations_cache"
    }
}
