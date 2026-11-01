package com.zylod.wholesale.ui.complaints

import android.content.Context
import android.util.Log
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ComplaintDetailDto
import com.zylod.wholesale.data.api.ComplaintDto
import com.zylod.wholesale.data.api.ComplaintEvidencePhotoDto
import com.zylod.wholesale.data.api.SupplierQueryDto
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlinx.serialization.KSerializer

/**
 * Shared pure-Kotlin model layer for the t261 complaints/queries surfaces —
 * ui-states, the wire→state mappers, the offline cache keys and the web's
 * own display helpers. NO Compose imports here (MoneyModels/WalletFormat
 * doctrine): the screens own colors and fonts, this file owns text and
 * state shapes only.
 *
 * CACHE doctrine (FinanceCacheStore/ReturnsCacheStore convention): every
 * list/detail surface saves its last successful payload into SharedPreferences
 * "zylod_config" under its own key and renders that snapshot (with an honest
 * offline banner) when the network fails — never a fabricated placeholder row.
 * The list cache is TAGGED with the status filter it was fetched under (a
 * cache never renders under a different chip); the detail/query caches are
 * PINNED to the id they were fetched for.
 */
object ComplaintCacheKeys {
    /** The ONE prefs file the whole native shell uses. */
    const val PREFS = "zylod_config"

    /** Last successful GET api/complaints list (tagged with its status filter). */
    const val COMPLAINTS = "native_complaints_cache"

    /** Prefix for the per-complaint detail caches: key + the complaint id. */
    const val COMPLAINT_DETAIL_PREFIX = "native_complaint_detail_cache_"

    /** Last successful GET api/supplier/queries/[id] thread (pinned to the id). */
    const val QUERIES = "native_queries_cache"

    /** Per-complaint detail cache key. */
    fun complaintDetail(complaintId: String): String = "$COMPLAINT_DETAIL_PREFIX$complaintId"
}

/** Saved complaints-list snapshot — the raw wire rows plus the filter tag. */
@kotlinx.serialization.Serializable
data class CachedComplaintList(
    val rows: List<ComplaintDto> = emptyList(),
    val filter: String = FILTER_ALL,
) {
    companion object {
        const val FILTER_ALL = "all"
    }
}

/** Saved complaint-detail snapshot, pinned to the complaint id it was fetched for. */
@kotlinx.serialization.Serializable
data class CachedComplaintDetail(
    val complaintId: String? = null,
    val detail: ComplaintDetailDto? = null,
)

/** Saved supplier-query-thread snapshot, pinned to the query id it was fetched for. */
@kotlinx.serialization.Serializable
data class CachedSupplierQuery(
    val queryId: String? = null,
    val query: SupplierQueryDto? = null,
)

/**
 * On-device saved complaints payloads — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the [ComplaintCacheKeys] keys.
 * Generic read/write over the caller's serializer (FinanceCacheStore
 * convention).
 */
object ComplaintCacheStore {
    private const val TAG = "ZylodComplaints"

    fun <T> read(context: Context, key: String, serializer: KSerializer<T>): T? = runCatching {
        val raw = context.getSharedPreferences(ComplaintCacheKeys.PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(serializer, raw)
    }.onFailure { Log.w(TAG, "complaints cache read failed ($key): ${it.message}") }.getOrNull()

    fun <T> write(context: Context, key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            val raw = ApiClient.json.encodeToString(serializer, value)
            context.getSharedPreferences(ComplaintCacheKeys.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
        }.onFailure { Log.w(TAG, "complaints cache write failed ($key): ${it.message}") }
    }
}

/* ─── web display helpers (lib/complaints.ts + the SPA components) ────────── */

/** The route's REAL status filter tokens + their chip labels (the zod enum). */
val COMPLAINT_STATUS_FILTERS: List<Pair<String, String>> = listOf(
    "all" to "All",
    "open" to "Open",
    "in_review" to "In review",
    "resolved" to "Resolved",
    "rejected" to "Rejected",
    "withdrawn" to "Withdrawn",
)

/** The POST api/complaints category enum + the web's display labels. */
val COMPLAINT_CATEGORIES: List<Pair<String, String>> = listOf(
    "order_issue" to "Order issue",
    "product_quality" to "Product quality",
    "delivery" to "Delivery",
    "payment" to "Payment",
    "seller_behavior" to "Seller behavior",
    "other" to "Other",
)

/** Real display label for a category — unknown real values pass through verbatim. */
fun complaintCategoryLabel(category: String?): String =
    COMPLAINT_CATEGORIES.firstOrNull { it.first == category }?.second
        ?: category?.takeIf(String::isNotBlank)
        ?: "Complaint"

/** The raise-complaint page's REAL complaint-type options (its own select). */
val RAISE_COMPLAINT_TYPES: List<Pair<String, String>> = listOf(
    "damaged" to "Damaged or Broken Items on Arrival",
    "missing" to "Missing Quantity / Incomplete Shipment",
    "specs" to "Product Specifications Differ from Sample",
    "delay" to "Severe Logistics Delay",
    "quality" to "Substandard Materials / Batch Defect",
)

/** The raise-complaint page's REAL desired-resolution options. */
val RAISE_OUTCOMES: List<Pair<String, String>> = listOf(
    "refund" to "Full Refund",
    "partial" to "Partial Refund",
    "replace" to "Replacement",
)

/** The query thread's REAL status tokens (supplier/queries PATCH zod enum). */
val QUERY_STATUSES: List<String> = listOf("open", "replied", "resolved", "closed")

/**
 * "Jan 5, 14:30" from a UTC ISO instant — the web components' shared
 * formatTimestamp (toLocaleString en-US, short month + day + 24h clock).
 * Null on absent/unparsable input — never an invented date.
 */
fun complaintTimestampLabel(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val parsed = runCatching { utcIsoParser.parse(iso.take(19)) }.getOrNull() ?: return null
    return timestampFormat.format(parsed)
}

/** ISO instants on the complaints wire: "2024-05-05T10:00:00.000Z". */
private val utcIsoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

/** buyer-complaints/dispute-center formatTimestamp: "Jan 5, 14:30". */
private val timestampFormat = SimpleDateFormat("MMM d, HH:mm", Locale.US)

/**
 * "Jan 5, 2026, 2:30 PM" — the query-thread component's default
 * toLocaleString rendering for createdAt / repliedAt.
 */
fun queryTimestampLabel(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val parsed = runCatching { utcIsoParser.parse(iso.take(19)) }.getOrNull() ?: return null
    return queryTimestampFormat.format(parsed)
}

private val queryTimestampFormat = SimpleDateFormat("MMM d, yyyy, h:mm a", Locale.US)

/** "512 B" / "10 KB" / "1.5 MB" — the evidence-manager's formatBytes. */
fun evidenceBytesLabel(bytes: Long?): String {
    val value = bytes ?: return ""
    return when {
        value < 1024 -> "$value B"
        value < 1024 * 1024 -> "${value / 1024} KB"
        else -> String.format(Locale.US, "%.1f MB", value / (1024.0 * 1024.0))
    }
}

/* ─── entry-query parsing (orderIdFromQuery convention) ──────────────────── */

/**
 * The complaint id an entry query pins: a "complaintId=x" pair, a bare
 * "id=x" pair, or a bare token (LogisticsModels.orderIdFromQuery
 * convention). NO id → null, and the screen shows its honest id-less state
 * — never a fabricated fallback id.
 */
fun complaintIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val named = Regex("complaintId=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!named.isNullOrBlank()) return named
    val bare = Regex("(?:^|&)id=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!bare.isNullOrBlank()) return bare
    return raw.takeIf { !it.contains('=') }
}

/**
 * The query id an entry query pins: "queryId=x", "id=x", or a bare token —
 * the same convention the web's CustomerQueryDetailPage applies
 * (idProp || pageParams?.id).
 */
fun queryIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val named = Regex("queryId=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!named.isNullOrBlank()) return named
    val bare = Regex("(?:^|&)id=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!bare.isNullOrBlank()) return bare
    return raw.takeIf { !it.contains('=') }
}

/**
 * The order id an entry query pins (the raise-complaint page reads
 * pageParams.orderId || pageParams.id): "orderId=x", "id=x", or a bare
 * token — exactly LogisticsModels.orderIdFromQuery's contract, re-declared
 * here so ui/complaints stays dependency-light on the logistics package.
 */
fun raiseOrderIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val named = Regex("orderId=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!named.isNullOrBlank()) return named
    val bare = Regex("(?:^|&)id=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!bare.isNullOrBlank()) return bare
    return raw.takeIf { !it.contains('=') }
}

/* ─── ui states ──────────────────────────────────────────────────────────── */

/** One expanded evidence section on a complaints-list row. */
data class ComplaintEvidenceSection(
    val loading: Boolean = false,
    val photos: List<ComplaintEvidencePhotoDto> = emptyList(),
    /** Verbatim server text (or the web component's session note). */
    val error: String? = null,
)

/**
 * State of the pageId-keyed complaints surface (buyer-complaints AND
 * dispute-center AND disputes-page — the first is the list+withdraw+
 * evidence variant, the other two carry the file-a-complaint form and the
 * compact recent list; the web maps disputes-page onto the SAME
 * dispute-center component as dispute-center).
 */
data class ComplaintsUiState(
    val loading: Boolean = true,
    val rows: List<ComplaintDto> = emptyList(),
    /** The active status filter — the route's wire token ("all" = skip). */
    val filter: String = FILTER_ALL,
    /** The visible rows are SAVED data (in-memory or disk cache). */
    val offline: Boolean = false,
    /** Signed out (no token, or 401/403 after the refresh attempt — the web gate). */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** Background refresh in flight (the web's auto-refresh analogue). */
    val refreshing: Boolean = false,
    /** Verbatim refresh failure — last good data stays on screen. */
    val refreshError: String? = null,
    // ── file-a-complaint form (dispute-center family) ──
    val category: String = "",
    val title: String = "",
    val description: String = "",
    val orderId: String = "",
    val submitting: Boolean = false,
    /** Validation/server text above the submit button (verbatim server text). */
    val formError: String? = null,
    /** The REAL server-created complaint (real cuid id + real status). */
    val filed: ComplaintDto? = null,
    // ── withdraw (buyer-complaints) ──
    val withdrawing: Boolean = false,
    /** Verbatim 409/403/404/401 text inside the confirm dialog. */
    val withdrawError: String? = null,
    /** Verbatim 200 message — rendered inline after the dialog closes. */
    val withdrawMessage: String? = null,
    // ── evidence sections (buyer-complaints, expanded per row) ──
    val evidence: Map<String, ComplaintEvidenceSection> = emptyMap(),
) {
    companion object {
        /** The route's documented skip token for the status param. */
        const val FILTER_ALL = "all"
    }
}

/** State of the raise-complaint / raise-dispute form surface. */
data class RaiseComplaintUiState(
    /** The order the entry query pinned ("" = "No specific order attached"). */
    val orderId: String = "",
    /** damaged | missing | specs | delay | quality (the web select's values). */
    val complaintType: String = "damaged",
    /** refund | partial | replace (the web's three resolution buttons). */
    val desiredOutcome: String = "refund",
    /** Display-only claim amount — the web renders it but never sends it. */
    val refundAmount: String = "",
    val statement: String = "",
    val submitting: Boolean = false,
    /** Real 201 → the reference screen (the saved feedbackSubmissions id). */
    val submitted: Boolean = false,
    val reference: String = "",
    /** Server verbatim error text, or the supportEmail-aware fallbacks. */
    val errorMsg: String? = null,
    /** 401/403 → the web's AccountGate ("Sign in to raise a complaint"). */
    val sessionExpired: Boolean = false,
    /** The owner-published support.email (GET api/settings/public). */
    val supportEmail: String = "",
)

/** State of the dispute-detail complaint surface (GET api/complaints/[id]). */
data class ComplaintDetailUiState(
    val loading: Boolean = true,
    /** False → the entry query carried no complaint id (the web's static page copy). */
    val hasId: Boolean = false,
    val complaintId: String = "",
    val detail: ComplaintDetailDto? = null,
    /** Definitive HTTP 404 → the honest "Complaint not found" card. */
    val notFound: Boolean = false,
    /** HTTP 403 — the route's verbatim "Not authorized to view this complaint". */
    val forbiddenMessage: String? = null,
    /** Signed out (no token, or 401 after the refresh attempt). */
    val needsAuth: Boolean = false,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** The visible detail came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    val withdrawing: Boolean = false,
    /** Verbatim 200 withdraw message, rendered inline after the dialog. */
    val withdrawMessage: String? = null,
    /** Verbatim 409/403/404 text inside the confirm dialog. */
    val withdrawError: String? = null,
) {
    /** Withdraw shows only while the complaint is genuinely open (web parity). */
    val canWithdraw: Boolean
        get() = detail?.status == "open"
}

/** State of the customer-query-detail thread surface (supplier-scoped). */
data class QueryDetailUiState(
    val loading: Boolean = true,
    /** False → the entry query carried no query id (the web's "No query selected"). */
    val hasQueryId: Boolean = false,
    val queryId: String = "",
    val query: SupplierQueryDto? = null,
    /** Definitive HTTP 404 → the web's "Query not found" card. */
    val notFound: Boolean = false,
    /** HTTP 401 — the web's "Sign in required" card (buyer/guest sessions). */
    val needsAuth: Boolean = false,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** The visible thread came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    val reply: String = "",
    val sending: Boolean = false,
    val statusMoving: Boolean = false,
    /** Verbatim action failure (reply/status PATCH) shown near the composer. */
    val actionError: String? = null,
    /** Inline action success note (the web's toast text). */
    val actionMessage: String? = null,
)

/** State of the seller-order-disputes surface — honestly static (see VM). */
data class SellerDisputesUiState(
    /** No endpoint exists behind this pageId — the state carries nothing. */
    val loaded: Boolean = true,
)
