package com.zylod.wholesale.ui.chat

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CreateConversationRequest
import com.zylod.wholesale.data.api.SendThreadMessageRequest
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
 * t278 — the DM THREAD behind the native "chat-detail" pageId (web
 * ChatDetailPage parity). The entry query carries either
 *  - "conversationId=…" (opened from the conversations list / a chat
 *    notification), or
 *  - "supplierUserId=…[&supplierName=…][&productId=…]" (opened from the
 *    supplier page's Contact Supplier button) → the VM create-or-reuses the
 *    conversation first (POST api/chat/conversations — buyerId from the
 *    token; the route validates the supplier account and the optional
 *    product belongs to them), then loads the thread.
 *
 * Previously this pageId funneled into the SUPPORT session API, so a buyer
 * tapping "Contact Supplier" landed in "Zylod Live Support" and the message
 * never reached the supplier — the wrong-recipient class.
 *
 *  - THREAD: GET api/chat/conversations/{id}/messages — ascending, the
 *    server marks the other party's messages read (Task 134) before the
 *    fetch; bubbles render mine-right / theirs-left by senderId == my id.
 *  - SEND: optimistic temp bubble now, server row replaces it on 201; on
 *    failure the temp is removed and the typed text returns through
 *    [DmThreadUiState.draftRestore] (LiveChatViewModel convention).
 *  - OFFLINE: in-memory rows survive; then the device-saved thread cache
 *    keyed by conversation id ("zylod_config", "native_dm_thread_cache_<id>",
 *    wire DTOs). A 404 on load is a DEFINITIVE answer (foreign or gone
 *    conversation) and shows the honest error card instead of any cache.
 *  - AUTH: no token → the honest sign-in gate; a 401 that survived the
 *    shared refresh chain → same gate.
 */
data class DmThreadUiState(
    /** Resolving the conversation / first thread pull (skeleton while empty). */
    val loading: Boolean = true,
    /** The resolved conversation id (blank until it exists). */
    val conversationId: String = "",
    /** Display name of the other party (query supplierName, or resolved from the thread). */
    val otherName: String = "",
    /** The product context card (when the conversation carries one). */
    val productContextLabel: String? = null,
    val bubbles: List<DmBubble> = emptyList(),
    /** A send is in flight (optimistic bubble already on screen). */
    val sending: Boolean = false,
    /** Send failure text — surfaced above the input bar, then cleared. */
    val actionError: String? = null,
    /** One-shot: the failed message text the input bar restores, then clears. */
    val draftRestore: String? = null,
    /** Set only when nothing is renderable (no network AND no saved thread). */
    val error: String? = null,
    /** The visible thread came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** Signed out — the gate (composer hidden). */
    val needsAuth: Boolean = false,
)

@Serializable
private data class CachedDmThread(
    val conversationId: String = "",
    val otherName: String = "",
    val productContextLabel: String? = null,
    val messages: List<com.zylod.wholesale.data.api.ChatThreadMessageDto> = emptyList(),
)

class ChatThreadViewModel(
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(DmThreadUiState())
    val state: StateFlow<DmThreadUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var sendJob: Job? = null
    private var lastQuery: String = ""
    private var tempCounter: Int = 0

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate instead of leaving a composer that would 401 on
        // every send (LiveChatViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, sending = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(entryQuery: String? = null) {
        if (entryQuery != null) lastQuery = entryQuery
        if (initJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = DmThreadUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.bubbles.isEmpty(),
                error = null,
                offlineFromCache = false,
                needsAuth = false,
                actionError = null,
            )
        }
        initJob = viewModelScope.launch { resolve() }
    }

    /** Error-card Retry — full re-resolution. */
    fun retry() = load()

    fun consumeActionError() = _state.update { it.copy(actionError = null) }

    fun consumeDraftRestore() = _state.update { it.copy(draftRestore = null) }

    /**
     * Optimistic send: temp own bubble now, the server row replaces it after
     * the 201 (its id confirms); on failure the temp is removed and the typed
     * text returns through [DmThreadUiState.draftRestore].
     */
    fun sendMessage(raw: String) {
        val text = raw.trim()
        val s = _state.value
        if (text.isEmpty() || s.sending || s.needsAuth) return
        if (s.conversationId.isBlank()) return
        val myId = myUserId()
        val temp = dmTempBubble(text, ++tempCounter)
        _state.update { it.copy(bubbles = it.bubbles + temp, sending = true, actionError = null, draftRestore = null) }
        sendJob?.cancel()
        sendJob = viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.chatConversationApi(base)
                    .sendThreadMessage(s.conversationId, SendThreadMessageRequest(messageText = text))
                if (response.code() == 401) {
                    // The shared authenticator already tried one refresh.
                    removeTemp(temp.key)
                    _state.update { it.copy(sending = false, needsAuth = true) }
                    return@launch
                }
                val saved = response.body()?.data
                if (response.isSuccessful && saved != null) {
                    _state.update { st ->
                        st.copy(
                            bubbles = st.bubbles.map { if (it.key == temp.key) saved.toDmBubble(myId) else it },
                            sending = false,
                            actionError = null,
                        )
                    }
                    // Optimistic caches only — re-pull the thread best-effort so
                    // the read receipts / ordering stay server-true.
                } else {
                    failSend(temp.key, text, parseError(response) ?: "Message not sent")
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "dm send failed: ${e.message}")
                failSend(temp.key, text, "Network error — message not sent")
            }
        }
    }

    /* ─── internals ──────────────────────────────────────────────────────── */

    private suspend fun resolve() {
        val conversationId = conversationIdFromQuery(lastQuery)
        if (conversationId != null) {
            _state.update { it.copy(conversationId = conversationId) }
            loadThread(conversationId)
            return
        }
        // No conversation id — the Contact Supplier entry: create-or-reuse.
        val supplierUserId = supplierUserIdFromQuery(lastQuery)
        if (supplierUserId == null) {
            // Neither id present (a bare chat-detail open) — the honest
            // empty state, not a fabricated thread.
            _state.update { it.copy(loading = false, error = "No conversation selected. Open a supplier page and tap Contact Supplier.") }
            return
        }
        _state.update { st ->
            st.copy(
                otherName = supplierNameFromQuery(lastQuery).orEmpty().ifBlank { st.otherName },
            )
        }
        try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.chatConversationApi(base).createConversation(
                CreateConversationRequest(
                    supplierId = supplierUserId,
                    productId = productIdFromChatQuery(lastQuery),
                ),
            )
            if (response.code() == 401) {
                _state.update { it.copy(loading = false, needsAuth = true) }
                return
            }
            val created = response.body()?.data
            val createdId = created?.id
            if (response.isSuccessful && !createdId.isNullOrBlank()) {
                _state.update { it.copy(conversationId = createdId) }
                loadThread(createdId)
            } else {
                _state.update {
                    it.copy(
                        loading = false,
                        error = parseError(response) ?: "Could not start the conversation with this supplier.",
                    )
                }
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "dm create failed: ${e.message}")
            _state.update {
                it.copy(loading = false, error = "Network error — could not start the conversation. Check your connection and retry.")
            }
        }
    }

    private suspend fun loadThread(conversationId: String) {
        val myId = myUserId()
        try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.chatConversationApi(base).threadMessages(conversationId, page = 1, limit = 100)
            if (response.code() == 401) {
                _state.update { it.copy(loading = false, needsAuth = true) }
                return
            }
            if (response.code() == 403 || response.code() == 404) {
                // Definitive: foreign or gone conversation — no cache theater.
                _state.update { it.copy(loading = false, error = "Conversation not found or access denied.") }
                return
            }
            val envelope = response.body()
            val rows = envelope?.takeIf { it.success }?.data.orEmpty()
            if (envelope == null || !envelope.success) {
                degradeThread(conversationId, parseError(response) ?: "Could not load the conversation.")
                return
            }
            val otherName = resolveOtherName(rows, myId)
            _state.update { st ->
                st.copy(
                    loading = false,
                    bubbles = rows.map { m -> m.toDmBubble(myId) },
                    otherName = otherName.ifBlank { st.otherName },
                    offlineFromCache = false,
                    error = null,
                )
            }
            persistThreadCache(conversationId, otherName, rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "dm thread load failed: ${e.message}")
            degradeThread(conversationId, "Network error while loading the conversation. Check your connection and retry.")
        }
    }

    /** The other party's display name — first message NOT sent by me, else "". */
    private fun resolveOtherName(rows: List<com.zylod.wholesale.data.api.ChatThreadMessageDto>, myId: String?): String =
        rows.firstOrNull { it.senderId != myId && !it.senderName.isNullOrBlank() }?.senderName.orEmpty()

    private suspend fun degradeThread(conversationId: String, message: String) {
        if (_state.value.bubbles.isNotEmpty()) {
            _state.update { it.copy(loading = false, offlineFromCache = true, error = null) }
            return
        }
        val cached = withContext(Dispatchers.IO) { readThreadCache(conversationId) }
        if (cached != null && cached.messages.isNotEmpty()) {
            val myId = myUserId()
            _state.update { st ->
                st.copy(
                    loading = false,
                    bubbles = cached.messages.map { m -> m.toDmBubble(myId) },
                    otherName = cached.otherName.ifBlank { st.otherName },
                    productContextLabel = cached.productContextLabel,
                    offlineFromCache = true,
                    error = null,
                )
            }
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    private fun removeTemp(tempKey: String) {
        _state.update { st -> st.copy(bubbles = st.bubbles.filterNot { it.key == tempKey }) }
    }

    private fun failSend(tempKey: String, text: String, message: String) {
        _state.update {
            it.copy(
                bubbles = it.bubbles.filterNot { b -> b.key == tempKey },
                sending = false,
                actionError = message,
                draftRestore = text,
            )
        }
    }

    private fun parseError(response: retrofit2.Response<*>): String? =
        com.zylod.wholesale.data.api.parseErrorBody(response.errorBody()).error?.takeIf(String::isNotBlank)

    private fun myUserId(): String? = SessionManager.userJson()?.let { raw ->
        runCatching {
            ApiClient.json.decodeFromString(
                com.zylod.wholesale.data.api.UserProfileSeed.serializer(),
                raw,
            )
        }.getOrNull()?.id
    }

    private fun persistThreadCache(conversationId: String, otherName: String, rows: List<com.zylod.wholesale.data.api.ChatThreadMessageDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val payload = CachedDmThread(
                    conversationId = conversationId,
                    otherName = otherName,
                    productContextLabel = _state.value.productContextLabel,
                    messages = rows,
                )
                val raw = ApiClient.json.encodeToString(CachedDmThread.serializer(), payload)
                appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putString("$KEY_PREFIX$conversationId", raw).apply()
            }.onFailure { Log.w(TAG, "dm thread cache write failed: ${it.message}") }
        }
    }

    private fun readThreadCache(conversationId: String): CachedDmThread? = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("$KEY_PREFIX$conversationId", null)
            ?: return null
        ApiClient.json.decodeFromString(CachedDmThread.serializer(), raw)
    }.onFailure { Log.w(TAG, "dm thread cache read failed: ${it.message}") }.getOrNull()

    private companion object {
        const val TAG = "ZylodChatDM"
        const val PREFS = "zylod_config"
        const val KEY_PREFIX = "native_dm_thread_cache_"
    }
}
