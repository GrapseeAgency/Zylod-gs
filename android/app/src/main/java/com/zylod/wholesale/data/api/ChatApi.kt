package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Chat surfaces — the REAL endpoints behind the native chat pages:
 *
 *  - FAMILY 1 (live support): pageIds chat-list, chat-detail, chat-support,
 *    instant-chat, messaging-center, live-chat — all delegate to
 *    ui/chat/LiveChatScreen which talks to api/support/chat/sessions.
 *  - FAMILY 2 (chatbot): pageIds chatbot, ai-assistant, support-bot — the
 *    PUBLIC api/support/chatbot/query endpoint (no auth required).
 *  - FAMILY 3 (delivery chat): honestly NOT backend-connected (on web
 *    either) — ui/chat/DeliveryChatScreen renders that honesty and never
 *    calls the wire.
 *
 * Every route here was verified against the src/app/api/support handlers:
 *
 *  - GET api/support/chat/sessions — sessions/route.ts. Bearer-authenticated.
 *    200 { success, data: [ChatSessionDto] }; every session embeds `messages`
 *    with AT MOST the latest message (may be empty) — the full thread always
 *    needs the per-session messages GET.
 *  - POST api/support/chat/sessions — body { type: "live_chat", subject? }
 *    → 201 { success, data: ChatSessionDto }.
 *  - GET api/support/chat/sessions/{id} — 200 full session, messages
 *    ASCENDING; 404 for a foreign/phantom id.
 *  - PATCH api/support/chat/sessions/{id} — body { status: "ended" } →
 *    200 { success, data: ChatSessionDto } (the End Chat action).
 *  - GET api/support/chat/sessions/{id}/messages — 200 { success,
 *    data: [ChatMessageDto] } ascending; 404 for a foreign session.
 *  - POST api/support/chat/sessions/{id}/messages — body { message } → 201
 *    { success, data: ChatMessageDto, botReply: ChatMessageDto | null }.
 *    botReply is present ONLY for chatbot-type sessions, so this response is
 *    NOT the shared [ApiEnvelope] shape (botReply is a top-level sibling of
 *    data) — it parses into [ChatSendMessageResponse].
 *  - POST api/support/chatbot/query — PUBLIC (no auth). Body
 *    { query, language: "en"|"bn" } → 200 with one of three sources:
 *    faq (answer + suggestedArticles[]), article (answer snippet +
 *    articleSlug/articleTitle) or fallback (answer only). Parses into
 *    [ChatbotQueryResponse].
 *
 * WIRE NOTES (dc74841 lesson applied everywhere):
 *  - senderType is one of "user" | "agent" | "chatbot" | "system".
 *  - Every field is optional-with-default so shape drift degrades into the
 *    tolerant mappers in ui/chat/ChatModels.kt instead of failing the whole
 *    screen's parse; every nested object is itself @Serializable.
 *  - The shared OkHttp client's Bearer header + 401-refresh-authenticator
 *    chain apply unchanged; a 401 that reaches the VM means a real end of
 *    session (the authenticator already attempted one refresh).
 */
interface ChatApi {
    /** GET api/support/chat/sessions — the buyer's sessions, latest first-ish. */
    @GET("api/support/chat/sessions")
    suspend fun sessions(): Response<ApiEnvelope<List<ChatSessionDto>>>

    /** POST api/support/chat/sessions — body EXACTLY { type, subject? }. */
    @POST("api/support/chat/sessions")
    suspend fun create(@Body body: ChatCreateRequest): Response<ApiEnvelope<ChatSessionDto>>

    /** GET api/support/chat/sessions/{id} — full session, messages ascending. */
    @GET("api/support/chat/sessions/{id}")
    suspend fun session(@Path("id") id: String): Response<ApiEnvelope<ChatSessionDto>>

    /** PATCH api/support/chat/sessions/{id} — body EXACTLY { status }. */
    @PATCH("api/support/chat/sessions/{id}")
    suspend fun endSession(
        @Path("id") id: String,
        @Body body: ChatEndRequest,
    ): Response<ApiEnvelope<ChatSessionDto>>

    /** GET api/support/chat/sessions/{id}/messages — full thread, ascending. */
    @GET("api/support/chat/sessions/{id}/messages")
    suspend fun messages(@Path("id") id: String): Response<ApiEnvelope<List<ChatMessageDto>>>

    /**
     * POST api/support/chat/sessions/{id}/messages — body EXACTLY { message }.
     * 201 with the saved message as `data` and an optional `botReply`
     * sibling (chatbot-type sessions only) — hence the dedicated response
     * DTO instead of the shared envelope.
     */
    @POST("api/support/chat/sessions/{id}/messages")
    suspend fun sendMessage(
        @Path("id") id: String,
        @Body body: ChatSendMessageRequest,
    ): Response<ChatSendMessageResponse>

    /**
     * POST api/support/chatbot/query — PUBLIC (no Bearer needed; the shared
     * client may attach one anyway and the route ignores it). Body
     * { query, language: "en"|"bn" }.
     */
    @POST("api/support/chatbot/query")
    suspend fun chatbotQuery(@Body body: ChatbotQueryRequest): Response<ChatbotQueryResponse>
}

/* ─── requests ───────────────────────────────────────────────────────────── */

/** Create-session request — the handler destructures { type, subject? }. */
@Immutable
@Serializable
data class ChatCreateRequest(
    val type: String,
    val subject: String? = null,
)

/** End-session request — the handler destructures { status: "ended" }. */
@Immutable
@Serializable
data class ChatEndRequest(
    val status: String,
)

/** Send-message request — the handler destructures { message }. */
@Immutable
@Serializable
data class ChatSendMessageRequest(
    val message: String,
)

/** Chatbot query request — { query, language }; language is "en" | "bn". */
@Immutable
@Serializable
data class ChatbotQueryRequest(
    val query: String,
    val language: String = "en",
)

/* ─── session + message DTOs ─────────────────────────────────────────────── */

/**
 * One support chat session (verbatim handler projection). `messages`
 * carries AT MOST the latest message on list payloads and the FULL
 * ascending thread on the detail/messages payloads.
 */
@Immutable
@Serializable
data class ChatSessionDto(
    val id: String? = null,
    val userId: String? = null,
    val type: String? = null,
    val subject: String? = null,
    val status: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val endedAt: String? = null,
    val messages: List<ChatMessageDto> = emptyList(),
) {
    /** Stable identity for keyed collections (session id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "chat-session-${hashCode()}"
}

/**
 * One chat message. senderType ∈ "user"|"agent"|"chatbot"|"system";
 * attachments is a nullable string on the wire (optional column) and is
 * declared-but-unrendered for now.
 */
@Immutable
@Serializable
data class ChatMessageDto(
    val id: String? = null,
    val sessionId: String? = null,
    val senderId: String? = null,
    val senderType: String? = null,
    val message: String? = null,
    val attachments: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for LazyColumn keys (message id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "chat-msg-${hashCode()}"
}

/* ─── POST messages response (data + botReply siblings) ──────────────────── */

/**
 * Send-message success body (HTTP 201): the saved [ChatMessageDto] plus an
 * optional chatbot [ChatMessageDto] reply — NOT the shared envelope shape,
 * because botReply is a TOP-LEVEL sibling of data.
 */
@Immutable
@Serializable
data class ChatSendMessageResponse(
    val success: Boolean = false,
    val data: ChatMessageDto? = null,
    val botReply: ChatMessageDto? = null,
)

/* ─── POST chatbot/query response ────────────────────────────────────────── */

/**
 * Chatbot query response. Exactly one of three `source` shapes arrives:
 *  - faq:      answer + suggestedArticles[{title, slug}]
 *  - article:  answer (<300-char snippet) + articleSlug + articleTitle
 *  - fallback: answer only
 * Every optional field is nullable/defaulted so any source parses.
 */
@Immutable
@Serializable
data class ChatbotQueryResponse(
    val success: Boolean = false,
    val source: String? = null,
    val answer: String? = null,
    val articleSlug: String? = null,
    val articleTitle: String? = null,
    val suggestedArticles: List<ChatbotSuggestedArticleDto> = emptyList(),
)

/** One suggested-article chip from the faq source ({ title, slug }). */
@Immutable
@Serializable
data class ChatbotSuggestedArticleDto(
    val title: String? = null,
    val slug: String? = null,
)
