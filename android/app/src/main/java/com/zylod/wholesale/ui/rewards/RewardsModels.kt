package com.zylod.wholesale.ui.rewards

import com.zylod.wholesale.data.api.AffiliateDashboardDto
import com.zylod.wholesale.data.api.AffiliateProfileDto
import com.zylod.wholesale.data.api.CheckinStatusDto
import com.zylod.wholesale.data.api.LoyaltyStatusDto
import com.zylod.wholesale.data.api.ReferralsDataDto
import com.zylod.wholesale.data.api.RewardsBookDto
import com.zylod.wholesale.data.api.SpinHistoryEnvelope

/**
 * Shared models for the t259 rewards/referral/affiliate surfaces. Same
 * doctrine as [com.zylod.wholesale.ui.finance.FinanceModels] (t256),
 * MoneyModels (t258) and CreditModels (t257): NO Compose imports — this
 * file owns offline-cache keys + envelopes and pure-Kotlin token
 * lists/helpers only; the screens own colors/fonts. FinanceCacheStore (the
 * generic read/write over SharedPreferences "zylod_config") is REUSED from
 * FinanceModels.kt — never redeclared.
 */
object RewardsCacheKeys {
    /** The ONE prefs file the whole native shell uses (FinanceCacheKeys.PREFS twin). */
    const val PREFS = "zylod_config"

    /** Last successful GET api/rewards full book (balance/tier/catalog/history). */
    const val REWARDS_BOOK = "native_rewards_cache"

    /** Last successful GET api/rewards/loyalty tier card. */
    const val LOYALTY = "native_loyalty_cache"

    /** Last successful GET api/referrals code/stats/history payload. */
    const val REFERRALS = "native_referrals_cache"

    /** Last successful GET/POST api/affiliate enrollment status + profile. */
    const val AFFILIATE_STATUS = "native_affiliate_cache"

    /** Last successful GET api/affiliate/dashboard aggregates. */
    const val AFFILIATE_DASHBOARD = "native_affiliate_dashboard_cache"

    /** Last successful GET api/rewards/checkin status (streak + schedule + ledger). */
    const val CHECKIN = "native_checkin_cache"

    /** Last successful GET api/rewards/spin-history payload (rows + today counters). */
    const val SPIN_HISTORY = "native_spin_history_cache"
}

/* ─── offline cache envelopes (the raw wire DTOs — offline render matches live) ─── */

/** Saved rewards-book snapshot (GET api/rewards). */
@kotlinx.serialization.Serializable
data class CachedRewardsBook(val book: RewardsBookDto? = null)

/** Saved loyalty-status snapshot (GET api/rewards/loyalty). */
@kotlinx.serialization.Serializable
data class CachedLoyaltyStatus(val loyalty: LoyaltyStatusDto? = null)

/** Saved referrals snapshot (GET api/referrals). */
@kotlinx.serialization.Serializable
data class CachedReferralsData(val referrals: ReferralsDataDto? = null)

/** Saved affiliate-status snapshot (GET/POST api/affiliate). */
@kotlinx.serialization.Serializable
data class CachedAffiliateStatus(
    val enrolled: Boolean = false,
    val profile: AffiliateProfileDto? = null,
)

/** Saved affiliate-dashboard snapshot (GET api/affiliate/dashboard). */
@kotlinx.serialization.Serializable
data class CachedAffiliateDashboard(val dashboard: AffiliateDashboardDto? = null)

/* ─── t260 offline cache envelopes (the raw wire DTOs — offline matches live) ── */

/** Saved check-in status snapshot (GET api/rewards/checkin). */
@kotlinx.serialization.Serializable
data class CachedCheckinStatus(val status: CheckinStatusDto? = null)

/** Saved spin-history snapshot (GET api/rewards/spin-history, counters included). */
@kotlinx.serialization.Serializable
data class CachedSpinHistory(val envelope: SpinHistoryEnvelope? = null)

/* ─── the routes' REAL wire tokens (ladders + chips use the exact values) ── */

/**
 * The tier ladder EXACTLY as GET api/rewards computes it (rewards/route.ts
 * TIERS, on totalEarned): bronze 0 / silver 1,000 / gold 5,000 /
 * platinum 15,000. The loyalty route's own comment block spells the same
 * bands (Bronze 0-999, Silver 1,000-4,999, Gold 5,000-14,999,
 * Platinum 15,000+). Server truth — never invented benefits.
 */
val REWARD_TIERS: List<Pair<String, Int>> = listOf(
    "bronze" to 0,
    "silver" to 1_000,
    "gold" to 5_000,
    "platinum" to 15_000,
)

/** Index of the tier the given totalEarned sits in (the route's reduce). */
fun tierIndexFor(totalEarned: Int?): Int {
    val earned = totalEarned ?: 0
    return REWARD_TIERS.indices.fold(0) { acc, i -> if (earned >= REWARD_TIERS[i].second) i else acc }
}

/**
 * The tier token rendered with its first letter capitalized (web parity).
 */
fun tierLabel(tier: String?): String =
    tier?.trim()?.takeIf(String::isNotEmpty)
        ?.replaceFirstChar { it.uppercase() } ?: "—"

/**
 * A rewards-history row's chip tint family: earn → emerald, redeem →
 * amber, expire → rose, anything else → neutral (the ledger's own type
 * tokens; the points sign stays the row's truth — never re-signed here).
 */
enum class RewardTxTint { EMERALD, AMBER, ROSE, NEUTRAL }

fun rewardTxTint(type: String?): RewardTxTint = when (type?.trim()?.lowercase()) {
    "earn" -> RewardTxTint.EMERALD
    "redeem" -> RewardTxTint.AMBER
    "expire" -> RewardTxTint.ROSE
    else -> RewardTxTint.NEUTRAL
}

/** "+500" / "−500" — the ledger row's own sign, only the glyph added. */
fun formatSignedPoints(points: Int?): String {
    val value = points ?: 0
    return (if (value < 0) "−" else "+") + kotlin.math.abs(value).toString()
}

/**
 * The web's referred-merchant email mask (referral-earnings-page.tsx:146,
 * verbatim regex): "bu***@zylod.bd" — null/blank degrades to the web's own
 * fallback string 'Verified Merchant'.
 */
fun maskReferralEmail(email: String?): String {
    val value = email?.trim().orEmpty()
    if (value.isBlank()) return "Verified Merchant"
    val at = value.indexOf('@')
    if (at <= 2) return value
    return value.take(2) + "***" + value.substring(at)
}

/**
 * The affiliate status token → the web's "Active Partner" badge pair. Only
 * 'active' earns the badge (the schema's other tokens — suspended, pending
 * — render themselves verbatim, never masked as active).
 */
fun affiliateIsActive(status: String?): Boolean = status?.trim()?.lowercase() == "active"
