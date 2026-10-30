package com.zylod.wholesale.ui.wallet

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Pure-Kotlin wallet formatters — NO Android UI imports (the screen owns
 * colors/fonts; this file only owns text). The screen must call these inside
 * remember(...) blocks so formatted strings are not rebuilt per
 * recomposition; the shared NumberFormat/SimpleDateFormat singletons below
 * keep even the remember{} pass allocation-free. Main-thread use only
 * (SimpleDateFormat is not thread-safe).
 */

/** Shared integer formatter (Locale.US → "12,500" grouping), main-thread only. */
private val wholeFormat: NumberFormat = NumberFormat.getIntegerInstance(Locale.US)

/** Wallet transaction types that move money INTO the wallet. The wire
 * contract (schema.prisma walletTransactions.type comment + balance route
 * aggregation): deposit | withdrawal | payment | refund | cashback — the
 * amount column itself is always a positive magnitude. */
fun walletTxIsCredit(type: String?): Boolean = when (type?.trim()?.lowercase()) {
    "deposit", "refund", "cashback" -> true
    else -> false
}

/** BDT amount format: ৳ + thousands separators (12,500 → "৳12,500"; 99.5 → "৳99.50"). */
fun formatBdt(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + wholeFormat.format(value.toLong())
    else "৳" + String.format(Locale.US, "%.2f", value)

/**
 * "+৳1,200" / "-৳500" — the sign comes from the transaction DIRECTION, not
 * the raw wire value (the amount column is a positive magnitude; a negative
 * wire value is treated as a magnitude too).
 */
fun formatSignedBdt(type: String?, amount: Double): String {
    val magnitude = if (amount < 0) -amount else amount
    return (if (walletTxIsCredit(type)) "+" else "-") + formatBdt(magnitude)
}

/**
 * Relative date text, web-parity style: "just now", "5m ago", "2h ago",
 * "3d ago", then the absolute "Jan 5, 2025" short-month form (same parser
 * contract as OrdersScreen.formatDate: UTC ISO instant, unparsable input
 * yields "" so the caller can drop the segment instead of inventing one).
 */
fun formatRelativeDate(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching { isoParser.parse(iso) }.getOrNull() ?: return ""
    val deltaMs = System.currentTimeMillis() - parsed.time
    if (deltaMs < 0) return "just now" // clock skew — never a negative "ago"
    val minutes = deltaMs / 60_000L
    val hours = deltaMs / 3_600_000L
    val days = deltaMs / 86_400_000L
    return when {
        deltaMs < 60_000L -> "just now"
        hours < 1 -> "${minutes}m ago"
        days < 1 -> "${hours}h ago"
        days < 7 -> "${days}d ago"
        else -> absoluteFormat.format(parsed)
    }
}

/** ISO instants on the wallet wire: "2024-05-05T10:00:00.000Z". */
private val isoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

private val absoluteFormat = SimpleDateFormat("MMM d, yyyy", Locale.US)
