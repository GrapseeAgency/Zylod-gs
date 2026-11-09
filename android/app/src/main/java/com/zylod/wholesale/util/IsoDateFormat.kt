package com.zylod.wholesale.util

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * t282 — the shared ISO-timestamp → "02 Oct 2026" display formatter for the
 * typed screens (recently-viewed rows, buyer-dashboard activity, product-Q&A
 * dates — the web pages' en-GB fmt() convention: day 2-digit, short month,
 * year).
 *
 * WHY NOT java.time: minSdk is 24 and the app has NO
 * coreLibraryDesugaring — java.time.* is API 26+, so an Instant.parse here
 * would crash on Android 7.x and fail CI lint's NewApi check. This helper
 * stays on the API-1 java.text stack: the ISO prefix is cut by hand, parsed
 * as UTC (the server emits UTC), then rendered in the device timezone —
 * the same wall-clock the web's toLocaleDateString shows.
 *
 * Honest fallback: an unparseable timestamp renders AS-IS (never blanked,
 * never faked).
 */
fun formatIsoDate(iso: String?): String {
    if (iso.isNullOrBlank()) return "—"
    val cut = iso.substringBefore('.').substringBefore('Z').trim()
    if (cut.length < 19) return iso
    return runCatching {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        parser.timeZone = TimeZone.getTimeZone("UTC")
        val parsed = parser.parse(cut) ?: return iso
        val formatter = SimpleDateFormat("dd MMM yyyy", Locale.US)
        formatter.format(Date(parsed.time))
    }.getOrDefault(iso)
}
