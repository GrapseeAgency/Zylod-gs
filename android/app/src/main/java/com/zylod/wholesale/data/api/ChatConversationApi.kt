package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * t278 — buyer↔supplier DM conversations (the REAL chat backend the web uses;
 * previously the ENTIRE native chat family funneled into the SUPPORT sessions
 * API, so "Contact Supplier" messages were delivered to the support team).
 *
 * Every route verified against the src/app/api/chat handlers:
 *
 *  - GET api/chat/conversations — conversations/route.ts. Bearer-authenticated.
 *    Query: role ("buyer"|"supplier" — defaults to the token's userType on
 *    the server, but the native passes it explicitly), page, limit (≤50).
 *    200 { success, data: [ConversationRow], pagination } — rows ordered by
 *    lastMessageAt desc, each with other-party name, optional product context,
 *    the LAST message (messages[0], desc take-1 on the server), messageCount
 *    and unreadCount (messages from the OTHER party with isRead=false).
 *  - POST api/chat/conversations — body { supplierId, productId? }; buyerId
 *    comes from the token. Validates the supplier is a REAL supplier account
 *    and that the product (when present) belongs to them; reuses an existing
 *    conversation for the same (buyer, supplier, productId|null) triple.
 *    200 (reused) / 201 (created) { success, data: {id, buyerId, supplierId,
 *    productId, createdAt, lastMessageAt} }.
 *  - GET api/chat/conversations/{id}/messages — participant-checked (403 for
 *    outsiders), marks the OTHER party's unread messages read BEFORE the
 *    fetch (Task 134), returns messages ASCENDING by sentAt with senderName
 *    resolved in bulk + replyTo previews. 200 { success, data: [ChatThreadMessageDto],
 *    pagination } (page/limit over the ascending list).
 *  - POST api/chat/conversations/{id}/messages — body { messageText } (or an
 *    attachment triple — the native sends text only, attachments render but
 *    are not composed on-device). 201 { success, data: ChatThreadMessageDto }.
 *    The server also fires a durable 'chat' notification to the recipient.
 *
 * WIRE NOTES (dc74841 lesson applied): every field optional-with-default so
 * shape drift degrades into tolerant rendering instead of failing the parse;
 * the shared OkHttp client's Bearer + single-flight 401-refresh chain applies
 * unchanged (a 401 that reaches the VM = real end of session).
 */
interface ChatConversationApi {

    /** GET api/chat/conversations — the authenticated user's DM threads. */
    @GET("api/chat/conversations")
    suspend fun conversations(
        @Query("role") role: String = "buyer",
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): Response<ConversationsEnvelope>

    /** POST api/chat/conversations — create-or-reuse { supplierId, productId? }. */
    @POST("api/chat/conversations")
    suspend fun createConversation(@Body body: CreateConversationRequest): Response<ConversationCreatedEnvelope>

    /** GET api/chat/conversations/{id}/messages — full thread, ascending. */
    @GET("api/chat/conversations/{id}/messages")
    suspend fun threadMessages(
        @Path("id") id: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50,
    ): Response<ConversationMessagesEnvelope>

    /** POST api/chat/conversations/{id}/messages — body { messageText }. */
    @POST("api/chat/conversations/{id}/messages")
    suspend fun sendThreadMessage(
        @Path("id") id: String,
        @Body body: SendThreadMessageRequest,
    ): Response<ThreadMessageCreatedEnvelope>
}

/* ─── requests ────────────────────────────────────────────────────────────── */

/** Create-or-reuse request — the handler destructures { supplierId, productId? }. */
@Immutable
@Serializable
data class CreateConversationRequest(
    val supplierId: String,
    val productId: String? = null,
)

/** Send-message request — text only (attachments are render-only on native). */
@Immutable
@Serializable
data class SendThreadMessageRequest(
    val messageText: String,
)

/* ─── list DTOs ──────────────────────────────────────────────────────────── */

/** GET conversations list envelope — rows + server pagination. */
@Immutable
@Serializable
data class ConversationsEnvelope(
    val success: Boolean = false,
    val data: List<ConversationRow> = emptyList(),
    val pagination: Pagination? = null,
    val error: String? = null,
)

/** One conversations-list row (verbatim conversations/route.ts projection). */
@Immutable
@Serializable
data class ConversationRow(
    val id: String? = null,
    val otherPartyId: String? = null,
    val otherPartyName: String? = null,
    val otherPartyBusiness: String? = null,
    val product: ConversationProductDto? = null,
    val lastMessage: ConversationLastMessageDto? = null,
    val messageCount: Int = 0,
    val unreadCount: Int = 0,
    val lastMessageAt: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (conversation id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "conversation-${hashCode()}"
}

/** The optional product context attached to a conversation. */
@Immutable
@Serializable
data class ConversationProductDto(
    val id: String? = null,
    val name: String? = null,
    val thumbnailUrl: String? = null,
    val basePrice: Double? = null,
    val unit: String? = null,
    val moq: Double? = null,
)

/** The newest message preview (messages[0] of the server's desc take-1). */
@Immutable
@Serializable
data class ConversationLastMessageDto(
    val messageText: String? = null,
    val sentAt: String? = null,
    val senderId: String? = null,
    val attachmentUrl: String? = null,
    val attachmentType: String? = null,
    val attachmentName: String? = null,
)

/* ─── thread DTOs ────────────────────────────────────────────────────────── */

/** GET thread messages envelope — ascending rows + pagination. */
@Immutable
@Serializable
data class ConversationMessagesEnvelope(
    val success: Boolean = false,
    val data: List<ChatThreadMessageDto> = emptyList(),
    val pagination: Pagination? = null,
    val error: String? = null,
)

/** POST create-conversation envelope — reused (200) or created (201). */
@Immutable
@Serializable
data class ConversationCreatedEnvelope(
    val success: Boolean = false,
    val data: ConversationRef? = null,
    val error: String? = null,
)

/** The bare conversation object a create-or-reuse returns. */
@Immutable
@Serializable
data class ConversationRef(
    val id: String? = null,
    val buyerId: String? = null,
    val supplierId: String? = null,
    val productId: String? = null,
    val createdAt: String? = null,
    val lastMessageAt: String? = null,
)

/** One DM message (verbatim messages/route.ts projection). */
@Immutable
@Serializable
data class ChatThreadMessageDto(
    val id: String? = null,
    val senderId: String? = null,
    val senderName: String? = null,
    val messageText: String? = null,
    val attachmentUrl: String? = null,
    val attachmentType: String? = null,
    val attachmentName: String? = null,
    val replyTo: ChatThreadReplyPreviewDto? = null,
    val isRead: Boolean = false,
    val sentAt: String? = null,
) {
    /** Stable identity for LazyColumn keys (message id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "dm-msg-${hashCode()}"
}

/** The replyTo preview a message may carry (resolved server-side in bulk). */
@Immutable
@Serializable
data class ChatThreadReplyPreviewDto(
    val id: String? = null,
    val senderId: String? = null,
    val senderName: String? = null,
    val messageText: String? = null,
    val attachmentUrl: String? = null,
    val attachmentType: String? = null,
)

/** POST send-message envelope — 201 with the saved row as `data`. */
@Immutable
@Serializable
data class ThreadMessageCreatedEnvelope(
    val success: Boolean = false,
    val data: ChatThreadMessageDto? = null,
    val error: String? = null,
)
