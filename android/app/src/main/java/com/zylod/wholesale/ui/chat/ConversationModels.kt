package com.zylod.wholesale.ui.chat

import com.zylod.wholesale.data.api.ChatThreadMessageDto

/**
 * t278 — buyer↔supplier DM domain models + mappers (pure Kotlin — no
 * Android imports), same file contract as the support family's ChatModels.kt
 * above: ViewModels stay thin fetch/degrade shells, the screens render typed
 * bubbles, every rendered row carries a fully-prefixed stable key and the
 * HH:mm labels are precomputed here. Nothing is invented: an unparsable or
 * absent sentAt renders an empty time label; an absent messageText renders ""
 * (attachment-only messages render their attachment preview instead).
 */

/** One rendered DM bubble (mine right / theirs left). */
data class DmBubble(
    val key: String,
    /** The server message id — null while the optimistic send is in flight. */
    val id: String?,
    /** True when the sender is the signed-in user (bubble renders right). */
    val mine: Boolean,
    /** Display name of the SENDER (rendered only on the other party's bubbles). */
    val senderName: String,
    /** The text body — empty for attachment-only messages. */
    val text: String,
    /** "📷 Image" / "📎 name" when the message carries an attachment. */
    val attachmentLabel: String?,
    /** "HH:mm" in the device zone — empty when the instant is missing/unparsable. */
    val timeLabel: String,
    /** Server-confirmed read receipt (own messages only — ✓✓ when read). */
    val read: Boolean,
) {
    /** Server-confirmed (the optimistic temp bubble has no id yet). */
    val confirmed: Boolean get() = !id.isNullOrBlank()
}

/** Wire message → rendered bubble (labels precomputed, nothing invented). */
fun ChatThreadMessageDto.toDmBubble(myUserId: String?): DmBubble {
    val mine = !senderId.isNullOrBlank() && senderId == myUserId
    val attachment = when {
        attachmentUrl.isNullOrBlank() -> null
        attachmentType?.lowercase(java.util.Locale.US) == "image" -> "📷 Image"
        else -> "📎 ${attachmentName?.takeIf(String::isNotBlank) ?: "File"}"
    }
    return DmBubble(
        key = "dm-$stableKey",
        id = id?.takeIf(String::isNotBlank),
        mine = mine,
        senderName = senderName.orEmpty(),
        text = messageText.orEmpty(),
        attachmentLabel = attachment,
        timeLabel = hhmmLabelOf(sentAt),
        read = isRead,
    )
}

/** Optimistic in-flight own bubble (no server id yet). */
fun dmTempBubble(text: String, seq: Int): DmBubble = DmBubble(
    key = "dm-temp-$seq",
    id = null,
    mine = true,
    senderName = "",
    text = text,
    attachmentLabel = null,
    timeLabel = hhmmNow(),
    read = false,
)

/**
 * Extracts the SUPPLIER USER id (users.id — what POST api/chat/conversations
 * validates) from the page's entry query: "supplierUserId=x" or a
 * "supplierId=x" pair (the web's supplier-directory button carries the
 * supplierProfile id under supplierId when it cannot know the user id —
 * the native Contact Supplier button carries the real user id under
 * supplierUserId). Null when nothing usable is present.
 */
fun supplierUserIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    for (key in listOf("supplierUserId", "supplierId")) {
        val value = Regex("$key=([^&]+)").find(raw)?.groupValues?.get(1)
        if (!value.isNullOrBlank()) return value
    }
    return null
}

/** Optional product context — a chat-detail query may carry "productId=x". */
fun productIdFromChatQuery(query: String?): String? =
    Regex("productId=([^&]+)").find(query.orEmpty())?.groupValues?.get(1)?.takeIf(String::isNotBlank)

/** Optional display name — a chat-detail query may carry "supplierName=x". */
fun supplierNameFromQuery(query: String?): String? =
    Regex("supplierName=([^&]*)").find(query.orEmpty())?.groupValues?.get(1)
        ?.takeIf { it.isNotBlank() }
        ?.let { java.net.URLDecoder.decode(it, Charsets.UTF_8.name()) }
