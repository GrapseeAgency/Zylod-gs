package com.zylod.wholesale.ui.coupons

import com.zylod.wholesale.data.api.ApiEnvelope
import com.zylod.wholesale.data.api.CouponVaultDto
import com.zylod.wholesale.data.api.PlatformCouponDto
import com.zylod.wholesale.data.api.RewardsDataDto
import kotlinx.serialization.Serializable
import kotlin.math.roundToInt

/**
 * Typed domain layer for the native My Coupons screen. PURE KOTLIN — no
 * Android imports here: the ViewModel and any future unit test can use these
 * models and mappers on the JVM as-is (kotlinx.serialization keeps the cache
 * snapshot storable, java.util.Locale formats money labels).
 *
 * Mappers are extension functions defined on the exact wire types declared
 * in CouponsApi.kt and called on those receivers: the row-level ones on
 * CouponVaultDto / PlatformCouponDto / RewardsDataDto, and the envelope-level
 * ones on ApiEnvelope of the matching list — the ViewModel only ever maps a
 * response body it has already verified (isSuccessful + success flag).
 *
 * Label doctrine: the server already builds display labels for vault rows
 * (userCoupons.discountLabel, e.g. "৳50 FLAT OFF" or "10% OFF"); the public
 * platform list ships raw numbers instead, so [defaultDiscountLabel] mirrors
 * the server's own label builder from coupons/claim/route.ts ("10% OFF" for
 * percentage, "৳X FLAT" for fixed) — the two sections never disagree.
 */

/** Voucher lifecycle, straight from the wire status strings of both routes. */
enum class CouponStatus { ACTIVE, USED, EXPIRED, UNKNOWN }

/** How the discount reads: percent of the order, flat taka, or free delivery. */
enum class CouponStyle { PERCENTAGE, FIXED, FREE_SHIPPING, UNKNOWN }

/** One voucher in the buyer's vault (GET /api/coupons/my, any status). */
data class CouponVaultItem(
    val id: String,
    val code: String,
    val title: String,
    val discountLabel: String,
    val style: CouponStyle,
    val status: CouponStatus,
    /** BDT value (flat taka off; for percentage rows the percent figure). */
    val savings: Double,
    val minOrder: Double,
    /** ISO timestamp, formatted by the screen layer only. */
    val validUntil: String?,
    val claimedAt: String?,
    val categoryLabel: String?,
) {
    /** Stable identity for LazyColumn keys and dedup. */
    val stableKey: String
        get() = id.ifBlank { "vault-${hashCode()}" }

    /** Only ACTIVE vouchers are spendable at checkout (server precedence). */
    val spendable: Boolean
        get() = status == CouponStatus.ACTIVE
}

/** One claimable row of the public campaign list (GET /api/coupons). */
data class PlatformCoupon(
    val id: String,
    val code: String,
    val style: CouponStyle,
    /** Wire discountPercent: the percent figure, or the flat taka amount. */
    val discountValue: Double,
    val discountLabel: String,
    val minOrder: Double,
    val maxDiscount: Double?,
    /** ISO timestamp, formatted by the screen layer only. */
    val validUntil: String?,
    /** usageLimit - usedCount; null when the server sets no usage limit. */
    val remainingUses: Int?,
    /** An earned voucher bound to one buyer — never offer a Claim button. */
    val personal: Boolean,
) {
    /** Stable identity for LazyColumn keys and dedup. */
    val stableKey: String
        get() = id.ifBlank { "coupon-${hashCode()}" }

    /** Claimable = public code with uses left (409s are kept off the UI). */
    val claimable: Boolean
        get() = !personal && (remainingUses == null || remainingUses > 0)
}

/** Loyalty points summary (GET /api/rewards), for the redeem-points rail. */
data class RewardsSummary(
    val points: Int,
    val tier: String?,
    val nextTier: String?,
    val pointsToNext: Int?,
    val progressPct: Int?,
)

// ── Row-level mappers (receiver: the wire DTO) ─────────────────────────────

/** CouponVaultDto → domain vault item (vault rows AND claim responses). */
fun CouponVaultDto.toVaultItem(): CouponVaultItem {
    val style = parseStyle(discountStyle)
    val savings = savingsBDT ?: 0.0
    return CouponVaultItem(
        id = id?.takeIf(String::isNotBlank) ?: stableKey,
        code = code?.trim().orEmpty().ifBlank { "--" },
        title = title?.takeIf(String::isNotBlank) ?: "Coupon",
        discountLabel = discountLabel?.takeIf(String::isNotBlank)
            ?: defaultDiscountLabel(style, savings),
        style = style,
        status = parseStatus(status),
        savings = savings,
        minOrder = minOrderBDT ?: 0.0,
        validUntil = validUntil,
        claimedAt = claimedAt,
        categoryLabel = categoryLabel?.takeIf(String::isNotBlank),
    )
}

/** PlatformCouponDto → domain claimable row. */
fun PlatformCouponDto.toPlatformCoupon(): PlatformCoupon {
    val style = when (discountType?.trim()?.lowercase()) {
        "percentage" -> CouponStyle.PERCENTAGE
        "fixed" -> CouponStyle.FIXED
        else -> CouponStyle.UNKNOWN
    }
    val value = discountPercent ?: 0.0
    return PlatformCoupon(
        id = id?.takeIf(String::isNotBlank) ?: stableKey,
        code = code?.trim().orEmpty(),
        style = style,
        discountValue = value,
        discountLabel = defaultDiscountLabel(style, value),
        minOrder = minOrderAmount ?: 0.0,
        maxDiscount = maxDiscount,
        validUntil = validUntil,
        remainingUses = usageLimit?.let { limit -> (limit - (usedCount ?: 0)).coerceAtLeast(0) },
        personal = !userId.isNullOrBlank(),
    )
}

/** RewardsDataDto → domain points summary. */
fun RewardsDataDto.toRewardsSummary(): RewardsSummary = RewardsSummary(
    points = balance ?: 0,
    tier = tier?.toTitleCase(),
    nextTier = nextTier?.tier?.toTitleCase(),
    pointsToNext = nextTier?.pointsNeeded,
    progressPct = nextTier?.progressPct,
)

// ── Envelope-level mappers (receiver: the verified ApiEnvelope) ────────────

/** data of a verified GET /api/coupons/my envelope → vault rows. */
fun ApiEnvelope<List<CouponVaultDto>>.vaultItems(): List<CouponVaultItem> =
    data.orEmpty().map(CouponVaultDto::toVaultItem)

/** data of a verified GET /api/coupons envelope → claimable rows. */
fun ApiEnvelope<List<PlatformCouponDto>>.platformCoupons(): List<PlatformCoupon> =
    data.orEmpty().map(PlatformCouponDto::toPlatformCoupon)

/** data of a verified GET /api/rewards envelope → points summary. */
fun ApiEnvelope<RewardsDataDto>.rewardsSummary(): RewardsSummary? =
    data?.toRewardsSummary()

// ── Offline snapshot (persists the DOMAIN state the screen renders) ────────

/**
 * On-device saved coupons — the payload of the "native_coupons_cache" key in
 * the shared "zylod_config" prefs file. The ViewModel renders domain models
 * (not wire DTOs), so the snapshot stores the domain lists directly — pure
 * Kotlin via kotlinx.serialization, byte-consistent with the online render.
 */
@Serializable
data class CouponsCacheEnvelope(
    val savedAt: Long = 0L,
    val active: List<CouponVaultItem> = emptyList(),
    val used: List<CouponVaultItem> = emptyList(),
    val available: List<PlatformCoupon> = emptyList(),
    val rewards: RewardsSummary? = null,
)

// ── Shared pure-Kotlin helpers ──────────────────────────────────────────────

private fun parseStatus(raw: String?): CouponStatus = when (raw?.trim()?.lowercase()) {
    "active" -> CouponStatus.ACTIVE
    "used" -> CouponStatus.USED
    "expired" -> CouponStatus.EXPIRED
    else -> CouponStatus.UNKNOWN
}

private fun parseStyle(raw: String?): CouponStyle = when (raw?.trim()?.lowercase()) {
    "percentage" -> CouponStyle.PERCENTAGE
    "fixed" -> CouponStyle.FIXED
    "free-shipping" -> CouponStyle.FREE_SHIPPING
    else -> CouponStyle.UNKNOWN
}

/**
 * Mirrors the label builder inside coupons/claim/route.ts: percentage rows
 * read "N% OFF", fixed rows read "৳X FLAT" (savingsBDT IS the flat amount —
 * the same column carries the percent figure for percentage rows).
 */
private fun defaultDiscountLabel(style: CouponStyle, value: Double): String = when (style) {
    CouponStyle.PERCENTAGE -> "${value.roundToInt()}% OFF"
    CouponStyle.FIXED -> "৳${formatBdtValue(value)} FLAT OFF"
    CouponStyle.FREE_SHIPPING -> "FREE DELIVERY"
    CouponStyle.UNKNOWN -> "৳${formatBdtValue(value)} OFF"
}

/** 50.0 → "50", 50.25 → "50.25" — no trailing ".0" on money labels. */
internal fun formatBdtValue(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString()
    else String.format(java.util.Locale.US, "%.2f", value)

/** "gold" → "Gold" — tier names arrive lowercase from the rewards route. */
private fun String.toTitleCase(): String =
    replaceFirstChar { if (it.isLowerCase()) it.titlecase(java.util.Locale.US) else it.toString() }
