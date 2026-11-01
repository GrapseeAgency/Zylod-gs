package com.zylod.wholesale.ui.sellerops

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * t266 — shared seller-operations formatters + status palette. Pure text /
 * color helpers ONLY (no layout): the screens call these inside remember(...)
 * blocks so formatted strings are not rebuilt per recomposition. Main-thread
 * use only (SimpleDateFormat / NumberFormat are not thread-safe) — the
 * ViewModels map rows on the main thread after the IO cache read, same as
 * the t265 AdminOpsModels convention.
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

fun sellerOpsMoney(value: Double?): String =
    if (value == null || value.isNaN()) "—" else "৳" + moneyFormat.format(value)

/** Plain count text; null stays an honest dash, never a fabricated 0. */
fun sellerOpsCount(value: Int?): String = value?.toString() ?: "—"

/**
 * Quantities arrive as Prisma Floats (orderItem.quantity, stockQuantity) so
 * they can be fractional; integral values render bare ("500"), fractional
 * ones keep up to two decimals ("12.50").
 */
fun sellerOpsQty(value: Double?): String {
    if (value == null || value.isNaN()) return "—"
    return if (value == value.toLong().toDouble()) value.toLong().toString() else moneyFormat.format(value)
}

/** Star-average text with ONE decimal (the route rounds to the same). */
fun sellerOpsRating(value: Double?): String =
    if (value == null || value.isNaN()) "—" else String.format(Locale.US, "%.1f", value)

/** ISO instants on this batch's wire: "2025-01-05T10:00:00.000Z". */
private val isoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

private val absoluteFormat = SimpleDateFormat("MMM d, yyyy HH:mm", Locale.US)

private val dayFormat = SimpleDateFormat("MMM d", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

/**
 * Short date text for ledger/payout/customer/review rows: absolute
 * "Jan 5, 2025 14:30". Unparsable input yields "" so the caller drops the
 * segment instead of inventing one.
 */
fun sellerOpsDate(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching { isoParser.parse(iso) }.getOrNull() ?: return ""
    return absoluteFormat.format(parsed)
}

/** Date-or-dash helper for nullable wire dates — never an invented fallback. */
fun sellerOpsDateOrDash(iso: String?): String = sellerOpsDate(iso).ifBlank { "—" }

/**
 * "Jan 5" from a plain "2025-01-05" day key — the sales-performance and
 * daily-series buckets are dates WITHOUT a time part, so the instant parser
 * above cannot read them as-is.
 */
fun sellerOpsDayLabel(dayKey: String?): String {
    if (dayKey.isNullOrBlank()) return ""
    val parsed = runCatching { isoParser.parse("${dayKey}T00:00:00") }.getOrNull() ?: return dayKey
    return dayFormat.format(parsed)
}

/**
 * Status → palette color for EVERY status this batch renders (union across
 * the eight surfaces). Green/red/orange/gray only: pending/processing/
 * under_review/shipped/packed/confirmed → warning (orange), completed/
 * delivered/paid/verified/active/success/approved → success (green),
 * failed/cancelled/rejected/returned/refunded → error (red),
 * inactive/unpaid/unknown → onSurfaceVariant (gray).
 */
@Composable
fun sellerOpsStatusColor(status: String?): Color = when (status?.trim()?.lowercase()) {
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
fun sellerOpsStatusContainer(status: String?): Color = sellerOpsStatusColor(status).copy(alpha = 0.12f)
