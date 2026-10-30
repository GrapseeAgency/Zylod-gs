package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Support ticket endpoints — the native Support Center surface, wired to the
 * exact handlers the web uses:
 *
 *  - GET  api/support/tickets      (src/app/api/support/tickets/route.ts GET)
 *    `{ success: true, data: [supportTicketsRow + _count{messages}] }`, the
 *    signed-in user's tickets newest-first (admins also receive a `user`
 *    block per row — carried as an optional field, never required).
 *  - POST api/support/tickets      (same route's POST)
 *    Body = the handler's destructure `{ category, subject, description,
 *    priority?, relatedOrderId? }`; 201 → `{ success: true, data: ticket }`.
 *    The route enforces subject ≥ 5 chars and description ≥ 20 chars — the
 *    VM mirrors those gates client-side and surfaces the server's own error
 *    strings for anything else (400/401/403/429/500 all carry `{ error }`).
 *  - GET  api/support/tickets/{id} (src/app/api/support/tickets/[id]/route.ts GET)
 *    `{ success: true, data: ticket }` where the row additionally includes
 *    `messages[]` (supportTicketMessages rows, oldest first).
 *
 * Dates arrive as Prisma ISO instants (strings). `attachments` on both
 * models is a JSON-STRINGIFIED array on the wire (schema comment), so it
 * stays a String? here exactly as the web reads it. Every field is
 * optional-with-default so shape drift degrades gracefully instead of
 * failing the whole screen's parse — same convention as DealItemDto.
 */
interface SupportApi {
    @GET("api/support/tickets")
    suspend fun tickets(): Response<SupportTicketsEnvelope>

    @POST("api/support/tickets")
    suspend fun createTicket(@Body body: CreateSupportTicketRequest): Response<SupportTicketEnvelope>

    @GET("api/support/tickets/{ticketId}")
    suspend fun ticket(@Path("ticketId") ticketId: String): Response<SupportTicketEnvelope>
}

/** Envelope of GET /api/support/tickets — also the on-disk offline cache payload. */
@Serializable
data class SupportTicketsEnvelope(
    val success: Boolean = false,
    val data: List<SupportTicketDto> = emptyList(),
    val error: String? = null,
)

/**
 * Envelope of POST /api/support/tickets (201) and GET
 * /api/support/tickets/{ticketId} — both return `{ success, data: ticket }`;
 * the detail route's row additionally carries the `messages` thread.
 */
@Serializable
data class SupportTicketEnvelope(
    val success: Boolean = false,
    val data: SupportTicketDto? = null,
    val error: String? = null,
)

/** POST /api/support/tickets body — the exact destructure in tickets/route.ts. */
@Serializable
data class CreateSupportTicketRequest(
    val category: String,
    val subject: String,
    val description: String,
    val priority: String? = null,
    val relatedOrderId: String? = null,
)

/**
 * One supportTickets row (prisma/schema.prisma "model supportTickets") plus
 * the list route's include. Field comments = the schema's own enums.
 */
@Immutable
@Serializable
data class SupportTicketDto(
    val id: String? = null,
    val userId: String? = null,
    // order_issue | payment_issue | account_issue | product_issue | seller_issue | general
    val category: String? = null,
    val subject: String? = null,
    val description: String? = null,
    // low | medium | high | urgent
    val priority: String? = null,
    // open | in_progress | waiting_buyer | waiting_seller | resolved | closed
    val status: String? = null,
    val assignedTo: String? = null,
    /** JSON-stringified array of file URLs on the wire (schema comment). */
    val attachments: String? = null,
    val relatedOrderId: String? = null,
    val rating: Int? = null,
    val ratingComment: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    /** GET /{id} include: the full message thread, oldest first. */
    val messages: List<SupportTicketMessageDto>? = null,
    /** GET list include: `_count: { messages: n }` — replies so far. */
    val _count: SupportTicketCountDto? = null,
    /** GET include present for ADMIN callers only (buyers never receive it). */
    val user: SupportTicketUserDto? = null,
)

@Serializable
data class SupportTicketCountDto(
    val messages: Int? = null,
)

/** One supportTicketMessages row (detail include / messages route shape). */
@Immutable
@Serializable
data class SupportTicketMessageDto(
    val id: String? = null,
    val ticketId: String? = null,
    val senderId: String? = null,
    // user | admin | system
    val senderType: String? = null,
    val message: String? = null,
    /** JSON-stringified array of file URLs on the wire (schema comment). */
    val attachments: String? = null,
    val isInternal: Boolean? = null,
    val createdAt: String? = null,
)

/** Filer identity block — present only when an ADMIN lists/reads tickets. */
@Serializable
data class SupportTicketUserDto(
    val id: String? = null,
    val email: String? = null,
    val userType: String? = null,
    val buyerProfile: SupportTicketBuyerProfileDto? = null,
)

@Serializable
data class SupportTicketBuyerProfileDto(
    val fullName: String? = null,
)
