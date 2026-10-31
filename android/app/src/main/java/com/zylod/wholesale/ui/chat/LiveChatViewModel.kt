package com.zylod.wholesale.ui.chat

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ChatApi
import com.zylod.wholesale.data.api.ChatCreateRequest
import com.zylod.wholesale.data.api.ChatEndRequest
import com.zylod.wholesale.data.api.ChatMessageDto
import com.zylod.wholesale.data.api.ChatSendMessageRequest
import com.zylod.wholesale.data.api.ServerConfig
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
import kotlinx.serialization.Serializable
import java.util.Locale

/**
 * Live support chat VM — api/support/chat/sessions (+ /messages) as the
 * payload of record for the six live-support pageIds (chat-list, chat-detail,
 * chat-support, instant-chat, messaging-center, live-chat; each gets its OWN
 * VM instance via the screen's pageId-keyed factory).
 *
 *  - INIT RESOLUTION (web live-chat-page parity): a conversationId in the
 *    entry query pins THAT session (GET sessions → find); otherwise the
 *    first session with type=="live_chat" && status=="active" is reused;
 *    otherwise POST-create ({type:"live_chat",
 *    subject:"Wholesale Buyer Support"}) and the full message thread is
 *    loaded via GET /{id}/messages (ascending).
 *  - AUTH: no token → no call at all, the honest needsAuth gate. A 401 on
 *    any call means a real end of session (the shared OkHttp authenticator
 *    has already attempted one token refresh by then) → needsAuth.
 *  - SEND: optimistic user bubble appended immediately; on 201 success the
 *    temp bubble is replaced by the server message (+ botReply when the
 *    session is chatbot-type); on failure the temp bubble is removed, the
 *    typed text comes back via [LiveChatUiState.draftRestore] and the
 *    server/network text surfaces as [LiveChatUiState.actionError]. The
 *    thread is NEVER faked.
 *  - END CHAT: PATCH {status:"ended"} — server-confirmed only, then the
 *    input bar is replaced by the ended-state row.
 *  - OFFLINE (RfqListViewModel degrade convention): on failure the last
 *    thread snapshot survives — in-memory first, then the device-saved
 *    cache (SharedPreferences "zylod_config"/"native_chat_cache_<pageId>")
 *    — and the state flips offlineFromCache so the screen shows its
 *    saved-data banner. A 404 on load is a DEFINITIVE answer (foreign or
 *    gone session) and shows the honest error card instead of any cache.
 *
 * SERIALIZATION NOTE (the dc74841 lesson): everything persisted to prefs is
 * @Serializable — [CachedChatThread] and its List<ChatMessageDto> field
 * (ChatMessageDto is, with defaults on every field).
 */
data class LiveChatUiState(
    /** Resolving the session / fetching the thread (skeleton while empty). */
    val loading: Boolean = true,
    /** The resolved session id (null until a session exists). */
    val sessionId: String? = null,
    /** Server-confirmed ended session → the ended-state row replaces input. */
    val sessionEnded: Boolean = false,
    val bubbles: List<ChatBubble> = emptyList(),
    /** A message send is in flight (optimistic bubble already on screen). */
    val sending: Boolean = false,
    /** The End Chat PATCH is in flight. */
    val endingChat: Boolean = false,
    /** Send/end-chat failure text — surfaced above the input bar, then cleared. */
    val actionError: String? = null,
    /** One-shot: the failed message text the input bar restores, then clears. */
    val draftRestore: String? = null,
    /** Set only when nothing is renderable (no network AND no saved thread). */
    val error: String? = null,
    /** The visible thread came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
)

class LiveChatViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(LiveChatUiState())
    val state: StateFlow<LiveChatUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var sendJob: Job? = null
    private var endJob: Job? = null
    private var lastQuery: String = ""

    /** "Start New Chat" skips the linked-conversation branch on the next resolve. */
    private var forceNew: Boolean = false
    private var tempCounter: Int = 0

    /** Wire messages of the last successful thread state — the cache payload. */
    private var lastMessages: List<ChatMessageDto> = emptyList()

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (RfqListViewModel convention) instead of leaving
        // an input bar that would 401 on every send.
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(
                        loading = false,
                        sending = false,
                        endingChat = false,
                        needsAuth = true,
                    )
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(entryQuery: String? = null) {
        if (entryQuery != null) lastQuery = entryQuery
        if (initJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = LiveChatUiState(loading = false, needsAuth = true)
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
        initJob = viewModelScope.launch { resolveSession() }
    }

    /** Error-card Retry — full re-resolution, no forced new session. */
    fun retry() {
        forceNew = false
        load()
    }

    /**
     * "Start New Chat" after an ended session — drops the rendered thread
     * and re-runs the init flow, which reuses any OTHER active live_chat
     * session or creates a fresh one (the ended one never matches the
     * active-session probe).
     */
    fun startNewChat() {
        forceNew = true
        _state.update {
            it.copy(
                bubbles = emptyList(),
                sessionId = null,
                sessionEnded = false,
                sending = false,
                endingChat = false,
                actionError = null,
                draftRestore = null,
                error = null,
                offlineFromCache = false,
                needsAuth = false,
            )
        }
        load()
    }

    /**
     * Optimistic send: temp user bubble now, server bubble (+ botReply)
     * after the 201; on failure the temp bubble is removed and the typed
     * text is restored through [LiveChatUiState.draftRestore].
     */
    fun sendMessage(raw: String) {
        val text = raw.trim()
        val s = _state.value
        if (text.isEmpty() || s.sending || s.loading || s.sessionEnded || s.needsAuth) return
        val sessionId = s.sessionId ?: return
        if (sendJob?.isActive == true) return
        val tempKey = "msg-temp-${tempCounter++}"
        _state.update {
            it.copy(
                sending = true,
                actionError = null,
                draftRestore = null,
                bubbles = it.bubbles + ChatBubble(
                    key = tempKey,
                    id = null,
                    senderType = "user",
                    text = text,
                    timeLabel = hhmmNow(),
                ),
            )
        }
        sendJob = viewModelScope.launch {
            try {
                Log.i(TAG, "send message to session …${sessionId.takeLast(6)} len=${text.length}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api = ApiClient.chatApi(base)
                val response = api.sendMessage(sessionId, ChatSendMessageRequest(message = text))
                if (gateOn401(response.code())) {
                    removeTemp(tempKey)
                    return@launch
                }
                val body = response.body()
                val serverMessage = body?.takeIf { response.isSuccessful && it.success }?.data
                if (serverMessage == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Message failed to send (HTTP ${response.code()})."
                    Log.w(TAG, "send failed: $message")
                    failSend(tempKey, text, message)
                    return@launch
                }
                val botMessage = body?.botReply
                val fresh = ArrayList<ChatMessageDto>(lastMessages.size + 2)
                fresh.addAll(lastMessages)
                fresh.add(serverMessage)
                botMessage?.let(fresh::add)
                lastMessages = fresh
                _state.update { st ->
                    st.copy(
                        sending = false,
                        bubbles = st.bubbles
                            .filterNot { bubble -> bubble.key == tempKey }
                            .plus(serverMessage.toBubble())
                            .plus(listOfNotNull(botMessage?.toBubble())),
                    )
                }
                persistCache(sessionId, _state.value.sessionEnded, lastMessages)
            } catch (ce: CancellationException) {
                removeTemp(tempKey)
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "send failed: ${e.message}")
                failSend(tempKey, text, "Network error — the message did not send. Check your connection and retry.")
            }
        }
    }

    /** End Chat — PATCH {status:"ended"}, server-confirmed only. */
    fun endChat() {
        val s = _state.value
        val sessionId = s.sessionId ?: return
        if (s.endingChat || s.sessionEnded || s.needsAuth) return
        if (endJob?.isActive == true) return
        _state.update { it.copy(endingChat = true, actionError = null) }
        endJob = viewModelScope.launch {
            try {
                Log.i(TAG, "end chat session …${sessionId.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api = ApiClient.chatApi(base)
                val response = api.endSession(sessionId, ChatEndRequest(status = "ended"))
                if (gateOn401(response.code())) return@launch
                val body = response.body()
                if (!response.isSuccessful || body == null || !body.success) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not end the chat (HTTP ${response.code()})."
                    Log.w(TAG, "end chat failed: $message")
                    _state.update { it.copy(endingChat = false, actionError = message) }
                    return@launch
                }
                Log.i(TAG, "chat ended")
                _state.update { it.copy(endingChat = false, sessionEnded = true) }
                persistCache(sessionId, ended = true, messages = lastMessages)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "end chat failed: ${e.message}")
                _state.update {
                    it.copy(endingChat = false, actionError = "Network error — the chat may still be open. Retry.")
                }
            }
        }
    }

    fun consumeActionError() {
        _state.update { it.copy(actionError = null) }
    }

    fun consumeDraftRestore() {
        _state.update { it.copy(draftRestore = null) }
    }

    /* ─── init resolution (linked → active → create) ─────────────────────── */

    private suspend fun resolveSession() {
        try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.chatApi(base)
            val targetId = if (forceNew) null else conversationIdFromQuery(lastQuery)
            if (targetId != null) {
                Log.i(TAG, "resolve linked conversation …${targetId.takeLast(6)}")
                val response = api.sessions()
                if (gateOn401(response.code())) return
                val body = response.body()
                val session = body
                    ?.takeIf { response.isSuccessful && it.success }
                    ?.data.orEmpty()
                    .firstOrNull { it.id == targetId }
                if (session == null) {
                    Log.w(TAG, "linked conversation not found (http=${response.code()})")
                    _state.update {
                        it.copy(loading = false, error = "That conversation could not be found on this account.")
                    }
                    return
                }
                loadThread(session.id, session.status, api)
                return
            }
            Log.i(TAG, "resolve active live_chat session")
            val listResponse = api.sessions()
            if (gateOn401(listResponse.code())) return
            val listBody = listResponse.body()
            if (!listResponse.isSuccessful || listBody == null || !listBody.success) {
                val message = parseErrorBody(listResponse.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the support session (HTTP ${listResponse.code()})."
                Log.w(TAG, "sessions error: $message")
                degrade(message)
                return
            }
            val active = listBody.data.orEmpty().firstOrNull {
                it.type?.trim()?.lowercase(Locale.US) == "live_chat" &&
                    it.status?.trim()?.lowercase(Locale.US) == "active"
            }
            if (active != null) {
                loadThread(active.id, active.status, api)
                return
            }
            Log.i(TAG, "no active session — creating one")
            val createResponse = api.create(
                ChatCreateRequest(type = "live_chat", subject = CREATE_SUBJECT),
            )
            if (gateOn401(createResponse.code())) return
            val createBody = createResponse.body()
            val created = createBody?.takeIf { createResponse.isSuccessful && it.success }?.data
            if (created == null) {
                val message = parseErrorBody(createResponse.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not start a live support session (HTTP ${createResponse.code()})."
                Log.w(TAG, "create failed: $message")
                degrade(message)
                return
            }
            loadThread(created.id, created.status, api)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "session resolve failed: ${e.message}")
            degrade("Network error while opening the live support chat. Check your connection and retry.")
        } finally {
            forceNew = false
        }
    }

    /** Full ascending thread for the resolved session (GET /{id}/messages). */
    private suspend fun loadThread(sessionId: String?, status: String?, api: ChatApi) {
        val id = sessionId?.takeIf(String::isNotBlank)
        if (id == null) {
            _state.update {
                it.copy(loading = false, error = "The support session has no id to load messages for.")
            }
            return
        }
        val ended = status?.trim()?.lowercase(Locale.US) == "ended"
        val response = api.messages(id)
        if (gateOn401(response.code())) return
        if (response.code() == 404) {
            // Definitive answer (foreign/gone session) — honest error card,
            // never a cache of some other conversation.
            val message = parseErrorBody(response.errorBody()).error
                ?.takeIf(String::isNotBlank)
                ?: "This conversation no longer exists (HTTP 404)."
            Log.w(TAG, "thread 404: $message")
            _state.update { it.copy(loading = false, error = message) }
            return
        }
        val body = response.body()
        if (!response.isSuccessful || body == null || !body.success) {
            val message = parseErrorBody(response.errorBody()).error
                ?.takeIf(String::isNotBlank)
                ?: "Could not load the conversation (HTTP ${response.code()})."
            Log.w(TAG, "thread error: $message")
            degrade(message)
            return
        }
        val messages = body.data.orEmpty()
        Log.i(TAG, "thread loaded messages=${messages.size} ended=$ended")
        lastMessages = messages
        _state.value = _state.value.copy(
            loading = false,
            sessionId = id,
            sessionEnded = ended,
            bubbles = messages.map { it.toBubble() },
            error = null,
            offlineFromCache = false,
            needsAuth = false,
        )
        persistCache(id, ended, messages)
    }

    /* ─── failure / helpers ──────────────────────────────────────────────── */

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(
            loading = false,
            sending = false,
            endingChat = false,
            needsAuth = true,
        )
        return true
    }

    private fun removeTemp(tempKey: String) {
        _state.update { st -> st.copy(bubbles = st.bubbles.filterNot { it.key == tempKey }) }
    }

    private fun failSend(tempKey: String, text: String, message: String) {
        _state.update { st ->
            st.copy(
                sending = false,
                actionError = message,
                draftRestore = text,
                bubbles = st.bubbles.filterNot { it.key == tempKey },
            )
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved thread
     * cache; with none, the honest error card. Mapped on the MAIN thread
     * after the IO cache read (the HH:mm formatter is a main-thread JVM
     * helper, RfqModels convention).
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) { ChatCacheStore.read(appContext, cacheKey()) }
        if (cached != null) {
            Log.i(TAG, "degrade → cache messages=${cached.messages.size}")
            lastMessages = cached.messages
            _state.value = LiveChatUiState(
                loading = false,
                sessionId = cached.sessionId,
                sessionEnded = cached.ended,
                bubbles = cached.messages.map { it.toBubble() },
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the thread's wire DTOs — the offline render matches the live one. */
    private fun persistCache(sessionId: String, ended: Boolean, messages: List<ChatMessageDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            ChatCacheStore.write(
                appContext,
                cacheKey(),
                CachedChatThread(sessionId = sessionId, ended = ended, messages = messages),
            )
        }
    }

    private fun cacheKey(): String = "native_chat_cache_$pageId"

    private companion object {
        const val TAG = "ZylodChat"

        /** The exact subject the web live-chat creation body carries. */
        const val CREATE_SUBJECT = "Wholesale Buyer Support"
    }
}

/** @Serializable thread snapshot (dc74841 rule: every persisted type + nested type serializable). */
@Serializable
private data class CachedChatThread(
    val sessionId: String? = null,
    val ended: Boolean = false,
    val messages: List<ChatMessageDto> = emptyList(),
)

/**
 * On-device saved thread — the SAME prefs file the rest of the native shell
 * uses (zylod_config), under the page-fixed key "native_chat_cache_<pageId>"
 * (one snapshot per live-support pageId). Payload = the last successful
 * thread (wire DTOs + the session's ended flag), so the offline render is
 * consistent with the live one.
 */
private object ChatCacheStore {
    private const val TAG = "ZylodChat"
    private const val PREFS = "zylod_config"

    fun read(context: Context, key: String): CachedChatThread? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(CachedChatThread.serializer(), raw)
    }.onFailure { Log.w(TAG, "chat cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, key: String, thread: CachedChatThread) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedChatThread.serializer(), thread)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
        }.onFailure { Log.w(TAG, "chat cache write failed: ${it.message}") }
    }
}
