package com.zylod.wholesale.ui.suppliercore

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * t267 — shared supplier-core formatters + status palette. Pure text /
 * color helpers ONLY (no layout): the screens call these inside remember(...)
 * blocks so formatted strings are not rebuilt per recomposition. Main-thread
 * use only (SimpleDateFormat / NumberFormat are not thread-safe) — the
 * ViewModels map rows on the main thread after the IO cache read, same as
 * the t266 SellerOpsModels convention.
 *
 * PALETTE RULE: green / red / orange / gray tones only — success and warning
 * come from LocalZylodExtra, red from MaterialTheme.colorScheme.error, gray
 * from onSurfaceVariant. No blue/indigo anywhere in this batch.
 */

/** ৳ money with ALWAYS 2 decimals + US grouping: 12500 → "৳12,500.00". */
private val moneyFormat: NumberFormat = NumberFormat.getNumberInstance(Locale.US).apply {
    minimumFractionDigits = 2
    maximumFractionDigits = 2
}

fun supplierCoreMoney(value: Double?): String =
    if (value == null || value.isNaN()) "—" else "৳" + moneyFormat.format(value)

/** Plain count text; null stays an honest dash, never a fabricated 0. */
fun supplierCoreCount(value: Int?): String = value?.toString() ?: "—"

/**
 * Quantities arrive as Prisma Floats (quantity, stockQuantity, moq,
 * moqPackCount) so they can be fractional; integral values render bare
 * ("500"), fractional ones keep up to two decimals ("12.50").
 */
fun supplierCoreQty(value: Double?): String {
    if (value == null || value.isNaN()) return "—"
    return if (value == value.toLong().toDouble()) value.toLong().toString() else moneyFormat.format(value)
}

/** Star-average text with ONE decimal (the route rounds to the same). */
fun supplierCoreRating(value: Double?): String =
    if (value == null || value.isNaN()) "—" else String.format(Locale.US, "%.1f", value)

/** ISO instants on this batch's wire: "2025-01-05T10:00:00.000Z". */
private val isoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

private val absoluteFormat = SimpleDateFormat("MMM d, yyyy HH:mm", Locale.US)

private val dayFormat = SimpleDateFormat("MMM d", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

/** t279 — date-only, UTC: membership/anniversary style dates have no
 *  meaningful time-of-day, and the old absoluteFormat (no timezone set)
 *  rendered a UTC createdAt in DEVICE-local time — "Jan 5, 2025 20:30Z"
 *  became "Jan 6, 2025 02:30" for the UTC+6 primary market (day shifted). */
private val dateOnlyFormat = SimpleDateFormat("MMM d, yyyy", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

/**
 * Short date text for order/sample/warehouse/directory rows: absolute
 * "Jan 5, 2025 14:30". Unparsable input yields "" so the caller drops the
 * segment instead of inventing one.
 */
fun supplierCoreDate(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching { isoParser.parse(iso) }.getOrNull() ?: return ""
    return absoluteFormat.format(parsed)
}

/** Date-or-dash helper for nullable wire dates — never an invented fallback. */
fun supplierCoreDateOrDash(iso: String?): String = supplierCoreDate(iso).ifBlank { "—" }

/** t279 — date-only UTC text ("Jan 5, 2025") for membership-style dates. */
fun supplierCoreDateOnly(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching { isoParser.parse(iso) }.getOrNull() ?: return ""
    return dateOnlyFormat.format(parsed)
}

/**
 * "Jan 5" from a plain "2025-01-05" day key — day keys WITHOUT a time part
 * cannot be read by the instant parser above as-is.
 */
fun supplierCoreDayLabel(dayKey: String?): String {
    if (dayKey.isNullOrBlank()) return ""
    val parsed = runCatching { isoParser.parse("${dayKey}T00:00:00") }.getOrNull() ?: return dayKey
    return dayFormat.format(parsed)
}

/**
 * Status → palette color for EVERY status this batch renders (union across
 * the five surfaces). Green/red/orange/gray only: pending/processing/
 * under_review/shipped/packed/confirmed → warning (orange), completed/
 * delivered/paid/verified/active/success/approved → success (green),
 * failed/cancelled/rejected/returned/refunded → error (red),
 * inactive/unpaid/unknown/suspended → onSurfaceVariant (gray).
 */
@Composable
fun supplierCoreStatusColor(status: String?): Color = when (status?.trim()?.lowercase()) {
    "pending", "processing", "under_review", "shipped", "packed", "confirmed" ->
        LocalZylodExtra.current.warning
    "completed", "delivered", "paid", "verified", "active", "success", "approved" ->
        LocalZylodExtra.current.success
    "failed", "cancelled", "rejected", "returned", "refunded" -> MaterialTheme.colorScheme.error
    else -> MaterialTheme.colorScheme.onSurfaceVariant
}

/**
 * Low-alpha container of the status tint — badge backgrounds pair the tint
 * with a translucent surface of itself.
 */
@Composable
fun supplierCoreStatusContainer(status: String?): Color = supplierCoreStatusColor(status).copy(alpha = 0.12f)
