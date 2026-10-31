package com.zylod.wholesale.ui.logistics

import android.content.Context
import android.util.Log
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.DeliveryMethodDto
import com.zylod.wholesale.data.api.QuoteOptionDto
import com.zylod.wholesale.data.api.TrackedOrderDto
import com.zylod.wholesale.data.api.TrackedSubOrderDto
import com.zylod.wholesale.data.api.TrackingEventDto
import com.zylod.wholesale.data.api.WarehouseDto
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlinx.serialization.KSerializer

/**
 * Logistics domain models + mappers + helpers (pure Kotlin — no Compose
 * imports) so the logistics ViewModels stay thin fetch/degrade shells and
 * the screens render typed rows instead of wire DTOs. Same file contract
 * as ui/chat/ChatModels.kt.
 *
 * MAPPER RECEIVERS are declared ON the exact wire types the endpoints
 * return; every rendered row carries a stable key so LazyColumns can key
 * rows directly, and the date labels are precomputed HERE (pure JVM
 * formatters) so the screens never format per recomposition. Nothing is
 * invented: absent fields render as empty strings / nulls and the screens
 * drop those segments.
 */

/* ─── delivery methods (web delivery-method-page.tsx) ────────────────────── */

/** One rendered delivery-method card row. */
data class DeliveryMethodRow(
    val key: String,
    val name: String,
    /** The web card's exact fallback chain: description || estimated_delivery || "". */
    val description: String,
    /** "2-4 days" label straight from the wire (null → the caller decides). */
    val estimatedDelivery: String?,
    val price: Double,
    /** price === 0 → the card renders "Free" (web parity). */
    val isFree: Boolean,
    val badge: String?,
    /** "truck" | "plane" | "store" (wire default "truck"). */
    val icon: String,
)

fun DeliveryMethodDto.toMethodRow() = DeliveryMethodRow(
    key = stableKey,
    name = name.orEmpty(),
    description = description?.takeIf(String::isNotBlank)
        ?: estimatedDelivery?.takeIf(String::isNotBlank)
        ?: "",
    estimatedDelivery = estimatedDelivery?.takeIf(String::isNotBlank),
    price = price,
    isFree = price == 0.0,
    badge = badge?.takeIf(String::isNotBlank),
    icon = icon?.takeIf(String::isNotBlank) ?: "truck",
)

/* ─── warehouses (web warehouse-locator-page.tsx / pickup-point-page.tsx) ── */

/** One rendered warehouse / pickup-point row. */
data class WarehouseRow(
    val key: String,
    val name: String,
    val companyName: String,
    val city: String,
    val district: String,
    val addressLine1: String,
    val addressLine2: String?,
    val supplierId: String?,
    val ratingAvg: Double?,
    val ratingCount: Int?,
    /** verificationStatus == "approved" → the emerald VERIFIED accent. */
    val verified: Boolean,
) {
    /** "Line1, Line2, City, District" address join (both web row formats). */
    val addressLabel: String
        get() = listOf(addressLine1, addressLine2, city, district)
            .filter { !it.isNullOrBlank() }
            .joinToString(", ")

    /** The web shows the rating line only when at least one review exists. */
    val hasRating: Boolean get() = (ratingCount ?: 0) > 0 && ratingAvg != null
}

fun WarehouseDto.toWarehouseRow() = WarehouseRow(
    key = stableKey,
    name = name.orEmpty(),
    companyName = companyName.orEmpty(),
    city = city.orEmpty(),
    district = district.orEmpty(),
    addressLine1 = addressLine1.orEmpty(),
    addressLine2 = addressLine2?.takeIf(String::isNotBlank),
    supplierId = supplierId?.takeIf(String::isNotBlank),
    ratingAvg = ratingAvg,
    ratingCount = ratingCount,
    verified = verificationStatus?.trim()?.lowercase(Locale.US) == "approved",
)

/* ─── order tracking (web track-order-page.tsx) ──────────────────────────── */

/** Real subOrder statuses → 4-step progress stage (Confirmed=1 … Delivered=4). */
val STAGE_BY_STATUS: Map<String, Int> = mapOf(
    "pending" to 1,
    "confirmed" to 1,
    "processing" to 1,
    "packed" to 2,
    "shipped" to 3,
    "delivered" to 4,
    "returned" to 3,
    "cancelled" to 1,
)

/** Overall badge, derived only from real subOrder statuses (web deriveBadge). */
fun deriveOverallBadge(subOrders: List<TrackedSubOrderDto>): String {
    val statuses = subOrders.map { (it.status ?: "pending").trim().lowercase(Locale.US) }
    if (statuses.isEmpty()) return "PROCESSING"
    if (statuses.all { it == "delivered" }) return "DELIVERED"
    if (statuses.any { it == "shipped" }) return "IN TRANSIT"
    if (statuses.any { it == "cancelled" }) return "CANCELLED"
    return "PROCESSING"
}

/** Furthest stage reached by any non-cancelled subOrder (web deriveStage). */
fun deriveStage(subOrders: List<TrackedSubOrderDto>): Int {
    val statuses = subOrders
        .filter { (it.status ?: "").trim().lowercase(Locale.US) != "cancelled" }
        .map { (it.status ?: "pending").trim().lowercase(Locale.US) }
    if (statuses.isEmpty()) return 1
    return statuses.maxOf { STAGE_BY_STATUS[it] ?: 1 }
}

/** One rendered per-shipment row inside the status card. */
data class ShipmentRow(
    val key: String,
    val supplierName: String,
    /** Uppercase wire status (web chip). */
    val statusLabel: String,
    /** Null → the row renders "No tracking number assigned yet". */
    val trackingNumber: String?,
    /** formatDate(estimatedDelivery) — null when the supplier has not set one. */
    val etaLabel: String?,
    val position: Int,
    val count: Int,
)

/** One rendered timeline row in the Tracking History card. */
data class TrackingEventRow(
    val key: String,
    /** Wire status with underscores → spaces, uppercased (web CSS uppercase). */
    val statusLabel: String,
    val location: String?,
    val note: String?,
    val supplierName: String?,
    /** formatDateTime(trackedAt) — "" when absent/unparsable (dropped). */
    val trackedLabel: String,
    /** idx == 0 in the DESC-sorted timeline → the highlighted node. */
    val latest: Boolean,
)

/** Per-shipment rows in server order (web: "Shipment {idx+1} of {n}"). */
fun TrackedOrderDto.toShipmentRows(): List<ShipmentRow> {
    val total = subOrders.size
    return subOrders.mapIndexed { index, subOrder -> subOrder.toShipmentRow(index + 1, total) }
}

private fun TrackedSubOrderDto.toShipmentRow(position: Int, count: Int) = ShipmentRow(
    key = "ship-$stableKey",
    supplierName = supplier?.companyName?.takeIf(String::isNotBlank) ?: "--",
    statusLabel = (status ?: "pending").trim().uppercase(Locale.US),
    trackingNumber = trackingNumber?.takeIf(String::isNotBlank),
    etaLabel = logisticsDateLabel(estimatedDelivery),
    position = position,
    count = count,
)

/**
 * Tracking events across ALL sub-orders, newest first, the owning
 * supplier's company name attached (web trackingEvents flatMap + sort desc).
 */
fun TrackedOrderDto.toEventRows(): List<TrackingEventRow> = subOrders
    .flatMap { subOrder ->
        subOrder.tracking.map { event -> Triple(event, subOrder.supplier?.companyName, subOrder) }
    }
    .sortedWith(compareByDescending { (event, _, _) -> eventTimestamp(event) })
    .mapIndexed { index, (event, supplierName, _) ->
        TrackingEventRow(
            key = "event-${event.stableKey}",
            statusLabel = (event.status ?: "--").replace('_', ' ').uppercase(Locale.US),
            location = event.location?.takeIf(String::isNotBlank),
            note = event.note?.takeIf(String::isNotBlank),
            supplierName = supplierName?.takeIf(String::isNotBlank),
            trackedLabel = logisticsDateTimeLabel(event.trackedAt),
            latest = index == 0,
        )
    }

/** Milliseconds from an ISO instant, Long.MIN_VALUE when absent/unparsable. */
private fun eventTimestamp(event: TrackingEventDto): Long {
    val iso = event.trackedAt?.takeIf(String::isNotBlank) ?: return Long.MIN_VALUE
    val parsed = runCatching { utcIsoParser.parse(iso.take(19)) }.getOrNull() ?: return Long.MIN_VALUE
    return parsed.time
}

/** Earliest REAL supplier-set ETA across the sub-orders (web etaCandidates). */
fun TrackedOrderDto.etaLabel(): String? = subOrders
    .mapNotNull { it.estimatedDelivery?.takeIf(String::isNotBlank) }
    .mapNotNull { iso ->
        runCatching { utcIsoParser.parse(iso.take(19)) }.getOrNull()?.let { iso to it.time }
    }
    .minByOrNull { it.second }
    ?.let { (iso, _) -> logisticsDateLabel(iso) }

/* ─── query parsing (mirror chat's conversationIdFromQuery) ──────────────── */

/**
 * Extracts an order id from the page's entry query, mirroring the native
 * key=value query convention and the web's
 * `pageParams.orderId || pageParams.id || ''` resolution:
 * "orderId=x" first, then a bare "&id=x" pair, then a bare single token
 * without any "=". Null when nothing usable is present.
 */
fun orderIdFromQuery(query: String?): String? {
    val raw = query?.trim().orEmpty()
    if (raw.isEmpty()) return null
    val named = Regex("orderId=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!named.isNullOrBlank()) return named
    val bare = Regex("(?:^|&)id=([^&]+)").find(raw)?.groupValues?.get(1)
    if (!bare.isNullOrBlank()) return bare
    return raw.takeIf { !it.contains('=') }
}

/* ─── formatters (web formatDate / formatDateTime / formatPrice) ─────────── */

/** ISO instants on the logistics wire: "2024-05-05T10:00:00.000Z". */
private val utcIsoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

private val dateLabelFormat = SimpleDateFormat("MMM d, yyyy", Locale.US)
private val dateTimeLabelFormat = SimpleDateFormat("MMM d, yyyy, h:mm a", Locale.US)

/** Shared ৳ formatter — thousands separators, 2dp only when fractional. */
private val takaFormat: NumberFormat = NumberFormat.getIntegerInstance(Locale.US)

/**
 * "Jan 5, 2026" from a UTC ISO instant, device zone (web formatDate).
 * Null on absent/unparsable input — never an invented date.
 */
fun logisticsDateLabel(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val parsed = runCatching { utcIsoParser.parse(iso.take(19)) }.getOrNull() ?: return null
    return dateLabelFormat.format(parsed)
}

/**
 * "Jan 5, 2026, 3:24 PM" from a UTC ISO instant, device zone (web
 * formatDateTime). "" on absent/unparsable input — the caller drops it.
 */
fun logisticsDateTimeLabel(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching { utcIsoParser.parse(iso.take(19)) }.getOrNull() ?: return ""
    return dateTimeLabelFormat.format(parsed)
}

/** ৳ price text (DealsScreen/OrdersScreen convention: whole → no decimals). */
fun formatTaka(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + takaFormat.format(value.toLong())
    else "৳" + String.format(Locale.US, "%.2f", value)

/* ─── offline cache (t251 LiveChatViewModel convention) ──────────────────── */

/** The device-saved logistics payload keys — SharedPreferences "zylod_config". */
internal object LogisticsCacheKeys {
    const val PREFS = "zylod_config"
    const val METHODS = "native_logistics_methods_cache"
    const val WAREHOUSES = "native_logistics_warehouses_cache"
    const val QUOTE = "native_logistics_quote_cache"

    /** One snapshot per pageId on the track surface family. */
    fun track(pageId: String): String = "native_logistics_track_cache_$pageId"
}

/**
 * @Serializable cache payloads (dc74841 rule: every persisted type and
 * every nested type serializable — these hold raw wire DTOs, all of which
 * are @Serializable with defaults on every field).
 */

/** Delivery-methods snapshot (the raw wire DTOs — offline render matches live). */
@kotlinx.serialization.Serializable
data class CachedMethods(val methods: List<DeliveryMethodDto> = emptyList())

/** Warehouses snapshot (rows + the district facet list + the total). */
@kotlinx.serialization.Serializable
data class CachedWarehouses(
    val rows: List<WarehouseDto> = emptyList(),
    val districts: List<String> = emptyList(),
    val total: Int = 0,
)

/** Last successful quote (options only — the inputs are user state). */
@kotlinx.serialization.Serializable
data class CachedQuote(val options: List<QuoteOptionDto> = emptyList())

/** Tracked-order snapshot pinned to the order id it was fetched for. */
@kotlinx.serialization.Serializable
data class CachedTrack(val orderId: String? = null, val order: TrackedOrderDto? = null)

/**
 * On-device saved payloads — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the [LogisticsCacheKeys] keys.
 */
internal object LogisticsCacheStore {
    private const val TAG = "ZylodLogistics"

    fun <T> read(context: Context, key: String, serializer: KSerializer<T>): T? = runCatching {
        val raw = context.getSharedPreferences(LogisticsCacheKeys.PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(serializer, raw)
    }.onFailure { Log.w(TAG, "logistics cache read failed: ${it.message}") }.getOrNull()

    fun <T> write(context: Context, key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            val raw = ApiClient.json.encodeToString(serializer, value)
            context.getSharedPreferences(LogisticsCacheKeys.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
        }.onFailure { Log.w(TAG, "logistics cache write failed: ${it.message}") }
    }
}
