package com.zylod.wholesale.ui.vip

import com.zylod.wholesale.data.api.VipDataDto
import com.zylod.wholesale.data.api.VipTierDto

/**
 * Shared models for the t260 VIP surfaces (pageIds vip-benefits,
 * vip-benefits-page, vip-club, vip-membership, vip-program). Same doctrine
 * as RewardsModels (t259), FinanceModels (t256) and CreditModels (t257):
 * NO Compose imports — this file owns the offline-cache key + envelope and
 * pure-Kotlin helpers only; the screen owns colors/fonts (it parses the
 * route's hex into Compose colors). FinanceCacheStore (the generic
 * read/write over SharedPreferences "zylod_config") is REUSED from
 * FinanceModels.kt — never redeclared.
 */
object VipCacheKeys {
    /** The ONE prefs file the whole native shell uses (FinanceCacheKeys.PREFS twin). */
    const val PREFS = "zylod_config"

    /** Last successful GET api/vip payload (ladder + current tier + spend). */
    const val VIP = "native_vip_cache"
}

/** Saved vip snapshot (GET api/vip) — the raw wire DTO, offline render matches live. */
@kotlinx.serialization.Serializable
data class CachedVip(val vip: VipDataDto? = null)

/**
 * The two web components the five vip pageIds map to (src/lib/page-chunks/
 * chunk-misc.ts): vip-benefits / vip-benefits-page render the
 * vip-benefits-page.tsx LADDER (tier cards + benefit bullets); vip-club /
 * vip-membership / vip-program render vip-membership-page.tsx (status
 * hero + fixed privileges) and gate sign-in there. ONE convention for the
 * whole batch: the layout branch lives on the pageId, nothing else.
 */
val VIP_LADDER_PAGE_IDS: Set<String> = setOf("vip-benefits", "vip-benefits-page")

/**
 * True when the pageId renders the web's vip-benefits-page component (the
 * un-gated tier ladder); false → the club hero layout (sign-in gated, the
 * web's AccountGate parity).
 */
fun vipIsLadder(pageId: String): Boolean = pageId in VIP_LADDER_PAGE_IDS

/**
 * Sanitized hex from the route's color field ('#78716C' style). Returns
 * null when absent/malformed — the screen falls back to its theme accent
 * instead of inventing a color. Accepts #RGB and #RRGGBB, nothing else.
 */
fun vipTierHex(color: String?): String? {
    val raw = color?.trim().orEmpty()
    if (!raw.startsWith("#")) return null
    val body = raw.drop(1)
    val valid = when (body.length) {
        3, 6 -> body.all { it.isDigit() || it in 'a'..'f' || it in 'A'..'F' }
        else -> false
    }
    return if (valid) raw else null
}

/**
 * The current tier's index in the ladder the route ordered (standard →
 * platinum). Falls back to 0 ('standard') for an unknown/absent token —
 * the route's own default for guests.
 */
fun vipTierIndex(currentTier: String?, tiers: List<VipTierDto>): Int {
    val token = currentTier?.trim()?.lowercase().orEmpty()
    return tiers.indexOfFirst { it.id?.trim()?.lowercase() == token }.takeIf { it >= 0 } ?: 0
}
