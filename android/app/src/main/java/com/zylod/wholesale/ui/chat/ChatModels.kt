package com.zylod.wholesale.ui.chat

import com.zylod.wholesale.data.api.ChatMessageDto
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Chat domain models + mappers (pure Kotlin — no Android imports) so the
 * chat ViewModels stay thin fetch/degrade shells and the screens render
 * typed bubbles instead of wire DTOs. Same file contract as
 * ui/rfq/RfqModels.kt.
 *
 * MAPPER RECEIVERS are declared ON the exact wire types the endpoints
 * return; every rendered bubble carries a fully-prefixed stable `key`
 * ("msg-…", "botm-…") so LazyColumns can key rows directly, and the HH:mm
 * labels are precomputed HERE (pure JVM formatters) so the screens never
 * format per recomposition. Nothing is invented: an unparsable/absent
 * createdAt renders an empty time label, an absent message renders "".
 */

/** One rendered live-support bubble (user right / agent left / system pill). */
data class ChatBubble(
    val key: String,
    /** The server message id — null while the optimistic send is in flight. */
    val id: String?,
    /** Normalized lowercase wire value: "user" | "agent" | "chatbot" | "system". */
    val senderType: String,
    val text: String,
    /** "HH:mm" in the device zone — empty when the instant is missing/unparsable. */
    val timeLabel: String,
) {
    val mine: Boolean get() = senderType == "user"
    val system: Boolean get() = senderType == "system"
    val agent: Boolean get() = senderType == "agent"
    /** Server-confirmed (the optimistic temp bubble has no id yet). */
    val confirmed: Boolean get() = !id.isNullOrBlank()
}

/** Wire message → rendered bubble (labels precomputed, nothing invented). */
fun ChatMessageDto.toBubble() = ChatBubble(
    key = "msg-$stableKey",
    id = id?.takeIf(String::isNotBlank),
    senderType = senderType?.trim()?.lowercase(Locale.US)?.takeIf(String::isNotBlank) ?: "user",
    text = message.orEmpty(),
    timeLabel = hhmmLabelOf(createdAt),
)

/**
 * "HH:mm" from a UTC ISO instant (Prisma createdAt), rendered in the device
 * zone like the web chat. Empty string on absent/unparsable input — the
 * caller just skips the label (parse ISO; on failure show nothing).
 */
fun hhmmLabelOf(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching {
        val utc = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
        utc.parse(iso.take(19))
    }.getOrNull() ?: return ""
    return SimpleDateFormat("HH:mm", Locale.getDefault()).format(parsed)
}

/** Wall-clock "HH:mm" for the optimistic in-flight bubble (no id yet). */
fun hhmmNow(): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())

/**
 * Extracts a conversation id from the page's entry query, mirroring the
 * native key=value query convention (productId=, orderId=, …):
 * "conversationId=x", "sessionId=x", "chatId=x", a bare "&id=x" pair, or a
 * bare single token without any "=". Null when nothing usable is present.
 */
fun conversationIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    for (key in listOf("conversationId", "sessionId", "chatId")) {
        val value = Regex("$key=([^&]+)").find(raw)?.groupValues?.get(1)
        if (!value.isNullOrBlank()) return value
    }
    val bare = Regex("(?:^|&)id=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!bare.isNullOrBlank()) return bare
    return raw.takeIf { !it.contains('=') }
}

/* ─── chatbot (family 2) domain ──────────────────────────────────────────── */

/** One rendered chatbot bubble (user right/primary, bot left with article row). */
data class ChatbotMessage(
    val key: String,
    val fromUser: Boolean,
    val text: String,
    /** "HH:mm" — empty for the local greeting (no wire instant behind it). */
    val timeLabel: String,
    /** article source: slug that opens the full policy article. */
    val articleSlug: String? = null,
    /** article source: the article title shown on the link row. */
    val articleTitle: String? = null,
) {
    val articleLink: String? get() = articleSlug?.takeIf(String::isNotBlank)
}

/** One suggested-inquiry chip in BOTH languages (exact web strings). */
data class QuickPrompt(val en: String, val bn: String)

/** The five exact web quick prompts (chatbot-page), EN + BN pairs. */
val CHATBOT_QUICK_PROMPTS = listOf(
    QuickPrompt("How do payments work on Zylod?", "জাইলডে পেমেন্ট কীভাবে কাজ করে?"),
    QuickPrompt("What is Minimum Order Quantity (MOQ)?", "মিনিমাম অর্ডার কোয়ান্টিটি (MOQ) কী?"),
    QuickPrompt("How to return defective or damaged goods?", "নষ্ট বা ভুল পণ্য কীভাবে রিটার্ন করব?"),
    QuickPrompt("What documents are required for Seller Verification?", "সেলার ভেরিফিকেশনের জন্য কী কী লাগবে?"),
    QuickPrompt("How are delivery charges calculated?", "ডেলিভারি চার্জ কীভাবে নির্ধারিত হয়?"),
)

/** Local (never server) first bot message — the web chatbot's exact copy. */
const val CHATBOT_GREETING =
    "Hi! I search Zylod's help articles and FAQs. Ask me about orders, payments, MOQs, verification, or returns."

/** Bot bubble on any network/HTTP failure — the web chatbot's exact copy. */
const val CHATBOT_OFFLINE_REPLY =
    "Unable to reach the knowledge base. Please check your connection or reach us through the Help Center."

/** Quick-prompt section label — "Suggested Inquiries" (EN) / Bengali (BN). */
const val CHATBOT_LABEL_EN = "Suggested Inquiries"
const val CHATBOT_LABEL_BN = "প্রস্তাবিত প্রশ্নাবলী"
