package com.zylod.wholesale.util

import android.content.Context
import kotlin.math.abs

/** BDT price formatting — currency-store formatPrice semantics (৳, en-BD rounding). */
fun formatBdt(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + java.text.NumberFormat.getIntegerInstance().format(value.toLong())
    else "৳" + String.format(java.util.Locale.US, "%.2f", value)

fun compactCount(count: Int): String =
    if (count >= 1000) "${(count / 1000.0).toInt()}k" else count.toString()

/** Resolves relative /uploads/... URLs against the active server base. */
fun resolveImageUrl(raw: String?, serverUrl: String): String? {
    if (raw.isNullOrBlank()) return null
    if (raw.startsWith("http")) return raw
    if (raw.startsWith("/placeholder")) return null
    if (serverUrl.isBlank()) return null
    return serverUrl.trimEnd('/') + raw
}

/**
 * Client-side login rate limiter — port of src/lib/auth-security.ts:128-191
 * (`zylod-auth-ratelimit`): 5 failed attempts inside a 5-minute window →
 * 15-minute lockout, persisted in SharedPreferences. recordFailedAttempt on
 * every 401, reset on success — decrement-on-success is implicit (full reset),
 * matching the web semantics.
 */
object AuthRateLimit {

    data class Check(val limited: Boolean, val remainingMs: Long, val attemptsRemaining: Int)

    private const val PREFS = "zylod_auth_ratelimit"
    private const val KEY_ATTEMPTS = "attempts"
    private const val KEY_LAST = "lastAttempt"
    private const val KEY_LOCKED = "lockedUntil"
    private const val MAX_ATTEMPTS = 5
    private const val LOCKOUT_MS = 15 * 60 * 1000L
    private const val WINDOW_MS = 5 * 60 * 1000L

    fun check(context: Context): Check {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val lockedUntil = prefs.getLong(KEY_LOCKED, 0L)
        val last = prefs.getLong(KEY_LAST, 0L)
        val attempts = prefs.getInt(KEY_ATTEMPTS, 0)
        val now = System.currentTimeMillis()
        return when {
            lockedUntil > now -> Check(true, lockedUntil - now, 0)
            lockedUntil in 1 until now -> {
                reset(context)
                Check(false, 0, MAX_ATTEMPTS)
            }
            now - last > WINDOW_MS -> Check(false, 0, MAX_ATTEMPTS)
            else -> Check(false, 0, (MAX_ATTEMPTS - attempts).coerceAtLeast(0))
        }
    }

    fun recordFailedAttempt(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val last = prefs.getLong(KEY_LAST, 0L)
        val attempts = if (now - last > WINDOW_MS) 1 else prefs.getInt(KEY_ATTEMPTS, 0) + 1
        prefs.edit()
            .putInt(KEY_ATTEMPTS, attempts)
            .putLong(KEY_LAST, now)
            .putLong(KEY_LOCKED, if (attempts >= MAX_ATTEMPTS) now + LOCKOUT_MS else 0L)
            .apply()
    }

    fun reset(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}

data class MathCaptcha(val question: String, val answer: Int)

/**
 * Port of generateMathCaptcha (auth-security.ts:12-41): + − × questions,
 * shown after 2 failed login attempts (login-page.tsx:194-197).
 */
fun generateMathCaptcha(): MathCaptcha {
    val ops = listOf("+", "-", "×")
    val op = ops[abs(java.util.concurrent.ThreadLocalRandom.current().nextInt()) % ops.size]
    val rnd = java.util.concurrent.ThreadLocalRandom.current()
    return when (op) {
        "+" -> {
            val a = rnd.nextInt(50) + 10
            val b = rnd.nextInt(50) + 10
            MathCaptcha("$a $op $b = ?", a + b)
        }
        "-" -> {
            val a = rnd.nextInt(50) + 30
            val b = rnd.nextInt(30) + 1
            MathCaptcha("$a $op $b = ?", a - b)
        }
        else -> {
            val a = rnd.nextInt(12) + 2
            val b = rnd.nextInt(12) + 2
            MathCaptcha("$a $op $b = ?", a * b)
        }
    }
}
