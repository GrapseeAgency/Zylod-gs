package com.zylod.wholesale.ui.support

import com.zylod.wholesale.data.api.SupportTicketDto
import com.zylod.wholesale.data.api.SupportTicketMessageDto

/**
 * Typed domain models for the native Support Center + the pure-Kotlin
 * DTO→domain mappers (no Android imports — testable without a device).
 *
 * The mapping layer keeps the nullable wire shape (prisma supportTickets
 * rows, optional-with-default DTOs per the drift-degradation convention)
 * from leaking into Compose: the screen receives non-null ids/subjects and
 * a typed [TicketStatus] for chip coloring, and identity-less rows fall
 * back to a hash key exactly like DealItemDto.stableKey.
 */

/** supportTickets.status lifecycle (schema comment + both routes' validation lists). */
enum class TicketStatus {
    OPEN,
    IN_PROGRESS,
    WAITING_BUYER,
    WAITING_SELLER,
    RESOLVED,
    CLOSED,
    UNKNOWN,
    ;

    /** Chip label — the wire's snake_case surfaced the way the web shows it. */
    val label: String
        get() = name.replace('_', ' ')

    companion object {
        fun fromWire(raw: String?): TicketStatus = when (raw?.trim()?.lowercase()) {
            "open" -> OPEN
            "in_progress" -> IN_PROGRESS
            "waiting_buyer" -> WAITING_BUYER
            "waiting_seller" -> WAITING_SELLER
            "resolved" -> RESOLVED
            "closed" -> CLOSED
            else -> UNKNOWN
        }
    }
}

/** One ticket row as the Support Center list renders it. */
data class SupportTicket(
    /** Stable LazyColumn key — the row id, hash fallback like DealItemDto. */
    val id: String,
    /** order_issue | payment_issue | account_issue | product_issue | seller_issue | general */
    val category: String,
    val subject: String,
    val description: String,
    /** low | medium | high | urgent */
    val priority: String,
    val status: TicketStatus,
    /** Exact wire status string — honest chip label when [status] is UNKNOWN. */
    val statusRaw: String,
    val createdAtIso: String?,
    val updatedAtIso: String?,
    val relatedOrderId: String?,
    val messageCount: Int,
)

/** One supportTicketMessages row (future thread view of a single ticket). */
data class SupportTicketMessage(
    val id: String,
    /** user | admin | system — drives who said it in a thread view. */
    val senderType: String,
    val isAdminReply: Boolean,
    val message: String,
    val createdAtIso: String?,
)

/**
 * DTO → domain. A row with no id at all still maps (hash-key fallback, the
 * OrdersScreen key convention) so one drift-broken field can never blank a
 * whole list; the screen never sees null subject/category.
 */
fun SupportTicketDto.toDomain(): SupportTicket = SupportTicket(
    id = id?.takeIf(String::isNotBlank) ?: "ticket-${hashCode()}",
    category = category?.takeIf(String::isNotBlank) ?: "general",
    subject = subject?.takeIf(String::isNotBlank) ?: "--",
    description = description.orEmpty(),
    priority = priority?.takeIf(String::isNotBlank) ?: "medium",
    status = TicketStatus.fromWire(status),
    statusRaw = status?.trim()?.takeIf(String::isNotBlank) ?: "open",
    createdAtIso = createdAt,
    updatedAtIso = updatedAt,
    relatedOrderId = relatedOrderId?.takeIf(String::isNotBlank),
    messageCount = _count?.messages ?: messages?.size ?: 0,
)

/** Message DTO → domain, or null when the row has no identity/text at all. */
fun SupportTicketMessageDto.toDomain(): SupportTicketMessage? {
    val id = id?.takeIf(String::isNotBlank) ?: return null
    val text = message.orEmpty()
    if (text.isBlank()) return null
    val sender = senderType?.trim()?.lowercase().orEmpty()
    return SupportTicketMessage(
        id = id,
        senderType = sender,
        isAdminReply = sender == "admin",
        message = text,
        createdAtIso = createdAt,
    )
}
