package com.zylod.wholesale.ui.rfq

import com.zylod.wholesale.data.api.ApiEnvelope
import com.zylod.wholesale.data.api.RfqDetailDto
import com.zylod.wholesale.data.api.RfqDetailQuoteDto
import com.zylod.wholesale.data.api.RfqItemDto
import com.zylod.wholesale.data.api.RfqQuoteDto
import com.zylod.wholesale.data.api.RfqRowDto
import com.zylod.wholesale.ui.wallet.formatBdt
import com.zylod.wholesale.ui.wallet.formatRelativeDate
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * Buyer RFQ domain models plus DTO-to-domain mappers (pure Kotlin — no
 * Android imports) so RfqListViewModel stays a thin fetch/degrade shell and
 * RfqListScreen renders typed rows instead of wire DTOs. Same file contract
 * as ui/admin/AdminModels.kt.
 *
 * MAPPER RECEIVERS (declared ON the exact envelope types the endpoints
 * return, so the VM cannot call them on the wrong receiver — AdminModels
 * convention):
 *  - ApiEnvelope<List<RfqRowDto>>.toRfqRows() — GET api/rfq?role=buyer
 *    (the shared envelope: pagination is a TOP-LEVEL sibling of data).
 *  - ApiEnvelope<RfqDetailDto>.toRfqDetail() — GET api/rfq/{id} (no
 *    pagination; null when the payload lacks its data core).
 *
 * Every rendered row carries a fully-prefixed stable `key` (rfq-, ritem-,
 * rq-) so the LazyColumn can key rows directly, and the money/date/status
 * labels are precomputed HERE (pure JVM formatters, main-thread like
 * AdminModels) so the screen never formats per recomposition.
 */

/** One buyer RFQ card row (list projection + precomputed labels). */
data class RfqRow(
    val key: String,
    val id: String?,
    val title: String,
    val status: String?,
    /** "Open" / "Quoted" / "Awarded" / "Closed" / "Expired" / raw fallback. */
    val statusLabel: String,
    /** "120 pcs · target ৳1,500" — quantity/unit/target line (best effort). */
    val summaryLabel: String,
    val deliveryCity: String?,
    /** "Deadline in 3d · Jan 5, 2025" — null when absent/unparsable. */
    val deadlineLabel: String?,
    /** "4 quotes" / "1 quote" / "No quotes yet" (quoteCount is the REAL total). */
    val quoteCountLabel: String,
    val quoteCount: Int,
    val description: String?,
    /** convertedOrderNumber from the row — non-null means already converted. */
    val convertedOrderNumber: String?,
    /** awarded && no conversion markers yet → the Convert-to-Order CTA shows. */
    val convertible: Boolean,
    /** "3h ago" for createdAt — null when the instant is missing/unparsable. */
    val createdLabel: String?,
    /** Raw embedded quotes (≤5, no supplier) — the collapsed-card fallback. */
    val quotes: List<RfqQuoteRow>,
)

/** One line item inside an expanded RFQ card. */
data class RfqItemRow(
    val key: String,
    val name: String,
    val specs: String?,
    /** "120 pcs" — quantity + unit, best effort. */
    val qtyLabel: String,
    /** "৳12.50" target per unit — null when the wire omits it. */
    val targetLabel: String?,
)

/** One supplier quote inside an expanded RFQ card (detail projection). */
data class RfqQuoteRow(
    val key: String,
    /** The quote id the award PATCH needs — non-null for pending rows. */
    val id: String?,
    /** supplier.displayName or the honest "Supplier" fallback. */
    val supplierLabel: String,
    /** "৳12.50 / unit" per-unit line — null when pricePerUnit is absent. */
    val priceLabel: String?,
    /** "৳1,500" total — null when totalPrice is absent. */
    val totalLabel: String?,
    /** "5d delivery" — null when deliveryDays is absent. */
    val deliveryLabel: String?,
    val message: String?,
    val status: String?,
    /** "Pending" / "Accepted" / "Rejected" / raw fallback. */
    val statusLabel: String,
    /** status == pending → the Accept/Reject action row renders. */
    val pending: Boolean,
    /** status == accepted (the quote that wins the conversion). */
    val accepted: Boolean,
)

/** The full detail payload behind an expanded card (GET api/rfq/{id}). */
data class RfqDetail(
    val key: String,
    val id: String?,
    val title: String,
    val description: String?,
    val categorySlug: String?,
    val status: String?,
    val statusLabel: String,
    val summaryLabel: String,
    val buyerName: String?,
    val deliveryCity: String?,
    val deadlineLabel: String?,
    val items: List<RfqItemRow>,
    val quotes: List<RfqQuoteRow>,
    /** The created order's number once converted — drives the green row. */
    val convertedOrderNumber: String?,
    /** awarded && convertedOrder==null && convertedOrderId blank. */
    val convertible: Boolean,
    val createdLabel: String?,
)

/** Buyer list page (GET api/rfq?role=buyer) — typed on ITS envelope type. */
fun ApiEnvelope<List<RfqRowDto>>.toRfqRows(): List<RfqRow> =
    data.orEmpty().map { it.toRfqRow() }

/** Buyer detail (GET api/rfq/{id}) — null when data is missing (shape drift). */
fun ApiEnvelope<RfqDetailDto>.toRfqDetail(): RfqDetail? {
    val data = data ?: return null
    return data.toRfqDetail()
}

/** List row mapper — labels precomputed, nothing invented. */
fun RfqRowDto.toRfqRow() = RfqRow(
    key = "rfq-$stableKey",
    id = id?.takeIf(String::isNotBlank),
    title = title?.takeIf(String::isNotBlank) ?: "Untitled RFQ",
    status = status?.takeIf(String::isNotBlank),
    statusLabel = rfqStatusLabel(status),
    summaryLabel = summaryLabelOf(quantity, unit, targetPrice),
    deliveryCity = deliveryCity?.takeIf(String::isNotBlank),
    deadlineLabel = deadlineLabelOf(deadline),
    quoteCount = quoteCount,
    quoteCountLabel = quoteCountLabelOf(quoteCount),
    description = description?.takeIf(String::isNotBlank),
    convertedOrderNumber = convertedOrderNumber?.takeIf(String::isNotBlank),
    convertible = convertibleOf(
        status = status,
        convertedOrderId = convertedOrderId,
        convertedOrderNumber = convertedOrderNumber,
    ),
    createdLabel = formatRelativeDate(createdAt).takeIf(String::isNotBlank),
    quotes = quotes.map { it.toQuoteRow() },
)

/** Detail mapper — the expanded card's payload of record. */
fun RfqDetailDto.toRfqDetail() = RfqDetail(
    // RfqDetailDto carries no stableKey — id with hash fallback (the
    // RfqRowDto.stableKey / SupportModels.toDomain key convention).
    key = "rfq-" + (id?.takeIf(String::isNotBlank) ?: "detail-${hashCode()}"),
    id = id?.takeIf(String::isNotBlank),
    title = title?.takeIf(String::isNotBlank) ?: "Untitled RFQ",
    description = description?.takeIf(String::isNotBlank),
    categorySlug = categorySlug?.takeIf(String::isNotBlank),
    status = status?.takeIf(String::isNotBlank),
    statusLabel = rfqStatusLabel(status),
    summaryLabel = summaryLabelOf(quantity, unit, targetPrice),
    buyerName = buyerName?.takeIf(String::isNotBlank),
    deliveryCity = deliveryCity?.takeIf(String::isNotBlank),
    deadlineLabel = deadlineLabelOf(deadline),
    items = items.map { it.toItemRow() },
    quotes = quotes.map { it.toQuoteRow() },
    convertedOrderNumber = convertedOrder?.orderNumber?.takeIf(String::isNotBlank)
        ?: convertedOrderNumber?.takeIf(String::isNotBlank),
    convertible = convertibleOf(
        status = status,
        convertedOrderId = convertedOrderId,
        convertedOrderNumber = convertedOrder?.orderNumber,
    ),
    createdLabel = formatRelativeDate(createdAt).takeIf(String::isNotBlank),
)

private fun RfqItemDto.toItemRow() = RfqItemRow(
    // RfqItemDto carries no stableKey — id with hash fallback.
    key = "ritem-" + (id?.takeIf(String::isNotBlank) ?: "item-${hashCode()}"),
    name = productName?.takeIf(String::isNotBlank) ?: "Unnamed item",
    specs = specifications?.takeIf(String::isNotBlank),
    qtyLabel = quantityLabelOf(quantity, unit),
    targetLabel = targetPrice?.takeIf { it > 0.0 }?.let { formatBdt(it) },
)

private fun RfqQuoteDto.toQuoteRow() = RfqQuoteRow(
    key = "rq-$stableKey",
    id = id?.takeIf(String::isNotBlank),
    supplierLabel = "Supplier",
    priceLabel = pricePerUnit?.takeIf { it > 0.0 }?.let { "${formatBdt(it)} / unit" },
    totalLabel = totalPrice?.takeIf { it > 0.0 }?.let { formatBdt(it) },
    deliveryLabel = deliveryDays?.takeIf { it > 0 }?.let { "${it}d delivery" },
    message = message?.takeIf(String::isNotBlank),
    status = status?.takeIf(String::isNotBlank),
    statusLabel = quoteStatusLabel(status),
    pending = status?.trim()?.lowercase(Locale.US) == "pending",
    accepted = status?.trim()?.lowercase(Locale.US) == "accepted",
)

private fun RfqDetailQuoteDto.toQuoteRow() = RfqQuoteRow(
    key = "rq-$stableKey",
    id = id?.takeIf(String::isNotBlank),
    supplierLabel = supplier?.displayName?.takeIf(String::isNotBlank) ?: "Supplier",
    priceLabel = pricePerUnit?.takeIf { it > 0.0 }?.let { "${formatBdt(it)} / unit" },
    totalLabel = totalPrice?.takeIf { it > 0.0 }?.let { formatBdt(it) },
    deliveryLabel = deliveryDays?.takeIf { it > 0 }?.let { "${it}d delivery" },
    message = message?.takeIf(String::isNotBlank),
    status = status?.takeIf(String::isNotBlank),
    statusLabel = quoteStatusLabel(status),
    pending = status?.trim()?.lowercase(Locale.US) == "pending",
    accepted = status?.trim()?.lowercase(Locale.US) == "accepted",
)

/* ─── label precomputes (pure JVM, main-thread like AdminModels) ─────────── */

/** RFQ status enum → display label (unknown values pass through raw). */
fun rfqStatusLabel(status: String?): String = when (status?.trim()?.lowercase(Locale.US)) {
    "open" -> "Open"
    "quoted" -> "Quoted"
    "awarded" -> "Awarded"
    "closed" -> "Closed"
    "expired" -> "Expired"
    else -> status?.takeIf(String::isNotBlank) ?: "Unknown"
}

/** Quote status enum → display label. */
fun quoteStatusLabel(status: String?): String = when (status?.trim()?.lowercase(Locale.US)) {
    "pending" -> "Pending"
    "accepted" -> "Accepted"
    "rejected" -> "Rejected"
    else -> status?.takeIf(String::isNotBlank) ?: "Pending"
}

/** "N quotes" / "1 quote" / "No quotes yet" — quoteCount is the real total. */
fun quoteCountLabelOf(count: Int): String = when {
    count <= 0 -> "No quotes yet"
    count == 1 -> "1 quote"
    else -> "$count quotes"
}

/** "120 pcs · target ৳1,500" — whichever parts the wire actually carries. */
private fun summaryLabelOf(quantity: Double?, unit: String?, targetPrice: Double?): String {
    val qty = quantityLabelOf(quantity, unit)
    val target = targetPrice?.takeIf { it > 0.0 }?.let { "target ${formatBdt(it)}" }
    return listOf(qty, target).filter { !it.isNullOrBlank() }.joinToString(" · ")
}

/** "120 pcs" / "120" / "" — never invents a unit. */
private fun quantityLabelOf(quantity: Double?, unit: String?): String {
    if (quantity == null || quantity <= 0.0) return ""
    val qty = if (quantity % 1.0 == 0.0) quantity.toLong().toString() else quantity.toString()
    val unitText = unit?.takeIf(String::isNotBlank) ?: return qty
    return "$qty $unitText"
}

/**
 * "Deadline in 3d · Jan 5, 2025" (or "Deadline today/tomorrow/passed") —
 * null when the instant is missing/unparsable, never invented. UTC parse
 * like formatAdminDate; day granularity from calendar dates in the device
 * zone so "tomorrow" means the real local tomorrow.
 */
private fun deadlineLabelOf(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    val parsed = runCatching {
        val utc = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
        utc.parse(iso.take(19))
    }.getOrNull() ?: return null
    val deadlineCal = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
        clear()
        time = parsed
    }
    val todayCal = Calendar.getInstance(TimeZone.getDefault())
    fun dayNumber(cal: Calendar): Long =
        cal.get(Calendar.YEAR) * 10_000L + cal.get(Calendar.MONTH) * 100L + cal.get(Calendar.DAY_OF_MONTH)
    val diffDays = dayNumber(deadlineCal) - dayNumber(todayCal)
    val relative = when {
        diffDays > 1L -> "Deadline in ${diffDays}d"
        diffDays == 1L -> "Deadline tomorrow"
        diffDays == 0L -> "Deadline today"
        else -> "Deadline passed"
    }
    val absolute = SimpleDateFormat("MMM d, yyyy", Locale.US).format(deadlineCal.time)
    return "$relative · $absolute"
}

/** awarded && no conversion markers yet → the Convert-to-Order CTA shows. */
private fun convertibleOf(status: String?, convertedOrderId: String?, convertedOrderNumber: String?): Boolean {
    val awarded = status?.trim()?.lowercase(Locale.US) == "awarded"
    val alreadyConverted = !convertedOrderId.isNullOrBlank() || !convertedOrderNumber.isNullOrBlank()
    return awarded && !alreadyConverted
}
