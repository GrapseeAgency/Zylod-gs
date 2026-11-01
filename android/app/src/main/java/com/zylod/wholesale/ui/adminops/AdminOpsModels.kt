package com.zylod.wholesale.ui.adminops

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * t265 — shared admin-operations formatters + status palette. Pure text /
 * color helpers ONLY (no layout): the screens call these inside remember(...)
 * blocks so formatted strings are not rebuilt per recomposition. Main-thread
 * use only (SimpleDateFormat / NumberFormat are not thread-safe) — the
 * ViewModels map rows on the main thread after the IO cache read, same as
 * AdminUsersViewModel.
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

fun adminOpsMoney(value: Double?): String =
    if (value == null || value.isNaN()) "—" else "৳" + moneyFormat.format(value)

/** Plain count text; null stays an honest dash, never a fabricated 0. */
fun adminOpsCount(value: Int?): String = value?.toString() ?: "—"

/** ISO instants on this batch's wire: "2024-05-05T10:00:00.000Z". */
private val adminOpsIsoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

private val adminOpsAbsoluteFormat = SimpleDateFormat("MMM d, yyyy HH:mm", Locale.US)

/**
 * Short date text for audit/inspection/payment/report rows: absolute
 * "Jan 5, 2025 14:30" (admin oversight cares about WHEN more than "3d ago").
 * Unparsable input yields "" so the caller drops the segment instead of
 * inventing one.
 */
fun adminOpsDate(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching { adminOpsIsoParser.parse(iso) }.getOrNull() ?: return ""
    return adminOpsAbsoluteFormat.format(parsed)
}

/** Date-or-dash helper for nullable wire dates — never an invented fallback. */
fun adminOpsDateOrDash(iso: String?): String = adminOpsDate(iso).ifBlank { "—" }

/**
 * Status → palette color for EVERY status this batch renders (union across
 * the eight surfaces). Green/red/orange/gray only: pending/under_review →
 * warning (orange), success/completed/active/action_taken/scheduled →
 * success (green), failed/cancelled/banned/suspended/refunded → error (red),
 * dismissed/inactive/unknown → onSurfaceVariant (gray).
 */
@Composable
fun adminOpsStatusColor(status: String?): Color = when (status?.trim()?.lowercase()) {
    "pending", "under_review" -> LocalZylodExtra.current.warning
    "success", "paid", "completed", "scheduled", "active", "action_taken", "approved" ->
        LocalZylodExtra.current.success
    "failed", "refunded", "cancelled", "banned", "suspended" -> MaterialTheme.colorScheme.error
    else -> MaterialTheme.colorScheme.onSurfaceVariant
}

/**
 * Low-alpha container of the status tint — badge backgrounds pair the tint
 * with a translucent surface of itself.
 */
@Composable
fun adminOpsStatusContainer(status: String?): Color = adminOpsStatusColor(status).copy(alpha = 0.12f)

/**
 * Admin-settings value/defaultValue → display text. The wire types these as
 * int-or-string-or-null (valueType decides); JsonPrimitive covers both, and
 * an explicitly saved empty string counts as "not set" (the route's own
 * rule), so blank content maps to null.
 */
fun adminOpsSettingValueText(raw: kotlinx.serialization.json.JsonElement?): String? {
    return when (raw) {
        null, is kotlinx.serialization.json.JsonNull -> null
        is kotlinx.serialization.json.JsonPrimitive -> raw.content.takeIf { it.isNotBlank() }
        else -> raw.toString()
    }
}
