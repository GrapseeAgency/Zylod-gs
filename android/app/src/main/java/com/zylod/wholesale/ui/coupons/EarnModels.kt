package com.zylod.wholesale.ui.coupons

import com.zylod.wholesale.data.api.ApiEnvelope
import com.zylod.wholesale.data.api.EarnTaskDto
import kotlinx.serialization.Serializable

/**
 * Typed domain layer for the native Earn Coupons screen (the Task 111
 * reward-tasks rail). PURE KOTLIN — no Android imports: the ViewModel and
 * any future unit test use these models and mappers on the JVM as-is
 * (kotlinx.serialization keeps the cache snapshot storable).
 *
 * Wire contract (src/app/api/coupons/earn/route.ts):
 *  - GET returns active couponEarningTasks rows; for the signed-in buyer
 *    each row gains `claimed` and `progress { count, required, met }` where
 *    count is the buyer's REAL proof count (orders / reviews / wishlists /
 *    check-ins / winning spins / bulk lines counted server-side).
 *  - GUESTS get the bare rows — `claimed` and `progress` are absent — but
 *    the screen gates those callers at needsAuth (the web page wraps the
 *    rail in its AccountGate), so a guest row's nulls never reach a card.
 *  - POST { taskId } → 201 + the created userCoupons row (same shape the
 *    vault renders), 403 with the server's honest shortfall wording,
 *    409 "already claimed", 401 signed out.
 */

/** One row of the reward-tasks rail (GET /api/coupons/earn). */
@Serializable
data class EarnTask(
    val id: String,
    /** first_order | review | wishlist | bulk | milestone | spin | checkin. */
    val type: String,
    val title: String,
    val description: String,
    val rewardLabel: String,
    val rewardBDT: Double,
    /** Hex color from the task row ("#C8102E"); the screen parses it safely. */
    val iconColor: String?,
    val targetCount: Int,
    val claimed: Boolean,
    /** The buyer's REAL proof count vs the target (server-computed). */
    val progressCount: Int,
    val progressRequired: Int,
    val progressMet: Boolean,
) {
    /** Stable identity for LazyColumn keys and in-place claim updates. */
    val stableKey: String
        get() = id.ifBlank { "task-${hashCode()}" }

    /** Claimable only when the server's own proof check says met. */
    val claimable: Boolean
        get() = progressMet && !claimed

    /**
     * The honest button copy — the web page's three states verbatim: a
     * claimed task, a met target, or the live count/required progress.
     */
    val actionLabel: String
        get() = when {
            claimed -> "Claimed"
            progressMet -> "Claim reward"
            else -> "${progressCount.coerceAtLeast(0)} of ${progressRequired.coerceAtLeast(1)} done"
        }
}

/** EarnTaskDto → domain task row (safe fallbacks, never a blank card). */
fun EarnTaskDto.toEarnTask(): EarnTask {
    val progress = progress
    return EarnTask(
        id = id?.takeIf(String::isNotBlank) ?: stableKeyFallback(),
        type = type?.trim().orEmpty().ifBlank { "milestone" },
        title = title?.takeIf(String::isNotBlank) ?: "Reward task",
        description = description?.takeIf(String::isNotBlank).orEmpty(),
        rewardLabel = rewardLabel?.takeIf(String::isNotBlank) ?: "Discount voucher",
        rewardBDT = rewardBDT ?: 0.0,
        iconColor = iconColor?.takeIf(String::isNotBlank),
        targetCount = targetCount ?: progress?.required ?: 1,
        claimed = claimed == true,
        progressCount = progress?.count ?: 0,
        progressRequired = progress?.required ?: targetCount ?: 1,
        progressMet = progress?.met == true,
    )
}

private fun EarnTaskDto.stableKeyFallback(): String = "task-${hashCode()}"

/** data of a verified GET /api/coupons/earn envelope → task rows. */
fun ApiEnvelope<List<EarnTaskDto>>.earnTasks(): List<EarnTask> =
    data.orEmpty().map(EarnTaskDto::toEarnTask)

/** ৳50.0 → "৳50", ৳50.5 → "৳50.5" — reward money never prints ".0". */
internal fun formatRewardBdt(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString()
    else String.format(java.util.Locale.US, "%.2f", value)

/** Progress fraction for the LinearProgressIndicator (0f..1f). */
internal fun EarnTask.progressFraction(): Float = when {
    progressRequired <= 0 -> if (progressMet) 1f else 0f
    else -> (progressCount.toFloat() / progressRequired.toFloat()).coerceIn(0f, 1f)
}

/**
 * On-device saved tasks — the payload of the "native_earn_tasks_cache" key
 * in the shared "zylod_config" prefs file. Stores the DOMAIN list the
 * screen renders (not wire DTOs), so the offline render is byte-consistent
 * with the online one — the same doctrine as [CouponsCacheEnvelope].
 */
@Serializable
data class EarnCacheEnvelope(
    val savedAt: Long = 0L,
    val tasks: List<EarnTask> = emptyList(),
)
