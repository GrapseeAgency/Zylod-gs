package com.zylod.wholesale.ui.chat

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ChatbotQueryRequest
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Chatbot VM — POST api/support/chatbot/query (PUBLIC, no auth) as the
 * payload of record for the three chatbot pageIds (chatbot, ai-assistant,
 * support-bot; each gets its OWN VM instance via the screen's pageId-keyed
 * factory).
 *
 *  - The FIRST bot message is LOCAL (never a server fact): the greeting
 *    constant, rendered before any wire call.
 *  - SEND: optimistic user bubble → query POST → bot bubble with the
 *    answer; when the response carries articleSlug/articleTitle the bubble
 *    renders the "read the article" row (screen side) that opens
 *    policy-detail with the slug. FAQ suggestedArticles stay declared on
 *    the wire DTO but are not rendered.
 *  - ANY failure (network exception, non-2xx, success=false, empty answer)
 *    → the honest bot bubble with the web's exact offline copy — never a
 *    fake answer.
 *  - NO auth, NO prefs cache: the endpoint is public and every answer is a
 *    fresh wire fact; a process restart re-seeds the local greeting only.
 */
data class ChatbotUiState(
    /** Seeded with the local greeting — the chatbot thread of record. */
    val messages: List<ChatbotMessage> = listOf(
        ChatbotMessage(key = "botm-greeting", fromUser = false, text = CHATBOT_GREETING, timeLabel = ""),
    ),
    /** Query language: "en" | "bn" (drives the request body + chip labels). */
    val language: String = "en",
    /** A chatbot query is in flight (typing indicator on screen). */
    val loading: Boolean = false,
)

class ChatbotViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(ChatbotUiState())
    val state: StateFlow<ChatbotUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var queryJob: Job? = null
    private var messageCounter: Int = 1

    /** EN/BN toggle — the label shows the OTHER language's name (screen side). */
    fun setLanguage(language: String) {
        if (language != "en" && language != "bn") return
        _state.update { it.copy(language = language) }
    }

    /** Optimistic user bubble → POST chatbot/query → bot bubble (or offline copy). */
    fun send(raw: String) {
        val text = raw.trim()
        val s = _state.value
        if (text.isEmpty() || s.loading) return
        if (queryJob?.isActive == true) return
        val userKey = "botm-${messageCounter++}"
        _state.update {
            it.copy(
                loading = true,
                messages = it.messages + ChatbotMessage(
                    key = userKey,
                    fromUser = true,
                    text = text,
                    timeLabel = hhmmNow(),
                ),
            )
        }
        queryJob = viewModelScope.launch {
            val reply: ChatbotReply = try {
                Log.i(TAG, "chatbot query lang=${_state.value.language} len=${text.length}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.chatApi(base).chatbotQuery(
                    ChatbotQueryRequest(query = text, language = _state.value.language),
                )
                val body = response.body()
                val ok = body?.takeIf { response.isSuccessful && it.success }
                if (ok == null) {
                    Log.w(TAG, "chatbot query failed (http=${response.code()})")
                    ChatbotReply(CHATBOT_OFFLINE_REPLY, null, null)
                } else {
                    val answer = ok.answer?.takeIf(String::isNotBlank)
                    if (answer == null) {
                        ChatbotReply(CHATBOT_OFFLINE_REPLY, null, null)
                    } else {
                        ChatbotReply(
                            answer = answer,
                            articleSlug = ok.articleSlug?.takeIf(String::isNotBlank),
                            articleTitle = ok.articleTitle?.takeIf(String::isNotBlank),
                        )
                    }
                }
            } catch (ce: CancellationException) {
                removeUserBubble(userKey)
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "chatbot query failed: ${e.message}")
                ChatbotReply(CHATBOT_OFFLINE_REPLY, null, null)
            }
            _state.update {
                it.copy(
                    loading = false,
                    messages = it.messages + ChatbotMessage(
                        key = "botm-${messageCounter++}",
                        fromUser = false,
                        text = reply.answer,
                        timeLabel = hhmmNow(),
                        articleSlug = reply.articleSlug,
                        articleTitle = reply.articleTitle,
                    ),
                )
            }
        }
    }

    private fun removeUserBubble(userKey: String) {
        _state.update { st ->
            st.copy(loading = false, messages = st.messages.filterNot { it.key == userKey })
        }
    }

    private companion object {
        const val TAG = "ZylodChat"
    }
}

/** The mapped bot answer (private — never leaves this file). */
private data class ChatbotReply(
    val answer: String,
    val articleSlug: String?,
    val articleTitle: String?,
)
